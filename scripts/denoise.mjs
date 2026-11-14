/**
 * IdeaRadar LLM 二次去噪（相关度方案 C）。
 *
 * 为什么独立成一步、放在翻译之后：
 * 1. 与采集管线「每步独立、可失败、可插拔」的约定一致。去噪是一种 LLM 连接器，
 *    不是采集的一部分；它挂了绝不能让 ingest / 翻译 / 数据提交变红。
 * 2. 翻译已把中文标题写进产物，LLM 同时看到中英文原文，判定比只看英文更准。
 * 3. 复用 translate.mjs 已验证的 TokenHub 协议（endpoint / model / json_object /
 *    parseModelJson），换厂商仍是那 3 个环境变量，业务逻辑一行不动。
 *
 * 核心纪律 —— fail-open，宁可放过不误杀：
 * - 只有模型对某条显式返回 keep:false 才剔除。缺字段 / 写错类型 / 批次失败 /
 *   无 token / 未启用 / 端点异常，一律保留原条目。
 * - 单轮驳回比例超过 DEFAULT_MAX_REJECT_RATIO 视为模型或 prompt 异常，整批回退，
 *   记 status=suspicious，避免一次抽风把好数据清空。
 * - 判定按 denoiseKey（= translationKey，id + 英文标题 + 引语）增量缓存到
 *   data/denoise.json。稳定条目不重复调用，每轮只判新增，API 成本可控。
 * - 被剔除条目合并写入 data/rejected.json（带 layer:"denoise" 与中文理由），
 *   供每周人工复核误杀；不覆盖人工策展层的驳回记录。
 *
 * 开关：IDEARADAR_DENOISE=1 才启用（默认关，避免本地误调 API 产生费用）；
 * 云端 workflow 默认传 1，可把仓库变量 IDEARADAR_DENOISE 设为 0 随时关闭。
 * 密钥复用 IDEARADAR_TRANSLATE_TOKEN，绝不写进仓库。
 *
 * 用法：node scripts/denoise.mjs
 * 输出：就地更新 data/opportunities.json + public/opportunities.json（移除噪声、
 *      写 denoise 元信息），增量写 data/denoise.json，合并写 data/rejected.json。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quoteOf, translationKey } from "./ingest-lib.mjs";
import { parseModelJson } from "./translate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data", "opportunities.json");
const PUBLIC_PATH = path.join(ROOT, "public", "opportunities.json");
const CACHE_PATH = path.join(ROOT, "data", "denoise.json");
const REJECTED_PATH = path.join(ROOT, "data", "rejected.json");
const CURATION_PATH = path.join(ROOT, "scripts", "curation.json");

const DEFAULT_ENDPOINT = "https://tokenhub.tencentmaas.com/v1/chat/completions";
const DEFAULT_MODEL = "hy-mt2-plus";
// 5 条/批（翻译是 8）：判定输出含中文理由，实测 8 条时偶发「漏 id / JSON 被截断」，
// 缩小批次可显著提高单批合法率，且失败时受影响的条目更少。
const DEFAULT_BATCH_SIZE = 5;
const MAX_ATTEMPTS = 2;
const TIMEOUT_MS = 90_000;
const MAX_TOKENS = 4000;
/**
 * 单轮驳回比例上限：超过即判定不可信，整批回退保留（防模型/prompt 抽风误杀）。
 * 真实数据噪声占比约 20~35%；实测 prompt 偏松时模型会把 48% 判成噪声并大量
 * 误杀具体 bug 报告，因此阈值压到 0.4 作为最后一道兜底。
 */
export const DEFAULT_MAX_REJECT_RATIO = 0.4;

export const CODES = Object.freeze([
  "complaint", "status-news", "issue-template", "announcement", "off-topic", "meta", "other",
]);
const CODE_SET = new Set(CODES);

const SYSTEM_PROMPT = `You are a relevance filter for "IdeaRadar", a product that surfaces REAL software pain points from public developer forums and issue trackers so founders can find product opportunities.

You receive records, each with an id, an English title, a Chinese title, a short verbatim quote, the topic niche and the source platforms. Decide whether each record is a genuine user problem worth showing, or noise.

CRITICAL DISTINCTION — never confuse "a user reporting a specific bug" with "a platform status announcement":
- "Service degradation on Microsoft 365", "Global Microsoft Outage", "X is down", "incident resolved" ARE official status news → REJECT.
- "Salesforce Bulk: a job is never recovered", "OAuth returns Error 9", "exposes passwords in 1,122 files", "export keeps breaking", "no POST request", "cannot be navigated via keyboard" ARE concrete user-reported bugs → KEEP, even though they mention failures or errors.

REJECT (keep:false) ONLY when the record is UNAMBIGUOUSLY one of these AND contains NO concrete user-reported broken behavior, friction or unmet need:
- status-news: an OFFICIAL platform status / incident announcement, a status page, or a downtime bulletin
- issue-template: an EMPTY issue/PR template, boilerplate skeleton, "## Problem", "Parent epic", "Planned:", "WISH:", TODO checklist, raw component/code scaffolding, or a feature SPEC written as a task list — with no user complaint in it
- announcement: release notes, changelog, launch/marketing copy, "we're hiring"
- off-topic: celebrity / movie / crypto price / giveaway / promo, or industry news unrelated to a software workflow
- meta: discussion ABOUT idea-discovery tools, surveys, or meta commentary instead of a pain point

KEEP (keep:true) — THIS IS THE DEFAULT — when the record contains ANY of:
- a specific broken behavior, error, data loss or failure (anything like "returns Error 9", "never recovered", "exposes passwords", "keeps breaking", "no POST request", "cannot be navigated")
- a concrete complaint, workaround, friction, or unmet feature request
- a repeated pain point with observable evidence

Rules:
- Output ONLY a JSON object {"items":[{"k":"...","keep":true|false,"code":"...","reason":"..."}]}, exactly one element per input, in the same order, with the same "k". No extra keys.
- "code" MUST be one of: complaint, status-news, issue-template, announcement, off-topic, meta, other.
- "reason" is ONE short Simplified Chinese sentence (<=40 chars), a single line with no line breaks and no unescaped double quotes.
- If you REJECT, "reason" MUST cite a specific phrase actually present in the title or quote that proves it is noise. Generic boilerplate such as "内容为服务故障相关说明" / "related to service failure" is FORBIDDEN. If you cannot cite such a phrase, KEEP.
- KEEP is the default. When in doubt, KEEP. Rejecting a real signal is far worse than leaving one noisy item.
- Never truncate, shorten or alter any "k". Copy it exactly from the input (e.g. "p12").
- No markdown fences, no prose, no commentary.`;

const USER_PREFIX = "Classify the following records. Return exactly one verdict per input element:\n\n";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 缓存键与译文缓存同源：id + 英文标题 + 引语前 160 字，原文不变即复用判定。 */
export function denoiseKey(item = {}) {
  return translationKey(item);
}

/**
 * 只送可核查的最小字段，不送 evidence 全文/评分，省 token 也避免模型被分数带偏。
 *
 * 关键：用短序号 k（"p0"、"p1"…）而非采集产物的长 id 作对齐键。实测超长 id
 * （如 scheduling-openai-structured-outputs-model-returns-null-or-...）常被模型
 * 截断或改写，导致整批 id 匹配不上、覆盖率过低而 fail-open 保留。短键彻底规避。
 * 单测不传 k 时退回 item.id，保持独立调用兼容。
 */
export function denoiseInput(item = {}, k = "") {
  return {
    k: String(k || item?.id || ""),
    title: String(item?.title || "").slice(0, 160),
    titleZh: typeof item?.titleZh === "string" ? item.titleZh.slice(0, 120) : "",
    quote: quoteOf(item).slice(0, 200),
    niche: String(item?.nicheLabel || item?.nicheId || "").slice(0, 80),
    sources: Array.isArray(item?.sources) ? item.sources.slice(0, 4).map(String) : [],
  };
}

/**
 * 归一化模型判定。核心 fail-open：只有显式 false 才剔除；
 * 任何缺失 / 非法类型都当作「保留」，绝不因模型输出不规范而误杀。
 */
export function normalizeVerdict(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const keep = !(raw.keep === false || raw.keep === "false");
  const rawCode = String(raw.code || "").trim();
  const code = CODE_SET.has(rawCode) ? rawCode : keep ? "complaint" : "other";
  const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, 80) : "";
  return { keep, code, reason };
}

/**
 * 解析判定数组。优先复用 translate.mjs 的 parseModelJson；模型偶尔在合法 JSON
 * 之后多吐一段文字或第二个对象（"Unexpected non-whitespace character after
 * JSON"），此时用括号配平扫描取「第一个完整数组」，不整批判失败。
 */
export function parseVerdictArray(raw) {
  try {
    return parseModelJson(raw);
  } catch {
    // 落到下面的配平扫描。
  }
  const s = String(raw || "").trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const t = fence ? fence[1].trim() : s;
  const start = t.indexOf("[");
  if (start < 0) throw new Error("no JSON array in model output");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        const parsed = JSON.parse(t.slice(start, i + 1));
        if (!Array.isArray(parsed)) throw new Error("extracted value is not an array");
        return parsed;
      }
    }
  }
  throw new Error("unterminated JSON array in model output");
}

/** 判定一批，校验 id 覆盖率；任一异常整批失败（由上层回退为保留）。 */
export async function judgeBatch(batch, ctx = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const body = {
        model: ctx.model,
        temperature: 0.1,
        max_tokens: ctx.maxTokens,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: USER_PREFIX + JSON.stringify({ items: batch }) },
        ],
      };
      if (ctx.jsonMode) body.response_format = { type: "json_object" };
      const post = (payload) =>
        ctx.fetchImpl(ctx.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${ctx.token}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(ctx.timeoutMs ?? TIMEOUT_MS),
        });
      let res = await post(body);
      // 少数兼容端点不认识 response_format 直接 400：去掉再试一次，不占重试次数。
      if (ctx.jsonMode && res && res.ok === false && res.status === 400) {
        const fb = { ...body };
        delete fb.response_format;
        res = await post(fb);
      }
      if (!res || typeof res.ok === "undefined") throw new Error("fetch returned no Response-like object");
      if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 429 ? " (rate limited)" : ""}`);
      const ctype = String(res.headers?.get?.("content-type") || "");
      if (ctype && !/json/i.test(ctype)) throw new Error(`endpoint returned ${ctype} instead of JSON`);
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error(`non-JSON response: ${String(err?.message || err).slice(0, 80)}`);
      }
      if (data?.error) throw new Error(`endpoint error: ${String(data.error.message || JSON.stringify(data.error)).slice(0, 140)}`);
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("missing choices[0].message.content");
      const parsed = parseVerdictArray(content);
      if (!parsed.length) throw new Error("empty verdict array");
      const byKey = new Map(
        parsed
          .filter((x) => x && typeof x === "object" && (x.k != null || x.id != null))
          .map((x) => [String(x.k ?? x.id), x]),
      );
      const out = new Map();
      for (const b of batch) {
        // 模型偶尔漏掉某条或把键拼错：不整批判失败，只跳过该条。
        // 上层没有 verdict 就按「保留」处理，且下轮因缓存缺失自动重判，不误杀。
        const key = String(b.k ?? b.id);
        const v = normalizeVerdict(byKey.get(key));
        if (v) out.set(key, v);
      }
      // 覆盖率过低说明模型整体答非所问，整批判失败，避免把「全保留」误记成成功判定。
      if (out.size < Math.ceil(batch.length / 2)) {
        throw new Error(`verdict coverage ${out.size}/${batch.length} too low`);
      }
      return out;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await (ctx.sleepImpl || sleep)(1200 * attempt);
    }
  }
  throw lastErr || new Error("denoise batch failed");
}

/**
 * 核心纯函数（不碰文件系统，fetch 可注入）。
 * @param {object[]} items 采集产物 items（最好已带中文译文）
 * @param {object} opts { enabled, token, cache:{verdicts}, fetchImpl, batchSize, maxRejectRatio, ... }
 * @returns {{items:object[], rejected:object[], verdicts:object, stats:object}}
 */
export async function denoiseItems(items = [], opts = {}) {
  const enabled = opts.enabled ?? (process.env.IDEARADAR_DENOISE === "1");
  const token = opts.token ?? process.env.IDEARADAR_TRANSLATE_TOKEN ?? "";
  const stats = {
    enabled,
    model: opts.model || process.env.IDEARADAR_TRANSLATE_MODEL || DEFAULT_MODEL,
    total: items.length,
    cached: 0,
    pending: 0,
    judged: 0,
    kept: items.length,
    rejected: 0,
    requests: 0,
    errors: [],
    status: "skipped",
    skippedReason: null,
    ratioGuard: false,
    forceKept: 0,
  };
  const verdicts = { ...((opts.cache && opts.cache.verdicts) || {}) };
  if (!enabled) {
    stats.skippedReason = "IDEARADAR_DENOISE 未设为 1（默认关闭，避免误调 API 产生费用）";
    return { items, rejected: [], verdicts, stats };
  }
  if (!token) {
    stats.skippedReason = "IDEARADAR_TRANSLATE_TOKEN 未设置（去噪复用翻译密钥）";
    return { items, rejected: [], verdicts, stats };
  }

  const ctx = {
    endpoint: opts.endpoint || process.env.IDEARADAR_TRANSLATE_ENDPOINT || DEFAULT_ENDPOINT,
    model: stats.model,
    token,
    fetchImpl: opts.fetchImpl || fetch,
    sleepImpl: opts.sleepImpl || sleep,
    batchSize: Math.max(1, Number(opts.batchSize || process.env.IDEARADAR_DENOISE_BATCH || DEFAULT_BATCH_SIZE)),
    maxTokens: Math.max(1, Number(opts.maxTokens || MAX_TOKENS)),
    jsonMode: opts.jsonMode ?? (process.env.IDEARADAR_TRANSLATE_JSON_MODE !== "0"),
    timeoutMs: opts.timeoutMs ?? TIMEOUT_MS,
  };
  const maxRejectRatio = Math.min(1, Math.max(0, Number(opts.maxRejectRatio ?? process.env.IDEARADAR_DENOISE_MAX_REJECT_RATIO ?? DEFAULT_MAX_REJECT_RATIO)));

  const out = items.map((x) => ({ ...x }));
  const pending = [];
  out.forEach((it, i) => {
    const v = verdicts[denoiseKey(it)];
    if (v && typeof v.keep === "boolean") stats.cached += 1;
    else pending.push(i);
  });
  stats.pending = pending.length;

  const at = new Date().toISOString();
  for (let start = 0; start < pending.length; start += ctx.batchSize) {
    const idxs = pending.slice(start, start + ctx.batchSize);
    const keys = idxs.map((_, n) => `p${start + n}`);
    const batch = idxs.map((i, n) => denoiseInput(out[i], keys[n]));
    try {
      const result = await judgeBatch(batch, ctx);
      stats.requests += 1;
      for (let n = 0; n < idxs.length; n += 1) {
        const i = idxs[n];
        const v = result.get(keys[n]);
        if (!v) continue;
        verdicts[denoiseKey(out[i])] = {
          ...v,
          id: String(out[i].id),
          title: String(out[i].title || "").slice(0, 120),
          at,
        };
        stats.judged += 1;
      }
    } catch (err) {
      // 该批没有写入任何 verdicts → 应用阶段视为「保留」，fail-open。
      stats.errors.push(String(err?.message || err).slice(0, 160));
    }
  }

  // 人工翻案通道：scripts/curation.json 的 forceKeepIds 列出的 id 永不被剔除，
  // 即使 LLM 判了 keep:false。发现误杀后把该 id（见 rejected.json 留痕）加进去即可。
  const keepIds = new Set((Array.isArray(opts.keepIds) ? opts.keepIds : []).map(String));
  const kept = [];
  const rejected = [];
  for (const it of out) {
    if (keepIds.has(String(it?.id ?? ""))) {
      stats.forceKept += 1;
      kept.push(it);
      continue;
    }
    const v = verdicts[denoiseKey(it)];
    if (v && v.keep === false) {
      rejected.push({
        id: String(it.id ?? ""),
        title: String(it.title || "").slice(0, 120),
        layer: "denoise",
        reasons: [`llm:${v.code}`],
        note: v.reason || "",
      });
    } else {
      kept.push(it);
    }
  }

  // 安全阀：驳回比例异常高时整批回退，宁可这轮不去噪也不清空数据。
  const ratio = out.length ? rejected.length / out.length : 0;
  if (ratio > maxRejectRatio) {
    stats.ratioGuard = true;
    stats.status = "suspicious";
    stats.kept = out.length;
    return { items: out, rejected: [], verdicts, stats };
  }

  stats.rejected = rejected.length;
  stats.kept = kept.length;
  stats.status = stats.errors.length ? "partial" : "ok";
  return { items: kept, rejected, verdicts, stats };
}

/** 把去噪驳回合并进 rejected.json（保留策展层记录，去重，附按层统计）。 */
export async function mergeRejected(rejected = [], at = new Date().toISOString(), doc = null) {
  let base = doc;
  if (!base) {
    try {
      base = JSON.parse(await fs.readFile(REJECTED_PATH, "utf8"));
    } catch {
      base = null;
    }
  }
  const prev = base && Array.isArray(base.items) ? base.items : [];
  const seen = new Set(prev.map((x) => String(x?.id ?? "")));
  const added = [];
  for (const r of rejected) {
    const id = String(r?.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    added.push(r);
  }
  const items = [...prev, ...added].slice(-300);
  return {
    ...(base || {}),
    schemaVersion: 1,
    generatedAt: at,
    count: items.length,
    curationCount: items.filter((x) => x?.layer !== "denoise").length,
    denoiseCount: items.filter((x) => x?.layer === "denoise").length,
    items,
  };
}

async function main() {
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
  } catch (err) {
    console.warn(`[denoise] 无法读取采集产物，跳过：${err.message}`);
    return;
  }
  const sourceItems = Array.isArray(raw.items) ? raw.items : [];
  let cache = { schemaVersion: 1, verdicts: {} };
  try {
    const d = JSON.parse(await fs.readFile(CACHE_PATH, "utf8"));
    if (d && d.verdicts && typeof d.verdicts === "object") cache = { ...cache, ...d };
  } catch {
    // 首次运行 / 缓存损坏：按空缓存处理，不阻塞。
  }

  // 人工翻案清单与策展规则同源，避免多造一个配置文件。
  let keepIds = [];
  try {
    const c = JSON.parse(await fs.readFile(CURATION_PATH, "utf8"));
    if (Array.isArray(c.forceKeepIds)) keepIds = c.forceKeepIds.map(String);
  } catch {
    keepIds = [];
  }
  const { items, rejected, verdicts, stats } = await denoiseItems(sourceItems, { cache, keepIds });
  // skippedReason 只在「未启用」或「无 token」时设置；stats 刻意不含密钥字段。
  if (stats.skippedReason) {
    if (stats.enabled) console.warn(`[denoise] 跳过：${stats.skippedReason}`);
    else console.log(`[denoise] 未启用，跳过（${stats.skippedReason}）`);
    return;
  }

  const at = new Date().toISOString();
  const output = {
    ...raw,
    items,
    totals: { ...(raw.totals || {}), opportunities: items.length },
    // cards / pinned 描述的是最终展示集合，随去噪重算；rejected 是策展层自身统计，保留。
    curation: {
      ...(raw.curation || {}),
      cards: items.filter((it) => it.opportunityCard).length,
      pinned: items.filter((it) => it.pinned).length,
    },
    denoise: {
      version: 1,
      at,
      model: stats.model,
      status: stats.status,
      enabled: stats.enabled,
      total: stats.total,
      cached: stats.cached,
      pending: stats.pending,
      judged: stats.judged,
      kept: stats.kept,
      rejected: stats.rejected,
      requests: stats.requests,
      ratioGuard: stats.ratioGuard,
      forceKeepIds: keepIds.length,
      forceKept: stats.forceKept,
      skippedReason: stats.skippedReason,
      errors: stats.errors.slice(0, 3),
    },
  };
  const json = `${JSON.stringify(output, null, 2)}\n`;
  await fs.writeFile(DATA_PATH, json);
  await fs.writeFile(PUBLIC_PATH, json);

  const rejectedDoc = await mergeRejected(rejected, at);
  await fs.writeFile(REJECTED_PATH, `${JSON.stringify(rejectedDoc, null, 2)}\n`);

  const cacheDoc = {
    schemaVersion: 1,
    updatedAt: at,
    model: stats.model,
    totalVerdicts: Object.keys(verdicts).length,
    verdicts,
  };
  await fs.writeFile(CACHE_PATH, `${JSON.stringify(cacheDoc, null, 2)}\n`);

  console.log(
    `[denoise] status=${stats.status} total=${stats.total} cached=${stats.cached} judged=${stats.judged} ` +
      `kept=${stats.kept} rejected=${stats.rejected} requests=${stats.requests}`,
  );
  if (stats.ratioGuard) console.warn("[denoise] 驳回比例超阈值，整批回退保留（status=suspicious）");
  for (const e of stats.errors.slice(0, 5)) console.warn(`[denoise] 批次失败（该批保留）：${e}`);
  console.log(`[denoise] rejected.json: curation=${rejectedDoc.curationCount} denoise=${rejectedDoc.denoiseCount}`);
}

// 直接运行时才执行；被单测 import 时保持静默。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // 绝不因去噪失败让 Actions 变红：采集与翻译产物已经写好了。
    console.warn(`[denoise] 未捕获异常，产物保持原样：${err?.message || err}`);
  });
}
