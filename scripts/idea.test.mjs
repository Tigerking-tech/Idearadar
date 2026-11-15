import test from "node:test";
import assert from "node:assert/strict";
import {
  IDEA_VERSION, ideaKey, ideaInput, templateIdea, normalizeIdea, generateIdeas,
  NICHE_PERSONA, PERSONAS, extractIdeaRecords,
  BRIEF_FIELDS, normalizeBrief,
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

/* ---------------- v3「可决策机会简报」防回归 ---------------- */

const briefRec = (k, over = {}) => ({
  k, persona: "indie-dev",
  brief: {
    jobStory: { zh: "当导出联系人给会计时，小老板想把名单存成干净表格以便直接报税", en: "When exporting contacts monthly, a small owner wants a clean sheet so they can file directly" },
    pain: { zh: "名为=1+1的收件人被原样导出，Excel 里当公式执行，得手动清理几十行", en: "A recipient named =1+1 is exported raw and evaluated as a formula in Excel, forcing manual cleanup" },
    workaround: { zh: "现在只能逐行删公式符号，容易漏且慢", en: "They delete formula signs row by row, slow and error-prone" },
    rootObstacle: { zh: "导出功能把不受信任的单元格内容原样写入文件，没有先转成纯文本", en: "The exporter writes untrusted cell content verbatim instead of converting it to plain text first" },
    build: { zh: "在写入 CSV 前把所有单元格统一转成纯文本的一个导出开关", en: "A single export toggle that stringifies every cell to plain text before writing the CSV" },
    test: { zh: "做一个能上传 CSV 就给出纯净文件的单页，发给 3 位常导联系人的人当天试用", en: "Ship a one-page CSV cleaner and send it to 3 people who export contacts this week" },
    stopIf: { zh: "没人愿意为省这几分钟改变现有导出习惯时，就别做", en: "If nobody will change their export habit to save these minutes, drop it" },
    whyNow: { zh: "原话里没有时间性证据，只能确认这确实在发生", en: "No timing evidence in the quote; only that this is happening" },
  },
  ...over,
});

test("normalizeBrief：8 段双语齐全时采纳", () => {
  const b = normalizeBrief(briefRec("p0").brief);
  assert.ok(b, "合法简报必须被采纳");
  assert.deepEqual(Object.keys(b), BRIEF_FIELDS);
  assert.ok(b.build.zh.length > 0 && b.build.en.length > 0);
  assert.ok(b.rootObstacle.zh.includes("纯文本"));
});

test("normalizeBrief：命中万能套话/编造数字 → 判不合格（不拿废话充数）", () => {
  const a = briefRec("p0").brief;
  assert.equal(normalizeBrief({ ...a, build: { zh: "做个最小 MVP 找 3 个人试用", en: "build an MVP" } }), null);
  const b = briefRec("p0").brief;
  assert.equal(normalizeBrief({ ...b, pain: { zh: "市场规模 3 亿美元", en: "a 300 million market" } }), null);
  const c = briefRec("p0").brief;
  assert.equal(normalizeBrief({ ...c, test: { zh: "做 5 场用户访谈", en: "do user interviews" } }), null);
});

test("normalizeBrief：缺核心字段 / 非对象 / 全空 → 判不合格", () => {
  const a = briefRec("p0").brief; delete a.build;
  assert.equal(normalizeBrief(a), null);
  assert.equal(normalizeBrief(null), null);
  assert.equal(normalizeBrief({}), null);
});

test("normalizeBrief：某段写成纯字符串时保留中文、英文诚实留白", () => {
  const a = briefRec("p0").brief;
  a.pain = "导出时公式没被转义，得手动清";
  const b = normalizeBrief(a);
  assert.ok(b);
  assert.ok(b.pain.zh.includes("转义"));
  assert.equal(b.pain.en, "");
});

test("normalizeIdea：v3 简报采纳，旧四段从简报派生且不再有找3人套话", () => {
  const n = normalizeIdea(briefRec("p0"), item());
  assert.equal(n.origin, "llm");
  assert.ok(n.brief, "v3 必须挂 brief");
  // headline 来自 build、step 来自 test —— 首页/今日点子/同类线索自动获得实质内容。
  assert.ok(n.headline.zh.includes("纯文本"), "headline 应派生自 build");
  assert.ok(n.step.zh.includes("上传") || n.step.zh.includes("当天"), "step 应派生自 test");
  assert.ok(!/找\s*3\s*(个|位)人试用|最小起步|做个?最小(版本|MVP)/.test(JSON.stringify(n)), "不得残留万能套话");
});

test("templateIdea：v3 模板 brief 为 null 且不含找3人套话", () => {
  const t = templateIdea(item());
  assert.equal(t.brief, null, "模板不冒充已生成简报");
  assert.ok(!/找\s*3\s*个|最小版本|做个?最小(版本|MVP)|build an MVP/.test(JSON.stringify(t)));
  assert.ok(t.step.zh.includes("原始讨论"), "第一步应是打开原帖核对，不是万能套话");
});

test("extractIdeaRecords：v3 简报对象可被栈式抠出并归一化", () => {
  const out = extractIdeaRecords(JSON.stringify({ items: [briefRec("p0")] }));
  assert.equal(out.length, 1);
  assert.equal(out[0].k, "p0");
  const n = normalizeIdea(out[0], item());
  assert.equal(n.origin, "llm");
  assert.ok(n.brief);
});

test("generateIdeas：v3 简报输出被采纳为 llm，brief 完整", async () => {
  const rows = [item()];
  const replies = [briefRec("p0")];
  const { items, stats } = await generateIdeas(rows, OPTS(ideaFetch({ items: replies })));
  assert.equal(stats.generated, 1);
  assert.equal(items[0].idea.origin, "llm");
  assert.ok(items[0].idea.brief, "生成结果应带 8 段简报");
  assert.ok(items[0].idea.headline.zh.includes("纯文本"));
});

test("extractIdeaRecords：尾部漏引号毁掉外层结构时，按字段名逐段恢复简报", () => {
  // 复刻真实 hy-mt2-plus 畸形：最后一段 en 少一个 "，外层 }]}] 被吞进字符串。
  const seg = (f, zh, en) => `"${f}":{"zh":"${zh}","en":"${en}"}`;
  const broken = '{"items":[{"k":"p0","persona":"indie-dev","brief":{'
    + [seg("jobStory", "当导出联系人时想存成干净表格以便报税", "want a clean sheet to file taxes"),
       seg("pain", "公式被原样导出得手动清理", "formula exported raw, manual cleanup"),
       seg("workaround", "逐行删公式符号", "delete signs row by row"),
       seg("rootObstacle", "导出未把单元格转纯文本", "exporter writes cells verbatim"),
       seg("build", "写入前统一转纯文本的导出开关", "a toggle that stringifies cells before write"),
       seg("test", "做一个上传CSV就出纯净文件的单页当天发给3人试用", "ship a one-page CSV cleaner today"),
       seg("stopIf", "准确率低于50%就放弃", "if accuracy below 50% drop it")].join(",")
    + ',"whyNow":{"zh":"无时间证据","en":"no timing evidence.'  // 故意漏闭合引号
    + '}}]}]';
  const out = extractIdeaRecords(broken);
  assert.equal(out.length, 1);
  assert.equal(out[0].k, "p0");
  const n = normalizeIdea(out[0], item());
  assert.equal(n.origin, "llm", "尾部畸形也应还原成 llm 简报");
  assert.ok(n.brief, "应恢复出 brief");
  assert.ok(n.brief.build.zh.includes("纯文本"));
});

test("normalizeBrief：停止条件里的合理百分比阈值不被误杀", () => {
  const b = briefRec("p0").brief;
  b.stopIf = { zh: "准确率低于 50% 就放弃", en: "if accuracy below 50% drop it" };
  assert.ok(normalizeBrief(b), "合理阈值不是编造规模，不该回退");
  const c = briefRec("p0").brief;
  c.test = { zh: "做一个单页当天发给 3 位目标用户试用", en: "ship a one-page tool to 3 target users today" };
  assert.ok(normalizeBrief(c), "有具体 artifact 的验证动作不是万能套话");
});

test("generateIdeas：命中历史缓存时清理 JTBD 占位符并把干净结果写回缓存", async () => {
  const it = item();
  const key = ideaKey(it);
  const brief = JSON.parse(JSON.stringify(briefRec("p0").brief));
  brief.jobStory = {
    zh: "当需要统计家庭收支时，<具体用户>希望手动录入收据以便掌握预算。",
    en: "When tallying household expenses, <specific user> wants to log receipts to track the budget.",
  };
  // 模拟 cleanBriefText 加入前写入的历史缓存：结构合法但文本带占位符。
  const dirty = {
    version: IDEA_VERSION, origin: "llm", persona: "general", brief,
    headline: { zh: "旧标题", en: "Old headline" },
    who: { zh: "", en: "" }, why: { zh: "", en: "" }, step: { zh: "", en: "" },
  };
  const { items, ideas, stats } = await generateIdeas([it], OPTS(ideaFetch({ fail: true }), {
    cache: { [key]: dirty },
  }));
  assert.equal(stats.cached, 1, "应命中缓存");
  assert.equal(stats.requests, 0, "命中缓存不应再发请求");
  assert.equal(items[0].idea.origin, "llm");
  const text = JSON.stringify(items[0].idea);
  assert.ok(!/[<>]/.test(text), "产物不得残留尖括号");
  assert.ok(!/具体用户|特定用户|specific user|specific persona/.test(text), "产物不得残留占位词");
  assert.ok(items[0].idea.brief.jobStory.zh.includes("希望手动录入"), "清理后正文仍完整");
  assert.ok(!/[<>]/.test(JSON.stringify(ideas[key])), "缓存本身也要自愈，不能下轮又带回来");
  assert.ok(items[0].idea.headline.zh.includes("纯文本"), "旧四段应从清理后的简报重新派生");
});

test("generateIdeas：缓存里不合格的简报不复用，重新生成而不是把套话带回前端", async () => {
  const it = item();
  const key = ideaKey(it);
  const brief = JSON.parse(JSON.stringify(briefRec("p0").brief));
  brief.build = { zh: "做个最小版本找 3 个人试用", en: "build an MVP and find 3 users" };
  const dirty = {
    version: IDEA_VERSION, origin: "llm", persona: "general", brief,
    headline: { zh: "旧", en: "Old" },
    who: { zh: "", en: "" }, why: { zh: "", en: "" }, step: { zh: "", en: "" },
  };
  const { items, stats } = await generateIdeas([it], OPTS(ideaFetch({ items: [briefRec("p0")] }), {
    cache: { [key]: dirty },
  }));
  assert.equal(stats.cached, 0, "不合格缓存不算命中");
  assert.equal(stats.generated, 1, "应重新生成");
  assert.ok(!/做个?最小版本|build an MVP|找\s*3\s*个人试用/.test(JSON.stringify(items[0].idea)));
  assert.ok(items[0].idea.brief, "重新生成的结果应是合法简报");
});

// 客户视角：停止条件是「该不该放弃」的判断标准，不能由模型凭空拍一个百分比。
// 用户点「对照原话核对」会发现原话里根本没有这个数字，与首页「0 个编造的分数」
// 承诺冲突。prompt 已明文禁止；这里再对真实数据产物做一道防回归闸门。
test("数据产物：简报的停止条件不含凭空百分比阈值", async () => {
  const { readFileSync } = await import("node:fs");
  const file = new URL("../data/opportunities.json", import.meta.url);
  const data = JSON.parse(readFileSync(file, "utf8"));
  const bad = (data.items || [])
    .filter((x) => {
      const s = x?.idea?.brief?.stopIf;
      return s && /\d{1,3}\s*%/.test(`${s.zh || ""} ${s.en || ""}`);
    })
    .map((x) => x.id);
  assert.deepEqual(bad, [], "stopIf 不该出现无来源的百分比阈值");
});
