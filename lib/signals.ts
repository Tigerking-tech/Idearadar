/**
 * 统一的「需求信号」数据层（Signal data layer）
 *
 * 设计目标：把"数据源"和"页面渲染"解耦。页面只认识 `Signal`，
 * 不管是演示数据还是真实采集管线输出，都先映射成 `Signal` 再交给 UI。
 *
 * 这样接好 GitHub Actions 实时采集后，只需把 `IDEARADAR_LIVE_FEED` 打开，
 * 同一个发现流 UI 就会从演示数据平滑切换到真实信号——这就是"预留的真实接口位"。
 */

import { GUEST_ITEMS_EN, GUEST_ITEMS_ZH } from "./guest-scan-data";
import { classifyTrend, localizeSignalLabels } from "../scripts/ingest-lib.mjs";

export type TrendKind = "rising" | "steady" | "peaked";

/** 类目字典：演示数据用固定中英标签；实时数据用采集到的 nicheLabel。 */
const CATEGORY_EN: Record<string, string> = {
  crm: "CRM & Sales",
  invoice: "Finance & Billing",
  support: "Customer Support",
  booking: "Scheduling",
  checkout: "E-commerce",
  email: "Email & Inbox",
  project: "Project Management",
  password: "Security",
  form: "Forms & Surveys",
  analytics: "Analytics",
  knowledge: "Knowledge Base",
  ci: "Developer Tools",
};
const CATEGORY_ZH: Record<string, string> = {
  crm: "CRM 与销售",
  invoice: "财务与账单",
  support: "客户支持",
  booking: "预约排期",
  checkout: "电商",
  email: "邮件与收件箱",
  project: "项目管理",
  password: "安全",
  form: "表单与问卷",
  analytics: "数据分析",
  knowledge: "知识库",
  ci: "开发者工具",
};

export const SOURCE_LABELS: Record<string, string> = {
  hn: "Hacker News",
  so: "Stack Exchange",
  github: "GitHub Issues",
  rss: "RSS",
  firstParty: "First-party",
  reddit: "Reddit",
};

/** 真实采集的 nicheLabel 是英文配置；中文页本地化为中文类目，避免中文页混入英文句子。 */
const NICHE_LABEL_ZH: Record<string, string> = {
  "solo-crm": "独立创业者 CRM",
  "invoice-export": "发票与报销导出",
  "support-transcripts": "客服记录导出",
  scheduling: "预约排期",
};
function categoryFor(rawNicheId: string | undefined, fallback: string, locale: "en" | "zh"): string {
  if (locale === "zh" && rawNicheId && NICHE_LABEL_ZH[rawNicheId]) return NICHE_LABEL_ZH[rawNicheId];
  return fallback;
}

export type Signal = {
  id: string;
  title: string;
  /** 0–100 证据分 / 信号强度 */
  score: number;
  /** 提及次数（真实采集）或近似计数（演示） */
  mentions: number;
  sources: string[];
  /** 已本地化的类目标签 */
  category: string;
  trend: TrendKind;
  /** 迷你曲线：0–1 归一化的 12 个点，用于 sparkline */
  spark: number[];
  /** 逐字原话 / 证据摘要（中文页可能是 AI 译文） */
  quote: string;
  /** 竞品空白 / 值得构建的机会 */
  gap: string;
  /** 英文原文，供「查看原文」切换；演示数据下与 title/quote 相同 */
  titleOriginal: string;
  quoteOriginal: string;
  /** 当前展示是否为 AI 译文（决定是否显示翻译标注与切换按钮） */
  translated: boolean;
};

/** 只有真正含汉字的字符串才算有效译文，避免把英文/空串当译文缓存下来。 */
function hasZhText(s: unknown): s is string {
  return typeof s === "string" && /[\u3400-\u9fff]/.test(s);
}

/** 由字符串派生稳定的伪随机种子，保证同一 id 的曲线每次一致。 */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由 seed 生成曲线，形状随趋势明显区分：rising 陡升、steady 近水平、peaked 先升后降。 */
function sparkForTrend(id: string, trend: TrendKind, n = 12): number[] {
  const seed = hashSeed(id);
  const rnd = mulberry32(seed);
  const jitter = () => (rnd() - 0.5) * 0.06;
  const clamp = (x: number) => Number(Math.max(0.05, Math.min(0.98, x)).toFixed(3));
  const out: number[] = [];
  if (trend === "rising") {
    let v = 0.12;
    for (let i = 0; i < n; i++) {
      v += 0.07 + rnd() * 0.03;
      out.push(clamp(v + jitter()));
    }
  } else if (trend === "peaked") {
    const peakAt = 0.42 + (seed % 20) / 100; // 让峰值位置略有差异
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const hump = Math.exp(-Math.pow((t - peakAt) / 0.22, 2));
      out.push(clamp(0.16 + hump * 0.78 + jitter()));
    }
  } else {
    let v = 0.5;
    for (let i = 0; i < n; i++) {
      v += (rnd() - 0.5) * 0.05;
      out.push(clamp(v));
    }
  }
  return out;
}

function trendFromScore(score: number): TrendKind {
  if (score >= 84) return "rising";
  if (score >= 68) return "steady";
  return "peaked";
}

/* ----------------------- 多时间点趋势（真实时序） ----------------------- */

/** 由采集管线累积的 history.json：每次运行一个按 niche 聚合的快照。 */
export type SignalHistory = {
  schemaVersion?: number;
  seeded?: boolean;
  maxSnapshots?: number;
  /** B2：召回口径版本（2=相关度召回）。序列里版本不一致意味着趋势存在口径断点。 */
  methodVersion?: number;
  snapshots: {
    t: string;
    byNiche: Record<string, { score: number; mentions: number; items: number }>;
    methodVersion?: number;
  }[];
};

/**
 * 基于某 niche 的历史序列判断趋势（取代单快照的 recency/frequency 瞎猜）：
 * - 历史不足 3 个快照 → "steady"（样本不足，诚实标注为平稳，不谎报上升）
 * - 近期提及量相对其历史峰值回落 ≥15% → "peaked"（已过峰）
 * - 近期提及量相对窗口起点上升 ≥15% → "rising"
 * - 其余 → "steady"
 * 主信号用「提及量」而非分数：提及量是需求强度更直接的代理，分数更多反映信号质量。
 */
export function nicheSeries(nicheId: string, history: SignalHistory | null): { score: number; mentions: number }[] {
  if (!history || !Array.isArray(history.snapshots)) return [];
  return history.snapshots
    .map((s) => s.byNiche?.[nicheId])
    .filter((x): x is { score: number; mentions: number; items: number } => Boolean(x))
    .map((x) => ({ score: x.score, mentions: x.mentions }));
}

/** 判定逻辑复用采集库的 classifyTrend（单一真源，可被 node --test 覆盖）。 */
export function trendForNiche(nicheId: string, history: SignalHistory | null): TrendKind {
  return classifyTrend(nicheSeries(nicheId, history)) as TrendKind;
}

/**
 * sparkline 直接画该 niche 的真实历史提及量序列（与趋势芯片同源，曲线不说谎）。
 * 无足够历史时返回 null，调用方回退到按趋势形状生成的曲线。
 */
export function sparkFromHistory(nicheId: string, history: SignalHistory | null): number[] | null {
  if (!history || !Array.isArray(history.snapshots) || history.snapshots.length < 3) return null;
  const series = nicheSeries(nicheId, history).slice(-12).map((s) => s.mentions);
  if (series.length < 3) return null;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  return series.map((v) => Number((0.12 + ((v - min) / span) * 0.8).toFixed(3)));
}

/** 单快照兜底（仅用于没有 nicheId 的条目）：沿用原 recency/frequency 启发式。 */
function trendFromBreakdown(score: number, b: RawOpportunity["breakdown"]): TrendKind {
  const bd = b ?? {};
  let trend: TrendKind = "steady";
  if (norm(bd.recency) >= 0.5 && norm(bd.frequency) >= 0.1) trend = "rising";
  else if (score < 30) trend = "peaked";
  return trend;
}

/* ----------------------------- 演示数据映射 ----------------------------- */

function demoSignals(locale: "en" | "zh"): Signal[] {
  const items = locale === "zh" ? GUEST_ITEMS_ZH : GUEST_ITEMS_EN;
  const catMap = locale === "zh" ? CATEGORY_ZH : CATEGORY_EN;
  return items.map((it) => ({
    id: it.id,
    title: it.title,
    score: it.score,
    mentions: it.mentions,
    sources: it.sources,
    category: catMap[it.id] ?? (locale === "zh" ? "其他" : "Other"),
    trend: trendFromScore(it.score),
    spark: sparkForTrend(it.id, trendFromScore(it.score)),
    quote: it.quote,
    gap: it.gap,
    titleOriginal: it.title,
    quoteOriginal: it.quote,
    translated: false,
  }));
}

/* ----------------------------- 实时数据映射 ----------------------------- */

type RawOpportunity = {
  id?: string;
  nicheId?: string;
  nicheLabel?: string;
  title?: string;
  score?: number;
  mentions?: number;
  sources?: string[];
  breakdown?: { frequency?: number; intensity?: number; recency?: number; corroboration?: number; willingnessToPay?: number };
  evidence?: { excerpt?: string; url?: string; source?: string }[];
  signals?: string[];
  /** 采集端翻译步骤写入的简体中文字段（方案 B）。缺失时中文页回退英文原文。 */
  titleZh?: string;
  quoteZh?: string;
  translationKey?: string;
};

function norm(n: number | undefined, max = 20): number {
  const x = Number(n ?? 0);
  return Math.max(0, Math.min(1, x / max));
}

function mapOpportunity(raw: RawOpportunity, history: SignalHistory | null, locale: "en" | "zh"): Signal | null {
  const id = raw.id ?? raw.title ?? "";
  if (!id || typeof raw.title !== "string" || raw.title.length < 6) return null;
  const b = raw.breakdown ?? {};
  const score = typeof raw.score === "number" ? raw.score : 0;
  const sources = Array.isArray(raw.sources) ? raw.sources.map((s) => SOURCE_LABELS[s] ?? s) : [];
  const evidence = Array.isArray(raw.evidence) ? raw.evidence : [];
  const quoteEn = evidence[0]?.excerpt?.trim() || raw.title;
  const titleEn = raw.title.replace(/\s*…\s*$/, "").slice(0, 160);
  // 内容层本地化：优先取采集端写好的中文字段；缺失/无效时诚实回退英文，
  // 并始终带上英文原文，供「查看原文」切换（证据链必须可回溯）。
  const titleZh = hasZhText(raw.titleZh) ? raw.titleZh.trim().slice(0, 200) : null;
  const quoteZh = hasZhText(raw.quoteZh) ? raw.quoteZh.trim().slice(0, 400) : null;
  const useZh = locale === "zh" && Boolean(titleZh || quoteZh);
  // signals 是固定枚举标签，用词典中文化即可，不交给翻译模型、不依赖网络。
  const signalLabels =
    Array.isArray(raw.signals) && raw.signals.length
      ? locale === "zh"
        ? localizeSignalLabels(raw.signals)
        : raw.signals
      : [];
  const gap = signalLabels.length
    ? signalLabels.join("；")
    : raw.nicheLabel ||
      (locale === "zh"
        ? "现有产品在该方向持续栽跟头，尚无人完整接住。"
        : "Existing tools keep falling short here — nobody has fully solved it yet.");
  // 趋势：优先基于该 niche 的历史时序（多快照）；无 niche / 无历史时退回单快照启发式。
  const trend: TrendKind = raw.nicheId
    ? trendForNiche(raw.nicheId, history)
    : trendFromBreakdown(score, b);
  // sparkline 优先画真实历史序列，无历史时按趋势形状生成（保证曲线语义与芯片一致）。
  const spark = (raw.nicheId ? sparkFromHistory(raw.nicheId, history) : null) ?? sparkForTrend(id, trend);
  return {
    id,
    title: useZh && titleZh ? titleZh : titleEn,
    titleOriginal: titleEn,
    score,
    mentions: typeof raw.mentions === "number" ? raw.mentions : 0,
    sources,
    category: categoryFor(raw.nicheId, raw.nicheLabel || (sources[0] ?? "Signal"), locale),
    trend,
    spark,
    quote: useZh && quoteZh ? quoteZh : quoteEn,
    quoteOriginal: quoteEn,
    gap,
    translated: useZh,
  };
}

/** 健壮性：任何解析异常都返回 null，让调用方安全回退到演示数据。 */
export function tryParseLiveSignals(json: unknown, history: SignalHistory | null = null, locale: "en" | "zh" = "en"): Signal[] | null {
  try {
    if (!json || typeof json !== "object") return null;
    const items = (json as { items?: unknown }).items;
    if (!Array.isArray(items) || items.length === 0) return null;
    const mapped = (items as RawOpportunity[])
      .map((raw) => mapOpportunity(raw, history, locale))
      .filter((x): x is Signal => x !== null)
      .filter((s) => s.score >= 20 && s.mentions >= 1);
    return mapped.length >= 3 ? mapped : null;
  } catch {
    return null;
  }
}

/* ----------------------------- 顶层解析 ----------------------------- */

export type ResolvedFeed = {
  signals: Signal[];
  live: boolean;
  generatedAt: string | null;
  sourceCount: number;
  /** 历史快照数量（真实趋势的样本量），0 表示完全没有历史。 */
  historyCount: number;
  /** 趋势是否仍含冷启动引导数据（会随真实采集自动退役）。UI 需诚实标注。 */
  historySeeded: boolean;
  /** 趋势样本是否足够（>=3 个快照）。不足时全部显示「平稳（样本不足）」。 */
  trendReady: boolean;
  /** 历史序列里是否出现召回口径切换（趋势存在断点，需诚实标注）。 */
  recallSwitch: boolean;
};

/**
 * 解析发现流数据：
 * - 开启 `IDEARADAR_LIVE_FEED` 且能解析出 >=3 条有效实时信号 → 走实时数据；
 * - 否则回退到本地化演示数据。
 * 两条路径返回完全相同的 `Signal[]` 形状，UI 无需感知差异。
 * 实时路径额外读取 data/history.json，用多快照时序驱动趋势与 sparkline。
 */
export function resolveSignals(locale: "en" | "zh"): ResolvedFeed {
  const liveOn = process.env.IDEARADAR_LIVE_FEED === "1" || process.env.IDEARADAR_LIVE_FEED === "true";
  let live: Signal[] | null = null;
  let generatedAt: string | null = null;
  let history: SignalHistory | null = null;
  if (liveOn) {
    try {
      // 运行时读取最新管线输出（try 页为 force-dynamic）
      const fs = require("fs") as typeof import("fs");
      const path = require("path") as typeof import("path");
      const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "opportunities.json"), "utf8"));
      let hist: SignalHistory | null = null;
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "history.json"), "utf8"));
        if (parsed && Array.isArray(parsed.snapshots)) hist = parsed as SignalHistory;
      } catch {
        hist = null; // 历史文件缺失/损坏时安全回退到单快照启发式
      }
      history = hist;
      live = tryParseLiveSignals(raw, hist, locale);
      generatedAt = raw?.generatedAt ?? null;
    } catch {
      live = null;
    }
  }
  const historyCount = history?.snapshots?.length ?? 0;
  const historySeeded = Boolean(history?.seeded);
  // 未标注版本的旧快照视为 v1；序列里出现两个及以上版本即认为存在口径断点。
  const versions = new Set((history?.snapshots ?? []).map((s) => s.methodVersion ?? 1));
  const recallSwitch = versions.size > 1;
  if (live) {
    return { signals: live, live: true, generatedAt, sourceCount: live.length, historyCount, historySeeded, trendReady: historyCount >= 3, recallSwitch };
  }
  const demo = demoSignals(locale);
  return { signals: demo, live: false, generatedAt: null, sourceCount: demo.length, historyCount: 0, historySeeded: false, trendReady: true, recallSwitch: false };
}

/* ----------------------------- 关键词检索 ----------------------------- */

/**
 * 真实的关键词检索排序（演示与实时共用）：命中词数优先，其次分数，最后稳定顺序。
 * 不足 limit 条时用剩余高分条目补齐；完全无命中时返回全库 Top 并标记 noMatch。
 */
export function searchSignals(query: string, signals: Signal[], limit = 4) {
  const q = query.trim().toLowerCase();
  const tokens = q.split(/[\s,，、/|]+/).filter((t) => t.length >= 2);
  const scored = signals.map((it, idx) => {
    // 中文页也能用中文词搜索；同时保留英文原文，中英混合查询都能命中。
    const hay = `${it.title} ${it.titleOriginal} ${it.category} ${it.gap} ${it.quote} ${it.quoteOriginal}`.toLowerCase();
    let hits = 0;
    for (const t of tokens) if (hay.includes(t)) hits += 1;
    if (q.length >= 2 && hay.includes(q)) hits += 2;
    return { it, hits, idx };
  });
  const noMatch = !scored.some((s) => s.hits > 0);
  const sorted = [...scored].sort((a, b) => b.hits - a.hits || b.it.score - a.it.score || a.idx - b.idx);
  return { list: sorted.slice(0, limit).map((s) => s.it), noMatch };
}

/** 按指定 id 顺序取信号（用于方向 tile / 随机 / Explore）。 */
export function pinnedSignals(ids: string[], signals: Signal[]): Signal[] {
  const map = new Map(signals.map((s) => [s.id, s]));
  return ids
    .map((id) => map.get(id))
    .filter((x): x is Signal => Boolean(x))
    .sort((a, b) => b.score - a.score);
}

/**
 * 零输入发现流：按分数取 Top N，但保证赛道（category / niche）多样性。
 * 第一轮每个赛道取最高分 1 条，第二轮按分数补齐。
 * 动机：真实采集里某些赛道分数普遍偏高，纯按分数取会让 6 张卡全来自同一赛道，
 * 既不像 Exploding Topics 的 curated 信息流，也会让趋势芯片退化成「全一样」。
 */
export function topSignals(signals: Signal[], n = 6): Signal[] {
  const sorted = [...signals].sort((a, b) => b.score - a.score || b.mentions - a.mentions);
  const picked: Signal[] = [];
  const seenCat = new Set<string>();
  const seenId = new Set<string>();
  for (const s of sorted) {
    if (picked.length >= n) break;
    if (seenCat.has(s.category)) continue;
    picked.push(s);
    seenCat.add(s.category);
    seenId.add(s.id);
  }
  for (const s of sorted) {
    if (picked.length >= n) break;
    if (seenId.has(s.id)) continue;
    picked.push(s);
    seenId.add(s.id);
  }
  return picked.sort((a, b) => b.score - a.score || b.mentions - a.mentions);
}
