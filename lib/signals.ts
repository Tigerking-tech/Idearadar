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
  /** 逐字原话 / 证据摘要 */
  quote: string;
  /** 竞品空白 / 值得构建的机会 */
  gap: string;
};

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
  }));
}

/* ----------------------------- 实时数据映射 ----------------------------- */

type RawOpportunity = {
  id?: string;
  nicheLabel?: string;
  title?: string;
  score?: number;
  mentions?: number;
  sources?: string[];
  breakdown?: { frequency?: number; intensity?: number; recency?: number; corroboration?: number; willingnessToPay?: number };
  evidence?: { excerpt?: string; url?: string; source?: string }[];
  signals?: string[];
};

function norm(n: number | undefined, max = 20): number {
  const x = Number(n ?? 0);
  return Math.max(0, Math.min(1, x / max));
}

function mapOpportunity(raw: RawOpportunity): Signal | null {
  const id = raw.id ?? raw.title ?? "";
  if (!id || typeof raw.title !== "string" || raw.title.length < 6) return null;
  const b = raw.breakdown ?? {};
  const score = typeof raw.score === "number" ? raw.score : 0;
  const sources = Array.isArray(raw.sources) ? raw.sources.map((s) => SOURCE_LABELS[s] ?? s) : [];
  const evidence = Array.isArray(raw.evidence) ? raw.evidence : [];
  const quote = evidence[0]?.excerpt?.trim() || raw.title;
  const gap =
    Array.isArray(raw.signals) && raw.signals.length
      ? raw.signals.join("；")
      : raw.nicheLabel || "现有产品在该方向持续栽跟头，尚无人完整接住。";
  const spark = [0.12, norm(b.frequency), norm(b.intensity), norm(b.recency), norm(b.corroboration), norm(b.willingnessToPay, 10)].map((x) =>
    Number(x.toFixed(3)),
  );
  let trend: TrendKind = "steady";
  if (norm(b.recency) >= 0.5 && norm(b.frequency) >= 0.1) trend = "rising";
  else if (score < 30) trend = "peaked";
  return {
    id,
    title: raw.title.replace(/\s*…\s*$/, "").slice(0, 160),
    score,
    mentions: typeof raw.mentions === "number" ? raw.mentions : 0,
    sources,
    category: raw.nicheLabel || (sources[0] ?? "Signal"),
    trend,
    spark,
    quote,
    gap,
  };
}

/** 健壮性：任何解析异常都返回 null，让调用方安全回退到演示数据。 */
export function tryParseLiveSignals(json: unknown): Signal[] | null {
  try {
    if (!json || typeof json !== "object") return null;
    const items = (json as { items?: unknown }).items;
    if (!Array.isArray(items) || items.length === 0) return null;
    const mapped = (items as RawOpportunity[])
      .map(mapOpportunity)
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
};

/**
 * 解析发现流数据：
 * - 开启 `IDEARADAR_LIVE_FEED` 且能解析出 >=3 条有效实时信号 → 走实时数据；
 * - 否则回退到本地化演示数据。
 * 两条路径返回完全相同的 `Signal[]` 形状，UI 无需感知差异。
 */
export function resolveSignals(locale: "en" | "zh"): ResolvedFeed {
  const liveOn = process.env.IDEARADAR_LIVE_FEED === "1" || process.env.IDEARADAR_LIVE_FEED === "true";
  let live: Signal[] | null = null;
  let generatedAt: string | null = null;
  if (liveOn) {
    try {
      // 运行时读取最新管线输出（try 页为 force-dynamic）
      const fs = require("fs") as typeof import("fs");
      const path = require("path") as typeof import("path");
      const file = path.join(process.cwd(), "data", "opportunities.json");
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      live = tryParseLiveSignals(raw);
      generatedAt = raw?.generatedAt ?? null;
    } catch {
      live = null;
    }
  }
  if (live) {
    return { signals: live, live: true, generatedAt, sourceCount: live.length };
  }
  const demo = demoSignals(locale);
  return { signals: demo, live: false, generatedAt: null, sourceCount: demo.length };
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
    const hay = `${it.title} ${it.category} ${it.gap} ${it.quote}`.toLowerCase();
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

/** 零输入发现流：按信号分取 Top N。 */
export function topSignals(signals: Signal[], n = 6): Signal[] {
  return [...signals].sort((a, b) => b.score - a.score).slice(0, n);
}
