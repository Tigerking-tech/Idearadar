/**
 * 第 3 步「沉淀」：把用户按需扫描过的方向提升为定时采集赛道。
 *
 * 链路：/api/scan 成功时把方向写入 data/query-scans.json → 本脚本在
 * GitHub Actions 每轮定时运行时统计高频方向 → 追加到 ingest.config.json 的
 * niches → 下一轮定时采集就会覆盖这些方向，固定索引自然变宽。
 *
 * 幂等：已存在的赛道 id / 检索词不会重复添加；只在确有新增时改写配置文件。
 * 边界：Vercel 等无持久文件系统的环境写不了 query-scans.json，本脚本读不到
 * 记录时静默跳过，需外部存储才能在正式部署闭环（见 README/交付说明）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { isVagueQuery, hintTerms } from "./live-scan.mjs";

const STOP_EXTRA = new Set([
  "a", "an", "the", "test", "tests", "hello", "foo", "bar", "abc",
  "什么", "怎么", "如何", "随便", "看看", "试试", "一个", "这个",
]);

function slug(q) {
  const ascii = String(q).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (ascii) return ascii.slice(0, 32);
  return createHash("sha1").update(String(q)).digest("hex").slice(0, 10);
}

function usable(q) {
  const s = String(q || "").trim();
  if (s.length < 3 || s.length > 40) return false;
  if (isVagueQuery(s) || STOP_EXTRA.has(s.toLowerCase())) return false;
  // 必须含字母或汉字。不能用 /^[\W]+$/ 判断「纯符号」：JS 的 \W 等价于
  // [^A-Za-z0-9_]，汉字也算 \W，会把「宠物寄养」这类中文方向整批误过滤。
  if (!/[A-Za-z0-9\u3400-\u9fff]/.test(s)) return false;
  return true;
}

/** 纯函数：从按需扫描记录里挑出值得提升为赛道的方向。 */
export function pickCandidates(records, existingNiches = [], { minCount = 2, maxAdd = 8 } = {}) {
  const counts = new Map();
  for (const r of records || []) {
    const q = String(r?.q || "").trim();
    if (!usable(q)) continue;
    const key = q.toLowerCase();
    const prev = counts.get(key);
    counts.set(key, { q: prev?.q || q, n: (prev?.n || 0) + 1 });
  }

  const existing = new Set();
  for (const n of existingNiches || []) {
    for (const t of [...(n.topicTerms || []), ...(n.queries || []), n.label || "", n.id || ""]) {
      existing.add(String(t).toLowerCase());
    }
  }

  const out = [];
  const sorted = [...counts.values()].sort((a, b) => b.n - a.n || a.q.localeCompare(b.q));
  for (const { q, n } of sorted) {
    if (n < minCount || out.length >= maxAdd) break;
    if (existing.has(q.toLowerCase())) continue;
    const id = `auto-${slug(q)}`;
    if (existing.has(id)) continue;
    // 中文方向补上英文检索词，否则在 GitHub / HN / StackOverflow 上召回接近 0。
    const terms = [...new Set([q, ...hintTerms(q)])].slice(0, 3);
    out.push({
      q,
      count: n,
      niche: { id, label: q, auto: true, topicTerms: terms, queries: terms },
    });
    existing.add(id);
    existing.add(q.toLowerCase());
  }
  return out;
}

/** 纯函数：把候选赛道合并进配置，返回是否真的有新增。 */
export function applyCandidates(config, candidates) {
  const next = { ...config, niches: [...(config.niches || [])] };
  const ids = new Set(next.niches.map((n) => String(n.id).toLowerCase()));
  let added = 0;
  for (const c of candidates || []) {
    if (ids.has(String(c.niche.id).toLowerCase())) continue;
    next.niches.push(c.niche);
    ids.add(String(c.niche.id).toLowerCase());
    added += 1;
  }
  return { config: next, added };
}

export async function run({ root = process.cwd(), minCount = 2, maxAdd = 8 } = {}) {
  const scansPath = path.join(root, "data", "query-scans.json");
  const cfgPath = path.join(root, "scripts", "ingest.config.json");
  let records = [];
  try {
    const parsed = JSON.parse(await fs.readFile(scansPath, "utf8"));
    records = Array.isArray(parsed?.queries) ? parsed.queries : [];
  } catch {
    return { scanned: 0, candidates: 0, added: 0, message: "no query-scans.json" };
  }
  const config = JSON.parse(await fs.readFile(cfgPath, "utf8"));
  const candidates = pickCandidates(records, config.niches, { minCount, maxAdd });
  const { config: next, added } = applyCandidates(config, candidates);
  if (added) await fs.writeFile(cfgPath, `${JSON.stringify(next, null, 2)}\n`);
  return { scanned: records.length, candidates: candidates.length, added, items: candidates.slice(0, added) };
}

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (isMain) {
  run()
    .then((r) => {
      console.log(`[promote] scanned=${r.scanned} candidates=${r.candidates} added=${r.added}${r.message ? ` (${r.message})` : ""}`);
      for (const c of r.items || []) console.log(`  + ${c.q} (${c.count} 次) -> ${c.niche.id}`);
    })
    .catch((err) => {
      console.error("[promote] failed:", err.message);
      process.exit(1);
    });
}
