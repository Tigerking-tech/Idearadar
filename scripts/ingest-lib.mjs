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
 *
 * 规则分三层，按「谁会污染发现流」组织：
 *  A. 通用社区噪音（HN 投稿前缀、榜单、社论、市场新闻、QA 日志、非 ASCII…）；
 *  B. 资讯 / 公告（发行公告、路线图、带日期的文章、公司动向、调查研究标题）——
 *     这些是「读者在看的资讯」，不是「某人在抱怨某工具」；
 *  C. 开发工单 / 规格文档（方括号标签、工单编号、PRD/spec/epic、code review 跟进）——
 *     这些是「团队待办」，同样不是用户痛点。
 * 所有 B/C 规则都要求高置信形态（前缀 / 冒号 / 编号 / 括号），避免误杀
 * "Configuration management is a nightmare" 这类真实的通用抱怨标题。
 */
export const NOISE_TITLE_RULES = [
  /* --- A. 通用社区噪音 --- */
  { id: "hn_submission", pattern: /^(?:show|ask|tell)\s+hn\b/i },
  { id: "listicle", pattern: /^(?:the|top|n)\s+\d+\s+\b/i },
  { id: "editorial", pattern: /^(?:why|how|what|when|is|are)\b[\s\S]*\b(?:fails?|often|matters?|works?|readiness|guide|explained|vs\.?)\b/i },
  { id: "market_news", pattern: /\b(?:ipo|valuation|buyers? see|acquires?|acquisition|funding round|raises? \$|shares? (?:rise|fall)|earnings|revenue)\b/i },
  { id: "finance_figure", pattern: /\$\s?\d+(?:\.\d+)?\s*(?:t|b|m|bn|trillion|billion|million)\b/i },
  { id: "qa_log", pattern: /\b(?:qa run|not-run|pass\s*\/|checked in ci|ci pipeline|release notes?|changelog|v?\d+\.\d+\.\d+)\b/i },
  { id: "issue_prefix", pattern: /^\s*\[(?:bug|feat|feature|chore|fix|docs?)\]/i },
  // 祈使动词开头的开发工单；但若标题里出现明确抱怨/故障语义（keeps breaking / are a pain / broken …），
  // 说明它是通用抱怨句而非待办工单，须保留 —— 否则会误杀 "Support chat transcripts are a pain to export"。
  { id: "task_imperative", pattern: /^(?:create|add|implement|build|generate|update|refactor|support|introduce|enable|migrate|integrate|setup|set up|allow|provide|document|extract|refresh)\b(?![\s\S]*\b(?:keeps?|crash(?:es|ed)?|fails?|failing|broken|buggy|bugs?|pain|painful|annoying|frustrat(?:ed|ing)|freez(?:e|es|ing)|slow|too\s+(?:complex|slow|expensive|hard|many|long|much|complicated|clunky)|loses?|losing|doesn'?t|does not|not working|hate|nightmare|headache|waste|struggl(?:e|ing)|terrible|awful|useless|killing)\b)/i },
  // 必须带冒号/感叹号才算 commit 前缀；早期允许 "feat " 无冒号，会误杀 "Build times are killing us"。
  { id: "conventional_commit", pattern: /^[a-z]+\([^)]{1,30}\):|^(?:feat|fix|chore|docs?|refactor|test|build|ci|release)\s*[:!]/i },
  { id: "feature_request", pattern: /\[?(?:feature request|enhancement|proposal|rfc|todo)\]?\b/i },
  { id: "task_label", pattern: /^\s*\[(?:task|spec|epic|story|ticket|todo|tracker)\]/i },
  { id: "spec_prefix", pattern: /^(?:spec|epic|tracker)\s*[:—-]/i },
  { id: "non_ascii", pattern: /[^\x20-\x7e]/ },
  { id: "code_tick", pattern: /`/ },

  /* --- B. 资讯 / 公告：读者在看的内容，不是用户抱怨 --- */
  { id: "announcement", pattern: /^(?:announcing|introducing|presenting|launching|releasing|shipping|now available|meet the|we'?re (?:excited|thrilled|launching|shipping))\b/i },
  { id: "roadmap", pattern: /\b(?:roadmap|what'?s (?:coming|next)|looking ahead|upcoming (?:release|features?)|release (?:plan|schedule)|future plans?|quarterly plan)\b/i },
  { id: "dated_article", pattern: /\(\s*(?:19|20)\d{2}\s*\)\s*$|^\s*\d{4}-\d{2}-\d{2}\s*$|\b(?:19|20)\d{2}-\d{2}-\d{2}\b/i },
  { id: "company_news", pattern: /\b(?:is back\b|is killing|is shutting down|is discontinuing|is sunsetting|pivots? to|imposes? (?:new )?rules|bypass \w+ restrictions|is going to sell)\b/i },
  { id: "study_headline", pattern: /\b(?:workdays? (?:up to \d+|longer)|study finds?|research shows?|survey finds?)/i },

  /* --- C. 开发工单 / 规格文档：团队待办，不是用户痛点 --- */
  // 通用方括号标签开头：[Bug] / [Feature Request] / [Consumer/Zoo/P1] / [$175] / [S175] / [engine] …
  { id: "bracket_prefix", pattern: /^\s*\[[^\]]{1,40}\]/ },
  // 工单编号开头：STORY-003-010: / FIN-04: / #123 / S11.13 / V4（后跟大写词的形态）
  { id: "ticket_id", pattern: /^(?:[A-Za-z]{2,8}[-_]\d[\w.-]*|#\d+|[A-Z]\d+(?:\.\d+)?\s+[A-Z]|[A-Z]\d+\s+[A-Z])/ },
  // 规格 / 文档类型前缀（要求冒号或破折号，避免误杀通用抱怨标题）
  { id: "doc_prefix", pattern: /^(?:prd|spec|epic|rfc|adr|program|initiative|proposal|architectural|architecture|configuration|idea|research|critical issue|bug report|known issue|design doc|design radar)\b\s*[:—-]/i },
  { id: "spec_suffix", pattern: /\b(?:MVP spec|spec sheet|design spec|technical spec)\b/i },
  { id: "review_followup", pattern: /\b(?:follow-up|residual (?:review )?findings|review findings|round \d+:|\(\s*#\d+\s*\)|sprite frames|whack-a-mole)/i },
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

/**
 * 把一批机会信号按 niche 聚合为单点快照：每个 niche 取「平均分 / 总提及 / 条目数」。
 * 这是趋势追踪的最小单元 —— 每次采集追加一个这样的快照到 history.json，
 * 时间序列积累后就能算出上升 / 平稳 / 过峰。
 */
export function aggregateByNiche(items = []) {
  const acc = {};
  for (const it of items) {
    const id = it?.nicheId || "unknown";
    if (!acc[id]) acc[id] = { scoreSum: 0, count: 0, mentions: 0 };
    acc[id].scoreSum += Number(it?.score) || 0;
    acc[id].count += 1;
    acc[id].mentions += Number(it?.mentions) || 0;
  }
  const out = {};
  for (const [id, v] of Object.entries(acc)) {
    out[id] = {
      score: Math.round(v.scoreSum / Math.max(1, v.count)),
      mentions: v.mentions,
      items: v.count,
    };
  }
  return out;
}

/** 解析历史 JSON，容忍空值 / 损坏内容，统一回退到空结构。 */
function parseHistory(prev) {
  if (!prev) return { schemaVersion: 1, seeded: false, maxSnapshots: 120, snapshots: [] };
  const obj = typeof prev === "string" ? safeParse(prev) : prev;
  if (!obj || !Array.isArray(obj.snapshots)) return { schemaVersion: 1, seeded: false, maxSnapshots: 120, snapshots: [] };
  return obj;
}
function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * 把本次快照追加进历史，按时间排序并只保留最近 maxSnapshots 条（滚动窗口）。
 * 同一时间戳的快照会被替换（幂等，便于重跑）。返回新的 history 对象（不修改入参）。
 */
export function appendHistory(prev, snapshot, maxSnapshots = 120) {
  const history = parseHistory(prev);
  const trimmed = Math.max(1, Number(maxSnapshots) || 120);
  let kept = history.snapshots.filter((s) => s?.t !== snapshot?.t);
  kept.push(snapshot);
  // 冷启动引导数据（snapshot.seeded=true）在真实快照攒够一个观察窗口后自动退役，
  // 保证趋势最终完全由真实采集驱动，且 seeded 标记随数据状态自动翻转。
  const realCount = kept.filter((s) => !s.seeded).length;
  if (realCount >= 12) kept = kept.filter((s) => !s.seeded);
  kept.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  return {
    ...history,
    schemaVersion: 1,
    seeded: kept.some((s) => s.seeded),
    maxSnapshots: trimmed,
    snapshots: kept.slice(-trimmed),
  };
}

/**
 * 趋势判定（趋势语义的单一真源，前端 signals.ts 直接复用，保证判定与单测一致）。
 * @param {{score:number, mentions:number}[]} series 按时间从早到晚排列的聚合序列
 * @returns {"rising"|"steady"|"peaked"}
 *
 * 规则：
 * - 少于 3 个快照 → "steady"（样本不足，诚实标注，不谎报上升）
 * - 近期提及量相对「近 12 点峰值」回落 ≥15% → "peaked"（已过峰）
 * - 近 6 点窗口内提及量相对起点上升 ≥15% → "rising"
 * - 其余 → "steady"
 * 峰值只看近 12 点，避免久远历史永久影响当前判定。
 */
export function classifyTrend(series = []) {
  if (!Array.isArray(series) || series.length < 3) return "steady";
  const window = series.slice(-Math.min(series.length, 6));
  const recent = series.slice(-12);
  const first = window[0];
  const last = window[window.length - 1];
  const peak = Math.max(...recent.map((s) => Number(s?.mentions) || 0));
  const firstM = Number(first?.mentions) || 0;
  const lastM = Number(last?.mentions) || 0;
  const dM = (lastM - firstM) / Math.max(1, firstM);
  if (peak >= 3 && lastM < peak * 0.85) return "peaked";
  if (dM > 0.15) return "rising";
  return "steady";
}

/* -------------------- B2：源头相关度（召回质量） -------------------- */

/**
 * 文本是否命中任一主题词（大小写不敏感，按非字母数字做边界，避免 "crm" 命中 "scrm"）。
 * terms 为空 / 未配置时返回 true —— 即「不设主题门槛」，兼容旧配置。
 * 纯函数、确定性，可被单测覆盖。
 */
export function matchTopic(text = "", terms = []) {
  if (!Array.isArray(terms) || terms.length === 0) return true;
  const t = normalizeText(text).toLowerCase();
  if (!t) return false;
  return terms.some((term) => {
    const w = String(term).toLowerCase().trim();
    if (!w) return false;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(t);
  });
}

/**
 * 从「召回的原始记录」构建机会信号 —— 采集脚本与离线评估脚本共用的单一真源。
 *
 * 判定链（与线上完全一致）：噪音标题 → 正文非空 → 正文抱怨信号 → 主题门槛
 * → 去重分组 → 评分 → 过滤低分 → 排序。评估脚本复用它，门禁判定才可信。
 *
 * @param {object[]} raw 召回记录 { title, text, url, createdAt, source }
 * @param {object} ctx
 * @param {object} ctx.niche 含 id / label / topicTerms
 * @param {object} ctx.cfg 含 minScore / lookbackDays
 * @param {Date} ctx.now 评估时间（注入以保证可复现）
 * @param {"any"|"title"} ctx.topicScope 主题门槛作用域：标题+正文 / 仅标题
 * @returns {{items:object[], stats:object, metrics:object}}
 */
export function buildOpportunities(raw = [], ctx = {}) {
  const { niche = {}, cfg = {}, now = new Date(), topicScope = "any" } = ctx;
  const terms = Array.isArray(niche.topicTerms) ? niche.topicTerms : [];
  const eligible = raw.filter((r) => !isNoiseTitle(r.title));
  const signaled = eligible
    .filter((r) => normalizeText(r.text).length > 0)
    .map((r) => {
      const sig = extractSignals(r.text);
      return {
        ...r,
        signals: sig.signals,
        intensityRaw: sig.intensityRaw,
        wtpSignals: sig.wtpSignals,
        hasComplaint: sig.hasComplaint,
      };
    })
    .filter((r) => r.hasComplaint)
    .filter((r) => {
      if (terms.length === 0) return true;
      const scope = topicScope === "title" ? r.title : `${r.title} ${r.text}`;
      return matchTopic(scope, terms);
    });

  const groups = dedupe(signaled);
  const items = [];
  for (const g of groups) {
    const excerpts = g.evidence.map((e) => e.excerpt).join(" ");
    const agg = extractSignals(excerpts);
    const latest = g.evidence.reduce(
      (max, e) => (e.createdAt > max ? e.createdAt : max),
      g.evidence[0]?.createdAt || now.toISOString(),
    );
    const { score, breakdown } = scorePainPoint({
      mentions: g.mentions,
      sources: g.sources,
      intensityRaw: agg.intensityRaw,
      daysSinceLatest: daysBetween(latest, now),
      lookbackDays: cfg.lookbackDays ?? 30,
      hasWtp: agg.wtpSignals.length > 0,
    });
    if (score < (cfg.minScore ?? 20)) continue;
    items.push({
      id: `${niche.id || "unknown"}-${g.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}`,
      nicheId: niche.id,
      nicheLabel: niche.label,
      title: truncateAtWord(g.title, 96),
      score,
      breakdown,
      mentions: g.mentions,
      sources: [...g.sources].sort(),
      signals: [...new Set(agg.signals)],
      willingnessToPay: agg.wtpSignals.length > 0,
      lastSeen: latest,
      evidence: g.evidence,
    });
  }
  items.sort((a, b) => b.score - a.score || b.mentions - a.mentions || a.id.localeCompare(b.id));
  return {
    items,
    stats: { raw: raw.length, complaintRecords: signaled.length, items: items.length },
    metrics: recallMetrics(raw, items, terms),
  };
}

/**
 * 召回质量指标。
 * - recallTitleRate：召回层「标题含主题词」比例（源头相关度，B2 真正改善的对象）；
 * - finalTitleRate：最终入选 items 里「标题含主题词」比例（用户实际看到的相关度）。
 */
export function recallMetrics(raw = [], items = [], terms = []) {
  const hit = (t) => matchTopic(t, terms);
  return {
    raw: raw.length,
    itemCount: items.length,
    recallTitleRate: raw.length ? raw.filter((r) => hit(r.title)).length / raw.length : 0,
    finalTitleRate: items.length ? items.filter((it) => hit(it.title)).length / items.length : 0,
  };
}

/**
 * 门禁判定（纯函数）。达标 adopt，否则 fallback（保留旧的时间排序），并给出理由。
 * - 数量底线：最终 items >= minItems；
 * - 质量底线：最终相关率 >= minFinalTitleRate；
 * - 不退化：新法相关率不得低于旧法超过 5 个百分点。
 */
export function evaluateRecall({ relevance = {}, legacy = null, minFinalTitleRate = 0.6, minItems = 24 } = {}) {
  const rel = relevance.metrics || relevance;
  const leg = legacy ? legacy.metrics || legacy : null;
  const reasons = [];
  const itemCount = Number(rel.itemCount) || 0;
  const rate = Number(rel.finalTitleRate) || 0;
  if (itemCount < minItems) reasons.push(`items ${itemCount} < ${minItems}`);
  if (rate < minFinalTitleRate) reasons.push(`finalTitleRate ${(rate * 100).toFixed(0)}% < ${(minFinalTitleRate * 100).toFixed(0)}%`);
  if (leg && rate < (Number(leg.finalTitleRate) || 0) - 0.05) {
    reasons.push(`regression vs legacy ${(rate * 100).toFixed(0)}% < ${((Number(leg.finalTitleRate) || 0) * 100).toFixed(0)}%`);
  }
  const verdict = reasons.length ? "fallback" : "adopt";
  return { verdict, method: verdict === "adopt" ? "relevance" : "legacy", reasons };
}

/**
 * 产物健全性判定（写文件前的最后一道闸，纯函数）。
 * 门禁+采集同轮连跑时若被限流，items 会塌到个位数；残缺数据一旦提交，
 * 还会追加畸形快照污染趋势历史。命中任一条件即拒绝写入。
 * @param {object} p
 * @param {number} p.itemCount 本次 items 数
 * @param {number} p.minHealthyItems 下限（<=0 表示跳过数量检查）
 * @param {{source:string,count:number}[]} p.sourceStats 各源行数
 * @param {{source:string,message:string}[]} p.errors 采集错误
 * @returns {string[]} 拒绝理由；空数组表示健康
 */
export function healthCheck({ itemCount = 0, minHealthyItems = 16, sourceStats = [], errors = [] } = {}) {
  const rows = (id) => sourceStats.filter((s) => s.source === id).reduce((sum, s) => sum + s.count, 0);
  const rateLimited = errors.some((e) => /HTTP (403|429)/.test(e?.message || ""));
  const reasons = [];
  if (minHealthyItems > 0 && itemCount < minHealthyItems) reasons.push(`items ${itemCount} < ${minHealthyItems}`);
  if (rateLimited && (rows("github") === 0 || rows("hn") === 0)) {
    reasons.push(`主源被限流且 0 行 (github=${rows("github")}, hn=${rows("hn")})`);
  }
  return reasons;
}

/* ----------------------- 内容层本地化（中文译文） ----------------------- */

/**
 * signals 是固定枚举标签（churn / broken / manual ...），不该交给翻译模型：
 * 用词典本地化即可让「竞品空白」在中文页不冒英文单词，且完全可单测。
 * 未知标签原样保留，避免静默丢信息。
 */
export const SIGNAL_LABELS_ZH = Object.freeze({
  churn: "客户流失",
  wish: "功能愿望",
  manual: "手工操作",
  broken: "功能故障",
  pain: "使用痛点",
  frustration: "使用挫败",
  feature_request: "功能请求",
  complexity: "过于复杂",
  missing: "能力缺失",
  integration: "集成困难",
  delay: "响应迟缓",
  pricing: "定价不满",
  data_loss: "数据丢失",
  performance: "性能问题",
  security: "安全顾虑",
});

export function localizeSignalLabels(signals = []) {
  return (Array.isArray(signals) ? signals : []).map((s) => SIGNAL_LABELS_ZH[s] ?? s);
}

/** 引语来自 evidence[0].excerpt（采集端已截到 220 字符），与前端 quote 同源。 */
export function quoteOf(item = {}) {
  const excerpt = item?.evidence?.[0]?.excerpt;
  return String(typeof excerpt === "string" ? excerpt.trim() : item?.title || "").slice(0, 240);
}

/**
 * 译文缓存键：id + 英文标题 + 引语前 160 字。
 * 原文没变就复用上一批译文，避免每 6 小时把 37 条重翻一遍。
 */
export function translationKey(item = {}) {
  const s = `${item?.id || ""}\u0000${item?.title || ""}\u0000${quoteOf(item).slice(0, 160)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * 采集会重写 opportunities.json；把上一批译文继承到「同 id、同原文」的新 item 上，
 * 让译文缓存随产物文件走 —— 零新增数据文件，也不会在 rebase 时多出冲突源。
 */
export function inheritTranslations(prevItems = [], nextItems = []) {
  const prev = new Map((Array.isArray(prevItems) ? prevItems : []).filter((x) => x && x.id).map((x) => [x.id, x]));
  return (Array.isArray(nextItems) ? nextItems : []).map((it) => {
    const old = prev.get(it.id);
    if (!old || old.title !== it.title) return it;
    const key = translationKey(it);
    // 采集每 6 小时重写一次 evidence，excerpt 常因截断位置略有浮动。
    // 标题是首屏主展示，只绑定「同 id + 同英文标题」，绝不让引语缓存键抖动冲掉中文；
    // 引语是证据链，绑定完整原文，原文变了就留给翻译步骤重翻（失败时诚实回退英文）。
    const quoteUnchanged = !old.translationKey || old.translationKey === key;
    const out = { ...it };
    // 新条目若已自带译文（例如人工修订过）优先保留，绝不被上一批覆盖。
    if (!out.titleZh && typeof old.titleZh === "string" && old.titleZh.trim()) out.titleZh = old.titleZh;
    if (quoteUnchanged && !out.quoteZh && typeof old.quoteZh === "string" && old.quoteZh.trim()) out.quoteZh = old.quoteZh;
    if (out.titleZh || out.quoteZh) out.translationKey = key;
    return out;
  });
}

/* --------------------------- 人工策展层（Curate） --------------------------- */

/**
 * 排除词命中判定：纯英文/数字词按词边界匹配（避免 "app" 命中 "appointment"、
 * "movie" 命中 "remove" 这类子串误杀），含中文的词直接按包含匹配。
 */
function curationHit(haystack, term) {
  const t = String(term).toLowerCase().trim();
  if (!t) return false;
  if (/^[a-z0-9][a-z0-9 ]*$/.test(t)) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(haystack);
  }
  return haystack.includes(t);
}

/**
 * 竞品的 Curate 层在本项目里退化成「可版本控制的规则 + 留痕」，不引入后台。
 *
 * 执行顺序固定为 excludeTerms → rejectIds → minCorroboration → pinIds：
 * 前一步命中即驳回（附具体理由，写入 rejected.json 供人工复核），pin 只作用于
 * 通过全部闸门的条目。任一清单为空时该步不改变行为，因此空规则 = 原样返回。
 *
 * @param {object[]} items buildOpportunities 的产物
 * @param {object} rules curation.json
 * @returns {{items:object[], rejected:object[]}}
 */
export function applyCuration(items = [], rules = {}) {
  const list = Array.isArray(items) ? items : [];
  const excludeTerms = Array.isArray(rules.excludeTerms) ? rules.excludeTerms.map(String) : [];
  const rejectIds = new Set((Array.isArray(rules.rejectIds) ? rules.rejectIds : []).map(String));
  const pinIds = new Set((Array.isArray(rules.pinIds) ? rules.pinIds : []).map(String));
  const minCorroboration = Math.max(0, Number(rules.minCorroboration) || 0);
  const pinBoost = Number(rules.pinBoost) || 0;

  const kept = [];
  const rejected = [];
  let pinnedAny = false;
  for (const it of list) {
    const id = String(it?.id ?? "");
    const hay = `${it?.title ?? ""} ${quoteOf(it)}`.toLowerCase();
    const reasons = [];

    // 1. 排除词：影视 / 名人 / 币价 / 促销 / 招聘等昙花一现的 fad
    const hit = excludeTerms.find((t) => curationHit(hay, t));
    if (hit) reasons.push(`excludeTerm:${hit}`);
    // 2. 人工驳回（带 id 精确匹配）
    if (rejectIds.has(id)) reasons.push(`rejectId:${id}`);
    // 3. 跨源印证下限：单源孤证在策展层被拒，避免一条帖子撑起一个「趋势」
    if (!reasons.length) {
      const sources = new Set(Array.isArray(it?.sources) ? it.sources.map(String) : []);
      if (sources.size < minCorroboration) {
        reasons.push(`minCorroboration:${sources.size}<${minCorroboration}`);
      }
    }
    if (reasons.length) {
      rejected.push({ id, title: String(it?.title ?? "").slice(0, 120), reasons });
      continue;
    }
    // 4. 人工置顶：加分后重排，且不覆盖已有字段（pinned 只作标记）
    let out = it;
    if (pinIds.has(id)) {
      out = { ...it, pinned: true, score: clamp((Number(it?.score) || 0) + pinBoost, 0, 100) };
      pinnedAny = true;
    }
    kept.push(out);
  }
  // 只有真的发生过 pin 才重排（pin 改变了分数）；空规则或规则未命中时
  // 完全保持上游 buildOpportunities 的既定顺序，做到「空清单不改行为」。
  if (pinnedAny) {
    kept.sort(
      (a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0) || String(a?.id).localeCompare(String(b?.id)),
    );
  }
  return { items: kept, rejected };
}
