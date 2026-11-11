/**
 * IdeaRadar 定时采集入口（零依赖，Node 18+/22 内置 fetch）。
 *
 * 设计原则：
 * 1. 每个 connector 独立、可失败、可插拔 —— 单一平台变更不会让整条管线停摆。
 * 2. 默认只启用合规公开源；Reddit 连接器必须显式开启且自带商业授权凭证。
 * 3. 评分与去重全部走 ingest-lib.mjs 的纯函数，便于单测与复现。
 *
 * 用法：node scripts/ingest.mjs
 * 输出：data/opportunities.json 与 public/opportunities.json
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractSignals,
  scorePainPoint,
  dedupe,
  daysBetween,
  normalizeText,
  isNoiseTitle,
  truncateAtWord,
} from "./ingest-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "scripts", "ingest.config.json");
const TIMEOUT_MS = 15_000;

const cfg = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
const now = new Date();
const since = new Date(now.getTime() - cfg.lookbackDays * 86_400_000);
const sinceEpoch = Math.floor(since.getTime() / 1000);

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": "IdeaRadar-Ingest/1.0 (+https://idearadar.app/methodology)", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}`);
  return res.json();
}

async function getText(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": "IdeaRadar-Ingest/1.0 (+https://idearadar.app/methodology)", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}`);
  return res.text();
}

function iso(dateLike) {
  const t = Date.parse(dateLike);
  return Number.isFinite(t) ? new Date(t).toISOString() : now.toISOString();
}

function pick(obj, ...keys) {
  for (const k of keys) if (obj?.[k]) return obj[k];
  return "";
}

/* ------------------------- connectors ------------------------- */

/** Hacker News — 官方 Algolia 搜索 API（公开可用） */
async function hackerNews({ query, limit }) {
  const params = new URLSearchParams({
    query,
    hitsPerPage: String(limit),
    numericFilters: `created_at_i>${sinceEpoch}`,
  });
  const data = await getJson(`https://hn.algolia.com/api/v1/search_by_date?${params}`);
  return (data.hits || []).map((h) => ({
    title: normalizeText(pick(h, "title", "story_title") || h.comment_text?.slice(0, 110) || "HN discussion"),
    text: normalizeText(pick(h, "comment_text", "story_text") || ""),
    url: h.story_url || (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : "https://news.ycombinator.com"),
    createdAt: iso(h.created_at),
  }));
}

/** Stack Exchange — 官方 2.3 API（公开可用） */
async function stackExchange({ query, limit }) {
  const params = new URLSearchParams({
    order: "desc",
    sort: "activity",
    q: query,
    site: "stackoverflow",
    pagesize: String(limit),
    filter: "withbody",
    fromdate: String(sinceEpoch),
  });
  const data = await getJson(`https://api.stackexchange.com/2.3/search/advanced?${params}`);
  return (data.items || []).map((i) => ({
    title: normalizeText(i.title || "Stack Overflow question"),
    text: normalizeText(i.body || ""),
    url: i.link,
    createdAt: new Date((i.last_activity_date || i.creation_date || sinceEpoch) * 1000).toISOString(),
  }));
}

/** GitHub Issues — 公开 REST API（有 token 时提高限额，无 token 也可匿名访问） */
async function githubIssues({ query, limit }) {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const q = `${query} is:issue created:>${since.toISOString().slice(0, 10)}`;
  const data = await getJson(
    `https://api.github.com/search/issues?${new URLSearchParams({ q, sort: "created", order: "desc", per_page: String(limit) })}`,
    headers,
  );
  return (data.items || []).map((i) => ({
    title: normalizeText(i.title || "GitHub issue"),
    text: normalizeText(i.body || ""),
    url: i.html_url,
    createdAt: iso(i.created_at),
  }));
}

/** RSS / Atom — 用户自行配置的公开订阅源 */
function parseFeed(xml, feedUrl) {
  const blocks = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.map((b) => {
    const tag = (name) => {
      const m = b.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
      return m ? normalizeText(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
    };
    const linkMatch = b.match(/<link[^>]*href=["']([^"']+)["']|<link[^>]*>([^<]+)<\/link>/i);
    return {
      title: tag("title") || "Feed entry",
      text: tag("description") || tag("summary") || tag("content") || "",
      url: (linkMatch && (linkMatch[1] || linkMatch[2])) || feedUrl,
      createdAt: iso(tag("pubDate") || tag("published") || tag("updated") || now.toISOString()),
    };
  });
}

const feedCache = new Map();

async function rssFeeds({ query, limit }) {
  const out = [];
  for (const feedUrl of cfg.feeds || []) {
    try {
      if (!feedCache.has(feedUrl)) {
        feedCache.set(feedUrl, await getText(feedUrl).catch((e) => {
          errors.push({ source: "rss", feed: feedUrl, message: String(e.message || e) });
          return "";
        }));
      }
      const xml = feedCache.get(feedUrl);
      if (!xml) continue;
      const rows = parseFeed(xml, feedUrl).filter(
        (r) => `${r.title} ${r.text}`.toLowerCase().includes(query.toLowerCase().split(" ")[0]),
      );
      out.push(...rows.slice(0, limit));
    } catch (err) {
      errors.push({ source: "rss", feed: feedUrl, message: String(err.message || err) });
    }
  }
  return out;
}

/** 第一方数据 — 用户自行导入的工单/评论 CSV 转换结果 */
async function firstParty({ query, limit }) {
  const dir = path.join(ROOT, "data", "imports");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    try {
      const rows = JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
      for (const r of Array.isArray(rows) ? rows : []) {
        const hay = `${r.title || ""} ${r.text || ""}`.toLowerCase();
        if (hay.includes(query.toLowerCase().split(" ")[0])) out.push({
          title: normalizeText(r.title || "Imported record"),
          text: normalizeText(r.text || ""),
          url: r.url || `first-party:${file}`,
          createdAt: iso(r.createdAt || now.toISOString()),
        });
      }
    } catch (err) {
      errors.push({ source: "firstParty", file, message: String(err.message || err) });
    }
  }
  return out.slice(0, limit);
}

/**
 * Reddit — 默认关闭。
 * 合规要求：Reddit 用户协议禁止未经授权的商业抓取；此连接器仅在
 * ENABLE_REDDIT=true 且提供自有商业授权凭证时启用。
 * 2027 年 3 月公开 Data API 终止后，应迁移到 Reddit Developer Platform 或改用授权数据。
 */
async function reddit({ query, limit }) {
  if (process.env.ENABLE_REDDIT !== "true") return [];
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) {
    errors.push({ source: "reddit", message: "ENABLE_REDDIT=true but credentials missing; connector skipped" });
    return [];
  }
  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT || "IdeaRadar/1.0 (licensed)",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!tokenRes.ok) throw new Error(`Reddit OAuth HTTP ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();
  const data = await getJson(
    `https://oauth.reddit.com/search?${new URLSearchParams({ q: query, sort: "new", t: "month", limit: String(limit), restrict_sr: "false" })}`,
    { Authorization: `Bearer ${access_token}` },
  );
  return (data?.data?.children || []).map((c) => ({
    title: normalizeText(c.data.title || "Reddit post"),
    text: normalizeText(c.data.selftext || ""),
    url: `https://www.reddit.com${c.data.permalink}`,
    createdAt: new Date(c.data.created_utc * 1000).toISOString(),
  }));
}

const CONNECTORS = [
  { id: "hn", label: "Hacker News (official API)", run: hackerNews, enabled: true },
  { id: "so", label: "Stack Exchange (official API)", run: stackExchange, enabled: true },
  { id: "github", label: "GitHub Issues (public REST API)", run: githubIssues, enabled: true },
  { id: "rss", label: "Configured RSS / Atom feeds", run: rssFeeds, enabled: true },
  { id: "firstParty", label: "First-party imports", run: firstParty, enabled: true },
  { id: "reddit", label: "Reddit (licensed credentials required)", run: reddit, enabled: process.env.ENABLE_REDDIT === "true" },
];

const errors = [];
const sourceStats = [];
let totalRaw = 0;
let totalComplaints = 0;
const opportunities = [];

for (const niche of cfg.niches) {
  const raw = [];
  for (const connector of CONNECTORS.filter((c) => c.enabled)) {
    let count = 0;
    const queryLimit = Number(process.env.INGEST_QUERY_LIMIT || niche.queries.length);
    for (const query of niche.queries.slice(0, Math.max(1, queryLimit))) {
      try {
        const rows = await connector.run({ query, limit: cfg.maxPerSource });
        const tagged = rows.map((r) => ({ ...r, source: connector.id }));
        raw.push(...tagged);
        count += tagged.length;
      } catch (err) {
        errors.push({ source: connector.id, niche: niche.id, query, message: String(err.message || err) });
      }
    }
    sourceStats.push({ source: connector.id, niche: niche.id, count });
  }

  totalRaw += raw.length;
  // 判定顺序（重要）：
  // 1. 先排除新闻 / 公告 / CI 日志 / 多语言 issue 等非抱怨标题；
  // 2. 抱怨信号只从正文判定 —— 标题里的 "Fails" 不等于用户在抱怨；
  // 3. 正文为空的记录没有可验证的用户表述，直接跳过；
  // 4. 只把信号字段并回记录，不用 extractSignals 返回的 text 覆盖原始正文。
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
    .filter((r) => r.hasComplaint);
  totalComplaints += signaled.length;

  const groups = dedupe(signaled);
  for (const g of groups) {
    // 与入选判定保持一致：聚合信号只取正文摘录，不把 issue 标题重新拼进来，
    // 否则标题里的 "fails" 会二次污染强度分。
    const excerpts = g.evidence.map((e) => e.excerpt).join(" ");
    const agg = extractSignals(excerpts);
    const latest = g.evidence.reduce((max, e) => (e.createdAt > max ? e.createdAt : max), g.evidence[0]?.createdAt || now.toISOString());
    const { score, breakdown } = scorePainPoint({
      mentions: g.mentions,
      sources: g.sources,
      intensityRaw: agg.intensityRaw,
      daysSinceLatest: daysBetween(latest, now),
      lookbackDays: cfg.lookbackDays,
      hasWtp: agg.wtpSignals.length > 0,
    });
    if (score < cfg.minScore) continue;
    opportunities.push({
      id: `${niche.id}-${g.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}`,
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
}

opportunities.sort((a, b) => b.score - a.score || b.mentions - a.mentions || a.id.localeCompare(b.id));
const items = opportunities.slice(0, cfg.maxItems);

const output = {
  schemaVersion: 1,
  generatedAt: now.toISOString(),
  lookbackDays: cfg.lookbackDays,
  minScore: cfg.minScore,
  connectors: CONNECTORS.map((c) => ({
    id: c.id,
    label: c.label,
    enabled: c.enabled,
    rows: sourceStats.filter((s) => s.source === c.id).reduce((sum, s) => sum + s.count, 0),
  })),
  totals: { rawRecords: totalRaw, complaintRecords: totalComplaints, opportunities: items.length },
  errors,
  items,
};

await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
await fs.mkdir(path.join(ROOT, "public"), { recursive: true });
const json = `${JSON.stringify(output, null, 2)}\n`;
await fs.writeFile(path.join(ROOT, "data", "opportunities.json"), json);
await fs.writeFile(path.join(ROOT, "public", "opportunities.json"), json);

if (process.env.INGEST_WEBHOOK_URL) {
  try {
    await fetch(process.env.INGEST_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generatedAt: output.generatedAt, totals: output.totals }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    errors.push({ source: "webhook", message: String(err.message || err) });
  }
}

console.log(`[ingest] connectors: ${CONNECTORS.filter((c) => c.enabled).map((c) => c.id).join(", ")}`);
console.log(`[ingest] raw=${totalRaw} complaints=${totalComplaints} opportunities=${items.length}`);
console.log(`[ingest] errors=${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(`  - ${e.source}: ${e.message}`);

const enabled = CONNECTORS.filter((c) => c.enabled);
const allFailed = enabled.every((c) => !sourceStats.some((s) => s.source === c.id && s.count > 0)) && totalRaw === 0;
if (allFailed) {
  console.error("[ingest] all connectors returned no data — failing the run for visibility");
  process.exit(1);
}
