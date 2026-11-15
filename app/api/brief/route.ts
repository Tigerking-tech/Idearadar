/**
 * POST /api/brief — 为一条「实时检索到的原始线索」按需生成 8 段双语机会简报。
 *
 * 为什么独立成接口：主检索 /api/scan 有 25s 总超时且已叠加扩词 + 归纳两次
 * LLM 调用，再塞一份 8 段简报会超时并加剧 429。借鉴 Perplexity 的
 * 「progressive depth」：默认只给证据 + 判断框架，用户想深挖时点一下再单独
 * 生成简报。这一步完全隔离、fail-open、不拖慢也不污染主检索结果。
 *
 * 输入只有「真实标题 + 真实原话」，密钥只在服务端读取；内容严格 evidence-bound，
 * 由 idea-core 的 IDEA_SYSTEM_PROMPT + normalizeBrief 保证不编造、不含套话。
 * 任何失败都返回 200 + { brief: null }，前端据此保留框架视图，绝不留半截结果。
 */
import { NextRequest, NextResponse } from "next/server";
import { extractIdeaRecords } from "../../../scripts/idea.mjs";
import {
  IDEA_SYSTEM_PROMPT, IDEA_USER_PREFIX, normalizeBrief,
} from "../../../scripts/idea-core.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT_DEFAULT = "https://tokenhub.tencentmaas.com/v1/chat/completions";
const MODEL_DEFAULT = "hy-mt2-plus";
const TIMEOUT_MS = 14_000;

/** 极简内存限流：同一 IP 每 60s 最多 20 次，防止把按需接口当免费 LLM 代理。 */
const hits = new Map<string, { n: number; resetAt: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const b = hits.get(ip);
  if (!b || now > b.resetAt) { hits.set(ip, { n: 1, resetAt: now + 60_000 }); return false; }
  b.n += 1;
  if (hits.size > 500) {
    Array.from(hits.entries()).forEach(([k, v]) => { if (now > v.resetAt) hits.delete(k); });
  }
  return b.n > 20;
}
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

function clean(s: unknown, max: number): string {
  return String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: { title?: unknown; quote?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ brief: null, reason: "invalid_json" });
  }
  const title = clean(body?.title, 180);
  const quote = clean(body?.quote, 420);
  if (title.length < 6 || quote.length < 20) {
    return NextResponse.json({ brief: null, reason: "thin_evidence" });
  }
  if (limited(clientIp(req))) {
    return NextResponse.json({ brief: null, reason: "rate_limited" }, { status: 429 });
  }

  const token = process.env.IDEARADAR_TRANSLATE_TOKEN || process.env.IDEARADAR_LLM_TOKEN || "";
  const endpoint = process.env.IDEARADAR_TRANSLATE_ENDPOINT || ENDPOINT_DEFAULT;
  const model = process.env.IDEARADAR_TRANSLATE_MODEL || MODEL_DEFAULT;
  if (!token) return NextResponse.json({ brief: null, reason: "no_model" });

  const record = { k: "p0", title, titleZh: "", quote, niche: "", signals: [] };
  const payload = {
    model, temperature: 0.4, max_tokens: 2600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: IDEA_SYSTEM_PROMPT },
      { role: "user", content: IDEA_USER_PREFIX + JSON.stringify([record]) },
    ],
  };

  try {
    // 429 退避一次（与 idea.mjs 同款，按需单条很少触发）。
    let res: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      break;
    }
    if (!res || !res.ok) return NextResponse.json({ brief: null, reason: `http_${res?.status ?? "none"}` });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return NextResponse.json({ brief: null, reason: "empty" });
    const records = extractIdeaRecords(content); // 含按字段恢复尾部畸形
    const brief = normalizeBrief(records[0]?.brief); // 套话/编造闸门
    if (!brief) return NextResponse.json({ brief: null, reason: "rejected" });
    return NextResponse.json({ brief }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ brief: null, reason: String((err as Error)?.name || "error") });
  }
}
