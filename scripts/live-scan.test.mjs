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

test("expandQuery 有密钥时真正采用 LLM 扩出的具体检索词，不再被 slice 截掉", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({
      terms: ["invoice export failed", "billing export broken"],
    }) } }] }),
  });
  const terms = await expandQuery("发票导出", { token: "fake" }, fetchImpl);
  assert.equal(terms[0], "发票导出");
  assert.ok(terms.includes("invoice export failed"), "LLM 扩词必须真正用于检索");
  assert.ok(terms.includes("billing export broken"));
  assert.ok(terms.length <= 5);
  assert.ok(terms.indexOf("invoice export failed") < terms.indexOf("invoice"),
    "具体短语应排在词典泛词之前");
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

/* ---------------- 客户视角：结果必须是人话、必须是痛点 ---------------- */

test("scoreRows 剔除 Show HN 产品推销帖（创始人在介绍自己的东西）", () => {
  const rows = [
    row(1),
    row(2, {
      title: "Show HN: Omelo - AI pet health companion, Health timelines",
      text: "Hey HN, I'm Amogh. I'm a solo founder building Omelo. Pet parents make health decisions with almost no data: missed vaccines, forgotten deworming, scattered notes.",
    }),
  ];
  const out = scoreRows(rows, ["pet"]);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /Pet app/);
});

test("scoreRows 整段网页样板清洗后为空，整条丢弃而不是摆成「对方原话」", () => {
  const rows = [
    row(1),
    row(2, {
      title: "All-optical synthesis chip for large-scale semantic vision",
      text: "打开CSDN APP Copyright © 1999-2020, CSDN.NET, All Rights Reserved 打开APP 原创 2025-12-30 20:54:42 阅读量 539 收藏 20 10赞 码龄6年 关注 论文基本信息 标题 {",
    }),
  ];
  const out = scoreRows(rows, ["pet"]);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /Pet app/);
});

test("scoreRows 解实体并从样板处截断，text/quote 都变成人话", () => {
  const raw = "The pet booking page is broken and I can&#x27;t find a workaround. 打开CSDN APP Copyright © 1999-2020 阅读量 539 码龄6年";
  const out = scoreRows([row(1, { text: raw })], ["pet"]);
  assert.equal(out.length, 1);
  assert.ok(out[0].quote.includes("can't find a workaround"));
  assert.ok(!out[0].quote.includes("&#x"));
  assert.ok(!out[0].quote.includes("Copyright"));
  assert.ok(!out[0].quote.includes("阅读量"));
  assert.equal(out[0].text, out[0].quote, "喂给大模型与结果卡的应是同一份清洗文本");
});

test("buildSignals 即使拿到未清洗的原始脏文本，也不把乱码摆进 quote", () => {
  const dirty = "Can&#x27;t export pet contacts without paying. 打开CSDN APP Copyright © 1999-2020 阅读量 539 码龄6年";
  const scored = scoreRows([row(1, { text: dirty })], ["pet"]);
  const sig = buildSignals(scored, "宠物", "zh", null);
  assert.equal(sig.length, 1);
  assert.ok(!sig[0].quote.includes("&#x"));
  assert.ok(!sig[0].quote.includes("Copyright"));
  assert.match(sig[0].quote, /can't export pet contacts/i);
});

test("scoreRows 剔除开发任务单/构建日志/工具征集，保留真实痛点描述", () => {
  const bad = [
    row(2, { title: "android build", text: "**BUILD SUCCEEDED** source pets-pet-care app-debug.apk gradle.log 0 error lines" }),
    row(3, { title: "Medication Epic E1", text: "**Epic name:** Manage Approved Pet Care Promotions **Business value:** Launch offers" }),
    row(4, { title: "Create a pet", text: "## User story As a pet owner, I want to add my pet with its name and species. ## Done when - [ ] The app opens" }),
    row(5, { title: "[Tool] 通讯录文件查看器", text: "## Tool name vCard Viewer ## What should it do? 解析 .vcf 文件" }),
    row(6, { title: "Day Care Booking", text: "Task scope: Calendar interface. Project context: please build me a doggy day care app. Acceptance criteria: - [ ] Customer selects pet" }),
  ];
  const good = row(1, {
    title: "Export contacts as vCard",
    text: "## Problem Contacts can already be exported as CSV, but CSV doesn't open directly in Apple Contacts or most address books. This is frustrating and I wish there was a workaround.",
  });
  const out = scoreRows([...bad, good], ["pet", "contacts"]);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /Export contacts as vCard/);
  assert.ok(!out[0].quote.includes("##"), "markdown 标题标记应被清掉");
  assert.ok(out[0].quote.includes("doesn't open directly"));
});

test("scoreRows 只保留有痛点/求助信号的结果，PRD/宣传/需求单不占「对方原话」", () => {
  const rows = [
    row(2, { title: "宠物行业 GIS 选址方案", text: "Pet store 选址需要数据支撑。核心功能包括养宠家庭密度、竞品分布、交通便利度分析，适用宠物连锁医院与用品店。" }),
    row(3, { title: "新增-导出通讯录", text: "在用户管理的用户详情处新增导出通讯录功能，pet owners 可以导出所选账号的所有联系人，包括手机号码、邮箱、昵称" }),
    row(4, { title: "Critter Care", text: "Care for your pet critters. Have some kind of Pen area where critters bounce around. Spend Normal Currency on Food or Toys." }),
    row(1, { title: "Export contacts as vCard", text: "## Problem Contacts can already be exported as CSV, but CSV doesn't open directly in Apple Contacts. This is frustrating and I wish there was a workaround." }),
    row(5, { title: "How to create academic tables in Google Docs?", text: "Is it possible to format and style tables in Google Docs in a similar design as academic articles published in peer-reviewed journals?" }),
  ];
  const out = scoreRows(rows, ["pet", "contacts", "academic"]);
  const titles = out.map((r) => r.title);
  assert.ok(!titles.some((t) => /GIS|新增-导出|Critter Care/.test(t)), "需求单/宣传/设计文档不得进入结果");
  assert.ok(titles.some((t) => /Export contacts as vCard/.test(t)), "真实痛点要保留");
  assert.ok(titles.some((t) => /academic tables/.test(t)), "真实求助要保留");
});

test("scoreRows 剔除别人写好的产品企划，不把「目标用户/核心痛点」当成对方原话", () => {
  const rows = [
    row(2, {
      title: "💡 [独立宠物美容师] PawStyle AI - 宠物美容档案纸本易丢",
      text: "目标用户 独立宠物美容师、社区小型宠物美容店。核心痛点 - 每只宠物的毛质、皮肤状况记在纸本或脑子里，换个店员就断档；造型前后照片散落在各人手机相册。",
    }),
    row(1, { title: "Pet booking keeps failing", text: "The pet booking page is broken and I can't find a workaround. This is frustrating." }),
  ];
  const out = scoreRows(rows, ["pet"]);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /Pet booking keeps failing/);
});

test("scoreRows 全是开发文档时返回空，让前端走诚实空态而不是凑数", () => {
  const rows = [
    row(2, { title: "F3 预约主流程", text: "父 Issue 1 构建内容：预约主流程垂直切片，后端 GET /api/slots 懒生成时段，小程序预约页端到端打通 pet booking 链路。" }),
    row(3, { title: "功能提案", text: "Summary Bring the pet forum composer closer to progressive editing. Scope - Keep core formatting actions visible and move advanced options." }),
  ];
  assert.deepEqual(scoreRows(rows, ["pet"]), []);
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

test("buildSignals 大模型模式保留真实原标题/原话，归纳短语降级为 summaryTitle", () => {
  const scored = scoreRows([row(1)], ["pet"]);
  const out = buildSignals(scored, "宠物", "zh", [
    { i: 0, title: "宠物预约在移动端反复失败", quote: "预约接口返回 500", gap: "缺少重试与错误提示", score: 78 },
  ]);
  assert.equal(out.length, 1);
  // 真实标题与逐字原话，不拿 LLM 归纳短语冒充（用户反馈「什么是填报压力」的根因）
  assert.equal(out[0].title, scored[0].title);
  assert.equal(out[0].titleOriginal, scored[0].title);
  assert.equal(out[0].quote, scored[0].text.slice(0, 400));
  assert.equal(out[0].quoteOriginal, scored[0].text.slice(0, 400));
  // 归纳短语只作补充并明确标注，不冒充标题
  assert.equal(out[0].summaryTitle, "宠物预约在移动端反复失败");
  // 未翻译的原始讨论不能标成 AI 译文
  assert.equal(out[0].translated, false);
  // 原始讨论链接必须送到前端，供「查看原始讨论 ↗」渲染
  assert.equal(out[0].sourceUrl, "https://example.com/1");
  assert.equal(out[0].score, 78);
  // 模板兜底仍标 template，前端据此不渲染四段万能套话
  assert.equal(out[0].idea.origin, "template");
});

test("buildSignals 规则模式同样带真实原文与原始链接，归纳标题为空", () => {
  const scored = scoreRows([row(3)], ["pet"]);
  const out = buildSignals(scored, "pet", "en", null);
  assert.equal(out[0].title, scored[0].title);
  assert.equal(out[0].quote, scored[0].text.slice(0, 400));
  assert.equal(out[0].sourceUrl, "https://example.com/3");
  assert.equal(out[0].summaryTitle, null);
  assert.equal(out[0].translated, false);
  assert.equal(out[0].idea.origin, "template");
});

test("buildSignals 丢弃非法 url，不把脏数据渲染成外链", () => {
  const scored = scoreRows([row(4, { url: "javascript:alert(1)" })], ["pet"]);
  const out = buildSignals(scored, "pet", "zh", null);
  assert.equal(out[0].sourceUrl, null);
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
  // 主标题/原话用采集到的真实文本，归纳短语只进 summaryTitle
  assert.equal(res.items[0].title, res.items[0].titleOriginal);
  assert.equal(res.items[0].quote, res.items[0].quoteOriginal);
  assert.equal(res.items[0].summaryTitle, "宠物预约反复失败");
  assert.match(res.items[0].sourceUrl, /^https:\/\/example\.com\//);
  assert.equal(res.items[0].idea.origin, "template");
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

/* ---------------- 召回治理：strict 收紧弱命中 + 普通人源提权 ---------------- */

test("scoreRows strict：只命中泛词、没命中实义检索词的弱相关被拦截", () => {
  // 搜「invoice app」：weak 只因正文里的泛词 app 命中，完全没有 invoice；
  // loose 口径会把它当结果，strict 要求命中实义词 invoice，应挡掉。
  const weak = row(1, { title: "Generic app tool keeps failing on mobile", source: "hn" });
  const strong = row(2, {
    title: "Invoice export keeps failing on mobile",
    text: "I cannot export invoices to CSV. It is frustrating and I wish there was a workaround because the export fails every time for users.",
    source: "hn",
  });
  const terms = ["invoice app"];
  const loose = scoreRows([weak, strong], terms);
  const strict = scoreRows([weak, strong], terms, { strict: true });
  assert.ok(loose.some((r) => r.url.endsWith("/1")), "loose 口径下弱相关确实会漏进来");
  assert.ok(!strict.some((r) => r.url.endsWith("/1")), "strict 必须拦掉只命中泛词的弱相关");
  assert.ok(strict.some((r) => r.url.endsWith("/2")), "真正命中 invoice 的结果必须保留");
});

test("scoreRows strict：普通人生活站同等命中下排在开发者源之前", () => {
  const dev = row(1, { source: "github" });
  const consumer = row(2, { source: "consumerQa" });
  const terms = ["pet app"];
  const loose = scoreRows([dev, consumer], terms);
  const strict = scoreRows([dev, consumer], terms, { strict: true });
  assert.equal(loose.length, 2);
  assert.equal(strict.length, 2, "strict 不得误杀两条真实痛点记录");
  assert.equal(strict[0].source, "consumerQa", "生活站应被提到主路径");
  assert.ok(strict[0].score > strict[1].score, "应真的加分，不是只改文案");
  const devLoose = loose.find((r) => r.source === "github");
  const devStrict = strict.find((r) => r.source === "github");
  assert.equal(devLoose.score, devStrict.score, "非 strict 路径不引入 consumer 提权");
});

/* ---------------- 相关性闸门：模型判不相关 → 诚实空态，不降级凑数 ---------------- */

test("buildSignals：模型判定全不相关时返回空数组，不降级回原始脏记录", () => {
  const scored = [row(1), row(2)];
  assert.deepEqual(buildSignals(scored, "宠物店", "zh", []), [], "[] 应是诚实空态");
  assert.equal(buildSignals(scored, "宠物店", "zh", null).length, 2,
    "null 表示调用失败，仍按规则降级（fail-open），与 [] 严格区分");
});

test("summarizeWithLlm：丢弃模型显式判为不相关的记录，保留真正相关的记录", async () => {
  const scored = Array.from({ length: 3 }, (_, i) => ({ ...row(i), score: 60 }));
  const content = JSON.stringify({ items: [
    { i: 0, relevant: false, title: "怎么养懒猴", quote: "无关", gap: "", score: 70 },
    { i: 1, relevant: true, title: "宠物店预约总被重复占用", quote: "证据原文", gap: "一把时段锁", score: 80 },
  ] });
  const fetchImpl = async () => ({
    ok: true, json: async () => ({ choices: [{ message: { content } }] }),
  });
  const out = await summarizeWithLlm(scored, "宠物店", "zh", { token: "fake" }, fetchImpl);
  assert.equal(out.length, 1);
  assert.equal(out[0].i, 1);
});

test("summarizeWithLlm：全部不相关返回空数组而非 null，让上层走诚实空态", async () => {
  const scored = [row(1), row(2)];
  const content = JSON.stringify({ items: [
    { i: 0, relevant: false, score: 70 },
    { i: 1, relevant: false, score: 60 },
  ] });
  const fetchImpl = async () => ({
    ok: true, json: async () => ({ choices: [{ message: { content } }] }),
  });
  const out = await summarizeWithLlm(scored, "宠物店", "zh", { token: "fake" }, fetchImpl);
  assert.deepEqual(out, [], "调用成功但全不相关，必须是 [] 而不是 null");
});

test("summarizeWithLlm：模型没给 relevant 字段时 fail-open 保留，不误杀", async () => {
  const scored = [row(1)];
  const content = JSON.stringify({ items: [
    { i: 0, title: "有效痛点", quote: "证据原文", gap: "", score: 70 },
  ] });
  const fetchImpl = async () => ({
    ok: true, json: async () => ({ choices: [{ message: { content } }] }),
  });
  const out = await summarizeWithLlm(scored, "pet", "zh", { token: "fake" }, fetchImpl);
  assert.equal(out.length, 1, "旧模型/降级输出没有 relevant 字段时不能全丢");
});

test("scoreRows 拦掉 P0/Epic 编号式需求规格，不把它当成对方逐字原话", () => {
  const bad = row(1, {
    title: "P0 FREE AI 06: Cancellation & Rescheduling Assistant",
    text: "Parent epic: Deliverable Classify cancel/change requests, explain current policy, direct to existing flows. Appointment booking is frustrating and I wish there was a workaround because it keeps failing.",
  });
  const good = row(2, {
    title: "Appointment Rescheduling Flow Malfunction",
    text: "Attempting to reschedule an existing appointment fails or generates errors, preventing students from updating booking times. This is frustrating and I wish there was a workaround.",
  });
  const out = scoreRows([bad, good], ["appointment"]);
  assert.ok(!out.some((r) => r.url.endsWith("/1")), "Epic/P0 任务单必须被挡掉");
  assert.ok(out.some((r) => r.url.endsWith("/2")), "真实痛点描述必须保留");
});
