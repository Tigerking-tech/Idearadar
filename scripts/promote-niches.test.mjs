import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  pickCandidates,
  applyCandidates,
  passesRecallGate,
  candidateEvidence,
  pruneIdleAutoNiches,
  run,
} from "./promote-niches.mjs";

const baseNiches = [
  { id: "solo-crm", label: "CRM complexity for solo founders", topicTerms: ["crm"], queries: ["CRM"] },
];

async function scaffold(records, config = { lookbackDays: 30, niches: [] }, opp = null) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-promote-"));
  await fs.mkdir(path.join(root, "data"), { recursive: true });
  await fs.mkdir(path.join(root, "scripts"), { recursive: true });
  await fs.writeFile(
    path.join(root, "data", "query-scans.json"),
    JSON.stringify({ version: 1, queries: records }),
  );
  await fs.writeFile(
    path.join(root, "scripts", "ingest.config.json"),
    JSON.stringify(config, null, 2),
  );
  if (opp) {
    await fs.writeFile(path.join(root, "data", "opportunities.json"), JSON.stringify(opp));
  }
  return root;
}

/* ------------------------- pickCandidates / applyCandidates ------------------------- */

test("pickCandidates 只提升达到次数阈值的方向，元词与过短词不计", () => {
  const records = [
    { q: "宠物寄养" }, { q: "宠物寄养" },
    { q: "健身打卡" },
    { q: "创意需求" }, { q: "创意需求" }, { q: "创意需求" },
    { q: "ab" },
  ];
  const out = pickCandidates(records, baseNiches);
  assert.equal(out.length, 1);
  assert.equal(out[0].q, "宠物寄养");
  assert.equal(out[0].count, 2);
});

test("pickCandidates 排除已覆盖赛道，中文方向补英文检索词", () => {
  const records = [{ q: "CRM" }, { q: "CRM" }, { q: "宠物寄养" }, { q: "宠物寄养" }];
  const out = pickCandidates(records, baseNiches, { minCount: 2 });
  assert.equal(out.length, 1);
  assert.equal(out[0].q, "宠物寄养");
  assert.ok(out[0].niche.queries.includes("pet app"));
  assert.equal(out[0].niche.auto, true);
  assert.match(out[0].niche.id, /^auto-/);
});

test("pickCandidates 按次数降序并受 maxAdd 限制", () => {
  const records = [
    ...Array.from({ length: 5 }, () => ({ q: "方向甲" })),
    ...Array.from({ length: 4 }, () => ({ q: "方向乙" })),
    ...Array.from({ length: 3 }, () => ({ q: "方向丙" })),
  ];
  const out = pickCandidates(records, [], { maxAdd: 2 });
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => x.q), ["方向甲", "方向乙"]);
});

test("pickCandidates 大小写不同视为同一方向并累加次数", () => {
  const out = pickCandidates([{ q: "Pet Sitting" }, { q: "pet sitting" }], [], { minCount: 2 });
  assert.equal(out.length, 1);
  assert.equal(out[0].count, 2);
});

test("applyCandidates 幂等：重复合并同一候选不产生第二条赛道", () => {
  const [c] = pickCandidates([{ q: "宠物寄养" }, { q: "宠物寄养" }], [], { minCount: 2 });
  const first = applyCandidates({ niches: [], lookbackDays: 30 }, [c]);
  assert.equal(first.added, 1);
  assert.equal(first.config.niches.length, 1);
  const second = applyCandidates(first.config, [c]);
  assert.equal(second.added, 0);
  assert.equal(second.config.niches.length, 1);
  assert.equal(second.config.lookbackDays, 30, "其他配置字段必须原样保留");
});

/* ------------------------- 召回准入闸门纯函数 ------------------------- */

test("passesRecallGate：raw 与 items 双阈值，缺字段按 0 且 fail-closed", () => {
  assert.equal(passesRecallGate({ raw: 3, items: 1 }).ok, true);
  assert.equal(passesRecallGate({ raw: 10, items: 0 }).ok, false, "召回一堆但产不出条目仍空转");
  assert.equal(passesRecallGate({ raw: 2, items: 3 }).ok, false, "raw 不足");
  assert.equal(passesRecallGate({}).ok, false);
  assert.equal(passesRecallGate(null).ok, false);
  assert.equal(passesRecallGate({ raw: 1, items: 1 }, { minRaw: 1 }).ok, true, "阈值可覆盖");
});

test("candidateEvidence：按方向大小写无关查高分候选", () => {
  const dirs = [
    { q: "Pet Sitting", items: [{ score: 60 }, { score: 30 }] },
    { q: "健身打卡", items: [{ score: 20 }] },
  ];
  assert.equal(candidateEvidence(dirs, "pet sitting").has, true);
  assert.equal(candidateEvidence(dirs, "pet sitting").best, 60);
  assert.equal(candidateEvidence(dirs, "健身打卡").has, false, "分数低于门槛不算证据");
  assert.equal(candidateEvidence(dirs, "未搜过").has, false);
  assert.equal(candidateEvidence(dirs, "健身打卡", { minScore: 20 }).has, true);
});

test("pruneIdleAutoNiches：只回收零产出 auto 赛道，人工主赛道绝不动", () => {
  const config = {
    lookbackDays: 30,
    niches: [
      { id: "solo-crm", label: "CRM" },
      { id: "scheduling", label: "Scheduling" },
      { id: "auto-pet-booking", auto: true },
      { id: "auto-pet-care", auto: true },
    ],
  };
  const metrics = [
    { niche: "solo-crm", itemCount: 0 },        // 人工赛道零产出也不动
    { niche: "scheduling", itemCount: 7 },
    { niche: "auto-pet-booking", itemCount: 0 }, // 回收
    { niche: "auto-pet-care", itemCount: 3 },    // 保留
  ];
  const { config: next, removed } = pruneIdleAutoNiches(config, metrics);
  assert.deepEqual(removed, ["auto-pet-booking"]);
  assert.deepEqual(next.niches.map((n) => n.id), ["solo-crm", "scheduling", "auto-pet-care"]);
  assert.equal(next.lookbackDays, 30);
  assert.equal(config.niches.length, 4, "不得修改入参");
  const none = pruneIdleAutoNiches(config, []);
  assert.deepEqual(none.removed, []);
  assert.equal(none.config, config, "无回收时返回原对象");
});

/* ------------------------- run 编排 ------------------------- */

test("run（关闭闸门）在临时目录写入配置并可重复执行", async () => {
  const root = await scaffold([{ q: "宠物寄养" }, { q: "宠物寄养" }, { q: "健身打卡" }]);
  try {
    const r1 = await run({ root, gateEnabled: false });
    assert.equal(r1.scanned, 3);
    assert.equal(r1.added, 1);
    const cfg = JSON.parse(await fs.readFile(path.join(root, "scripts", "ingest.config.json"), "utf8"));
    assert.equal(cfg.niches.length, 1);
    assert.equal(cfg.niches[0].label, "宠物寄养");
    const r2 = await run({ root, gateEnabled: false });
    assert.equal(r2.added, 0, "第二次运行不应重复追加");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("run 读不到 query-scans.json 时静默跳过，不改配置", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-promote-empty-"));
  try {
    await fs.mkdir(path.join(root, "scripts"), { recursive: true });
    await fs.writeFile(path.join(root, "scripts", "ingest.config.json"), JSON.stringify({ niches: [] }));
    const r = await run({ root, gateEnabled: false });
    assert.equal(r.added, 0);
    assert.equal(r.scanned, 0);
    const cfg = JSON.parse(await fs.readFile(path.join(root, "scripts", "ingest.config.json"), "utf8"));
    assert.equal(cfg.niches.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("准入闸门：零召回方向不提升（这正是空转赛道的根因）", async () => {
  const root = await scaffold([{ q: "宠物寄养" }, { q: "宠物寄养" }]);
  try {
    const r = await run({ root, probeFn: async () => ({ raw: 0, items: 0 }) });
    assert.equal(r.gate, true);
    assert.equal(r.added, 0, "零召回必须 fail-closed");
    assert.equal(r.candidates, 1);
    const cfg = JSON.parse(await fs.readFile(path.join(root, "scripts", "ingest.config.json"), "utf8"));
    assert.equal(cfg.niches.length, 0);
    assert.equal(r.gateLog[0].via, "probe");
    assert.equal(r.gateLog[0].ok, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("准入闸门：召回达阈值才提升", async () => {
  const root = await scaffold([{ q: "invoice export" }, { q: "invoice export" }]);
  try {
    const r = await run({ root, probeFn: async () => ({ raw: 12, items: 2 }) });
    assert.equal(r.added, 1);
    const cfg = JSON.parse(await fs.readFile(path.join(root, "scripts", "ingest.config.json"), "utf8"));
    assert.equal(cfg.niches[0].label, "invoice export");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("PROBE=0 但闸门开：无证据方向 fail-closed，不退回「只看次数」", async () => {
  const root = await scaffold([{ q: "宠物寄养" }, { q: "宠物寄养" }]);
  try {
    const r = await run({
      root,
      env: { IDEARADAR_PROMOTE_PROBE: "0" },
      probeFn: async () => { throw new Error("probe 不该被调用"); },
    });
    assert.equal(r.gate, true, "闸门必须仍然开启");
    assert.equal(r.added, 0, "无落盘证据且不做 probe 时不得提升");
    assert.equal(r.gateLog[0].via, "no-evidence");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("GATE=0 紧急回滚：完全关闭闸门，恢复只看次数", async () => {
  const root = await scaffold([{ q: "宠物寄养" }, { q: "宠物寄养" }]);
  try {
    const r = await run({
      root,
      env: { IDEARADAR_PROMOTE_GATE: "0" },
      probeFn: async () => { throw new Error("probe 不该被调用"); },
    });
    assert.equal(r.gate, false);
    assert.equal(r.added, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("准入闸门：probe 抛错时保守跳过且不崩溃", async () => {
  const root = await scaffold([{ q: "宠物寄养" }, { q: "宠物寄养" }]);
  try {
    const r = await run({ root, probeFn: async () => { throw new Error("network down"); } });
    assert.equal(r.added, 0);
    assert.equal(r.gateLog[0].via, "probe-error");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("准入闸门：有高分候选证据时走快速通道，不再调用 probe", async () => {
  const root = await scaffold(
    [{ q: "pet care" }, { q: "pet care" }],
    { lookbackDays: 30, niches: [] },
  );
  try {
    await fs.writeFile(
      path.join(root, "data", "scan-candidates.json"),
      JSON.stringify({ version: 1, directions: [{ q: "pet care", items: [{ score: 72 }] }] }),
    );
    let probed = 0;
    const r = await run({
      root,
      probeFn: async () => { probed += 1; return { raw: 0, items: 0 }; },
    });
    assert.equal(probed, 0, "有证据就不该再发网络请求");
    assert.equal(r.added, 1);
    assert.equal(r.gateLog[0].via, "evidence");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("run 回收本轮零产出 auto 赛道并写回配置", async () => {
  const config = {
    lookbackDays: 30,
    niches: [
      { id: "solo-crm", label: "CRM" },
      { id: "auto-pet-booking", label: "pet app booking", auto: true },
    ],
  };
  const opp = {
    recall: { nicheMetrics: [
      { niche: "solo-crm", itemCount: 7, finalTitleRate: 0.7 },
      { niche: "auto-pet-booking", itemCount: 0, finalTitleRate: 0 },
    ] },
  };
  const root = await scaffold([], config, opp);
  try {
    const r = await run({ root, gateEnabled: false });
    assert.deepEqual(r.removed, ["auto-pet-booking"]);
    const cfg = JSON.parse(await fs.readFile(path.join(root, "scripts", "ingest.config.json"), "utf8"));
    assert.deepEqual(cfg.niches.map((n) => n.id), ["solo-crm"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
