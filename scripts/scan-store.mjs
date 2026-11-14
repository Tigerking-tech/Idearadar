/**
 * 方向沉淀的存储适配层（P1 候选落盘 / P2 正式部署闭环）。
 *
 * 背景：/api/scan 与 promote-niches 原本直接读写 data/*.json。GitHub Actions、
 * 本地自托管都成立，但 Vercel Serverless 的文件系统不可写，方向沉淀会静默失效。
 * 本模块把「读/写两份方向文档」抽象成可替换后端：
 *
 *  - 默认 file：data/query-scans.json、data/scan-candidates.json（零配置，行为不变）。
 *  - 配了 IDEARADAR_STORE_URL：走远端 REST（GET 读 / PUT 写，Bearer 可选），
 *    可用 Supabase / Cloudflare KV Workers / Upstash REST 等任意接受 GET+PUT JSON 的端点。
 *
 * 契约（纯 JSON，可单测）：
 *   GET  {url}/{kind}  → 200 + JSON 文档，404 → 视为空，其他 → 读失败
 *   PUT  {url}/{kind}  → 2xx 视为成功，body 为完整文档
 * 任何后端失败都返回 false / 默认空文档，绝不抛异常阻塞扫描或采集。
 */
import fs from "node:fs/promises";
import path from "node:path";

export const QUERIES = "query-scans";
export const CANDIDATES = "scan-candidates";

const FILES = {
  [QUERIES]: "query-scans.json",
  [CANDIDATES]: "scan-candidates.json",
};

export function emptyQueries() {
  return { version: 1, queries: [], updatedAt: null };
}

export function emptyCandidates() {
  return { version: 1, directions: [], updatedAt: null };
}

/** 后端选择：只有显式配了 URL 才走远端，默认本地文件。 */
export function storeConfig(env = process.env) {
  const url = String(env.IDEARADAR_STORE_URL || "").trim().replace(/\/+$/, "");
  const token = String(env.IDEARADAR_STORE_TOKEN || "").trim();
  return { url, token, remote: url.length > 0 };
}

function fallbackFor(kind) {
  return kind === CANDIDATES ? emptyCandidates() : emptyQueries();
}

function isDoc(kind, value) {
  if (!value || typeof value !== "object") return false;
  return kind === CANDIDATES
    ? Array.isArray(value.directions)
    : Array.isArray(value.queries);
}

/**
 * 读取文档。远端 404 / 网络失败 / 非法 JSON 一律回退到空文档。
 * @param {string} kind QUERIES | CANDIDATES
 */
export async function loadDoc(kind, { root = process.cwd(), env = process.env, fetchImpl = fetch } = {}) {
  const cfg = storeConfig(env);
  if (!cfg.remote) {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(root, "data", FILES[kind]), "utf8"));
      return isDoc(kind, parsed) ? parsed : fallbackFor(kind);
    } catch {
      return fallbackFor(kind);
    }
  }
  try {
    const res = await fetchImpl(`${cfg.url}/${kind}`, {
      headers: cfg.token ? { Authorization: `Bearer ${cfg.token}`, Accept: "application/json" } : { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return fallbackFor(kind);
    if (!res.ok) return fallbackFor(kind);
    const parsed = await res.json();
    return isDoc(kind, parsed) ? parsed : fallbackFor(kind);
  } catch {
    return fallbackFor(kind);
  }
}

/** 写入文档，返回是否成功。远端失败只返回 false，不抛。 */
export async function saveDoc(kind, data, { root = process.cwd(), env = process.env, fetchImpl = fetch } = {}) {
  const doc = { ...data, updatedAt: new Date().toISOString() };
  const cfg = storeConfig(env);
  if (!cfg.remote) {
    try {
      const dir = path.join(root, "data");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, FILES[kind]), `${JSON.stringify(doc, null, 2)}\n`);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const res = await fetchImpl(`${cfg.url}/${kind}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      },
      body: JSON.stringify(doc),
      signal: AbortSignal.timeout(6_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------- 领域便捷函数 ------------------------- */

/**
 * 追加一条按需扫描方向记录。60 秒内的重复写入由调用方去重（route.ts 的 shouldRecord）。
 * 纯 I/O，可通过 loadDoc/saveDoc 注入后端；返回是否写入成功。
 */
export async function appendQuery(query, meta = {}, opts = {}) {
  const q = String(query || "").trim();
  if (!q) return false;
  const doc = await loadDoc(QUERIES, opts);
  doc.queries = (doc.queries || []).concat([{
    q: q.slice(0, 80),
    at: new Date().toISOString(),
    hits: Number(meta.hits) || 0,
    locale: meta.locale || "en",
    mode: meta.mode || "rules",
  }]).slice(-500);
  return saveDoc(QUERIES, doc, opts);
}

/**
 * 落盘一次按需扫描的高分结果，作为 promote-niches 的召回准入证据。
 * 同一方向只保留最近一次（覆盖式），避免文档无限膨胀。
 * @param {object[]} items Signal[]，只保留可核查的字段
 */
export async function putCandidates(query, items = [], meta = {}, opts = {}) {
  const q = String(query || "").trim().slice(0, 80);
  if (!q) return false;
  const doc = await loadDoc(CANDIDATES, opts);
  const entry = {
    q,
    at: new Date().toISOString(),
    locale: meta.locale || "en",
    mode: meta.mode || "rules",
    terms: Array.isArray(meta.terms) ? meta.terms.slice(0, 6).map(String) : [],
    items: (Array.isArray(items) ? items : []).slice(0, 8).map((it) => ({
      id: String(it?.id || ""),
      title: String(it?.title || "").slice(0, 200),
      titleOriginal: String(it?.titleOriginal || "").slice(0, 200),
      quote: String(it?.quote || "").slice(0, 320),
      quoteOriginal: String(it?.quoteOriginal || "").slice(0, 320),
      score: Number(it?.score) || 0,
      sources: Array.isArray(it?.sources) ? it.sources.slice(0, 5).map(String) : [],
    })),
  };
  const rest = (doc.directions || []).filter((d) => String(d?.q || "").toLowerCase() !== q.toLowerCase());
  doc.directions = rest.concat([entry]).slice(-200);
  return saveDoc(CANDIDATES, doc, opts);
}
