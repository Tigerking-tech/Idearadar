import test from "node:test";
import assert from "node:assert/strict";
import { applyCuration } from "./ingest-lib.mjs";

const item = (id, title, extra = {}) => ({
  id,
  title,
  score: 50,
  sources: ["hn", "so"],
  evidence: [{ excerpt: "users keep reporting this problem in the forum" }],
  ...extra,
});

test("空规则完全不改变行为（顺序、内容、数量）", () => {
  const list = [item("a", "CRM export is broken"), item("b", "Booking tool loses slots")];
  const { items, rejected } = applyCuration(list, {});
  assert.equal(items.length, 2);
  assert.equal(items[0], list[0], "无 pin 时不得重排、不得复制对象");
  assert.equal(items[1], list[1]);
  assert.equal(rejected.length, 0);
});

test("excludeTerms 英文按词边界匹配，不误伤子串", () => {
  const rules = { excludeTerms: ["app", "movie"] };
  const list = [
    item("a", "appointment booking keeps failing"),   // appointment 不应命中 app
    item("b", "the app crashes on export"),            // 词边界命中 app
    item("c", "remove the cached file"),               // remove 不应命中 movie
    item("d", "netflix movie tracker is trending"),   // 命中 movie
  ];
  const { items, rejected } = applyCuration(list, rules);
  assert.deepEqual(items.map((x) => x.id), ["a", "c"]);
  assert.deepEqual(rejected.map((x) => x.id), ["b", "d"]);
  assert.match(rejected[0].reasons.join(" "), /excludeTerm:app/);
});

test("excludeTerms 中文按包含匹配", () => {
  const rules = { excludeTerms: ["币价", "明星"] };
  const list = [item("a", "今日币价大涨"), item("b", "CRM 导出失败")];
  const { items, rejected } = applyCuration(list, rules);
  assert.deepEqual(items.map((x) => x.id), ["b"]);
  assert.equal(rejected.length, 1);
});

test("rejectIds 精确驳回并留下理由", () => {
  const rules = { rejectIds: ["b"] };
  const { items, rejected } = applyCuration([item("a", "CRM export is broken"), item("b", "Booking tool loses slots")], rules);
  assert.deepEqual(items.map((x) => x.id), ["a"]);
  assert.match(rejected[0].reasons.join(" "), /rejectId:b/);
  assert.equal(rejected[0].title, "Booking tool loses slots");
});

test("minCorroboration 拒绝单源孤证", () => {
  const rules = { minCorroboration: 2 };
  const list = [
    item("a", "CRM export is broken"),                              // 2 源
    item("b", "Booking tool loses slots", { sources: ["hn"] }),    // 1 源
  ];
  const { items, rejected } = applyCuration(list, rules);
  assert.deepEqual(items.map((x) => x.id), ["a"]);
  assert.match(rejected[0].reasons.join(" "), /minCorroboration:1<2/);
});

test("pinIds 加分、标记并前置；分数被 clamp 到 100", () => {
  const list = [
    item("a", "CRM export is broken", { score: 90 }),
    item("b", "Booking tool loses slots", { score: 10 }),
  ];
  const { items } = applyCuration(list, { pinIds: ["b"], pinBoost: 15 });
  // b: 10+15=25 < a:90，无重排到第一，但 pinned 与分数应生效
  const b = items.find((x) => x.id === "b");
  assert.equal(b.pinned, true);
  assert.equal(b.score, 25);
  const high = applyCuration([item("a", "A", { score: 95 }), item("b", "B", { score: 10 })], { pinIds: ["b"], pinBoost: 99 });
  assert.equal(high.items[0].id, "b", "加分后应重排到首位");
  assert.ok(high.items[0].score <= 100);
});

test("执行优先级：被 excludeTerm 命中的条目即使被 pin 也要驳回", () => {
  const rules = { excludeTerms: ["movie"], pinIds: ["a"], pinBoost: 50 };
  const { items, rejected } = applyCuration([item("a", "movie tracker is trending")], rules);
  assert.equal(items.length, 0);
  assert.equal(rejected.length, 1);
});

test("多规则叠加时按序给出全部驳回理由", () => {
  const rules = { excludeTerms: ["movie"], rejectIds: ["a"], minCorroboration: 2 };
  const { rejected } = applyCuration([item("a", "movie tracker", { sources: ["hn"] })], rules);
  assert.equal(rejected.length, 1);
  // excludeTerm 与 rejectId 都会被记录；minCorroboration 因已有驳回理由而跳过
  assert.match(rejected[0].reasons.join(" "), /excludeTerm:movie/);
  assert.match(rejected[0].reasons.join(" "), /rejectId:a/);
});

test("对空/非数组输入安全", () => {
  assert.deepEqual(applyCuration([], {}).items, []);
  assert.deepEqual(applyCuration(null, {}).items, []);
  assert.deepEqual(applyCuration(undefined, {}).rejected, []);
});
