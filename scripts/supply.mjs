/**
 * 供给侧参考（Supply Reference）—— 与站内需求信号「分口径」的第三条独立信号。
 *
 * 数据来源：TrustMRR 面向 AI/公开使用的只读快照端点（无需密钥、无需登录）：
 *   GET /api/ai           → recentlyListedStartups + bestDeals
 *   GET /api/ai/discovery → recentlyAddedStartups + fastestGrowingStartups
 * 每个端点约 25 条，合计约 100 条去重后的「已验证收入的公开项目」。
 *
 * 这个模块刻意不做的事（避免编造数字，用户对此有过明确要求）：
 * - 不计算「赛道过千比例」「中位增速」「势能」—— 公开快照样本太小（每类个位数），
 *   且 revenue.mrr / growthMRR30d 大量为 0，算比例会得出误导性的结论。公众号里
 *   那种「AI 赛道 2167 个项目 11% 过千」用的是付费全量 API，这里没有、也不假装。
 * - 不镜像逐条数据集到本站公开页（TrustMRR 的 Acceptable Use Policy 禁止 bulk
 *   republication / 未授权 SEO 页）。这里只做「关键词命中了几个真实项目」的轻量计数
 *   与可点开的原页链接，属于引用，并在 UI 明确标注来源 + 快照口径 + 链接回原页。
 *
 * 设计原则完全沿用 external-heat.mjs：
 * 1. 纯函数解析 + 匹配（parsePublicSnapshot / matchNicheSupply），可离线单测；
 * 2. 抓取失败 / 端点变更 / 抓到 0 条一律诚实写 status=unavailable 或 matched=false，
 *    绝不编造项目，绝不阻塞采集与提交（main 永不 exit 非 0）；
 * 3. 产物同时写 data/ 与 public/，与 opportunities.json 一致，前端 SSR 直接读。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_ENDPOINTS = Object.freeze([
  "https://trustmrr.com/api/ai",
  "https://trustmrr.com/api/ai/discovery",
]);
export const SOURCE_SITE = "https://trustmrr.com";
const TIMEOUT_MS = 10_000;
/** 单个赛道最多展示几个真实命中项目，避免把公开快照整段搬到本站。 */
const MAX_MATCHES_PER_NICHE = 3;

/**
 * 纯函数：从一个公开端点 JSON 中抽取项目数组。
 * 兼容两种端点不同的键名（recentlyListedStartups/bestDeals 与
 * recentlyAddedStartups/fastestGrowingStartups），也兼容直接就是一个数组。
 * 每个项目只保留可引用字段，不保留图标/颜色等展示噪声。
 */
export function parsePublicSnapshot(json) {
  if (!json || typeof json !== "object") return [];
  const arrays = [];
  if (Array.isArray(json)) arrays.push(json);
  else {
    for (const key of Object.keys(json)) {
      if (Array.isArray(json[key])) arrays.push(json[key]);
    }
  }
  const out = [];
  const seen = new Set();
  for (const arr of arrays) {
    for (const p of arr) {
      if (!p || typeof p !== "object") continue;
      const slug = String(p.slug || "").trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({
        slug,
        name: String(p.name || slug).trim().slice(0, 80),
        description: String(p.description || "").trim().slice(0, 400),
        category: p.category ? String(p.category).trim().slice(0, 60) : null,
        url: /^https?:\/\//.test(String(p.url || ""))
          ? String(p.url)
          : `${SOURCE_SITE}/startup/${encodeURIComponent(slug)}`,
      });
    }
  }
  return out;
}

/**
 * 合并多个公开端点的项目并按 slug 去重。纯函数。
 */
export function mergeProjects(snapshots = []) {
  const out = [];
  const seen = new Set();
  for (const list of Array.isArray(snapshots) ? snapshots : []) {
    for (const p of Array.isArray(list) ? list : []) {
      const slug = String(p?.slug || "").trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push(p);
    }
  }
  return out;
}

function escapeRe(t) {
  return String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 泛词黑名单：这些词在几乎每个 SaaS 项目描述里都会出现，命中它们说明不了
 * 「同一个方向」，只会制造看似相关实则无关的假匹配（例如 build 命中任何
 * 「build X」、files/photos 命中任何网盘/相册）。宁可少匹配，也不展示误导项。
 * 与 live-scan 的 GENERIC_TOKENS 同一思路，但这里是供给侧描述文本，单独维护。
 */
const GENERIC_TERMS = new Set([
  "build", "building", "files", "file", "photos", "photo", "record", "records",
  "logging", "log", "calendar", "schedule", "reminder", "reminders", "tool", "tools",
  "app", "simple", "better", "fast", "easy", "smart", "ai", "data", "management",
  "automation", "workspace", "platform", "dashboard", "tracking", "track", "note", "notes",
  "booking", "bookings", "scan", "endpoint", "integration", "api", "form", "forms",
]);

/** 词边界命中：英文/数字词用边界正则避免 "crm" 命中 "scrmsuite"；中文用包含匹配。 */
function termMatches(term, haystack) {
  const t = String(term || "").trim().toLowerCase();
  const hay = String(haystack || "").toLowerCase();
  if (!t || t.length < 2) return false;
  // 泛词（含其分词后的每个单词都泛）不算有效命中。
  if (GENERIC_TERMS.has(t)) return false;
  if (/^[a-z0-9][a-z0-9 +'&/-]*$/.test(t)) {
    const words = t.split(/[ +&/]+/).filter(Boolean);
    // 多词短语（如 "customer support" / "invoice export"）只要不是全泛词就可命中，
    // 避免把 "customer support" 这种有效短语误杀；单词则必须不在黑名单。
    if (words.length === 1 && GENERIC_TERMS.has(words[0])) return false;
    return new RegExp(`(?:^|[^a-z0-9])${escapeRe(t)}(?:$|[^a-z0-9])`, "i").test(hay);
  }
  return hay.includes(t);
}

/**
 * 纯函数：把方向（niche 的 topicTerms/queries）与公开项目做文本匹配。
 * 只返回真实命中的项目（name/description/category 任一命中），计数即命中项目数。
 * 命中数为 0 时 matched=false —— 诚实说「本次快照未发现直接对应的验证项目」。
 */
export function matchNicheSupply(projects = [], niches = [], { maxPerNiche = MAX_MATCHES_PER_NICHE } = {}) {
  const byNiche = {};
  for (const niche of Array.isArray(niches) ? niches : []) {
    const id = String(niche?.id || "");
    if (!id) continue;
    const terms = [...new Set([
      ...(Array.isArray(niche.topicTerms) ? niche.topicTerms : []),
      ...(Array.isArray(niche.queries) ? niche.queries : []),
    ])].map((t) => String(t).trim()).filter((t) => t.length >= 2);
    const hits = [];
    for (const p of Array.isArray(projects) ? projects : []) {
      const name = String(p?.name || "");
      const category = String(p?.category || "");
      const description = String(p?.description || "");
      const strong = `${name} ${category}`;
      const full = `${strong} ${description}`;
      // 命中词必须在「名/类目」里出现（强信号），或本身是 ≥6 字符的特征/多词短语
      // （可出现在描述里）。这样 "booking" 偶然出现在某模板工具的长描述里不算命中，
      // 而 "customer support" / "authentication" 这类更具体的词仍可命中。
      const matchedTerm = terms.find((t) => {
        if (termMatches(t, strong)) return true;
        const clean = String(t).trim();
        // 中文等表意文字信息密度高，≥3 字即可在描述里匹配；拉丁词要求 ≥6 字符的
        // 特征词/短语，避免 "booking"/"scan" 这类在长描述里偶然出现造成假匹配。
        const minLen = /[^\x00-\x7F]/.test(clean) ? 2 : 6;
        return clean.length >= minLen && termMatches(t, full);
      });
      if (matchedTerm) {
        hits.push({
          name: p.name,
          url: p.url,
          category: p.category ?? null,
          matchedTerm,
        });
      }
      if (hits.length >= maxPerNiche) break;
    }
    byNiche[id] = {
      matched: hits.length > 0,
      count: hits.length,
      projects: hits,
    };
  }
  return byNiche;
}

/**
 * 组装完整产物。sampleSize = 真实抓到的去重项目数；status=unavailable 时 byNiche 为空。
 * source/site 明示来源，UI 必须标注「公开快照样本、非全量、不代表成功率」并链接回原页。
 */
export function buildSupplyDoc({
  projects = [],
  niches = [],
  status = "ok",
  endpoints = DEFAULT_ENDPOINTS,
  at = new Date(),
} = {}) {
  return {
    schemaVersion: 1,
    generatedAt: at.toISOString(),
    source: SOURCE_SITE,
    endpoints: Array.isArray(endpoints) ? endpoints.slice() : [],
    status,
    sampleSize: status === "ok" ? (Array.isArray(projects) ? projects.length : 0) : 0,
    byNiche: status === "ok" ? matchNicheSupply(projects, niches) : {},
  };
}

/** 抓取单个端点；失败返回 null（不抛出），由 run 聚合成诚实降级。 */
async function fetchOne(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": "IdeaRadar-SupplyReference/1.0 (+https://idearadar.app/methodology)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[supply] 端点抓取失败 ${url}: ${String(err?.message || err).slice(0, 100)}`);
    return null;
  }
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
  const endpoints = DEFAULT_ENDPOINTS.slice();
  const snapshots = [];
  for (const url of endpoints) {
    const json = await fetchOne(url, fetchImpl);
    if (json) snapshots.push(parsePublicSnapshot(json));
  }
  const projects = mergeProjects(snapshots);
  const doc = buildSupplyDoc({
    projects,
    niches: cfg.niches || [],
    // 只有真正抓到项目才算 ok；全空说明端点改版或不可用，诚实降级。
    status: projects.length ? "ok" : "unavailable",
    endpoints,
  });
  const json = `${JSON.stringify(doc, null, 2)}\n`;
  await fs.mkdir(path.join(root, "data"), { recursive: true });
  await fs.mkdir(path.join(root, "public"), { recursive: true });
  await fs.writeFile(path.join(root, "data", "supply.json"), json);
  await fs.writeFile(path.join(root, "public", "supply.json"), json);
  console.log(`[supply] status=${doc.status} sampleSize=${doc.sampleSize} niches=${Object.keys(doc.byNiche).length}`);
  return doc;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  run().catch((err) => {
    console.warn(`[supply] 未捕获异常，保留上一份产物：${err?.message || err}`);
  });
}
