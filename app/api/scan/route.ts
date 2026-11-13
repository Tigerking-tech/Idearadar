/**
 * POST /api/scan — 按需实时检索公开讨论。
 *
 * 用户给的方向不在本地 41 条固定索引里时，前端调用此接口现场检索
 * Hacker News / Stack Overflow / GitHub Issues，去噪后返回与 Signal 同结构的结果。
 * 大模型密钥只在服务端读取（IDEARADAR_TRANSLATE_TOKEN 等），永不下发浏览器。
 *
 * 防护：查询串清洗限长、按 IP 的内存限流、同方向 10 分钟结果缓存、整体 25s 超时。
 * 任何下游失败都返回 200 + 明确的 mode（no-evidence / rules），不向用户抛 5xx。
 */
import { NextRequest, NextResponse } from "next/server";
import { runLiveScan, recordQuery, normalizeQuery } from "../../../scripts/live-scan.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const CACHE_TTL_MS = 10 * 60 * 1000;
const OVERALL_TIMEOUT_MS = 25_000;

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

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > MAX_PER_WINDOW;
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

  prune();
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "600" } });
  }

  const cacheKey = `${locale}:${query.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    // 命中缓存也算一次真实需求，否则用户反复搜同一方向永远累计不到扩赛道阈值。
    if (shouldRecord(cacheKey)) {
      const payload = hit.payload as { items?: unknown[]; mode?: string };
      await recordQuery(query, {
        hits: Array.isArray(payload.items) ? payload.items.length : 0,
        locale,
        mode: String(payload.mode || "rules"),
      });
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
    errors: result.errors,
    cached: false,
    elapsedMs: Date.now() - started,
  };
  cache.set(cacheKey, { at: Date.now(), payload });

  // 第 3 步「沉淀」：记录按需扫过的方向，供 promote-niches.mjs 提升为定时采集赛道。
  // 只在真的做了检索且拿到结果时记录；元词与空结果不构成有效方向。
  if (result.mode !== "vague" && result.items.length && shouldRecord(cacheKey)) {
    await recordQuery(query, { hits: result.items.length, locale, mode: result.mode });
  }

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
