import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_VERSION,
  buildCard,
  cardKey,
  needsCard,
  mergeInsight,
  attachCards,
  CARD_CODES,
} from "./cards.mjs";

const NOW = new Date("2026-11-14T00:00:00Z");

const base = {
  id: "invoice-export-export-keeps-breaking",
  title: "Multi-currency export keeps breaking",
  score: 62,
  mentions: 6,
  sources: ["hn", "so", "github"],
  signals: ["broken", "frustration", "manual"],
  breakdown: { frequency: 12, intensity: 14, recency: 9, corroboration: 15, willingnessToPay: 0 },
  willingnessToPay: false,
  nicheId: "invoice-export",
  lastSeen: "2026-11-13T00:00:00Z",
  evidence: [{ excerpt: "the export is broken again and we copy everything manually" }],
};

test("buildCard 产出八维，其中五维有证据、三维诚实留空", () => {
  const c = buildCard(base, NOW);
  assert.equal(c.version, CARD_VERSION);
  assert.equal(Object.keys(c.dimensions).length, 8, "必须是八维");
  assert.equal(c.totalDimensions, 8);
  assert.equal(c.evaluatedDimensions, 5);
  for (const k of ["demand", "urgency", "feasibility", "monetization", "confidence"]) {
    assert.equal(typeof c.dimensions[k], "number", `${k} 应有数值`);
    assert.ok(c.dimensions[k] >= 0 && c.dimensions[k] <= 10, `${k} 应在 0-10`);
  }
  assert.equal(c.dimensions.competition, null, "竞品格局未评估，不能用 0 伪造");
  assert.equal(c.dimensions.marketSize, null, "市场规模未评估");
  assert.equal(c.dimensions.retention, null, "留存未评估");
});

test("buildCard 维度只由显式规则推导，且 total 仅基于已评估维度", () => {
  const c = buildCard(base, NOW);
  const vals = ["demand", "urgency", "feasibility", "monetization", "confidence"].map((k) => c.dimensions[k]);
  const expected = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10);
  assert.equal(c.total, expected);
  assert.ok(c.total >= 0 && c.total <= 100);
  // 付费意愿信号会提高 monetization
  const withWtp = buildCard({ ...base, willingnessToPay: true, signals: [...base.signals, "pricing"] }, NOW);
  assert.ok(withWtp.dimensions.monetization > c.dimensions.monetization);
});

test("buildCard 三维未评估维度恒为 null，不因任何数据而编造", () => {
  const rich = {
    ...base,
    mentions: 999,
    sources: ["hn", "so", "github", "rss", "firstParty"],
    willingnessToPay: true,
    breakdown: { frequency: 30, intensity: 20, recency: 15, corroboration: 20, willingnessToPay: 15 },
  };
  const c = buildCard(rich, NOW);
  assert.equal(c.dimensions.competition, null);
  assert.equal(c.dimensions.marketSize, null);
  assert.equal(c.dimensions.retention, null);
  assert.equal(c.evaluatedDimensions, 5);
});

test("风险标记全部是可核查事实，且恒含未评估竞品的提示", () => {
  const thin = buildCard({ ...base, sources: ["hn"], mentions: 1 }, NOW);
  assert.ok(thin.riskFlags.includes("single-source"));
  assert.ok(thin.riskFlags.includes("thin-evidence"));
  assert.ok(thin.riskFlags.includes("no-wtp"));
  assert.ok(thin.riskFlags.includes("unverified-competition"));
  const stale = buildCard({ ...base, lastSeen: "2026-09-01T00:00:00Z" }, NOW);
  assert.ok(stale.riskFlags.includes("stale"));
  const fresh = buildCard(base, NOW);
  assert.ok(!fresh.riskFlags.includes("stale"));
});

test("目标用户按已知赛道映射，未知赛道诚实标 unknown；最小验证步骤按证据选择", () => {
  assert.equal(buildCard(base, NOW).audience, "ops");
  assert.equal(buildCard({ ...base, nicheId: "solo-crm" }, NOW).audience, "solo");
  assert.equal(buildCard({ ...base, nicheId: "unknown-niche" }, NOW).audience, "unknown");
  assert.equal(buildCard({ ...base, sources: ["hn"], mentions: 1 }, NOW).validation, "interview");
  assert.ok(CARD_CODES.audiences.has("developer"));
  assert.ok(CARD_CODES.validations.has("manual-audit"));
});

test("cardKey 稳定且对原文变化敏感", () => {
  const a = cardKey(base);
  assert.equal(a, cardKey({ ...base }));
  assert.notEqual(a, cardKey({ ...base, title: "A different title entirely" }));
  assert.match(a, new RegExp(`:v${CARD_VERSION}$`));
});

test("needsCard 对缺失、版本过期、缓存键失配返回 true，对最新卡返回 false", () => {
  assert.equal(needsCard(base), true);
  assert.equal(needsCard({ ...base, opportunityCard: { version: CARD_VERSION - 1 } }), true);
  const card = buildCard(base, NOW);
  assert.equal(needsCard({ ...base, opportunityCard: card, cardKey: cardKey(base) }), false);
});

test("mergeInsight 只合并合法中英洞察并截断，非法值原样返回", () => {
  const card = buildCard(base, NOW);
  const merged = mergeInsight(card, { zh: "  值得先做一次访谈  ", en: "  Worth one interview  " });
  assert.equal(merged.insight.zh, "值得先做一次访谈");
  assert.equal(merged.insight.en, "Worth one interview");
  assert.equal(card.insight, undefined, "不得修改原卡");
  assert.equal(mergeInsight(card, null), card);
  assert.equal(mergeInsight(card, { zh: 123, en: null }), card);
  assert.equal(mergeInsight(card, { zh: "x".repeat(500) }).insight.zh.length, 160);
});

test("attachCards 幂等：只补缺失，最新卡对象引用不变", () => {
  const once = attachCards([base], NOW);
  assert.equal(once.length, 1);
  assert.equal(once[0].opportunityCard.version, CARD_VERSION);
  assert.equal(once[0].cardKey, cardKey(base));
  const twice = attachCards(once, NOW);
  assert.equal(twice[0], once[0], "已是最新卡时应原样返回同一对象");
  const mixed = attachCards([base, once[0]], NOW);
  assert.ok(mixed[0].opportunityCard);
});

test("attachCards 对空/非数组输入安全", () => {
  assert.deepEqual(attachCards([], NOW), []);
  assert.deepEqual(attachCards(null, NOW), []);
});
