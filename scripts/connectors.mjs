/**
 * 多源召回连接器（采集脚本与离线评估脚本共用的唯一真源）。
 *
 * 之所以单独成模块：B2 的离线评估门禁必须用「与线上完全相同的召回函数」
 * 跑对照，否则参数差异会让 verdict 失去意义。任何连接器改动都只改这里。
 *
 * 设计原则沿用原 ingest.mjs：每个 connector 独立、可失败、可插拔；
 * 默认只启用合规公开源；Reddit 需显式开启且自带商业授权凭证。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "./ingest-lib.mjs";

const TIMEOUT_MS = 15_000;

export function createCollector({ cfg, now, root, errors = [] }) {
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

  /**
   * Hacker News — 官方 Algolia 搜索 API（公开可用）。
   * B2：默认用 /search（相关度→票数→评论数）；门禁回退时用旧口径
   * /search_by_date（时间倒序）。created_at_i 过滤在 /search 上合法，
   * 只有 points/num_comments 过滤才会被 relevance 索引拒绝（HTTP 400）。
   */
  async function hackerNews({ query, limit, method }) {
    const params = new URLSearchParams({
      query,
      hitsPerPage: String(limit),
      numericFilters: `created_at_i>${sinceEpoch}`,
    });
    const endpoint = method === "legacy" ? "search_by_date" : "search";
    const data = await getJson(`https://hn.algolia.com/api/v1/${endpoint}?${params}`);
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

  /**
   * GitHub Issues — 公开 REST API（有 token 时提高限额，无 token 也可匿名访问）。
   * B2：默认省略 sort（官方 best-match）；门禁回退时用旧口径
   * sort=created&order=desc。created:> 时间窗两种口径都保留。
   */
  async function githubIssues({ query, limit, method }) {
    const headers = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const q = `${query} is:issue created:>${since.toISOString().slice(0, 10)}`;
    const params = new URLSearchParams({ q, per_page: String(limit) });
    if (method === "legacy") {
      params.set("sort", "created");
      params.set("order", "desc");
    }
    const data = await getJson(`https://api.github.com/search/issues?${params}`, headers);
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
    const dir = path.join(root, "data", "imports");
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
   * Reddit — 默认关闭。合规要求：Reddit 用户协议禁止未经授权的商业抓取；
   * 仅在 ENABLE_REDDIT=true 且提供自有商业授权凭证时启用。
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

  /** 采集单个赛道的全部原始记录（采集与评估共用）。 */
  async function collectNiche(niche, { method, queryLimit }) {
    const rows = [];
    const sourceStats = [];
    const limit = Math.max(1, Number(queryLimit) || niche.queries.length);
    for (const connector of CONNECTORS.filter((c) => c.enabled)) {
      let count = 0;
      for (const query of niche.queries.slice(0, limit)) {
        try {
          const found = await connector.run({ query, limit: cfg.maxPerSource, method });
          const tagged = found.map((r) => ({ ...r, source: connector.id }));
          rows.push(...tagged);
          count += tagged.length;
        } catch (err) {
          errors.push({ source: connector.id, niche: niche.id, query, message: String(err.message || err) });
        }
      }
      sourceStats.push({ source: connector.id, niche: niche.id, count });
    }
    return { rows, sourceStats };
  }

  return { collectNiche, connectorIds: CONNECTORS.filter((c) => c.enabled).map((c) => c.id), labels: CONNECTORS };
}
