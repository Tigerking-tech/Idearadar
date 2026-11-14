/**
 * 第 3 步「沉淀」：把用户按需扫描过的方向提升为定时采集赛道。
 *
 * 链路：/api/scan 成功时把方向与高分候选写入存储层 → 本脚本在
 * GitHub Actions 每轮定时运行时统计高频方向 → 通过「召回准入闸门」才
 * 追加到 ingest.config.json 的 niches → 下一轮定时采集覆盖这些方向。
 *
 * 为什么要准入闸门（P0-1）：历史上有两个 auto 赛道 itemCount 恒为 0 ——
 * 用户搜的是中文长尾词（宠物寄养、预约工具），采集源却是 HN / StackExchange /
 * GitHub Issues 三个英文技术社区，这些赛道每 6 小时白跑一轮、零产出，还稀释
 * 全局相关率。现在提升前必须证明「这个方向真的能在数据源里召回抱怨」：
 *   - 快速通道：/api/scan 落盘的高分候选（scan-candidates.json）本身就是
 *     真实检索证据，有就直接过闸门，零额外网络请求；
 *   - 否则用 createCollector 的轻量入口（只跑 HN + StackExchange 两个无鉴权源）
 *     现场试跑该方向的英文检索词，要求 raw 达阈值且 buildOpportunities 产出
 *     ≥1 条。失败 / 超时一律 fail-closed（宁可不提升，也不制造空转赛道）。
 *
 * 幂等：已存在的赛道 id / 检索词不会重复添加；只在确有新增或回收时改写配置。
 * 存储适配：方向记录走 scan-store.mjs（默认本地文件；配 IDEARADAR_STORE_URL
 * 时走远端 REST，Vercel 等无持久文件系统也能闭环）。配置文件仍写本地，因为
 * 本脚本只在 GitHub Actions / 自托管这种文件系统可写的环境里运行。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { isVagueQuery, hintTerms } from "./live-scan.mjs";
import { createCollector } from "./connectors.mjs";
import { buildOpportunities } from "./ingest-lib.mjs";
import { loadDoc, QUERIES, CANDIDATES } from "./scan-store.mjs";

/** 准入阈值：至少召回 3 条原始记录且产出 1 条机会，才认定为「非空转方向」。 */
export const GATE_MIN_RAW = 3;
export const GATE_MIN_ITEMS = 1;
/** 候选证据快速通道：/api/scan 落盘结果里出现 ≥1 条不低于此分的信号即视为有召回。 */
export const EVIDENCE_MIN_SCORE = 55;

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

/**
 * 纯函数：召回准入判定。probe 是 { raw, items }，任一缺失按 0 处理（fail-closed）。
 * 可单测，不碰网络。
 */
export function passesRecallGate(probe, { minRaw = GATE_MIN_RAW, minItems = GATE_MIN_ITEMS } = {}) {
  const raw = Number(probe?.raw) || 0;
  const items = Number(probe?.items) || 0;
  return { ok: raw >= minRaw && items >= minItems, raw, items };
}

/**
 * 纯函数：从 /api/scan 落盘的高分候选里查某方向的召回证据。
 * 这是「真实用户已经检索并拿到结果」的证据，优先于现场 probe。
 */
export function candidateEvidence(directions, q, { minScore = EVIDENCE_MIN_SCORE } = {}) {
  const key = String(q || "").trim().toLowerCase();
  const d = (Array.isArray(directions) ? directions : []).find(
    (x) => String(x?.q || "").trim().toLowerCase() === key,
  );
  if (!d || !Array.isArray(d.items)) return { has: false, hits: 0, best: 0 };
  const scores = d.items.map((it) => Number(it?.score) || 0);
  const best = scores.length ? Math.max(...scores) : 0;
  const hits = scores.filter((s) => s >= minScore).length;
  return { has: hits >= 1, hits, best };
}

/**
 * 纯函数：回收「已在配置里、但本轮采集零产出」的 auto 赛道。
 * 只动 auto:true 的自动赛道，人工维护的主赛道绝不碰。
 * @param {object} config ingest.config.json
 * @param {object[]} nicheMetrics opportunities.json 的 recall.nicheMetrics
 */
export function pruneIdleAutoNiches(config, nicheMetrics = []) {
  const idle = new Set(
    (Array.isArray(nicheMetrics) ? nicheMetrics : [])
      .filter((m) => (Number(m?.itemCount) || 0) === 0)
      .map((m) => String(m?.niche)),
  );
  const before = Array.isArray(config?.niches) ? config.niches : [];
  const removed = before.filter((n) => n?.auto && idle.has(String(n.id))).map((n) => String(n.id));
  if (!removed.length) return { config, removed };
  return { config: { ...config, niches: before.filter((n) => !(n.auto && idle.has(String(n.id)))) }, removed };
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

/**
 * 默认的现场召回试跑（可注入替换，便于单测）。
 * 只跑 HN + StackExchange 两个公开无鉴权源，避开 GitHub Search 的限流窗口；
 * 中文 query 会再补一次英文同义词；任一源失败不影响其他源。
 */
export async function probeDirection(niche, { root = process.cwd(), now = new Date(), sources = ["hn", "so"] } = {}) {
  const cfg = { lookbackDays: 30, maxPerSource: 10, feeds: [] };
  const errors = [];
  const collector = createCollector({
    cfg, now, root, errors,
    timeoutMs: 6_000, retries: 0, githubMinIntervalMs: 0, maxBackoffMs: 1_200,
  });
  // 中文方向再展开一次英文同义词，确保 probe 用的是英文可检索词。
  const queries = [...new Set((niche.queries || []).flatMap((q) => [q, ...hintTerms(q)]))].slice(0, 3);
  const rows = [];
  for (const q of queries) {
    // eslint-disable-next-line no-await-in-loop
    const found = await collector.collectQuery(q, 10, sources);
    rows.push(...found);
  }
  // 主题门槛在 probe 里关闭：这里要验证的是「能否召回任何真实抱怨」，
  // 主题相关度由后续正式采集的 topicTerms 保证。
  const built = buildOpportunities(rows, {
    niche: { ...niche, topicTerms: [] },
    cfg: { minScore: 20, lookbackDays: 30 },
    now,
    topicScope: "any",
  });
  return { raw: built.stats.raw, items: built.items.length };
}

/**
 * 编排一轮沉淀。
 * @param {object} opts
 * @param {string} opts.root 项目根目录（单测用临时目录）
 * @param {number} opts.minCount / maxAdd 高频阈值与单轮上限
 * @param {boolean} opts.gateEnabled 是否启用召回准入闸门（默认读 env，缺省启用）
 * @param {Function} opts.probeFn 注入的 probe（默认 probeDirection 真实走网络）
 * @param {object} opts.env 注入环境变量
 *
 * 两个独立开关，语义互不混淆：
 *  - IDEARADAR_PROMOTE_GATE=0  紧急回滚：完全关闭闸门，恢复「只看次数」旧行为。
 *  - IDEARADAR_PROMOTE_PROBE=0 闸门仍开，但不做现场 probe，只认落盘高分证据；
 *    无证据的方向 fail-closed 不提升（绝不把中文长尾词又变回空转赛道）。
 */
export async function run({
  root = process.cwd(),
  minCount = 2,
  maxAdd = 8,
  gateEnabled,
  probeFn = probeDirection,
  env = process.env,
} = {}) {
  const storeOpts = { root, env };
  const cfgPath = path.join(root, "scripts", "ingest.config.json");
  const config = JSON.parse(await fs.readFile(cfgPath, "utf8"));

  const queriesDoc = await loadDoc(QUERIES, storeOpts);
  const records = Array.isArray(queriesDoc?.queries) ? queriesDoc.queries : [];
  const candidatesDoc = await loadDoc(CANDIDATES, storeOpts);
  const evidenceDirections = Array.isArray(candidatesDoc?.directions) ? candidatesDoc.directions : [];

  // 1) 先回收本轮零产出的 auto 赛道（健康闸门：不让空转赛道继续占配置与统计位）。
  let nicheMetrics = [];
  try {
    const opp = JSON.parse(await fs.readFile(path.join(root, "data", "opportunities.json"), "utf8"));
    if (Array.isArray(opp?.recall?.nicheMetrics)) nicheMetrics = opp.recall.nicheMetrics;
  } catch {
    nicheMetrics = [];
  }
  const pruned = pruneIdleAutoNiches(config, nicheMetrics);

  // 2) 按高频挑候选。
  const candidates = pickCandidates(records, pruned.config.niches, { minCount, maxAdd });

  // 3) 召回准入闸门：候选证据快速通道 → 现场 probe → fail-closed。
  // 两个开关独立：gate 控制「要不要准入」，probeEnabled 控制「是否现场试跑」。
  const gate = gateEnabled ?? env.IDEARADAR_PROMOTE_GATE !== "0";
  const probeEnabled = env.IDEARADAR_PROMOTE_PROBE !== "0";
  const approved = [];
  const gateLog = [];
  for (const c of candidates) {
    if (!gate) {
      approved.push(c);
      continue;
    }
    const ev = candidateEvidence(evidenceDirections, c.q);
    if (ev.has) {
      approved.push(c);
      gateLog.push({ q: c.q, via: "evidence", best: ev.best });
      continue;
    }
    if (!probeEnabled) {
      // 关闭 probe 时：闸门仍开，无证据方向保守跳过，绝不退回「只看次数」。
      gateLog.push({ q: c.q, via: "no-evidence", ok: false });
      continue;
    }
    try {
      const probe = await probeFn(c.niche, { root });
      const verdict = passesRecallGate(probe);
      gateLog.push({ q: c.q, via: "probe", ...verdict });
      if (verdict.ok) approved.push(c);
    } catch (err) {
      // fail-closed：probe 失败/超时不提升，也绝不让整轮沉淀崩掉。
      gateLog.push({ q: c.q, via: "probe-error", message: String(err?.message || err).slice(0, 120) });
    }
  }

  // 4) 合并进配置；有新增或被回收才改写文件。
  const { config: next, added } = applyCandidates(pruned.config, approved);
  if (added || pruned.removed.length) {
    await fs.writeFile(cfgPath, `${JSON.stringify(next, null, 2)}\n`);
  }
  return {
    scanned: records.length,
    candidates: candidates.length,
    added,
    removed: pruned.removed,
    gate,
    gateLog,
    items: approved.slice(0, added),
  };
}

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (isMain) {
  run()
    .then((r) => {
      console.log(
        `[promote] scanned=${r.scanned} candidates=${r.candidates} added=${r.added} removed=${r.removed.length} gate=${r.gate}`,
      );
      for (const c of r.items || []) console.log(`  + ${c.q} (${c.count} 次) -> ${c.niche.id}`);
      for (const id of r.removed) console.log(`  - ${id} (零产出，已回收)`);
      for (const g of r.gateLog) {
        if (g.via === "probe" && !g.ok) console.log(`  x ${g.q} 未过准入 (raw=${g.raw} items=${g.items})`);
        if (g.via === "probe-error") console.log(`  x ${g.q} probe 失败，保守跳过 (${g.message})`);
      }
    })
    .catch((err) => {
      console.error("[promote] failed:", err.message);
      process.exit(1);
    });
}
