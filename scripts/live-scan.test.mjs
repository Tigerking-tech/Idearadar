import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  normalizeQuery,
  queryTokens,
  isVagueQuery,
  hintTerms,
  expandQuery,
  scoreRows,
  buildSignals,
  summarizeWithLlm,
  runLiveScan,
  recordQuery,
} from "./live-scan.mjs";

const NO_TOKEN = { token: "" };

function row(i, overrides = {}) {
  return {
    url: `https://example.com/${i}`,
    title: `Pet app booking keeps failing on mobile ${i}`,
    text: "We keep seeing the pet app booking fail with a 500 error. This is a real bug and we wish there was a workaround because it is frustrating for users who need to schedule appointments.",
    source: "github",
    ...overrides,
  };
}

/* ---------------- 输入清洗与检索词 ---------------- */

test("normalizeQuery 去控制字符、压空白并限长 80", () => {
  assert.equal(normalizeQuery("  宠物\t寄养\n平台  "), "宠物 寄养 平台");
  assert.equal(normalizeQuery("\u0000abc\u001f"), "abc");
  assert.equal(normalizeQuery("x".repeat(200)).length, 80);
  assert.equal(normalizeQuery(""), "");
  assert.equal(normalizeQuery(null), "");
});

test("queryTokens 对中文连写词补两字片段，英文不拆", () => {
  const t = queryTokens("发票导出 pet app");
  assert.ok(t.includes("发票导出"));
  assert.ok(t.includes("发票"));
  assert.ok(t.includes("导出"));
  assert.ok(t.includes("pet"));
  assert.ok(!t.includes("p"));
});

test("isVagueQuery 拦截元词，放行具体方向", () => {
  assert.equal(isVagueQuery("创意需求"), true);
  assert.equal(isVagueQuery("  IDEA "), true);
  assert.equal(isVagueQuery("宠物寄养平台"), false);
  assert.equal(isVagueQuery("CI 构建日志"), false);
});

test("hintTerms 为中文方向补英文检索词", () => {
  assert.ok(hintTerms("宠物寄养").includes("pet app"));
  assert.ok(hintTerms("健身打卡").includes("fitness app"));
  assert.deepEqual(hintTerms("Salesforce webhook"), []);
});

test("expandQuery 无密钥时不发请求，返回原文 + 词典", async () => {
  let called = 0;
  const fetchImpl = async () => { called += 1; throw new Error("不应调用大模型"); };
  const terms = await expandQuery("宠物寄养", NO_TOKEN, fetchImpl);
  assert.equal(called, 0);
  assert.equal(terms[0], "宠物寄养");
  assert.ok(terms.includes("pet app"));
  assert.ok(terms.length <= 3);
});

/* ---------------- 去噪打分（核心防线） ---------------- */

test("scoreRows 必须命中检索词：含痛点词但不相关的记录一律丢弃", () => {
  const rows = [
    row(1),
    row(2, { title: "Unrelated CRM bug", text: "The CRM webhook fails with a 500 error and we wish there was a workaround for this frustrating bug." }),
  ];
  const out = scoreRows(rows, ["pet app", "pet"]);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /Pet app/);
});

test("scoreRows 过滤招聘/推广噪音、过短正文与重复 URL", () => {
  const rows = [
    row(1),
    row(2, { title: "We're hiring pet app engineers", text: "We're hiring! Apply now for a great salary and job opening at our pet company. " .repeat(2) }),
    row(1, { title: "重复 URL 应被去掉" }),
    row(3, { title: "too short", text: "pet" }),
  ];
  const out = scoreRows(rows, ["pet"]);
  assert.equal(out.length, 1);
});

test("scoreRows 命中更多检索词/痛点词的记录排在前面且分数更高", () => {
  const rows = [
    row(1, { text: "The pet page loads slowly. ".repeat(4) }),
    row(2, { text: "pet app booking bug error fails can't workaround frustrating ".repeat(4) }),
  ];
  const out = scoreRows(rows, ["pet app", "pet"]);
  assert.equal(out.length, 2);
  assert.ok(out[0].score >= out[1].score);
  assert.ok(out[0].painHits >= out[1].painHits);
  assert.ok(out[0].score <= 92);
});

test("scoreRows 英文多词短语按 token 展开，不要求整串出现在正文里", () => {
  const rows = [row(1, {
    title: "Pet app booking fails",
    text: "The pet booking flow fails with an error and we wish there was a workaround for this frustrating bug that keeps happening.",
  })];
  // 旧实现只拿 "pet app booking" 整串去 includes，会把这条真实相关记录全部丢弃。
  assert.equal(scoreRows(rows, ["pet app booking"]).length, 1);
});

test("scoreRows 空输入返回空数组", () => {
  assert.deepEqual(scoreRows([], ["pet"]), []);
  assert.deepEqual(scoreRows(null, ["pet"]), []);
});

/* ---------------- 构造 Signal ---------------- */

test("buildSignals 规则模式字段完整，趋势为 steady 且不伪造曲线", () => {
  const scored = scoreRows([row(1), row(2)], ["pet"]);
  const out = buildSignals(scored, "宠物", "zh", null);
  assert.equal(out.length, 2);
  for (const s of out) {
    assert.match(s.id, /^live-[0-9a-f]{12}$/);
    assert.equal(s.trend, "steady");
    assert.equal(s.spark.length, 12);
    assert.ok(s.spark.every((v) => v === 0.5));
    assert.equal(s.mentions, 1);
    assert.ok(s.sources.length >= 1);
    assert.equal(s.translated, false);
    assert.ok(s.titleOriginal && s.quoteOriginal && s.gap);
    assert.match(s.category, /实时检索/);
  }
});

test("buildSignals 大模型模式输出中文标题且标注 translated", () => {
  const scored = scoreRows([row(1)], ["pet"]);
  const out = buildSignals(scored, "宠物", "zh", [
    { i: 0, title: "宠物预约在移动端反复失败", quote: "预约接口返回 500", gap: "缺少重试与错误提示", score: 78 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "宠物预约在移动端反复失败");
  assert.equal(out[0].score, 78);
  assert.equal(out[0].translated, true);
  assert.equal(out[0].titleOriginal, scored[0].title);
});

test("buildSignals 大模型条目索引越界时回退到首条记录而不崩溃", () => {
  const scored = scoreRows([row(1)], ["pet"]);
  const out = buildSignals(scored, "宠物", "en", [
    { i: 99, title: "Ghost", quote: "no source", gap: "none", score: 50 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].titleOriginal, scored[0].title);
});

/* ---------------- 大模型降级 ---------------- */

test("summarizeWithLlm 无密钥直接返回 null", async () => {
  let called = 0;
  const out = await summarizeWithLlm([{ title: "a", text: "b", source: "github", score: 60 }], "pet", "zh", NO_TOKEN, async () => { called += 1; });
  assert.equal(out, null);
  assert.equal(called, 0);
});

test("summarizeWithLlm 过滤非法索引、空标题并限制 5 条", async () => {
  const scored = Array.from({ length: 8 }, (_, i) => ({ ...row(i), score: 60 }));
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [
      { i: 0, title: "有效", quote: "证据", gap: "空白", score: 80 },
      { i: 99, title: "越界", quote: "证据", gap: "空白", score: 80 },
      { i: 1, title: "", quote: "证据", gap: "空白", score: 80 },
      ...Array.from({ length: 6 }, (_, k) => ({ i: k + 2, title: `条目${k}`, quote: "证据", gap: "空白", score: 70 })),
    ] }) } }] }),
  });
  const out = await summarizeWithLlm(scored, "pet", "zh", { token: "fake" }, fetchImpl);
  assert.equal(out.length, 5);
  assert.equal(out[0].i, 0);
});

test("summarizeWithLlm 合并模型输出的重复 items 键（hy-mt2-plus 实测）", async () => {
  const scored = Array.from({ length: 5 }, (_, i) => ({ ...row(i), score: 60 }));
  const rec = (i) => JSON.stringify({ i, title: `痛点${i}`, quote: "证据原文", gap: "空白", score: 70 });
  // 严格 JSON.parse 只会保留最后一个同名 items，前两条会被静默丢掉。
  const broken = '{"items":[' + rec(0) + '],"items":[' + rec(1) + '],"items":[' + rec(2) + ']}';
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: broken } }] }),
  });
  const out = await summarizeWithLlm(scored, "pet", "zh", { token: "fake" }, fetchImpl);
  assert.equal(out.length, 3, "三个 items 数组都要合并，不能只留最后一个");
  assert.deepEqual(out.map((x) => x.i), [0, 1, 2]);
});

test("summarizeWithLlm 漏填 i 时按输出顺序回退，明确越界的 i 仍丢弃", async () => {
  const scored = Array.from({ length: 3 }, (_, i) => ({ ...row(i), score: 60 }));
  const content = JSON.stringify({ items: [
    { title: "漏填索引A", quote: "证据", gap: "", score: 70 },
    { i: 99, title: "越界应丢弃", quote: "证据", gap: "", score: 70 },
    { title: "漏填索引B", quote: "证据", gap: "", score: 70 },
  ] });
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
  const out = await summarizeWithLlm(scored, "pet", "zh", { token: "fake" }, fetchImpl);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => x.title), ["漏填索引A", "漏填索引B"]);
});

test("summarizeWithLlm 非法 JSON / HTTP 错误 / 抛错一律降级为 null", async () => {
  const scored = [row(1)];
  const cases = [
    async () => ({ ok: false, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "NOT JSON" } }] }) }),
    async () => { throw new Error("network down"); },
  ];
  for (const fetchImpl of cases) {
    assert.equal(await summarizeWithLlm(scored, "pet", "zh", { token: "fake" }, fetchImpl), null);
  }
});

/* ---------------- 编排 ---------------- */

test("runLiveScan 元词直接返回 vague，不触发任何采集", async () => {
  let collected = 0;
  const res = await runLiveScan({ query: "创意需求", env: NO_TOKEN, collect: async () => { collected += 1; return []; } });
  assert.equal(res.mode, "vague");
  assert.equal(res.items.length, 0);
  assert.equal(collected, 0);
});

test("runLiveScan 采集不到命中记录时返回 no-evidence 而非兜底结果", async () => {
  const res = await runLiveScan({
    query: "宠物",
    env: NO_TOKEN,
    collect: async () => [row(1, { title: "Unrelated CRM bug", text: "CRM webhook fails and we wish there was a workaround for this frustrating bug." })],
  });
  assert.equal(res.mode, "no-evidence");
  assert.equal(res.items.length, 0);
});

test("runLiveScan 无密钥走 rules 模式并产出结构完整的结果", async () => {
  const res = await runLiveScan({ query: "pet app", locale: "zh", env: NO_TOKEN, collect: async () => [row(1), row(2)] });
  assert.equal(res.mode, "rules");
  assert.equal(res.items.length, 2);
  assert.deepEqual(res.sources, ["GitHub Issues"]);
  assert.equal(res.items[0].trend, "steady");
});

test("runLiveScan 采集器抛错时降级为 no-evidence，不抛异常", async () => {
  const res = await runLiveScan({ query: "pet", env: NO_TOKEN, collect: async () => { throw new Error("全部平台超时"); } });
  assert.equal(res.mode, "no-evidence");
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0].message, /超时/);
});

test("runLiveScan 有密钥且返回合法归纳时走 llm 模式", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [
      { i: 0, title: "宠物预约反复失败", quote: "预约接口返回 500", gap: "缺少重试", score: 82 },
    ] }) } }] }),
  });
  const res = await runLiveScan({
    query: "pet app", locale: "zh", env: { token: "fake" }, fetchImpl,
    collect: async () => [row(1), row(2)],
  });
  assert.equal(res.mode, "llm");
  assert.equal(res.items[0].title, "宠物预约反复失败");
});

/* ---------------- 方向沉淀 ---------------- */

test("recordQuery 写入临时目录，保留最近记录并去重式追加", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-scan-"));
  try {
    assert.equal(await recordQuery("宠物寄养", { hits: 3, locale: "zh", mode: "rules" }, root), true);
    assert.equal(await recordQuery("健身打卡", { hits: 0, locale: "zh", mode: "no-evidence" }, root), true);
    const data = JSON.parse(await fs.readFile(path.join(root, "data", "query-scans.json"), "utf8"));
    assert.equal(data.queries.length, 2);
    assert.equal(data.queries[0].q, "宠物寄养");
    assert.equal(data.queries[0].hits, 3);
    assert.equal(data.queries[1].mode, "no-evidence");
    assert.ok(data.updatedAt);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("recordQuery 空查询或不可写路径返回 false 而不抛异常", async () => {
  assert.equal(await recordQuery("", {}, "/tmp"), false);
  // 用 /dev/null 的子路径：ENOTDIR 立即失败。不要用 /proc 路径，
  // 该文件系统上的递归 mkdir 在本沙箱会挂住，测试进程无法退出。
  assert.equal(await recordQuery("pet", {}, "/dev/null/nope"), false);
});
