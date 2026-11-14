/**
 * 按需实时扫描（Live Scan）核心模块。
 *
 * 与定时管线的区别：定时管线是「先写死 4 个赛道，再按词抓」；这里是
 * 「用户给方向 → 现场检索公开讨论 → 去噪 → 归纳」。它决定了产品能否
 * 回答库外方向，而不是只能回答预置的 4 类。
 *
 * 协议约束：
 * - 只走 OpenAI Chat Completions 兼容协议，不引入任何厂商专有 SDK / 签名。
 * - 大模型是「增强」不是「依赖」：无密钥、超时、返回非法 JSON 时自动降级到
 *   确定性规则筛选，接口永远有结果或明确的「证据不足」，不会 5xx。
 * - 所有输出都标注 mode（llm / rules / no-evidence / vague），前端据此如实
 *   说明结果是怎么来的，不把规则筛选或兜底结果伪装成「智能分析」。
 *
 * 该模块被 app/api/scan/route.ts（服务端）与 node --test 单测共用；
 * 纯函数（normalizeQuery / queryTokens / scoreRows / buildSignals）不碰网络。
 */
import { createHash } from "node:crypto";
import { createCollector } from "./connectors.mjs";
import { appendQuery } from "./scan-store.mjs";

export const SOURCE_LABELS = {
  hn: "Hacker News",
  so: "StackOverflow",
  github: "GitHub Issues",
  rss: "RSS",
  firstParty: "Imported",
  reddit: "Reddit",
};

/** 这些是「元词」而非具体方向，硬搜只会得到一堆无关内容，直接引导用户说具体行业。 */
const VAGUE_QUERIES = new Set([
  "创意需求", "创意", "需求", "点子", "想法", "灵感", "创业点子", "随便",
  "测试", "test", "hello", "idea", "ideas", "startup ideas", "随便看看",
]);

/** 中文方向 → 英文检索词。英文平台内容占绝大多数，没有这层映射中文方向召回会接近 0。 */
const CN_EN_HINTS = {
  宠物: ["pet app", "pet care"], 健身: ["fitness app", "workout"],
  教育: ["education software", "edtech"], 电商: ["ecommerce", "checkout"],
  游戏: ["game development", "gaming"], 财务: ["finance app", "accounting"],
  招聘: ["recruiting software", "hiring"], 营销: ["marketing tool", "seo"],
  设计: ["design tool", "figma"], 医疗: ["healthcare software", "medical"],
  物流: ["logistics", "shipping"], 餐饮: ["restaurant software", "food delivery"],
  旅游: ["travel app", "booking"], 音乐: ["music app", "audio"],
  视频: ["video streaming", "video editing"], 写作: ["writing tool", "editor"],
  笔记: ["note taking", "notes app"], 日历: ["calendar", "scheduling"],
  邮件: ["email client", "inbox"], 客服: ["customer support", "helpdesk"],
  发票: ["invoice", "billing"], 预约: ["booking", "appointment"],
  创业: ["startup", "solo founder"], 独立开发: ["indie hacker", "solo developer"],
  摄影: ["photo editing", "photography"], 翻译: ["translation tool", "localization"],
  安全: ["security", "authentication"], 数据: ["data pipeline", "analytics"],
  智能家居: ["smart home", "home automation"], 汽车: ["automotive", "vehicle"],
  法律: ["legal tech", "law firm"], 房产: ["real estate", "property"],
  农业: ["agriculture", "farming"], 儿童: ["kids app", "parenting"],
};

const NOISE_RE = /(we'?re hiring|now hiring|job opening|apply now|\bjob alert\b|show hn:\s*(?:ask|launch)|salary|recruiter|sponsored|newsletter signup)/i;
const PAIN_RES = [
  /\b(bug|issue|error|fail(?:ed|s|ure)?|broken|crash|regression)\b/i,
  /\b(doesn'?t work|can'?t|unable to|not working|stuck|timeout|hangs?)\b/i,
  /\b(wish|feature request|would be nice|please add|missing|no way to)\b/i,
  /\b(frustrat|annoying|painful|workaround|confusing|inconsistent|slow)\w*/i,
  /\b(problem|complaint|limitation|unsupported|deprecated|rejected)\b/i,
];

/** 清洗用户输入：去控制字符、压空白、限长，防注入与超长检索词。 */
export function normalizeQuery(raw) {
  const q = String(raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return q.slice(0, 80);
}

/** 与 lib/signals.ts 的 searchSignals 同口径：中文连写词补两字片段。 */
export function queryTokens(q) {
  const raw = String(q).toLowerCase().split(/[\s,，、/|]+/).filter((t) => t.length >= 2);
  const terms = [];
  const add = (t) => { if (t && !terms.includes(t)) terms.push(t); };
  raw.forEach(add);
  for (const t of raw) {
    if (/^[\u3400-\u9fff]{3,}$/.test(t)) {
      for (let i = 0; i < t.length - 1; i += 1) add(t.slice(i, i + 2));
    }
  }
  return terms;
}

export function isVagueQuery(q) {
  return VAGUE_QUERIES.has(String(q).trim().toLowerCase());
}

/** 内置词典给中文方向补英文检索词；有密钥时再由大模型扩展。 */
export function hintTerms(q) {
  const out = [];
  for (const [cn, en] of Object.entries(CN_EN_HINTS)) {
    if (q.includes(cn)) out.push(...en);
  }
  return out;
}

const LLM_ENDPOINT_DEFAULT = "https://tokenhub.tencentmaas.com/v1/chat/completions";
const LLM_MODEL_DEFAULT = "hy-mt2-plus";

function llmConfig(env = {}) {
  const token = env.token ?? process.env.IDEARADAR_TRANSLATE_TOKEN ?? process.env.IDEARADAR_LLM_TOKEN ?? "";
  return {
    token,
    endpoint: env.endpoint ?? process.env.IDEARADAR_TRANSLATE_ENDPOINT ?? LLM_ENDPOINT_DEFAULT,
    model: env.model ?? process.env.IDEARADAR_TRANSLATE_MODEL ?? LLM_MODEL_DEFAULT,
  };
}

async function callLlm(system, payload, env, fetchImpl, timeoutMs = 20_000) {
  const cfg = llmConfig(env);
  if (!cfg.token) return null;
  const body = {
    model: cfg.model,
    temperature: 0.2,
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload) },
    ],
  };
  const res = await fetchImpl(cfg.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 把用户方向扩成 2–3 个英文检索词；失败/无密钥时退回内置词典 + 原文。 */
export async function expandQuery(q, env = {}, fetchImpl = fetch) {
  const base = [q, ...hintTerms(q)];
  if (!llmConfig(env).token || !/[\u3400-\u9fff]/.test(q)) {
    return dedupe(base).slice(0, 3);
  }
  try {
    const out = await callLlm(
      "You expand a product/market direction into 2-3 short English search phrases for finding real user complaints on GitHub Issues, Hacker News and Stack Overflow. Output ONLY a JSON object {\"terms\":[\"...\"]}. No explanation. Keep phrases concrete and searchable; never invent products.",
      { query: q, existing: base },
      env,
      fetchImpl,
      8_000,
    );
    const terms = Array.isArray(out?.terms) ? out.terms.filter((t) => typeof t === "string" && t.trim()) : [];
    return dedupe([...base, ...terms.map((t) => t.trim().slice(0, 40))]).slice(0, 3);
  } catch {
    return dedupe(base).slice(0, 3);
  }
}

function dedupe(arr) {
  const seen = new Set();
  return arr.filter((x) => {
    const k = String(x).toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * 确定性去噪 + 打分（纯函数，单测覆盖）。
 * 硬性要求：必须命中至少一个检索词，否则丢弃——这正是旧版「创意需求」
 * 只靠「需求」二字误命中就返回「预约取消」的根源。
 */
export function scoreRows(rows, terms) {
  // 每个检索词都要再按 token 展开：像 "pet app booking" 这样的英文短语，
  // 整串几乎不会出现在任何一条讨论里，只用整串匹配会把全部记录误判为不相关。
  const list = [];
  const add = (t) => { if (t && !list.includes(t)) list.push(t); };
  for (const item of (Array.isArray(terms) ? terms : [terms])) {
    queryTokens(String(item)).forEach(add);
  }
  const seen = new Set();
  const scored = [];
  for (const r of rows || []) {
    const url = String(r?.url || "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = String(r?.title || "").trim();
    const text = String(r?.text || "").trim();
    if (title.length < 8 || text.length < 30) continue;
    const hay = `${title} ${text}`.toLowerCase();
    if (NOISE_RE.test(hay)) continue;
    let hits = 0;
    for (const t of list) if (t && hay.includes(t)) hits += 1;
    if (hits === 0) continue;
    const painHits = PAIN_RES.filter((re) => re.test(hay)).length;
    const score = Math.min(92, 36 + hits * 9 + painHits * 7 + Math.min(10, Math.floor(text.length / 140)));
    scored.push({ ...r, title, text, hits, painHits, score });
  }
  return scored.sort((a, b) => b.score - a.score || b.painHits - a.painHits || b.text.length - a.text.length).slice(0, 24);
}

const SYS_ZH = `你是创业需求分析助手。用户给了一个方向，以及从 Hacker News、Stack Overflow、GitHub Issues 现场检索到的公开讨论记录。
只保留真实的用户抱怨、功能请求或反复出现的问题；丢弃招聘、新闻发布、纯技术闲聊、与该方向无关的内容。
每条输出必须能对应到给定记录（用字段 i 标注索引），不得编造事实、数字或来源。
用自然简洁的简体中文输出：title（痛点标题）、quote（该记录原文摘录的中文翻译，保留技术名词与接口路径）、gap（竞品空白或值得构建的机会，基于记录谨慎推断，不夸大）、score（0-100 证据强度）。
输出且仅输出一个 JSON 对象：{"items":[{"i":0,"title":"...","quote":"...","gap":"...","score":72}]}，最多 5 条，按 score 降序。`;

const SYS_EN = `You are a startup-demand analyst. The user gave a direction plus public discussion records freshly retrieved from Hacker News, Stack Overflow and GitHub Issues.
Keep only genuine user complaints, feature requests, or recurring problems. Discard job posts, announcements, pure chit-chat and anything off-topic.
Every item MUST map to a supplied record via its index field "i". Never invent facts, numbers or sources.
Output concise English: title, quote (verbatim excerpt), gap (competitor gap or build opportunity, inferred cautiously), score (0-100 evidence strength).
Output ONLY a JSON object: {"items":[{"i":0,"title":"...","quote":"...","gap":"...","score":72}]}, at most 5 items, sorted by score descending.`;

/** 大模型归纳；任何异常都返回 null，由调用方降级到规则模式。 */
export async function summarizeWithLlm(scored, q, locale, env = {}, fetchImpl = fetch) {
  if (!llmConfig(env).token || !scored.length) return null;
  const records = scored.slice(0, 14).map((r, i) => ({
    i,
    source: SOURCE_LABELS[r.source] || r.source,
    title: r.title,
    text: r.text.slice(0, 420),
  }));
  try {
    const out = await callLlm(locale === "zh" ? SYS_ZH : SYS_EN, { query: q, records }, env, fetchImpl);
    if (!Array.isArray(out?.items)) return null;
    const used = new Set();
    const items = [];
    for (const it of out.items) {
      const i = Number(it?.i);
      if (!Number.isInteger(i) || i < 0 || i >= records.length || used.has(i)) continue;
      const title = String(it?.title || "").trim();
      const quote = String(it?.quote || "").trim();
      const gap = String(it?.gap || "").trim();
      if (!title || !quote) continue;
      used.add(i);
      items.push({
        i,
        title: title.slice(0, 120),
        quote: quote.slice(0, 320),
        gap: (gap || (locale === "zh" ? "公开讨论中出现的真实问题，竞品覆盖情况尚待核实。" : "Reported in public discussions; competitor coverage not yet verified.")).slice(0, 260),
        score: Math.max(30, Math.min(95, Math.round(Number(it?.score) || scored[i].score))),
      });
      if (items.length >= 5) break;
    }
    return items.length ? items : null;
  } catch {
    return null;
  }
}

function flatSpark() {
  return Array.from({ length: 12 }, () => 0.5);
}

function liveId(url) {
  return `live-${createHash("sha1").update(url).digest("hex").slice(0, 12)}`;
}

/**
 * 把筛选/归纳结果构造成前端可直接渲染的 Signal[]。
 * 按需结果没有多时间点历史，trend 一律 steady、spark 为水平线——不伪造趋势。
 */
export function buildSignals(scored, q, locale, llmItems) {
  const zh = locale === "zh";
  const category = zh ? `实时检索 · ${q}` : `Live search · ${q}`;
  const fallbackGap = zh
    ? "来自刚检索到的公开讨论；尚未做竞品覆盖分析，不做结论性判断。"
    : "From freshly retrieved public discussions; no competitor analysis performed yet.";
  const make = (r, title, quote, gap, score, translated) => ({
    id: liveId(r.url),
    title,
    score,
    mentions: 1,
    sources: [SOURCE_LABELS[r.source] || r.source],
    category,
    trend: "steady",
    spark: flatSpark(),
    quote,
    gap,
    titleOriginal: r.title,
    quoteOriginal: r.text.slice(0, 320),
    translated,
  });

  if (Array.isArray(llmItems) && llmItems.length) {
    return llmItems.map((it) => {
      const r = scored[it.i] || scored[0];
      return make(r, it.title, it.quote, it.gap, it.score, zh);
    });
  }
  return scored.slice(0, 5).map((r) => make(
    r,
    r.title.slice(0, 120),
    r.text.slice(0, 320),
    fallbackGap,
    r.score,
    false,
  ));
}

/** 现场采集：复用 connectors.mjs 的合规公开源，并发、短超时、单平台可失败。 */
export async function collectRows(terms, { root = process.cwd(), errors = [], fetchImpl } = {}) {
  const cfg = { lookbackDays: 365, maxPerSource: 12, feeds: [] };
  const collector = createCollector({
    cfg,
    now: new Date(),
    root,
    errors,
    timeoutMs: 7_000,
    retries: 1,
    githubMinIntervalMs: 0,
    maxBackoffMs: 2_000,
  });
  const queries = dedupe(terms).slice(0, 3);
  const settled = await Promise.allSettled(
    queries.map((query) => collector.collectQuery(query, 12)),
  );
  const rows = [];
  settled.forEach((res) => {
    if (res.status === "fulfilled") rows.push(...res.value);
  });
  return rows;
}

/**
 * 编排一次按需扫描。返回 { items, mode, sources, terms, errors }。
 * mode 供前端如实标注：llm / rules / no-evidence / vague。
 */
export async function runLiveScan({ query, locale = "en", root = process.cwd(), env = {}, fetchImpl = fetch, collect = collectRows } = {}) {
  const q = normalizeQuery(query);
  const errors = [];
  if (!q) return { items: [], mode: "no-evidence", sources: [], terms: [], errors };
  if (isVagueQuery(q)) return { items: [], mode: "vague", sources: [], terms: [], errors };

  const terms = await expandQuery(q, env, fetchImpl);
  let rows = [];
  try {
    rows = await collect(terms, { root, errors });
  } catch (err) {
    errors.push({ source: "collector", message: String(err?.message || err) });
  }
  const scored = scoreRows(rows, terms);
  if (!scored.length) {
    return { items: [], mode: "no-evidence", sources: [], terms, errors };
  }
  const llmItems = await summarizeWithLlm(scored, q, locale, env, fetchImpl);
  const items = buildSignals(scored, q, locale, llmItems);
  return {
    items,
    mode: llmItems ? "llm" : "rules",
    sources: [...new Set(scored.map((r) => SOURCE_LABELS[r.source] || r.source))],
    terms,
    errors,
  };
}

/**
 * 第 3 步「沉淀」：记录按需扫过的方向，供 promote-niches.mjs 提升为定时采集赛道。
 *
 * 已委托给 scan-store.mjs 的 appendQuery（单一真源）：默认写本地文件，配了
 * IDEARADAR_STORE_URL 时写远端 REST，Vercel 等无持久文件系统也能闭环。
 * 保留旧签名 (query, meta, root) 供既有调用方/单测兼容；写入失败返回 false，
 * 不因写失败影响用户这次扫描结果。
 */
export async function recordQuery(query, meta = {}, root = process.cwd()) {
  const q = normalizeQuery(query);
  if (!q) return false;
  return appendQuery(q, meta, { root, env: process.env });
}
