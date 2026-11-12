/**
 * 冷启动引导历史生成器（只应在演示 / 首次部署时运行一次）。
 *
 * 背景：趋势已从「单快照瞎猜」改成「多快照时序」，但历史是随 GitHub Actions
 * 每 6 小时采集一次才慢慢积累的。全新仓库只有 0~1 个快照，按规则所有赛道
 * 都会诚实显示「平稳（样本不足）」，三种趋势芯片无法被看到。
 *
 * 本脚本生成一段明确标注 seeded 的引导历史，让三种趋势立刻可区分、便于验收；
 * 关键诚实性设计：
 *  1. 每个赛道的【最后一个快照 = 当前真实采集的聚合值】，与真实数据无缝衔接；
 *  2. 之前的序列按目标形态（rising / steady / peaked）确定性生成，并标注 seeded；
 *  3. 每个快照带 seeded:true；appendHistory 在真实快照攒够 12 个后自动剔除
 *     全部引导快照并把顶层 seeded 翻为 false —— 引导数据会自然退役，无需人工干预；
 *  4. 前端在 seeded 期间显示提示文案，不把演示趋势冒充真实趋势。
 *
 * 用法：node scripts/seed-history.mjs
 * 输出：data/history.json 与 public/history.json（覆盖）
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateByNiche } from "./ingest-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const N = 12; // 引导快照数量
const STEP_MS = 6 * 3600 * 1000; // 与 Actions cron 间隔一致

/** 赛道 → 期望展示的趋势形态。覆盖三种芯片，且与赛道真实特征大体吻合。 */
const SHAPES = {
  "solo-crm": "rising",
  scheduling: "rising",
  "support-transcripts": "steady",
  "invoice-export": "peaked",
};

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 形态因子：p∈[0,1]，保证 p=1 时恰好为 1（末值锚定真实值）。 */
function factor(shape, p) {
  if (shape === "rising") return 0.42 + 0.58 * Math.pow(p, 1.15);
  if (shape === "steady") return 0.94 + 0.06 * p;
  // peaked：先冲高再回落，末值回落到真实值，峰值≈1.88×真实值（满足回落 ≥15% 判定）
  const hump = (x) => Math.exp(-Math.pow((x - 0.5) / 0.26, 2));
  return 1 + 0.9 * (hump(p) - hump(1));
}

const opp = JSON.parse(await fs.readFile(path.join(ROOT, "data", "opportunities.json"), "utf8"));
const current = aggregateByNiche(opp.items || []);
const endT = Date.parse(opp.generatedAt) || Date.now();
const ids = Object.keys(current);
if (ids.length < 3) {
  console.error("[seed-history] 真实数据赛道数不足 3，拒绝生成引导历史");
  process.exit(1);
}

const rnd = {};
for (const id of ids) rnd[id] = mulberry32(hashSeed(id));

const snapshots = [];
for (let i = 0; i < N; i++) {
  const p = i / (N - 1);
  const isLast = i === N - 1;
  const byNiche = {};
  for (const id of ids) {
    const now = current[id];
    const jitter = isLast ? 0 : (rnd[id]() - 0.5) * 0.06;
    const f = Math.max(0.1, factor(SHAPES[id] || "steady", p) * (1 + jitter));
    byNiche[id] = {
      score: isLast ? now.score : Math.max(1, Math.round(now.score * (1 + (f - 1) * 0.35))),
      mentions: isLast ? now.mentions : Math.max(1, Math.round(now.mentions * f)),
      items: isLast ? now.items : Math.max(1, Math.round(now.items * f)),
    };
  }
  snapshots.push({
    t: new Date(endT - (N - 1 - i) * STEP_MS).toISOString(),
    seeded: true,
    methodVersion: 2, // B2 相关度召回口径；整段序列口径一致，不产生趋势断点
    byNiche,
  });
}

const history = {
  schemaVersion: 1,
  seeded: true,
  methodVersion: 2,
  note:
    "冷启动引导历史：各赛道最后一个快照为真实采集聚合值，其余为按目标形态确定性生成的演示序列。真实采集每 6 小时追加一个真实快照，攒够 12 个后 appendHistory 会自动剔除全部引导快照并把 seeded 置为 false。",
  maxSnapshots: 120,
  snapshots,
};

const json = `${JSON.stringify(history, null, 2)}\n`;
await fs.writeFile(path.join(ROOT, "data", "history.json"), json);
await fs.writeFile(path.join(ROOT, "public", "history.json"), json);

console.log(`[seed-history] 生成 ${N} 个引导快照，赛道 ${ids.length} 个`);
for (const id of ids) {
  const s = snapshots.map((x) => x.byNiche[id].mentions);
  console.log(`  ${id.padEnd(22)} ${SHAPES[id] || "steady"}`.padEnd(36) + ` mentions: ${s[0]} → ${Math.max(...s)}(峰) → ${s[s.length - 1]}(当前真实)`);
}
