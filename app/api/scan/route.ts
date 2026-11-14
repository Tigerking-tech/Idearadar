/**
 * POST /api/scan — 按需实时检索公开讨论。
 *
 * 用户给的方向不在本地固定索引里时，前端调用此接口现场检索
 * Hacker News / Stack Overflow / GitHub Issues，去噪后返回与 Signal 同结构的结果。
 * 大模型密钥只在服务端读取（IDEARADAR_TRANSLATE_TOKEN 等），永不下发浏览器。
 *
 * 防护：查询串清洗限长、按 IP 的内存限流、同方向 10 分钟结果缓存、整体 25s 超时。
 * 任何下游失败都返回 200 + 明确的 mode（no-evidence / rules），不向用户抛 5xx。
 *
 * P1/P2 新增：
 * - 方向记录与高分候选统一走 scan-store.mjs（默认本地文件；配 IDEARADAR_STORE_URL
 *   时走远端 REST，Vercel 等无持久文件系统也能闭环），替代原来直接写单文件。
 * - 高分结果落盘为 scan-candidates.json，作为 promote-niches 的召回准入证据。
 * - 限流额度由 entitlement.mjs 决定：默认关闭（guest 20 次/10 分钟，行为不变），
 *   显式开启计费后按凭证提额。触发条件见 scripts/entitlement.mjs 顶部注释。
 */
import { NextRequest, NextResponse } from "next/server";
import { runLiveScan, normalizeQuery } from "../../../scripts/live-scan.mjs";
import { appendQuery, putCandidates } from "../../../scripts/scan-store.mjs";
import { resolveEntitlement, serverTokensFromEnv } from "../../../scripts/entitlement.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_PER_WINDOW = 20;
const CACHE_TTL_MS = 10 * 60 * 1000;
const OVERALL_TIMEOUT_MS = 25_000;
/** 落盘为候选证据的最低分（对应 promote-niches 的 EVIDENCE_MIN_SCORE）。 */
const CANDIDATE_MIN_SCORE = 55;

const buckets = new Map<string, { count: number; resetAt: number }>();
const cache = new Map<string, { at: number; payload: Record<string, unknown> }>();
/** 同一方向 60 秒内最多沉淀一次，避免刷新/重试把高频统计刷爆。 */
const recorded = new Map<string, number>();

function shouldRecord(key: string): boolean {
  const now = Date.now();
  if (now - (recorded.get(key) || 0) < 60_000) return false;
  recorded.set(key, now);
  return true;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return (req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

/** 解析 Bearer token；未开启计费时不影响任何行为。 */
function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim().slice(0, 128) : null;
}

function rateLimited(ip: string, maxPerWindow: number): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > maxPerWindow;
}

function prune() {
  const now = Date.now();
  // 项目 TS target 较低，直接 for...of Map 会触发 downlevelIteration 报错，统一走数组。
  Array.from(buckets.entries()).forEach(([k, v]) => {
    if (now > v.resetAt) buckets.delete(k);
  });
  Array.from(cache.entries()).forEach(([k, v]) => {
    if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  });
  if (cache.size > 300) {
    Array.from(cache.entries())
      .sort((a, b) => a[1].at - b[1].at)
      .slice(0, 100)
      .forEach(([k]) => cache.delete(k));
  }
}

/** 沉淀方向记录 + 高分候选，任何失败都只影响沉淀，不影响本次返回。 */
async function persist(query: string, locale: string, items: Record<string, unknown>[], mode: string, terms: string[]) {
  const storeOpts = { root: process.cwd() };
  await appendQuery(query, { hits: items.length, locale, mode }, storeOpts);
  const highScore = items.some((it) => (Number(it?.score) || 0) >= CANDIDATE_MIN_SCORE);
  if (highScore) {
    await putCandidates(query, items, { locale, mode, terms }, storeOpts);
  }
}

export async function POST(req: NextRequest) {
  let body: { query?: unknown; locale?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const query = normalizeQuery(body?.query);
  if (!query) return NextResponse.json({ error: "empty_query" }, { status: 400 });
  const locale = body?.locale === "zh" ? "zh" : "en";

  // 权益判定（默认关闭 → guest，20 次/窗口，与改造前完全一致）。
  // 会话读取刻意不在此处引入：付费判定当前只凭服务端配置的 API token，
  // 避免把 better-auth / prisma 拖进这个匿名高频接口。开启后如需会话提额，
  // 可在此处按需 await auth.api.getSession 并传入 session（见 README 第 10 节）。
  const entitlement = resolveEntitlement({
    env: process.env,
    apiToken: bearer(req),
    serverTokens: serverTokensFromEnv(process.env),
  });

  prune();
  if (!entitlement.unlimited && rateLimited(clientIp(req), entitlement.rateLimit ?? DEFAULT_MAX_PER_WINDOW)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "600" } });
  }

  const cacheKey = `${locale}:${query.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    // 命中缓存也算一次真实需求，否则用户反复搜同一方向永远累计不到扩赛道阈值。
    if (shouldRecord(cacheKey)) {
      const cachedPayload = hit.payload as { items?: Record<string, unknown>[]; mode?: string; terms?: string[] };
      await persist(
        query, locale,
        Array.isArray(cachedPayload.items) ? cachedPayload.items : [],
        String(cachedPayload.mode || "rules"),
        Array.isArray(cachedPayload.terms) ? cachedPayload.terms : [],
      );
    }
    return NextResponse.json({ ...hit.payload, cached: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const started = Date.now();
  let result;
  try {
    result = await Promise.race([
      runLiveScan({ query, locale }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("overall_timeout")), OVERALL_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    result = { items: [], mode: "no-evidence" as const, sources: [], terms: [], errors: [{ message: String((err as Error)?.message || err) }] };
  }

  const payload: Record<string, unknown> = {
    query,
    mode: result.mode,
    items: result.items,
    sources: result.sources,
    terms: result.terms,
    errors: result.errors,
    cached: false,
    elapsedMs: Date.now() - started,
    // 前端据此在「开启计费」时显示会员额度标签；默认关闭时为 guest，不展示。
    entitlement: { enabled: entitlement.enabled, tier: entitlement.tier, unlimited: entitlement.unlimited },
  };
  cache.set(cacheKey, { at: Date.now(), payload });

  // 只在真的做了检索且拿到结果时记录；元词与空结果不构成有效方向。
  if (result.mode !== "vague" && result.items.length && shouldRecord(cacheKey)) {
    await persist(query, locale, result.items as Record<string, unknown>[], result.mode, result.terms);
  }

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
