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
import { aggregateByNiche, appendHistory, buildOpportunities, healthCheck, inheritTranslations } from "./ingest-lib.mjs";
import { createCollector } from "./connectors.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "scripts", "ingest.config.json");
const TIMEOUT_MS = 15_000;

const cfg = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
const now = new Date();

/**
 * 召回口径（B2 门禁）：
 * - 默认读 cfg.recall.method（relevance = 相关度排序）；
 * - 若离线评估脚本写入了 data/recall-eval.json 且 verdict=fallback，自动回退到
 *   旧的时间排序，保证「相关度不达标就保留旧口径」这一安全阀在采集时真正生效；
 * - 环境变量 IDEARADAR_RECALL_METHOD 可强制覆盖，便于本地对照与紧急回滚。
 */
const RECALL_EVAL_PATH = path.join(ROOT, "data", "recall-eval.json");
let recallVerdict = null;
try {
  recallVerdict = JSON.parse(await fs.readFile(RECALL_EVAL_PATH, "utf8"));
} catch {
  recallVerdict = null; // 未评估过时按配置默认值走
}
const recallCfg = cfg.recall || {};
const recallMethod =
  process.env.IDEARADAR_RECALL_METHOD ||
  (recallVerdict && recallVerdict.verdict === "fallback" ? "legacy" : recallCfg.method) ||
  "relevance";
const methodVersion = recallMethod === "relevance" ? 2 : 1;

const errors = [];
const collector = createCollector({ cfg, now, root: ROOT, errors });
const sourceStats = [];
let totalRaw = 0;
let totalComplaints = 0;
const opportunities = [];

const nicheMetrics = [];

for (const niche of cfg.niches) {
  // 召回走 connectors.mjs 的共享实现 —— 与离线评估脚本完全同一份代码。
  const { rows: raw, sourceStats: stats } = await collector.collectNiche(niche, {
    method: recallMethod,
    queryLimit: Number(process.env.INGEST_QUERY_LIMIT || niche.queries.length),
  });
  sourceStats.push(...stats);

  // 判定链完全由 ingest-lib.mjs 的 buildOpportunities 提供（与离线评估脚本同一真源）：
  // 噪音标题 → 正文非空 → 正文抱怨信号 → 主题门槛 → 去重 → 评分 → 过滤低分。
  const built = buildOpportunities(raw, {
    niche,
    cfg,
    now,
    topicScope: recallCfg.topicScope || "any",
  });
  totalRaw += built.stats.raw;
  totalComplaints += built.stats.complaintRecords;
  opportunities.push(...built.items);
  nicheMetrics.push({ niche: niche.id, method: recallMethod, ...built.metrics });
}

opportunities.sort((a, b) => b.score - a.score || b.mentions - a.mentions || a.id.localeCompare(b.id));

/**
 * 译文缓存随产物文件走：本轮会整体重写 opportunities.json，先从上一批把
 * 「同 id、同英文原文」的 titleZh/quoteZh 继承过来，避免每 6 小时全量重翻，
 * 也避免翻译步骤偶发失败时把已有中文冲掉。零新增数据文件 = 不制造 rebase 冲突源。
 */
let prevItems = [];
try {
  const prev = JSON.parse(await fs.readFile(path.join(ROOT, "data", "opportunities.json"), "utf8"));
  if (prev && Array.isArray(prev.items)) prevItems = prev.items;
} catch {
  prevItems = []; // 首次运行 / 产物损坏时按全新翻译处理
}
const items = inheritTranslations(prevItems, opportunities.slice(0, cfg.maxItems));

const output = {
  schemaVersion: 1,
  generatedAt: now.toISOString(),
  lookbackDays: cfg.lookbackDays,
  minScore: cfg.minScore,
  // B2：召回口径与逐赛道相关度指标，供离线评估、CI 与人工复核追溯。
  recall: {
    method: recallMethod,
    methodVersion,
    verdict: recallVerdict?.verdict ?? "unevaluated",
    topicScope: recallCfg.topicScope || "any",
    nicheMetrics,
  },
  connectors: collector.labels.map((c) => ({
    id: c.id,
    label: c.label,
    enabled: c.enabled,
    rows: sourceStats.filter((s) => s.source === c.id).reduce((sum, s) => sum + s.count, 0),
  })),
  totals: { rawRecords: totalRaw, complaintRecords: totalComplaints, opportunities: items.length },
  errors,
  items,
};

/**
 * 产物健全性下限（务必在任何写文件之前）：
 * 门禁+采集同轮跑 3 次全量召回，若 GitHub 被限流，items 会塌到个位数。
 * 这种残缺数据若被提交，还会追加一个畸形快照污染趋势历史。因此检测：
 *  - items 低于 minHealthyItems（默认 16，约为 4 赛道各 4 条）
 *  - 或某个主网络源（github/hn）本轮 0 行且有 403/429 错误
 * 命中即 fail，让 Actions 报错并保持仓库里上一份完整数据不变。
 * 可用 INGEST_MIN_ITEMS=0 显式跳过（仅用于本地诊断）。
 */
const minHealthy = Number(process.env.INGEST_MIN_ITEMS ?? recallCfg.minHealthyItems ?? 16);
const unhealthyReasons = healthCheck({ itemCount: items.length, minHealthyItems: minHealthy, sourceStats, errors });
if (unhealthyReasons.length) {
  console.error(`[ingest] 产物不健全，拒绝写入: ${unhealthyReasons.join("; ")}`);
  console.error(`[ingest] errors=${errors.length} | 前几项: ${errors.slice(0, 5).map((e) => `${e.source}:${e.message}`).join(" | ")}`);
  process.exit(1);
}

await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
await fs.mkdir(path.join(ROOT, "public"), { recursive: true });
const json = `${JSON.stringify(output, null, 2)}\n`;
await fs.writeFile(path.join(ROOT, "data", "opportunities.json"), json);
await fs.writeFile(path.join(ROOT, "public", "opportunities.json"), json);

// 趋势追踪：把本次运行的「按 niche 聚合快照」追加进历史，供发现流计算上升/平稳/过峰。
const historyPath = path.join(ROOT, "data", "history.json");
const publicHistoryPath = path.join(ROOT, "public", "history.json");
let prevHistory = null;
try {
  prevHistory = await fs.readFile(historyPath, "utf8");
} catch {
  prevHistory = null;
}
const snapshot = { t: output.generatedAt, byNiche: aggregateByNiche(items), methodVersion };
const history = appendHistory(prevHistory, snapshot, 120);
// 口径版本写在顶层，供前端在「序列里出现口径切换」时诚实标注（不掩盖趋势断点）。
history.methodVersion = methodVersion;
const historyJson = `${JSON.stringify(history, null, 2)}\n`;
await fs.writeFile(historyPath, historyJson);
await fs.writeFile(publicHistoryPath, historyJson);

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

console.log(`[ingest] connectors: ${collector.connectorIds.join(", ")}`);
console.log(`[ingest] recall: ${recallMethod} (verdict=${recallVerdict?.verdict ?? "unevaluated"})`);
console.log(`[ingest] raw=${totalRaw} complaints=${totalComplaints} opportunities=${items.length}`);
console.log(`[ingest] errors=${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(`  - ${e.source}: ${e.message}`);

const allFailed = collector.connectorIds.every((id) => !sourceStats.some((s) => s.source === id && s.count > 0)) && totalRaw === 0;
if (allFailed) {
  console.error("[ingest] all connectors returned no data — failing the run for visibility");
  process.exit(1);
}
