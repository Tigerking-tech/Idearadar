import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pickCandidates, applyCandidates, run } from "./promote-niches.mjs";

const baseNiches = [
  { id: "solo-crm", label: "CRM complexity for solo founders", topicTerms: ["crm"], queries: ["CRM"] },
];

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

test("run 在临时目录里写入配置并可重复执行", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-promote-"));
  try {
    await fs.mkdir(path.join(root, "data"), { recursive: true });
    await fs.mkdir(path.join(root, "scripts"), { recursive: true });
    await fs.writeFile(
      path.join(root, "data", "query-scans.json"),
      JSON.stringify({ version: 1, queries: [{ q: "宠物寄养" }, { q: "宠物寄养" }, { q: "健身打卡" }] }),
    );
    await fs.writeFile(
      path.join(root, "scripts", "ingest.config.json"),
      JSON.stringify({ lookbackDays: 30, niches: [] }, null, 2),
    );
    const r1 = await run({ root });
    assert.equal(r1.scanned, 3);
    assert.equal(r1.added, 1);
    const cfg = JSON.parse(await fs.readFile(path.join(root, "scripts", "ingest.config.json"), "utf8"));
    assert.equal(cfg.niches.length, 1);
    assert.equal(cfg.niches[0].label, "宠物寄养");
    const r2 = await run({ root });
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
    const r = await run({ root });
    assert.equal(r.added, 0);
    assert.equal(r.scanned, 0);
    const cfg = JSON.parse(await fs.readFile(path.join(root, "scripts", "ingest.config.json"), "utf8"));
    assert.equal(cfg.niches.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
