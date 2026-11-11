/**
 * 采集管线的确定性纯函数层。
 * 所有规则显式列出，不依赖运行时 AI 推断；可被 node --test 单测覆盖。
 */

export const COMPLAINT_RULES = [
  { id: "frustration", weight: 6, pattern: /\b(frustrat(?:ed|ing)|annoying|hate|terrible|awful|nightmare)\b/i },
  { id: "broken", weight: 6, pattern: /\b(broken|buggy|bug|crash(?:es|ed)?|fails?|failing|doesn'?t work|not working)\b/i },
  { id: "pain", weight: 5, pattern: /\b(pain point|painful|struggl(?:e|ing)|headache|waste of time)\b/i },
  { id: "wish", weight: 5, pattern: /\b(i wish|why is there no|is there any tool|alternative to|anyone know a way)\b/i },
  { id: "manual", weight: 4, pattern: /\b(manually|spreadsheet|copy and paste|workaround|hours every week)\b/i },
  { id: "churn", weight: 4, pattern: /\b(cancel(?:led|ling)?|switched away|abandoned|gave up on)\b/i },
];

export const WTP_RULES = [
  { id: "explicit_pay", pattern: /\b(i'?d pay|i would pay|willing to pay|happy to pay)\b/i },
  { id: "price_point", pattern: /\$\s?\d+(?:\.\d+)?\s*(?:\/\s*)?(?:mo|month|yr|year|per month|a month)\b/i },
  { id: "current_spend", pattern: /\b(currently paying|we pay|paying for|subscription costs?|budget of)\b/i },
  { id: "cost_of_problem", pattern: /\b(costs? (?:us|me) |losing \$|lost \$|hours? (?:a|per) week)\b/i },
];

/**
 * 非抱怨类标题的排除规则（全部显式列出，可被单测覆盖）。
 *
 * 背景：社区检索返回的多是「资讯标题 / 文章标题 / issue 标题」，直接拿标题
 * 匹配抱怨词会把 "Why Agile Often Fails"、"IPO buyers see valuation" 这类
 * 新闻当成用户抱怨。新闻标题、发行公告、CI 日志、多语言 issue 一律不是痛点。
 */
export const NOISE_TITLE_RULES = [
  { id: "hn_submission", pattern: /^(?:show|ask|tell)\s+hn\b/i },
  { id: "listicle", pattern: /^(?:the|top|n)\s+\d+\s+\b/i },
  { id: "editorial", pattern: /^(?:why|how|what|when|is|are)\b[\s\S]*\b(?:fails?|often|matters?|works?|readiness|guide|explained|vs\.?)\b/i },
  { id: "market_news", pattern: /\b(?:ipo|valuation|buyers? see|acquires?|acquisition|funding round|raises? \$|shares? (?:rise|fall)|earnings|revenue)\b/i },
  { id: "finance_figure", pattern: /\$\s?\d+(?:\.\d+)?\s*(?:t|b|m|bn|trillion|billion|million)\b/i },
  { id: "qa_log", pattern: /\b(?:qa run|not-run|pass\s*\/|checked in ci|ci pipeline|release notes?|changelog|v?\d+\.\d+\.\d+)\b/i },
  { id: "issue_prefix", pattern: /^\s*\[(?:bug|feat|feature|chore|fix|docs?)\]/i },
  // 开发任务 / 工单标题：祈使动词或 conventional-commit 前缀，是待办事项而非用户抱怨
  { id: "task_imperative", pattern: /^(?:create|add|implement|build|generate|update|refactor|support|introduce|enable|migrate|integrate|setup|set up|allow|provide|document)\b/i },
  { id: "conventional_commit", pattern: /^[a-z]+\([^)]{1,30}\):|^(?:feat|fix|chore|docs?|refactor|test|build|ci)(\s*[:!]|\s)/i },
  { id: "feature_request", pattern: /\[?(?:feature request|enhancement|proposal|rfc|todo)\]?\b/i },
  { id: "task_label", pattern: /^\s*\[(?:task|spec|epic|story|ticket|todo|tracker)\]/i },
  { id: "spec_prefix", pattern: /^(?:spec|epic|tracker)\s*[:—-]/i },
  { id: "non_ascii", pattern: /[^\x20-\x7e]/ },
  { id: "code_tick", pattern: /`/ },
];

/** 标题是否属于明确的非抱怨类内容（新闻、公告、日志、多语言 issue 等）。 */
export function isNoiseTitle(title = "") {
  const t = normalizeText(title);
  if (!t) return true;
  return NOISE_TITLE_RULES.some((r) => r.pattern.test(t));
}

/**
 * 按词边界截断标题，避免把 "Readiness in" 切成 "Readiness i" 这种半个单词。
 * 超出上限时回退到最后一个空格并追加省略号；中文等无空格文本按字符截断。
 */
export function truncateAtWord(text = "", maxLength = 96) {
  const s = normalizeText(text);
  if (s.length <= maxLength) return s;
  const cut = s.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= Math.floor(maxLength * 0.6) ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.·—–-]+$/g, "")}…`;
}

/** 命中的噪音规则 id，便于采集日志与人工复核。 */
export function noiseTitleReasons(title = "") {
  const t = normalizeText(title);
  return NOISE_TITLE_RULES.filter((r) => r.pattern.test(t)).map((r) => r.id);
}

export function clamp(value, min, max) {
  // 显式规则：NaN 取下界；±Infinity 视为越界并夹到对应边界；其余有限值正常夹取。
  if (Number.isNaN(value)) return min;
  if (value === Infinity) return max;
  if (value === -Infinity) return min;
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeText(input = "") {
  return String(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSignals(text = "") {
  const clean = normalizeText(text);
  const matched = COMPLAINT_RULES.filter((r) => r.pattern.test(clean));
  const wtp = WTP_RULES.filter((r) => r.pattern.test(clean)).map((r) => r.id);
  const intensityRaw = matched.reduce((sum, r) => sum + r.weight, 0);
  return {
    text: clean,
    signals: matched.map((r) => r.id),
    intensityRaw,
    wtpSignals: wtp,
    hasComplaint: matched.length > 0,
  };
}

/**
 * 0-100 证据分。五个维度权重合计 100，规则全部显式。
 * @param {object} p
 * @param {number} p.mentions 去重后的独立提及数
 * @param {string[]} p.sources 出现过的独立数据源 id
 * @param {number} p.intensityRaw 抱怨信号权重之和
 * @param {number} p.daysSinceLatest 最近一条讨论距今天数
 * @param {number} p.lookbackDays 观察窗口
 * @param {boolean} p.hasWtp 是否存在显式付费意愿
 */
export function scorePainPoint({
  mentions = 0,
  sources = [],
  intensityRaw = 0,
  daysSinceLatest = 999,
  lookbackDays = 30,
  hasWtp = false,
} = {}) {
  const frequency = clamp((mentions / 10) * 30, 0, 30);
  const intensity = clamp(intensityRaw, 0, 20);
  const recency = clamp(15 * (1 - daysSinceLatest / Math.max(1, lookbackDays)), 0, 15);
  const corroboration = clamp(new Set(sources).size * 5, 0, 20);
  const wtp = hasWtp ? 15 : 0;
  const score = Math.round(frequency + intensity + recency + corroboration + wtp);
  return {
    score,
    breakdown: {
      frequency: Number(frequency.toFixed(1)),
      intensity: Number(intensity.toFixed(1)),
      recency: Number(recency.toFixed(1)),
      corroboration: Number(corroboration.toFixed(1)),
      willingnessToPay: wtp,
    },
  };
}

function tokenSet(text) {
  return new Set(
    normalizeText(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "that", "this", "from", "have", "has", "are", "was", "you", "our", "but", "not", "too", "any", "all", "can", "get", "just", "how", "what", "why", "when"]);

export function jaccard(a, b) {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection += 1;
  return intersection / (sa.size + sb.size - intersection);
}

/** 按标题相似度合并重复项，保留最早的一条作为证据代表。 */
export function dedupe(items = [], threshold = 0.8) {
  const sorted = [...items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const groups = [];
  for (const item of sorted) {
    const group = groups.find((g) => jaccard(g.representative.title, item.title) >= threshold);
    if (group) group.members.push(item);
    else groups.push({ representative: item, members: [item] });
  }
  return groups.map((g) => ({
    ...g.representative,
    mentions: g.members.length,
    sources: [...new Set(g.members.map((m) => m.source))],
    evidence: g.members.slice(0, 5).map((m) => ({
      title: m.title,
      url: m.url,
      source: m.source,
      createdAt: m.createdAt,
      excerpt: m.text.slice(0, 220),
    })),
  }));
}

export function daysBetween(isoDate, now = new Date()) {
  const t = Date.parse(isoDate);
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}
