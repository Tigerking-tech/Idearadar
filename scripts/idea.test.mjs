import test from "node:test";
import assert from "node:assert/strict";
import {
  IDEA_VERSION, ideaKey, ideaInput, templateIdea, normalizeIdea, generateIdeas,
  NICHE_PERSONA, PERSONAS, extractIdeaRecords,
} from "./idea.mjs";

const item = (over = {}) => ({
  id: "everyday-money-subscription-tracking",
  nicheId: "everyday-money",
  nicheLabel: "Everyday money: subscriptions",
  title: "What functions can I use to track subscriptions?",
  titleZh: "用什么功能可以追踪订阅？",
  signals: ["seeking", "manual", "question"],
  evidence: [{ excerpt: "I am struggling to make a spreadsheet to track members' subscriptions" }],
  ...over,
});

/** 构造一个返回给定 items 的 mock fetch（OpenAI 兼容响应）。 */
function ideaFetch({ items, fail = false, badContent = null } = {}) {
  return async () => {
    if (fail) throw new Error("network down");
    const content = badContent ?? JSON.stringify({ items });
    return {
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
    };
  };
}
const OPTS = (fetchImpl, extra = {}) => ({
  enabled: true, token: "test-token", fetchImpl, batchSize: 4, batchDelayMs: 0, ...extra,
});

test("templateIdea：确定性、语言无关、含中英四段、不编造数字", () => {
  const a = templateIdea(item());
  const b = templateIdea(item());
  assert.deepEqual(a, b, "同一输入必须完全一致");
  assert.equal(a.version, IDEA_VERSION);
  assert.equal(a.origin, "template");
  assert.ok(PERSONAS.includes(a.persona));
  for (const k of ["headline", "who", "why", "step"]) {
    assert.ok(a[k].zh.length > 0, `${k}.zh`);
    assert.ok(a[k].en.length > 0, `${k}.en`);
  }
  assert.ok(!/\d+\s*(亿|万|%|million|billion)/.test(JSON.stringify(a)), "不得编造规模数字");
});

test("templateIdea：不同人群/信号给出不同动作，非纯套话", () => {
  const pet = templateIdea(item({ nicheId: "pet-and-home-care", signals: ["broken"] }));
  const money = templateIdea(item({ nicheId: "everyday-money", signals: ["manual"] }));
  assert.notEqual(pet.persona, money.persona);
  assert.ok(pet.headline.zh.includes("宠物"));
  assert.ok(money.headline.zh.includes("账") || money.headline.zh.includes("订阅"));
});

test("persona 映射覆盖全部 consumer 赛道", () => {
  for (const id of ["everyday-money", "pet-and-home-care", "local-service-booking", "personal-admin"]) {
    assert.ok(NICHE_PERSONA[id], id);
    assert.ok(PERSONAS.includes(NICHE_PERSONA[id]));
  }
  assert.equal(templateIdea(item({ nicheId: "unknown-x" })).persona, "general");
});

test("ideaKey：原文不变则稳定，原文变则失效", () => {
  const k = ideaKey(item());
  assert.equal(k, ideaKey(item()));
  assert.notEqual(k, ideaKey(item({ title: "different title" })));
  assert.ok(k.startsWith(`idea-${IDEA_VERSION}-`));
});

test("ideaInput：短键 k、不含评分/evidence 全文、字段裁剪", () => {
  const inp = ideaInput(item({ score: 99 }), "p2");
  assert.equal(inp.k, "p2");
  assert.deepEqual(Object.keys(inp).sort(), ["k", "niche", "quote", "signals", "title", "titleZh"]);
  assert.ok(!JSON.stringify(inp).includes("99"));
});

test("normalizeIdea：合法输出采用 llm 结果", () => {
  const n = normalizeIdea({
    k: "p0", persona: "budget-keeper",
    headline: { zh: "给管订阅的人做一个自动汇总扣费的小工具", en: "A tool to auto-summarize subscription charges" },
    who: { zh: "管订阅的人", en: "subscribers" },
    why: { zh: "每月要手动对账", en: "manual reconciliation each month" },
    step: { zh: "先做一个粘贴账单就出汇总的单页", en: "a single page that summarizes a pasted bill" },
  }, item());
  assert.equal(n.origin, "llm");
  assert.equal(n.persona, "budget-keeper");
  assert.ok(n.headline.zh.includes("管订阅"));
});

test("normalizeIdea：空/非法/半截输出一律回退模板", () => {
  assert.equal(normalizeIdea(null, item()).origin, "template");
  assert.equal(normalizeIdea({}, item()).origin, "template");
  assert.equal(normalizeIdea({ headline: { zh: "", en: "" } }, item()).origin, "template");
  const partial = normalizeIdea({ headline: { zh: "给管账的人做一个对账小工具" } }, item());
  assert.equal(partial.origin, "llm");
  assert.ok(partial.headline.en.length > 0, "缺英文时用模板补齐，不留空");
  assert.ok(partial.who.zh.length > 0, "缺 who 时用模板补齐");
});

test("normalizeIdea：非法 persona 归为模板值", () => {
  const n = normalizeIdea({
    persona: "invented-persona",
    headline: { zh: "给管账的人做一个对账小工具", en: "A reconciliation tool for bookkeepers" },
  }, item());
  assert.equal(n.persona, "budget-keeper");
});

test("generateIdeas：关闭 LLM 时全部用确定性模板，零请求", async () => {
  let calls = 0;
  const { items, stats } = await generateIdeas([item(), item({ id: "b" })], {
    enabled: false, fetchImpl: async () => { calls += 1; },
  });
  assert.equal(stats.requests, 0);
  assert.equal(calls, 0);
  assert.equal(stats.templated, 2);
  assert.ok(items.every((x) => x.idea.origin === "template"));
});

test("generateIdeas：无 token 也全模板，不抛异常", async () => {
  const { items, stats } = await generateIdeas([item()], OPTS(ideaFetch({ fail: true }), { token: "" }));
  assert.equal(items[0].idea.origin, "template");
  assert.equal(stats.skippedReason !== null, true);
});

test("generateIdeas：正常生成 + 短键对齐", async () => {
  const rows = [item(), item({ id: "b", title: "export contacts" })];
  const replies = rows.map((_, j) => ({
    k: `p${j}`, persona: "general",
    headline: { zh: `给第${j}类人做一个具体小工具`, en: `A concrete small tool for group ${j}` },
    who: { zh: "有这麻烦的人", en: "people with this issue" },
    why: { zh: "现在要手动做", en: "done manually today" },
    step: { zh: "先做一个单页试用", en: "try one single page" },
  }));
  const { items, stats } = await generateIdeas(rows, OPTS(ideaFetch({ items: replies })));
  assert.equal(stats.requests, 1);
  assert.equal(stats.generated, 2);
  assert.ok(items.every((x) => x.idea.origin === "llm"));
  assert.ok(items[0].idea.headline.zh.includes("第0类"));
  assert.ok(items[1].idea.headline.zh.includes("第1类"));
});

test("generateIdeas：请求失败整批 fail-open 回退模板", async () => {
  const { items, stats } = await generateIdeas([item(), item({ id: "b" })], OPTS(ideaFetch({ fail: true })));
  assert.equal(stats.generated, 0);
  assert.equal(stats.templated, 2);
  assert.ok(items.every((x) => x.idea.origin === "template"));
  assert.ok(stats.errors.length > 0);
});

test("generateIdeas：非法 JSON 整批回退，不写半截模型输出", async () => {
  const { items } = await generateIdeas([item()], OPTS(ideaFetch({ badContent: "not-json" })));
  assert.equal(items[0].idea.origin, "template");
});

test("generateIdeas：模型漏某条 → 那条回退模板，其余生效", async () => {
  const rows = [item(), item({ id: "b" })];
  const replies = [{
    k: "p0", persona: "general",
    headline: { zh: "给管账的人做一个对账小工具", en: "A reconciliation tool for bookkeepers" },
  }];
  const { items } = await generateIdeas(rows, OPTS(ideaFetch({ items: replies })));
  assert.equal(items[0].idea.origin, "llm");
  assert.equal(items[1].idea.origin, "template");
});

test("generateIdeas：增量缓存命中已生成条目，只请求新增", async () => {
  const rows = [item(), item({ id: "b", title: "export contacts" })];
  const make = (j) => ({
    k: `p${j}`, persona: "general",
    headline: { zh: "给管账的人做一个对账小工具", en: "A reconciliation tool for bookkeepers" },
  });
  const first = await generateIdeas(rows.slice(0, 1), OPTS(ideaFetch({ items: [make(0)] })));
  assert.equal(first.stats.generated, 1);
  const second = await generateIdeas(rows, OPTS(ideaFetch({ items: [make(0)] }), { cache: first.ideas }));
  assert.equal(second.stats.cached, 1, "已生成条目命中缓存");
  assert.equal(second.stats.generated, 1, "只新生成 1 条");
  assert.equal(second.stats.requests, 1);
});

test("generateIdeas：模板结果也写进缓存，下一轮开启 LLM 不重算模板", async () => {
  const first = await generateIdeas([item()], { enabled: false });
  const second = await generateIdeas([item()], { enabled: false, cache: first.ideas });
  assert.equal(second.stats.templated, 1);
});

const rec = (k) => ({
  k, persona: "general",
  headline: { zh: "给管账的人做一个对账小工具", en: "A reconciliation tool" },
  who: { zh: "管账的人", en: "bookkeepers" },
  why: { zh: "每月手动对账", en: "manual monthly" },
  step: { zh: "做个单页试用", en: "a single page" },
});

test("extractIdeaRecords：合法 {\"items\":[...]} 包装", () => {
  const out = extractIdeaRecords(JSON.stringify({ items: [rec("p0"), rec("p1")] }));
  assert.equal(out.length, 2);
  assert.equal(out[0].k, "p0");
});

test("extractIdeaRecords：数组少逗号也能逐个抠出对象", () => {
  const broken = '{"items":[' + JSON.stringify(rec("p0")) + " " + JSON.stringify(rec("p1")) + ' "]}';
  const out = extractIdeaRecords(broken);
  assert.equal(out.length, 2, "两个合法对象都应被救回");
  assert.equal(out[1].k, "p1");
});

test("extractIdeaRecords：JSON 后多吐一段 / 裸对象序列", () => {
  const trailing = JSON.stringify({ items: [rec("p0")] }) + " 以上是结果，希望有帮助";
  assert.equal(extractIdeaRecords(trailing).length, 1);
  const bare = JSON.stringify(rec("p0")) + " " + JSON.stringify(rec("p1"));
  assert.equal(extractIdeaRecords(bare).length, 2);
});

test("extractIdeaRecords：完全无合法对象时抛错（交上层 fail-open）", () => {
  assert.throws(() => extractIdeaRecords("not json at all"));
});

// 真实 TokenHub / hy-mt2-plus 返回过的三种畸形，防回归。
test("extractIdeaRecords：外层少一个右括号，单条对象仍被救回", () => {
  // 模型常把 {"items":[{...}]} 写成 {"items":[{...}]}（漏最外层 }）。
  const broken = '{"items":[' + JSON.stringify(rec("p0")) + "]}";
  const out = extractIdeaRecords(broken);
  assert.equal(out.length, 1);
  assert.equal(out[0].k, "p0");
});

test("extractIdeaRecords：step 写成字符串不影响整条回收", () => {
  const r = { ...rec("p0"), step: "做一个能粘贴账单就出汇总的单页，找3人试用" };
  const out = extractIdeaRecords(JSON.stringify({ items: [r] }));
  assert.equal(out.length, 1);
  assert.equal(typeof out[0].step, "string");
});

test("extractIdeaRecords：JSON 后多吐一段中文说明也能回收", () => {
  const broken = JSON.stringify({ items: [rec("p0")] }) + " 以上是结果，希望有帮助";
  assert.equal(extractIdeaRecords(broken).length, 1);
});

test("normalizeIdea：step 为纯中文字符串时保留中文、英文回退模板", () => {
  const n = normalizeIdea({
    k: "p0",
    headline: { zh: "给管账的人做一个对账小工具", en: "A reconciliation tool" },
    step: "做一个能粘贴账单就出汇总的单页，找3人试用",
  }, item());
  assert.equal(n.origin, "llm");
  assert.ok(n.step.zh.includes("粘贴账单"), "中文模型内容不能被模板覆盖");
  assert.ok(n.step.en.length > 0, "英文侧回退模板，不留空");
});
