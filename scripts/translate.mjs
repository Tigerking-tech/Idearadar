/**
 * IdeaRadar 内容层本地化（方案 B：GitHub Models 批量翻译）
 *
 * 为什么不是「实时翻译」：采集产物每 6 小时一批、内容静态。把译文在采集时
 * 一次性写进 opportunities.json，前端 SSR 直接吐中文 HTML —— 零运行时调用、
 * 零首屏延迟、零前端密钥，爬虫看到的也是中文 DOM（SEO/GEO 不退化）。
 *
 * 设计原则：
 * 1. 增量：按 id + 英文原文哈希（translationKey）复用上一批译文，不重翻。
 * 2. 免密钥：GitHub Actions 里用现成 GITHUB_TOKEN + permissions.models: read，
 *    OpenAI 兼容端点 models.github.ai/inference，无新增 Secret、无新增依赖。
 * 3. 非阻塞：无 token / 429 / 端点不可达 / 响应异常一律跳过并 warn，保留英文
 *    原文，进程 exit 0。采集与提交照常进行，翻译只是「有则更好」的增强层。
 * 4. 可插拔：endpoint / model 均可由环境变量覆盖，将来换自有 key 只改配置。
 * 5. 可测：核心逻辑导出为纯函数 translateItems()，fetch 可注入 mock。
 *
 * 用法：node scripts/translate.mjs
 * 输出：就地更新 data/opportunities.json 与 public/opportunities.json 的
 *      titleZh / quoteZh / translationKey 字段，并写入 translation 元信息。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quoteOf, translationKey } from "./ingest-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data", "opportunities.json");
const PUBLIC_PATH = path.join(ROOT, "public", "opportunities.json");

const DEFAULT_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_BATCH_SIZE = 10;
const MAX_ATTEMPTS = 2;
const TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You are a professional localisation engine for "IdeaRadar", a product that surfaces software pain points from public developer forums and issue trackers.

Translate the supplied English strings into natural, concise Simplified Chinese for a Chinese product manager audience.

Rules:
- Output ONLY a JSON array. No markdown fences, no prose, no commentary.
- Each output element must be an object with the same "id" as the input element, plus only the translated fields requested ("t" and/or "q").
- "t" is a short issue/feature title. Use a compact noun phrase, no trailing punctuation, no quotation marks.
- "q" is a verbatim user quote. Keep it faithful; never summarise, never add claims.
- Preserve technical and product tokens exactly as written: CSV, CRM, API, SDK, OAuth, webhook, Xero, QuickBooks, Stripe, Salesforce, Zendesk, Meta Lead Ads, Flask, BigDecimal, MathContext, HTTP, GitHub, AI, endpoint paths such as /bookings/{booking_id}, and code identifiers.
- Convey ALL-CAPS markers like WISH, ISSUES, FEATURE by meaning (e.g. 希望、问题、功能), not by transliteration.
- Every translated string MUST contain Chinese characters. Never echo the English input back unchanged.
- Never merge, drop, reorder or invent elements. The output array length must exactly match the input.`;

const USER_PREFIX = "Translate the following JSON array. For each element, return ONLY the fields present on that element:\n\n";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 中文译文才算有效，避免把英文原文或空串误当译文缓存下来。 */
export function hasChinese(s) {
  return typeof s === "string" && /[\u3400-\u9fff]/.test(s);
}

/** 只挑出缺失的字段送翻：已有 titleZh 的种子条目不会重翻标题。 */
export function fieldsToTranslate(item = {}) {
  const out = { id: item.id };
  if (!hasChinese(item.titleZh)) out.t = String(item.title || "");
  if (!hasChinese(item.quoteZh)) out.q = quoteOf(item);
  return out;
}

export function needsTranslation(item = {}) {
  return !hasChinese(item.titleZh) || !hasChinese(item.quoteZh);
}

/** 模型偶尔会包 markdown fence 或前后加一句话，用首个 [ 到最后一个 ] 兜住。 */
export function parseModelJson(raw) {
  let s = String(raw || "").trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("model output contains no JSON array");
  const parsed = JSON.parse(s.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("model output is not an array");
  return parsed;
}

async function callModel(batch, ctx, signal) {
  const res = await ctx.fetchImpl(ctx.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${ctx.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      model: ctx.model,
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PREFIX + JSON.stringify(batch) },
      ],
    }),
    signal,
  });
  if (!res || typeof res.ok === "undefined") throw new Error("fetch returned no Response-like object");
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 429 ? " (rate limited)" : ""}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("missing choices[0].message.content");
  return parseModelJson(content);
}

/**
 * 翻一批并做严格校验：条数、id 对齐、每个请求字段都有译文、译文含汉字。
 * 任一校验不过就把整批判失败（不写回半截译文），重试后仍失败则保留英文。
 */
export async function translateBatch(batch, ctx = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const signal = AbortSignal.timeout(ctx.timeoutMs ?? TIMEOUT_MS);
      const parsed = await callModel(batch, ctx, signal);
      if (parsed.length !== batch.length) throw new Error(`array length ${parsed.length} != ${batch.length}`);
      const byId = new Map(
        parsed.filter((x) => x && typeof x === "object" && x.id != null).map((x) => [String(x.id), x]),
      );
      const out = new Map();
      for (const b of batch) {
        const r = byId.get(String(b.id));
        if (!r) throw new Error(`missing id ${b.id} in model output`);
        const rec = {};
        if (Object.prototype.hasOwnProperty.call(b, "t")) {
          if (!hasChinese(r.t)) throw new Error(`invalid title translation for ${b.id}`);
          rec.titleZh = r.t.trim().slice(0, 200);
        }
        if (Object.prototype.hasOwnProperty.call(b, "q")) {
          if (!hasChinese(r.q)) throw new Error(`invalid quote translation for ${b.id}`);
          rec.quoteZh = r.q.trim().slice(0, 400);
        }
        out.set(String(b.id), rec);
      }
      return out;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await (ctx.sleepImpl || sleep)(1200 * attempt);
    }
  }
  throw lastErr || new Error("translation failed");
}

/**
 * 翻译整批 items（纯函数，不碰文件系统）。
 * 返回 { items, stats }；items 是新数组，失败条目保持原样（英文）。
 */
export async function translateItems(items = [], opts = {}) {
  const ctx = {
    endpoint: opts.endpoint || process.env.IDEARADAR_TRANSLATE_ENDPOINT || DEFAULT_ENDPOINT,
    model: opts.model || process.env.IDEARADAR_TRANSLATE_MODEL || DEFAULT_MODEL,
    token: opts.token ?? process.env.GITHUB_TOKEN ?? "",
    fetchImpl: opts.fetchImpl || fetch,
    sleepImpl: opts.sleepImpl || sleep,
    batchSize: Math.max(1, Number(opts.batchSize || process.env.IDEARADAR_TRANSLATE_BATCH || DEFAULT_BATCH_SIZE)),
    timeoutMs: opts.timeoutMs ?? TIMEOUT_MS,
  };
  const stats = {
    model: ctx.model,
    total: items.length,
    cached: 0,
    pending: 0,
    translated: 0,
    failed: 0,
    requests: 0,
    errors: [],
    skippedReason: null,
  };
  if (!ctx.token) {
    stats.skippedReason = "GITHUB_TOKEN 未设置";
    return { items, stats };
  }

  const out = items.map((x) => ({ ...x }));
  const pendingIdx = [];
  out.forEach((it, i) => {
    if (needsTranslation(it)) pendingIdx.push(i);
    else stats.cached += 1;
  });
  stats.pending = pendingIdx.length;
  if (!pendingIdx.length) return { items: out, stats };

  for (let start = 0; start < pendingIdx.length; start += ctx.batchSize) {
    const idxs = pendingIdx.slice(start, start + ctx.batchSize);
    const batch = idxs.map((i) => fieldsToTranslate(out[i]));
    try {
      const result = await translateBatch(batch, ctx);
      stats.requests += 1;
      for (const i of idxs) {
        const rec = result.get(String(out[i].id));
        if (!rec) continue;
        Object.assign(out[i], rec);
        // 缓存键基于英文原文，写回译文后仍用原文计算，保证下一轮可命中。
        out[i].translationKey = translationKey(out[i]);
        stats.translated += 1;
      }
    } catch (err) {
      stats.failed += idxs.length;
      stats.errors.push(String(err?.message || err));
    }
  }
  return { items: out, stats };
}

async function main() {
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
  } catch (err) {
    console.warn(`[translate] 无法读取采集产物，跳过：${err.message}`);
    return;
  }
  const { items, stats } = await translateItems(Array.isArray(raw.items) ? raw.items : []);
  if (stats.skippedReason) console.warn(`[translate] 跳过翻译：${stats.skippedReason}（保留英文原文，不影响采集）`);
  for (const e of stats.errors.slice(0, 5)) console.warn(`[translate] 批次失败（保留英文）：${e}`);
  for (const e of stats.errors.slice(5)) console.warn(`[translate]   ${e}`);

  const output = {
    ...raw,
    items,
    translation: {
      model: stats.model,
      at: new Date().toISOString(),
      status: stats.failed === 0 ? "ok" : stats.translated === 0 ? "skipped" : "partial",
      total: stats.total,
      cached: stats.cached,
      translated: stats.translated,
      failed: stats.failed,
      requests: stats.requests,
    },
  };
  const json = `${JSON.stringify(output, null, 2)}\n`;
  await fs.writeFile(DATA_PATH, json);
  await fs.writeFile(PUBLIC_PATH, json);
  console.log(
    `[translate] total=${stats.total} cached=${stats.cached} pending=${stats.pending} translated=${stats.translated} failed=${stats.failed} requests=${stats.requests}`,
  );
}

// 直接运行时才执行；被单测 import 时保持静默。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // 绝不因翻译失败让 Actions 变红：采集产物已经写好了。
    console.warn(`[translate] 未捕获异常，保留英文原文：${err?.message || err}`);
  });
}
