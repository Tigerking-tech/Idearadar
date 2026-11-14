import test from "node:test";
import assert from "node:assert/strict";
import { translateCardInsights } from "./translate.mjs";
import { buildCard, cardKey } from "./cards.mjs";

const NOW = new Date("2026-11-14T00:00:00Z");
const item = (id, title) => ({
  id,
  title,
  titleOriginal: title,
  score: 61,
  signals: ["broken", "manual"],
  sources: ["hn", "so"],
  mentions: 4,
  evidence: [{ excerpt: "the export keeps breaking and we copy everything manually" }],
});

function withCard(id, title) {
  const base = item(id, title);
  const card = buildCard({ ...base, nicheId: "invoice-export", lastSeen: "2026-11-13T00:00:00Z" }, NOW);
  return { ...base, opportunityCard: card, cardKey: cardKey(base) };
}

/** 依据请求体里的 {items:[{id,...}]} 回一条合法的洞察响应。 */
function insightFetch(overrides = {}) {
  const calls = [];
  const fn = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (overrides.fail) return { ok: false, status: 500, json: async () => ({}) };
    const items = (body.messages?.[1]?.content ? JSON.parse(body.messages[1].content).items : []) || [];
    const content = JSON.stringify({
      items: items.map((x) => ({ id: x.id, zh: "导出失败反复出现，值得先访谈。", en: "Export failures recur; interviews first." })),
    });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
  };
  fn.calls = calls;
  return fn;
}

test("默认关闭：不发起任何请求，卡片骨架原样保留", async () => {
  const fetchImpl = insightFetch();
  const items = [withCard("a", "Export keeps breaking")];
  const { items: out, stats } = await translateCardInsights(items, { enabled: false, token: "tk", fetchImpl });
  assert.equal(stats.enabled, false);
  assert.equal(stats.requests, 0);
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(out[0], items[0], "关闭时不得复制/修改对象");
  assert.ok(out[0].opportunityCard, "确定性卡片骨架仍在");
});

test("无 token 时跳过，不报错", async () => {
  const fetchImpl = insightFetch();
  const { stats } = await translateCardInsights([withCard("a", "Export keeps breaking")], { enabled: true, token: "", fetchImpl });
  assert.equal(stats.requests, 0);
  assert.equal(stats.skipped, 1);
});

test("开启后按 id 合并中英洞察，并写入增量缓存键", async () => {
  const fetchImpl = insightFetch();
  const items = [withCard("a", "Export keeps breaking"), withCard("b", "Booking loses slots")];
  const { items: out, stats } = await translateCardInsights(items, { enabled: true, token: "tk", fetchImpl });
  assert.equal(stats.done, 2);
  assert.equal(stats.requests, 1);
  assert.equal(out[0].opportunityCard.insight.zh, "导出失败反复出现，值得先访谈。");
  assert.equal(out[0].opportunityCard.insight.en, "Export failures recur; interviews first.");
  assert.ok(out[0].cardInsightKey, "应写入 cardInsightKey 供下轮命中缓存");
  // 送翻批次只含可核查字段，不含译文/证据正文
  const sent = JSON.parse(fetchImpl.calls[0].messages[1].content).items;
  assert.equal(sent.length, 2);
  assert.equal(sent[0].title, "Export keeps breaking");
  assert.equal(sent[0].evidence, undefined);
});

test("增量缓存：已有洞察且键未变时跳过，不再请求", async () => {
  const fetchImpl = insightFetch();
  const base = withCard("a", "Export keeps breaking");
  const cached = {
    ...base,
    opportunityCard: { ...base.opportunityCard, insight: { zh: "旧洞察", en: "old" } },
    cardInsightKey: base.cardKey,
  };
  const { items: out, stats } = await translateCardInsights([cached], { enabled: true, token: "tk", fetchImpl });
  assert.equal(stats.requests, 0);
  assert.equal(stats.skipped, 1);
  assert.equal(out[0].opportunityCard.insight.zh, "旧洞察");
});

test("模型返回空洞察时合并为空（字段缺失诚实留空），不破坏卡片", async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [{ id: "a", zh: "", en: "" }] }) } }] }),
  });
  const { items: out, stats } = await translateCardInsights([withCard("a", "Export keeps breaking")], { enabled: true, token: "tk", fetchImpl });
  assert.equal(stats.done, 1);
  assert.equal(out[0].opportunityCard.insight, undefined, "空洞察不写入");
  assert.equal(out[0].opportunityCard.version, 1, "卡片骨架完整");
});

test("请求失败静默跳过，卡片骨架仍完整，不抛异常", async () => {
  const fetchImpl = insightFetch({ fail: true });
  const { items: out, stats } = await translateCardInsights([withCard("a", "Export keeps breaking")], { enabled: true, token: "tk", fetchImpl });
  assert.ok(stats.errors.length >= 1);
  assert.equal(stats.done, 0);
  assert.ok(out[0].opportunityCard.dimensions, "确定性八维仍在");
  assert.equal(out[0].opportunityCard.insight, undefined);
});

test("缺 opportunityCard 的条目（演示/实时数据）被忽略，不送翻", async () => {
  const fetchImpl = insightFetch();
  const { stats } = await translateCardInsights([item("x", "plain live result")], { enabled: true, token: "tk", fetchImpl });
  assert.equal(stats.considered, 0);
  assert.equal(stats.requests, 0);
});
