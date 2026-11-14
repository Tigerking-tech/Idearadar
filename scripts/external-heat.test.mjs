import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTraffic,
  parseTrendingRss,
  matchNicheHeat,
  buildExternalHeatDoc,
  run,
} from "./external-heat.mjs";

const niches = [
  {
    id: "solo-crm",
    topicTerms: ["crm", "sales pipeline", "salesforce"],
    queries: ["CRM", "hubspot"],
  },
  { id: "invoice-export", topicTerms: ["invoice", "quickbooks"], queries: ["invoice export"] },
];

test("parseTraffic 解析带逗号与加号的 approx_traffic，非法值返回 null", () => {
  assert.equal(parseTraffic("20,000+"), 20000);
  assert.equal(parseTraffic("1,000,000+"), 1000000);
  assert.equal(parseTraffic("Breakout"), null);
  assert.equal(parseTraffic(""), null);
  assert.equal(parseTraffic(null), null);
});

test("parseTrendingRss 解析 item 词表、去重、按流量降序，容忍缺字段", () => {
  const xml = `<rss xmlns:ht="https://trends.google.com/trending/rss"><channel>
    <item><title>CRM software</title><ht:approx_traffic>50,000+</ht:approx_traffic></item>
    <item><title>crm software</title><ht:approx_traffic>10,000+</ht:approx_traffic></item>
    <item><title>Invoice tool</title><ht:approx_traffic>200,000+</ht:approx_traffic></item>
    <item><title><![CDATA[QuickBooks]]></title></item>
  </channel></rss>`;
  const out = parseTrendingRss(xml);
  assert.equal(out.length, 3, "大小写重复词应去重");
  assert.equal(out[0].term, "Invoice tool", "按流量降序");
  assert.equal(out[0].traffic, 200000);
  assert.equal(out.find((x) => x.term === "QuickBooks").traffic, null, "缺流量的词仍保留但诚实为 null");
  assert.deepEqual(parseTrendingRss("not xml at all"), []);
});

test("matchNicheHeat 按词边界命中，未命中赛道明确标 matched=false", () => {
  const trends = [
    { term: "Salesforce CRM pricing", traffic: 50000 },
    { term: "SCRMsuite news", traffic: 900000 },  // crm 是子串，不应命中
    { term: "invoice export broken", traffic: 20000 },
  ];
  const byNiche = matchNicheHeat(trends, niches);
  assert.equal(byNiche["solo-crm"].matched, true);
  assert.equal(byNiche["solo-crm"].term, "Salesforce CRM pricing");
  assert.equal(byNiche["invoice-export"].matched, true);
  assert.equal(byNiche["invoice-export"].term, "invoice export broken");
  const none = matchNicheHeat([{ term: "celebrity gossip", traffic: 999999 }], niches);
  assert.equal(none["solo-crm"].matched, false);
  assert.equal(none["invoice-export"].matched, false);
});

test("matchNicheHeat 中文词按包含匹配，且空输入安全", () => {
  const zh = [{ id: "auto-pet", topicTerms: ["宠物寄养"], queries: ["宠物寄养"] }];
  const hit = matchNicheHeat([{ term: "宠物寄养平台推荐", traffic: 10000 }], zh);
  assert.equal(hit["auto-pet"].matched, true);
  assert.deepEqual(matchNicheHeat([], []), {});
  assert.deepEqual(matchNicheHeat(null, null), {});
});

test("buildExternalHeatDoc：unavailable 时 byNiche 为空、记录 status 与 source", () => {
  const ok = buildExternalHeatDoc({
    trends: [{ term: "CRM", traffic: 1000 }],
    niches,
    status: "ok",
    at: new Date("2026-11-14T00:00:00Z"),
  });
  assert.equal(ok.status, "ok");
  assert.equal(ok.schemaVersion, 1);
  assert.equal(ok.trendCount, 1);
  assert.equal(ok.byNiche["solo-crm"].matched, true);
  assert.equal(ok.generatedAt, "2026-11-14T00:00:00.000Z");
  const down = buildExternalHeatDoc({ status: "unavailable", niches, at: new Date("2026-11-14T00:00:00Z") });
  assert.deepEqual(down.byNiche, {}, "不可用时不给任何赛道假数据");
  assert.equal(down.trendCount, 0);
});

test("run 成功抓取时写 data/ 与 public/ 两份一致产物", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-heat-"));
  try {
    const xml = `<rss><channel><item><title>CRM software</title><ht:approx_traffic>5,000+</ht:approx_traffic></item></channel></rss>`;
    const doc = await run({
      root,
      env: {},
      config: { niches },
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => xml }),
    });
    assert.equal(doc.status, "ok");
    const data = JSON.parse(await fs.readFile(path.join(root, "data", "external-heat.json"), "utf8"));
    const pub = JSON.parse(await fs.readFile(path.join(root, "public", "external-heat.json"), "utf8"));
    assert.deepEqual(data, pub, "两份产物必须一致");
    assert.equal(data.byNiche["solo-crm"].matched, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("run 抓取失败 / 返回空词表时诚实降级为 unavailable，不抛异常", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-heat-down-"));
  try {
    const down = await run({
      root, env: {}, config: { niches },
      fetchImpl: async () => { throw new Error("offline"); },
    });
    assert.equal(down.status, "unavailable");
    const empty = await run({
      root, env: {}, config: { niches },
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "<rss><channel></channel></rss>" }),
    });
    assert.equal(empty.status, "unavailable", "0 条热搜视为端点改版");
    const saved = JSON.parse(await fs.readFile(path.join(root, "data", "external-heat.json"), "utf8"));
    assert.equal(saved.status, "unavailable");
    assert.deepEqual(saved.byNiche, {});
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
