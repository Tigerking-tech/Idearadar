/**
 * P1 外部搜索热度（External Heat）—— 与站内多快照趋势「分口径」的第二条信号。
 *
 * 为什么单独做一个模块：
 * - 站内 trend 来自 history.json 的多快照提及量，是「我们采集到的讨论强度」；
 * - 这里来自 Google Trends 每日热搜 RSS 的 approx_traffic，是「外部公开搜索量级」。
 * 两者口径完全不同，绝不能混成一条曲线或互相覆盖。前端并列展示、各自标注。
 *
 * 设计原则沿用项目惯例：
 * 1. 纯函数解析 + 匹配（parseTrendingRss / matchNicheHeat），可离线单测；
 * 2. 抓取失败 / 无匹配 / 端点变更一律诚实写 status=unavailable 或 matched=false，
 *    绝不编造流量数字，绝不阻塞采集与提交（main 永不 exit 非 0）；
 * 3. 产物同时写 data/ 与 public/，与 opportunities.json 一致，前端 SSR 直接读。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_TRENDING_RSS = "https://trends.google.com/trending/rss?geo=US";
const TIMEOUT_MS = 10_000;

/** 把 "20,000+" / "1,000,000+" 这类 approx_traffic 解析成数字；无法解析返回 null。 */
export function parseTraffic(raw) {
  const m = String(raw ?? "").replace(/,/g, "").match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 宽松解析 Google Trends 每日热搜 RSS。兼容 <item> 与 ht: 命名空间，
 * 任何字段缺失都不抛异常；返回按 approx_traffic 降序的去重词表。
 */
export function parseTrendingRss(xml = "") {
  const blocks = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const out = [];
  const seen = new Set();
  for (const b of blocks) {
    const title = (b.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "")
      .replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, "").trim();
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const trafficRaw = b.match(/<(?:\w+:)?approx_traffic[^>]*>([\s\S]*?)<\/(?:\w+:)?approx_traffic>/i)?.[1] || "";
    out.push({ term: title, traffic: parseTraffic(trafficRaw) });
  }
  return out.sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0));
}

/**
 * 纯函数：把热搜词按赛道 topicTerms 匹配，产出 data/external-heat.json 的 byNiche。
 * 匹配要求「词边界命中」，避免 "crm" 命中 "scrmsuite"；中文词用包含匹配。
 * 未命中的赛道明确写 matched=false，前端据此显示「未进入今日外部热榜」。
 */
export function matchNicheHeat(trends = [], niches = [], { maxPerNiche = 1 } = {}) {
  const byNiche = {};
  for (const niche of Array.isArray(niches) ? niches : []) {
    const id = String(niche?.id || "");
    if (!id) continue;
    const terms = [...new Set([
      ...(Array.isArray(niche.topicTerms) ? niche.topicTerms : []),
      ...(Array.isArray(niche.queries) ? niche.queries : []),
    ])].map((t) => String(t).trim().toLowerCase()).filter((t) => t.length >= 2);
    const hits = [];
    for (const row of trends) {
      const hay = String(row?.term || "").toLowerCase();
      const matchedTerm = terms.find((t) => {
        if (/^[a-z0-9 ]+$/.test(t)) {
          const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(hay);
        }
        return hay.includes(t);
      });
      if (matchedTerm) hits.push({ term: row.term, traffic: row.traffic ?? null, matchedTerm });
      if (hits.length >= maxPerNiche) break;
    }
    byNiche[id] = hits.length
      ? { matched: true, term: hits[0].term, traffic: hits[0].traffic, matchedTerm: hits[0].matchedTerm }
      : { matched: false, term: null, traffic: null };
  }
  return byNiche;
}

/** 组装完整产物；status=unavailable 时 byNiche 为空，前端显示「本次未取到」。 */
export function buildExternalHeatDoc({ trends = [], niches = [], status = "ok", source = DEFAULT_TRENDING_RSS, at = new Date() } = {}) {
  return {
    schemaVersion: 1,
    generatedAt: at.toISOString(),
    source,
    status,
    trendCount: trends.length,
    byNiche: status === "ok" ? matchNicheHeat(trends, niches) : {},
  };
}

/** 抓取 + 落盘。任何失败都写 unavailable 产物，绝不抛出（工作流不因外部源变红）。 */
export async function run({ root = ROOT, env = process.env, fetchImpl = fetch, config = null } = {}) {
  let cfg = config;
  if (!cfg) {
    try {
      cfg = JSON.parse(await fs.readFile(path.join(root, "scripts", "ingest.config.json"), "utf8"));
    } catch {
      cfg = { niches: [] };
    }
  }
  const url = String(env.IDEARADAR_TRENDING_RSS || DEFAULT_TRENDING_RSS);
  let doc;
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": "IdeaRadar-ExternalHeat/1.0 (+https://idearadar.app/methodology)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const trends = parseTrendingRss(xml);
    // 抓到 0 条通常意味着端点改版：诚实标 unavailable，不假装「今日无热搜」。
    doc = buildExternalHeatDoc({
      trends,
      niches: cfg.niches || [],
      status: trends.length ? "ok" : "unavailable",
      source: url,
    });
  } catch (err) {
    doc = buildExternalHeatDoc({ status: "unavailable", niches: cfg.niches || [], source: url });
    console.warn(`[external-heat] 抓取失败，诚实降级：${String(err?.message || err).slice(0, 120)}`);
  }
  const json = `${JSON.stringify(doc, null, 2)}\n`;
  await fs.mkdir(path.join(root, "data"), { recursive: true });
  await fs.mkdir(path.join(root, "public"), { recursive: true });
  await fs.writeFile(path.join(root, "data", "external-heat.json"), json);
  await fs.writeFile(path.join(root, "public", "external-heat.json"), json);
  console.log(`[external-heat] status=${doc.status} trendCount=${doc.trendCount} niches=${Object.keys(doc.byNiche).length}`);
  return doc;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  run().catch((err) => {
    console.warn(`[external-heat] 未捕获异常，保留上一份产物：${err?.message || err}`);
  });
}
