/**
 * IdeaRadar「一句话机会」生成脚本（L1 核心，命令行入口）。
 *
 * 纯逻辑（模板/归一化/人群映射）在 idea-core.mjs，零 node: 依赖，供 Next.js
 * 数据层与浏览器 bundle 共用；本文件只负责 IO 与 TokenHub 调用。
 *
 * 为什么需要这一步：站点原来把「别人的 bug 报告 / 技术工单」直接当「创业灵感」
 * 输出，用户读完只知道有人提了个需求，不知道自己能做什么。本模块把每条证据
 * 翻译成一句「给谁 + 做什么」的机会陈述，让首屏 10 秒内能读懂一个点子。
 *
 * 设计纪律（沿用项目「诚实、可插拔、fail-open」一贯约定）：
 * 1. 严格基于证据：prompt 明令只从给定标题/原话推导，禁止发明市场规模、竞品、
 *    营收、用户数、预测数字。不确定就写得保守，宁可平淡不可编造。
 * 2. fail-open 降级：无 token / 未启用 / 请求失败 / 非法 JSON / 覆盖率过低，
 *    一律回退到确定性模板 templateIdea()（动作导向、语言无关、零编造），
 *    绝不让管线变红，也绝不显示半截模型输出。
 * 3. 短键 k 对齐 + 增量缓存：复用 id+原文哈希作 ideaKey，稳定条目不重复调用；
 *    超长 id 送判时改用 p0/p1… 避免被模型截断。
 * 4. 中英双字段：headline/who/why/step 各含 zh/en，SSR 两语页共用同一份数据。
 *
 * 开关：IDEARADAR_IDEA=1 才调 LLM（默认关，避免本地误调产生费用）；关闭时
 * 仍可为全部条目写确定性模板，保证前端永远有可读的一句话机会。
 * 密钥复用 IDEARADAR_TRANSLATE_TOKEN，绝不写进仓库。
 *
 * 用法：node scripts/idea.mjs
 * 输出：就地更新 data/opportunities.json + public/opportunities.json（每条写
 *      idea 字段 + 顶层 ideaSummary 元信息），增量写 data/idea.json 缓存。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IDEA_VERSION, ideaKey, ideaInput, templateIdea, normalizeIdea,
  IDEA_SYSTEM_PROMPT, IDEA_USER_PREFIX,
} from "./idea-core.mjs";

// 纯逻辑统一从 idea-core re-export，保持既有 import "./idea.mjs" 的单测兼容。
export {
  IDEA_VERSION, NICHE_PERSONA, PERSONAS, PERSONA_LABEL,
  ideaKey, ideaInput, templateIdea, normalizeIdea,
} from "./idea-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data", "opportunities.json");
const PUBLIC_PATH = path.join(ROOT, "public", "opportunities.json");
const CACHE_PATH = path.join(ROOT, "data", "idea.json");

const DEFAULT_ENDPOINT = "https://tokenhub.tencentmaas.com/v1/chat/completions";
const DEFAULT_MODEL = "hy-mt2-plus";
// hy-mt2-plus 是翻译专用模型，一批多条时几乎必然把 items 数组只包第一条就
// 提前闭合，其余记录被摊平成外层对象字段（实测 15 批只采纳 15 条 LLM）。
// 一批一条时模型只生成单个对象，结构稳定、覆盖率接近 100%，代价只是请求数
// 变多（每批间隔节流 + 429 退避重试已在 generateIdeas/callIdeaBatch 内处理）。
const DEFAULT_BATCH_SIZE = 1;
const TIMEOUT_MS = 90_000;
const MAX_TOKENS = 1800;

async function callIdeaBatch(batch, ctx, signal) {
  const body = {
    model: ctx.model,
    temperature: 0.4,
    max_tokens: ctx.maxTokens,
    ...(ctx.jsonMode ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: IDEA_SYSTEM_PROMPT },
      { role: "user", content: IDEA_USER_PREFIX + JSON.stringify(batch) },
    ],
  };
  const post = (payload) => ctx.fetchImpl(ctx.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json",
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify(payload),
    signal,
  });
  const MAX_ATTEMPTS = 3;
  let res;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    res = await post(body);
    if (ctx.jsonMode && res && res.ok === false && res.status === 400) {
      const fb = { ...body };
      delete fb.response_format;
      res = await post(fb);
    }
    // 429 限流：退避后重试，避免与 translate/denoise 连续调用叠加触发。
    if (res && res.ok === false && res.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? "no-response"}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("empty model content");
  // 对象级配平提取：既能处理「JSON 后多吐一段」，也能救「数组少逗号/截断」，
  // 逐个抠出合法机会对象，最大化单批覆盖率（详见 extractIdeaRecords）。
  return extractIdeaRecords(content);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 对象级配平提取：hy-mt2-plus 即使开了 json_object 也常把 JSON 写坏 ——
 * 数组提前闭合、后续记录摊平成外层字段、末尾少一个 }、输出后多吐一段。
 *
 * 关键教训：数组级解析在这类畸形上会「成功」解析出一个只含第一条的不完整
 * 数组并提前返回，造成静默丢条（实测 15 批只采纳 15 条 LLM）。所以这里
 * 完全不信任数组语法：用「栈」记录每个 `{` 的位置，每个 `}` 闭合时单独
 * JSON.parse 该片段，逐个抠出带 k + headline 的完整记录，按 k 去重。
 * 合法包装 {"items":[...]} 同样会被扫到（外层展开 + 内部对象去重）。
 *
 * 返回按 k 数字排序（p0,p1…）的数组；一条都抠不出时抛错，交上层 fail-open。
 */
function sortIdeaRecords(records) {
  return records.sort((a, b) => {
    const na = Number(String(a.k).replace(/\D/g, "")) || 0;
    const nb = Number(String(b.k).replace(/\D/g, "")) || 0;
    return na - nb;
  });
}

export function extractIdeaRecords(raw) {
  const s = String(raw || "").trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const t = fence ? fence[1].trim() : s;
  const found = new Map(); // k -> record，天然去重

  const accept = (obj) => {
    if (!obj || typeof obj !== "object") return;
    // {"items":[...]} 包装：展开其中合法元素（递归一层即可）。
    if (Array.isArray(obj.items)) {
      for (const e of obj.items) if (e && typeof e === "object") accept(e);
      return;
    }
    if (obj.k != null && obj.headline && typeof obj.headline === "object") {
      const k = String(obj.k);
      if (!found.has(k)) found.set(k, obj);
    }
  };

  // 栈式逐对象扫描：嵌套对象、坏掉数组里的对象、外层未闭合都不影响逐条回收。
  const stack = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { stack.push(i); continue; }
    if (ch === "}") {
      const start = stack.pop();
      if (start === undefined) continue;
      let obj;
      try { obj = JSON.parse(t.slice(start, i + 1)); } catch { continue; }
      accept(obj);
    }
  }
  if (!found.size) throw new Error("no valid idea objects in model output");
  return sortIdeaRecords([...found.values()]);
}

/**
 * 给一批 items 生成「一句话机会」。
 * @param {object[]} items 采集产物条目
 * @param {object} opts 可注入 endpoint/model/token/fetchImpl/cache/enabled/batchSize
 * @returns {{items:object[], ideas:Record<string,object>, stats:object}}
 */
export async function generateIdeas(items = [], opts = {}) {
  const enabled = opts.enabled ?? (process.env.IDEARADAR_IDEA === "1");
  const token = opts.token ?? process.env.IDEARADAR_TRANSLATE_TOKEN ?? "";
  const ctx = {
    endpoint: opts.endpoint || process.env.IDEARADAR_TRANSLATE_ENDPOINT || DEFAULT_ENDPOINT,
    model: opts.model || process.env.IDEARADAR_TRANSLATE_MODEL || DEFAULT_MODEL,
    token,
    fetchImpl: opts.fetchImpl || fetch,
    jsonMode: opts.jsonMode ?? (process.env.IDEARADAR_TRANSLATE_JSON_MODE !== "0"),
    batchSize: Math.max(1, Number(opts.batchSize || process.env.IDEARADAR_IDEA_BATCH || DEFAULT_BATCH_SIZE)),
    maxTokens: Math.max(1, Number(opts.maxTokens || MAX_TOKENS)),
    timeoutMs: opts.timeoutMs ?? TIMEOUT_MS,
    // 批次间节流，避开 TokenHub 429（与 translate/denoise 同账号连续调用会叠加限流）。
    batchDelayMs: Number(opts.batchDelayMs ?? process.env.IDEARADAR_IDEA_DELAY ?? 1500),
    sleepImpl: opts.sleepImpl || sleep,
    callBatch: opts.callBatch || callIdeaBatch,
  };
  const stats = {
    enabled, model: ctx.model, total: items.length, cached: 0, generated: 0,
    templated: 0, requests: 0, errors: [], skippedReason: null,
  };
  const ideas = { ...(opts.cache || {}) };
  const out = items.map((x) => ({ ...x }));
  // 关闭 LLM：全部走确定性模板，仍让前端有可读的一句话机会（零 API 成本）。
  if (!enabled || !token) {
    stats.skippedReason = !enabled ? "IDEARADAR_IDEA!=1" : "IDEARADAR_TRANSLATE_TOKEN 未设置";
    for (let i = 0; i < out.length; i++) {
      out[i].idea = templateIdea(out[i]);
      ideas[ideaKey(out[i])] = out[i].idea;
      stats.templated += 1;
    }
    return { items: out, ideas, stats };
  }

  const pending = [];
  out.forEach((it, i) => {
    const key = ideaKey(it);
    const hit = ideas[key];
    // 只有 LLM 结果才算「已生成」可命中缓存。模板是失败/关闭时的兜底，
    // 必须留待下一轮重新尝试，否则一次 429/畸形 JSON 就会让该条永远停在模板。
    if (hit && hit.version === IDEA_VERSION && hit.origin === "llm" && typeof hit.headline?.zh === "string") {
      out[i].idea = hit;
      stats.cached += 1;
    } else {
      pending.push(i);
    }
  });

  for (let s = 0; s < pending.length; s += ctx.batchSize) {
    if (s > 0 && ctx.batchDelayMs > 0) await ctx.sleepImpl(ctx.batchDelayMs);
    const idxs = pending.slice(s, s + ctx.batchSize);
    const batch = idxs.map((i, j) => ideaInput(out[i], `p${j}`));
    try {
      const parsed = await ctx.callBatch(batch, ctx, AbortSignal.timeout(ctx.timeoutMs));
      stats.requests += 1;
      const byK = new Map(
        parsed.filter((x) => x && x.k != null).map((x) => [String(x.k), x]),
      );
      for (let j = 0; j < idxs.length; j++) {
        const i = idxs[j];
        const idea = normalizeIdea(byK.get(`p${j}`), out[i]);
        out[i].idea = idea;
        ideas[ideaKey(out[i])] = idea;
        if (idea.origin === "llm") stats.generated += 1;
        else stats.templated += 1;
      }
    } catch (err) {
      stats.errors.push(String(err?.message || err));
      // fail-open：整批失败时该批全部用确定性模板，绝不把半截模型输出写进产物。
      for (const i of idxs) {
        out[i].idea = templateIdea(out[i]);
        ideas[ideaKey(out[i])] = out[i].idea;
        stats.templated += 1;
      }
    }
  }
  return { items: out, ideas, stats };
}

async function loadJson(p, fallback) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

export async function main() {
  const raw = await loadJson(DATA_PATH, null);
  if (!raw || !Array.isArray(raw.items)) {
    console.warn("[idea] 采集产物不可用，跳过");
    return;
  }
  const cached = await loadJson(CACHE_PATH, {});
  const cache = cached && cached.verdicts ? cached.verdicts : {};
  const { items, ideas, stats } = await generateIdeas(raw.items, { cache });
  if (stats.skippedReason) console.log(`[idea] LLM 未启用（${stats.skippedReason}），全部用确定性模板`);
  for (const e of stats.errors.slice(0, 3)) console.warn(`[idea] 批次失败（该批回退模板）：${e}`);

  const status = !stats.enabled || stats.generated === 0
    ? "template"
    : stats.errors.length ? "partial" : "ok";
  const output = {
    ...raw,
    items,
    ideaSummary: {
      version: IDEA_VERSION,
      model: stats.model,
      at: new Date().toISOString(),
      enabled: stats.enabled,
      status,
      total: stats.total,
      cached: stats.cached,
      generated: stats.generated,
      templated: stats.templated,
      requests: stats.requests,
      errors: stats.errors.slice(0, 3),
    },
  };
  const json = `${JSON.stringify(output, null, 2)}\n`;
  await fs.writeFile(DATA_PATH, json);
  await fs.writeFile(PUBLIC_PATH, json);
  // 缓存只保留当前条目的判定，避免无限增长。
  const liveKeys = new Set(items.map(ideaKey));
  const pruned = {};
  for (const [k, v] of Object.entries(ideas)) if (liveKeys.has(k)) pruned[k] = v;
  await fs.writeFile(CACHE_PATH, `${JSON.stringify({
    schemaVersion: 1, version: IDEA_VERSION, generatedAt: new Date().toISOString(),
    totalVerdicts: Object.keys(pruned).length, verdicts: pruned,
  }, null, 2)}\n`);
  console.log(
    `[idea] total=${stats.total} cached=${stats.cached} generated=${stats.generated} templated=${stats.templated} requests=${stats.requests} status=${status}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => console.warn(`[idea] 未捕获异常，产物保持原样：${err?.message || err}`));
}
