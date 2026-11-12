/**
 * B2 离线评估门禁 —— 决定线上采集用「相关度召回」还是回退到「时间排序」。
 *
 * 为什么可信：召回函数（connectors.mjs）与入选判定（ingest-lib.mjs 的
 * buildOpportunities）都与线上采集脚本完全共享同一份代码，评估不是另写一套
 * fetch 去猜，而是把两种排序口径真的各跑一遍完整管线，再比较结果。
 *
 * 流程：
 *   1. 对每个 niche 分别用 relevance / legacy 两种口径召回；
 *   2. 各自走 buildOpportunities 得到 items，与线上一样全局排序并截到 maxItems；
 *   3. 计算「最终标题相关率」与「召回层标题相关率」；
 *   4. evaluateRecall 纯函数给出 verdict；
 *   5. --write（默认）把 verdict 写入 data/recall-eval.json —— ingest.mjs 会读它，
 *      fallback 时自动保留旧的时间排序；
 *   6. 在 GitHub Actions 里 fallback 会输出 ::warning:: 并写 step summary。
 *
 * 用法：
 *   node scripts/eval-recall.mjs                 # 评估并写入 verdict
 *   node scripts/eval-recall.mjs --no-write     # 仅诊断，不改 verdict
 *   EVAL_QUERY_LIMIT=1 node scripts/eval-recall.mjs   # 每赛道只跑首条 query（快速）
 *
 * 输出：stdout 对照表 + data/recall-eval.json（--write 时）
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpportunities, matchTopic, evaluateRecall } from "./ingest-lib.mjs";
import { createCollector } from "./connectors.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "scripts", "ingest.config.json");
const OUT_PATH = path.join(ROOT, "data", "recall-eval.json");
const PUBLIC_OUT_PATH = path.join(ROOT, "public", "recall-eval.json");

const argv = process.argv.slice(2);
const WRITE = !argv.includes("--no-write");
const QUICK = argv.includes("--quick");

const cfg = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
const recallCfg = cfg.recall || {};
const now = new Date();
const errors = [];
const collector = createCollector({ cfg, now, root: ROOT, errors });
const termsByNiche = new Map(cfg.niches.map((n) => [n.id, n.topicTerms || []]));
// 与 ingest.mjs 完全一致：默认跑每个赛道的全部 query。EVAL_QUERY_LIMIT 仅用于
// 本地快速诊断，不能用于产出 verdict（会与线上数据量不一致）。
const queryLimit = Number(process.env.EVAL_QUERY_LIMIT || (QUICK ? 1 : cfg.niches[0].queries.length));
const nicheList = cfg.niches;
const delayMs = Number(process.env.EVAL_DELAY_MS || 800);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 跑一种口径的完整管线，返回与线上同构的全局 items 与指标。 */
async function runMethod(method) {
  const allItems = [];
  const allRaw = [];
  const perNiche = [];
  for (const niche of nicheList) {
    const { rows } = await collector.collectNiche(niche, { method, queryLimit });
    const built = buildOpportunities(rows, {
      niche,
      cfg,
      now,
      topicScope: recallCfg.topicScope || "any",
    });
    allRaw.push(...rows.map((r) => ({ ...r, nicheId: niche.id })));
    allItems.push(...built.items);
    perNiche.push({ niche: niche.id, ...built.metrics, stats: built.stats });
    if (delayMs > 0) await sleep(delayMs);
  }
  allItems.sort((a, b) => b.score - a.score || b.mentions - a.mentions || a.id.localeCompare(b.id));
  const items = allItems.slice(0, cfg.maxItems);

  // 每条记录只用「自己赛道」的主题词判定，避免跨赛道词汇造成相关率虚高。
  const titleHit = (r) => matchTopic(r.title, termsByNiche.get(r.nicheId) || []);
  const recallHits = allRaw.filter(titleHit).length;
  const finalHits = items.filter(titleHit).length;
  return {
    method,
    items,
    perNiche,
    metrics: {
      raw: allRaw.length,
      itemCount: items.length,
      recallHits,
      finalHits,
      recallTitleRate: allRaw.length ? recallHits / allRaw.length : 0,
      finalTitleRate: items.length ? finalHits / items.length : 0,
    },
  };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

console.log(`[eval-recall] 口径对照 | queryLimit=${queryLimit} | topicScope=${recallCfg.topicScope || "any"}`);
console.log("[eval-recall] 正在跑 relevance（相关度排序）…");
const relevance = await runMethod("relevance");
console.log("[eval-recall] 正在跑 legacy（时间排序，旧口径）…");
const legacy = await runMethod("legacy");

const thresholds = {
  minFinalTitleRate: Number(process.env.EVAL_MIN_RATE || recallCfg.minFinalTitleRate || 0.6),
  minItems: Number(process.env.EVAL_MIN_ITEMS || recallCfg.minItems || 24),
};
const decision = evaluateRecall({ relevance, legacy, ...thresholds });

console.log("\n=== 逐赛道对照 ===");
console.log("niche".padEnd(22) + "口径".padEnd(12) + "召回".padEnd(8) + "召回相关率".padEnd(14) + "入选".padEnd(8) + "最终相关率");
for (const niche of nicheList) {
  for (const m of [relevance, legacy]) {
    const p = m.perNiche.find((x) => x.niche === niche.id) || {};
    console.log(
      niche.id.padEnd(22) +
      m.method.padEnd(12) +
      String(p.raw ?? 0).padEnd(8) +
      pct(p.recallTitleRate ?? 0).padEnd(14) +
      String(p.itemCount ?? 0).padEnd(8) +
      pct(p.finalTitleRate ?? 0),
    );
  }
}

console.log("\n=== 全局 ===");
console.log(`relevance: items=${relevance.metrics.itemCount}  finalTitleRate=${pct(relevance.metrics.finalTitleRate)}  recallTitleRate=${pct(relevance.metrics.recallTitleRate)}`);
console.log(`legacy   : items=${legacy.metrics.itemCount}  finalTitleRate=${pct(legacy.metrics.finalTitleRate)}  recallTitleRate=${pct(legacy.metrics.recallTitleRate)}`);
console.log(`门槛     : minItems=${thresholds.minItems}  minFinalTitleRate=${pct(thresholds.minFinalTitleRate)}`);
console.log(`verdict  : ${decision.verdict.toUpperCase()} → method=${decision.method}`);
if (decision.reasons.length) console.log(`理由     : ${decision.reasons.join("; ")}`);
if (errors.length) console.log(`\n[eval-recall] 采集告警 ${errors.length} 条（前 5）:`);
for (const e of errors.slice(0, 5)) console.log(`  - ${e.source}: ${e.message}`);

// 保留样本标题，便于人工复核「相关率」这个数字是不是真的反映了内容质量。
const sample = (m) => m.items.slice(0, 8).map((it) => ({
  title: it.title,
  niche: it.nicheId,
  titleHit: matchTopic(it.title, termsByNiche.get(it.nicheId) || []),
}));

const report = {
  schemaVersion: 1,
  evaluatedAt: now.toISOString(),
  verdict: decision.verdict,
  method: decision.method,
  reasons: decision.reasons,
  thresholds,
  config: { queryLimit, topicScope: recallCfg.topicScope || "any", maxItems: cfg.maxItems },
  global: { relevance: relevance.metrics, legacy: legacy.metrics },
  perNiche: { relevance: relevance.perNiche, legacy: legacy.perNiche },
  samples: { relevance: sample(relevance), legacy: sample(legacy) },
  errors: errors.slice(0, 20),
};

if (WRITE) {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
  await fs.mkdir(path.join(ROOT, "public"), { recursive: true });
  await fs.writeFile(OUT_PATH, json);
  await fs.writeFile(PUBLIC_OUT_PATH, json);
  console.log(`\n[eval-recall] 已写入 ${path.relative(ROOT, OUT_PATH)}（ingest.mjs 会据此决定口径）`);
} else {
  console.log("\n[eval-recall] --no-write：未改动 verdict");
}

// CI 报警：只在 fallback 时提示，避免每次成功都刷屏。
if (decision.verdict === "fallback") {
  const msg = `Recall gate fell back to legacy time-sort: ${decision.reasons.join("; ")}`;
  console.log(`::warning::${msg}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `\n## ⚠️ Recall gate: fallback\n\n${msg}\n\n| | items | final title relevance |\n|---|---|---|\n| relevance | ${relevance.metrics.itemCount} | ${pct(relevance.metrics.finalTitleRate)} |\n| legacy | ${legacy.metrics.itemCount} | ${pct(legacy.metrics.finalTitleRate)} |\n`,
    );
  }
} else if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `\n## ✅ Recall gate: adopt relevance\n\nitems=${relevance.metrics.itemCount}, final title relevance=${pct(relevance.metrics.finalTitleRate)} (legacy ${pct(legacy.metrics.finalTitleRate)})\n`,
  );
}
