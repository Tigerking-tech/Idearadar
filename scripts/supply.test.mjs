import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePublicSnapshot,
  mergeProjects,
  matchNicheSupply,
  buildSupplyDoc,
  DEFAULT_ENDPOINTS,
  run,
} from "./supply.mjs";

const niches = [
  { id: "solo-crm", topicTerms: ["crm", "sales pipeline"], queries: ["CRM"] },
  { id: "invoice-export", topicTerms: ["invoice", "bookkeeping"], queries: ["invoice export"] },
];

const aiSnapshot = {
  recentlyListedStartups: [
    {
      slug: "crm-one", name: "CRM One", description: "A simple CRM for small sales teams",
      category: "SaaS", url: "https://trustmrr.com/startup/crm-one",
      revenue: { mrr: 0 }, growthMRR30d: 0,
    },
    {
      slug: "invoice-ly", name: "InvoiceLy", description: "Bookkeeping and invoice export tool",
      category: "Finance", url: "https://trustmrr.com/startup/invoice-ly",
      revenue: { mrr: 0 }, growthMRR30d: 0,
    },
  ],
  bestDeals: [
    // 与 recentlyListedStartups 重复 slug，应被去重
    { slug: "crm-one", name: "CRM One dup", description: "dup", category: "SaaS" },
    { slug: "scrm-bad", name: "SCRMsuite", description: "social media tool", category: "Marketing" },
  ],
};
const discoverySnapshot = {
  recentlyAddedStartups: [
    { slug: "pet-care", name: "PetCare", description: "pet sitting reminders", category: "Mobile Apps" },
  ],
  fastestGrowingStartups: [],
};

test("parsePublicSnapshot 抽取可引用字段、按 slug 去重、容忍缺字段与非法 url", () => {
  const out = parsePublicSnapshot(aiSnapshot);
  assert.equal(out.length, 3, "4 条里 crm-one 重复，应去重成 3");
  const crm = out.find((x) => x.slug === "crm-one");
  assert.equal(crm.name, "CRM One");
  assert.equal(crm.category, "SaaS");
  // 缺 url 时用规范化的原页链接，不编造外部网址
  const pet = parsePublicSnapshot(discoverySnapshot).find((x) => x.slug === "pet-care");
  assert.equal(pet.url, "https://trustmrr.com/startup/pet-care");
  assert.deepEqual(parsePublicSnapshot(null), []);
  assert.deepEqual(parsePublicSnapshot("x"), []);
  assert.deepEqual(parsePublicSnapshot({ metricAccess: "x" }), []);
});

test("mergeProjects 跨端点按 slug 去重", () => {
  const all = mergeProjects([parsePublicSnapshot(aiSnapshot), parsePublicSnapshot(discoverySnapshot)]);
  assert.equal(all.length, 4, "crm-one 去重，共 4 个不同 slug");
  assert.equal(new Set(all.map((x) => x.slug)).size, 4);
});

test("matchNicheSupply 按词边界命中，子串不误命中，返回真实命中项目与计数", () => {
  const projects = mergeProjects([parsePublicSnapshot(aiSnapshot)]);
  const byNiche = matchNicheSupply(projects, niches);
  assert.equal(byNiche["solo-crm"].matched, true);
  assert.equal(byNiche["solo-crm"].count, 1);
  assert.equal(byNiche["solo-crm"].projects[0].name, "CRM One");
  // SCRMsuite 含 crm 子串，但词边界不应命中
  assert.ok(!byNiche["solo-crm"].projects.some((p) => p.name === "SCRMsuite"));
  assert.equal(byNiche["invoice-export"].matched, true);
  assert.equal(byNiche["invoice-export"].count, 1, "InvoiceLy 命中 invoice/bookkeeping");
  const none = matchNicheSupply([{ slug: "x", name: "Gossip App", description: "celebrity news", category: "Media" }], niches);
  assert.equal(none["solo-crm"].matched, false);
  assert.equal(none["solo-crm"].count, 0);
  assert.deepEqual(none["solo-crm"].projects, []);
});

test("matchNicheSupply 中文词按包含匹配，maxPerNiche 限制展示条数，空输入安全", () => {
  const zh = [{ id: "pet", topicTerms: ["宠物寄养"], queries: ["宠物"] }];
  const projects = [
    { slug: "a", name: "A", description: "宠物寄养平台", category: null, url: "u" },
    { slug: "b", name: "B", description: "宠物用品", category: null, url: "u" },
  ];
  const hit = matchNicheSupply(projects, zh);
  assert.equal(hit.pet.matched, true);
  assert.equal(hit.pet.count, 2);
  const capped = matchNicheSupply(projects, zh, { maxPerNiche: 1 });
  assert.equal(capped.pet.count, 1, "上限生效");
  assert.deepEqual(matchNicheSupply([], []), {});
  assert.deepEqual(matchNicheSupply(null, null), {});
});

test("buildSupplyDoc：sampleSize 是真实去重计数，不编造胜率/增速，unavailable 时 byNiche 为空", () => {
  const projects = mergeProjects([parsePublicSnapshot(aiSnapshot), parsePublicSnapshot(discoverySnapshot)]);
  const ok = buildSupplyDoc({
    projects, niches, status: "ok", at: new Date("2026-11-16T00:00:00Z"),
  });
  assert.equal(ok.status, "ok");
  assert.equal(ok.schemaVersion, 1);
  assert.equal(ok.sampleSize, 4, "真实项目数，不是赛道总数或百分比");
  assert.equal(ok.generatedAt, "2026-11-16T00:00:00.000Z");
  assert.equal(ok.source, "https://trustmrr.com");
  assert.deepEqual(ok.endpoints, DEFAULT_ENDPOINTS);
  // 关键防回归：产物里绝不出现胜率/中位增速/百分比字段
  const json = JSON.stringify(ok);
  assert.ok(!/winRate|win_rate|medianGrowth|successRate|过千|胜率|percent/i.test(json), "不得编造成功率类数字");
  const down = buildSupplyDoc({ status: "unavailable", niches });
  assert.deepEqual(down.byNiche, {}, "不可用时不给任何赛道假数据");
  assert.equal(down.sampleSize, 0);
});

test("run 成功抓取时写 data/ 与 public/ 两份一致产物", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-supply-"));
  try {
    const doc = await run({
      root, env: {}, config: { niches },
      fetchImpl: async (url) => ({
        ok: true, status: 200,
        json: async () => (url.includes("discovery") ? discoverySnapshot : aiSnapshot),
      }),
    });
    assert.equal(doc.status, "ok");
    assert.equal(doc.sampleSize, 4);
    const data = JSON.parse(await fs.readFile(path.join(root, "data", "supply.json"), "utf8"));
    const pub = JSON.parse(await fs.readFile(path.join(root, "public", "supply.json"), "utf8"));
    assert.deepEqual(data, pub, "两份产物必须一致");
    assert.equal(data.byNiche["solo-crm"].matched, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("run 抓取失败 / 抓到 0 条时诚实降级 unavailable，不抛异常", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-supply-down-"));
  try {
    const down = await run({
      root, env: {}, config: { niches },
      fetchImpl: async () => { throw new Error("offline"); },
    });
    assert.equal(down.status, "unavailable");
    assert.equal(down.sampleSize, 0);
    const empty = await run({
      root, env: {}, config: { niches },
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    });
    assert.equal(empty.status, "unavailable", "0 个项目视为端点改版");
    const saved = JSON.parse(await fs.readFile(path.join(root, "data", "supply.json"), "utf8"));
    assert.equal(saved.status, "unavailable");
    assert.deepEqual(saved.byNiche, {});
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
