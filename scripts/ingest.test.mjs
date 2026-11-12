import test from "node:test";
import assert from "node:assert/strict";
import {
  clamp,
  normalizeText,
  extractSignals,
  scorePainPoint,
  jaccard,
  dedupe,
  daysBetween,
  isNoiseTitle,
  truncateAtWord,
  noiseTitleReasons,
  aggregateByNiche,
  appendHistory,
  classifyTrend,
  matchTopic,
  buildOpportunities,
  recallMetrics,
  evaluateRecall,
  healthCheck,
} from "./ingest-lib.mjs";

test("clamp 边界与异常值", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
  assert.equal(clamp(NaN, 0, 10), 0);
  assert.equal(clamp(Infinity, 0, 10), 10);
});

test("normalizeText 去标签、解实体、压缩空白", () => {
  assert.equal(normalizeText("  <p>Tools &amp;  broken</p>  "), "Tools & broken");
  assert.equal(normalizeText("a\n\n  b"), "a b");
});

test("extractSignals 命中抱怨与付费意愿，且不误判中性文本", () => {
  const hit = extractSignals("This CRM is frustrating and broken. I'd pay $20/mo for a fix.");
  assert.equal(hit.hasComplaint, true);
  assert.ok(hit.signals.includes("frustration"));
  assert.ok(hit.intensityRaw > 0);
  assert.ok(hit.wtpSignals.includes("explicit_pay"));

  const neutral = extractSignals("Release notes for version 2.4 are now available.");
  assert.equal(neutral.hasComplaint, false);
  assert.equal(neutral.wtpSignals.length, 0);
});

test("scorePainPoint 满分上限 100，各权重按显式规则累加", () => {
  const perfect = scorePainPoint({
    mentions: 50,
    sources: ["hn", "so", "github", "rss"],
    intensityRaw: 100,
    daysSinceLatest: 0,
    lookbackDays: 30,
    hasWtp: true,
  });
  assert.equal(perfect.score, 100);
  assert.deepEqual(perfect.breakdown, {
    frequency: 30,
    intensity: 20,
    recency: 15,
    corroboration: 20,
    willingnessToPay: 15,
  });
});

test("scorePainPoint 零信号为 0，且分数随提及数单调不减", () => {
  const zero = scorePainPoint({ mentions: 0, sources: [], intensityRaw: 0, daysSinceLatest: 999, hasWtp: false });
  assert.equal(zero.score, 0);
  const a = scorePainPoint({ mentions: 2, sources: ["hn"], intensityRaw: 5, daysSinceLatest: 3, lookbackDays: 30 });
  const b = scorePainPoint({ mentions: 8, sources: ["hn"], intensityRaw: 5, daysSinceLatest: 3, lookbackDays: 30 });
  assert.ok(b.score > a.score);
});

test("scorePainPoint 付费意愿恰好贡献 15 分", () => {
  const base = { mentions: 3, sources: ["hn"], intensityRaw: 6, daysSinceLatest: 2, lookbackDays: 30 };
  const without = scorePainPoint({ ...base, hasWtp: false });
  const withWtp = scorePainPoint({ ...base, hasWtp: true });
  assert.equal(withWtp.score - without.score, 15);
});

test("jaccard 相同文本为 1，无关文本为 0", () => {
  assert.equal(jaccard("CRM tools are too complex", "CRM tools are too complex"), 1);
  assert.equal(jaccard("CRM tools are too complex", "banana bread recipe"), 0);
});

test("dedupe 合并重复项并汇总来源，不丢失独立项", () => {
  const items = [
    { title: "CRM tools are too complex for solo founders", text: "frustrating", source: "hn", url: "https://a", createdAt: "2026-11-01T00:00:00Z" },
    { title: "CRM tools are too complex for solo founders", text: "broken", source: "github", url: "https://b", createdAt: "2026-11-02T00:00:00Z" },
    { title: "Invoice exports break on multi-currency", text: "buggy", source: "so", url: "https://c", createdAt: "2026-11-03T00:00:00Z" },
  ];
  const groups = dedupe(items);
  assert.equal(groups.length, 2, "应合并为 2 组，避免假阴性漏合并");
  const merged = groups.find((g) => g.title.includes("CRM"));
  assert.equal(merged.mentions, 2);
  assert.deepEqual(merged.sources.sort(), ["github", "hn"]);
});

test("daysBetween 无效日期返回哨兵值 999，不抛出", () => {
  assert.equal(daysBetween("not-a-date", new Date("2026-11-11T00:00:00Z")), 999);
  assert.equal(daysBetween("2026-11-10T00:00:00Z", new Date("2026-11-11T00:00:00Z")), 1);
});

test("isNoiseTitle 拒绝首页曾误铺的四条真实噪音标题", () => {
  const noise = [
    "Server refusals in the user's language: every refusal code has its RO and EN text, checked in CI",
    "Why Agile Often Fails",
    "Anthropic IPO buyers see valuation as low as $1.1T",
    "The 7 Decision Gates That Determine Target Account Readiness in B2B Marketing",
  ];
  for (const t of noise) {
    assert.equal(isNoiseTitle(t), true, `应识别为噪音: ${t}`);
    assert.ok(noiseTitleReasons(t).length > 0);
  }
});

test("isNoiseTitle 拒绝 HN 投稿前缀、发行公告、QA 日志、多语言 issue 与反引号", () => {
  for (const t of [
    "Show HN: Aggregate Finance, your financial data in a spreadsheet you own",
    "QA run · all (64/355) · ff04ad81 · 13 PASS / 49 PARTIAL",
    "[Bug]: Sisa panggilan web ke rute yang tidak dilayani API",
    "[Bug] ToolPkg `registerAiProvider` 的 provider 无法被创建为模型供应商",
    "Release notes v2.4.1",
    "",
  ]) {
    assert.equal(isNoiseTitle(t), true, `应识别为噪音: ${t}`);
  }
});

test("isNoiseTitle 拒绝开发任务式标题（祈使句 / conventional commit / feature request）", () => {
  for (const t of [
    "[Feature Request] Add a Live Provider Debug Console for Inspecting API Requests",
    "Create frontend accounting module",
    "feat(tax): generate Section 194-O TDS and GST Input Tax Credit schedule",
    "Implement SSO login for the dashboard",
    "build: bump dependencies",
  ]) {
    assert.equal(isNoiseTitle(t), true, `应识别为开发任务: ${t}`);
  }
});

test("isNoiseTitle 保留真实的英文抱怨标题", () => {
  for (const t of [
    "CRM tools are too complex for solo founders",
    "Multi-currency invoices keep breaking exports",
    "No clean way to export support chat transcripts",
    "Booking tools lose recurring appointments",
  ]) {
    assert.equal(isNoiseTitle(t), false, `不应误杀: ${t}`);
  }
});

test("truncateAtWord 不产生半个单词，短文本原样返回", () => {
  const long = "The 7 Decision Gates That Determine Target Account Readiness in B2B Marketing";
  const cut = truncateAtWord(long, 40);
  assert.ok(cut.length <= 41, "截断后不应超过上限+省略号");
  assert.ok(cut.endsWith("…"));
  assert.ok(!/\s\w{1}$/.test(cut.replace("…", "")), "不应留下半截词尾");
  assert.equal(truncateAtWord("Short title", 96), "Short title");
  assert.equal(truncateAtWord("  a   b  ", 96), "a b");
});

/* ---------------- 多时间点趋势追踪 ---------------- */

test("aggregateByNiche 按赛道聚合平均分、总提及、条目数", () => {
  const out = aggregateByNiche([
    { nicheId: "a", score: 20, mentions: 2 },
    { nicheId: "a", score: 30, mentions: 3 },
    { nicheId: "b", score: 40, mentions: 1 },
  ]);
  assert.deepEqual(out, {
    a: { score: 25, mentions: 5, items: 2 },
    b: { score: 40, mentions: 1, items: 1 },
  });
  assert.deepEqual(aggregateByNiche([]), {});
});

test("appendHistory 追加、按时间排序、同时间戳幂等、滚动窗口裁剪", () => {
  const mk = (t, m) => ({ t: `2026-01-${t}T00:00:00Z`, byNiche: { a: { score: 20, mentions: m, items: 1 } } });
  let h = appendHistory(null, mk("03", 3), 3);
  h = appendHistory(h, mk("01", 1), 3);
  h = appendHistory(h, mk("02", 2), 3);
  assert.deepEqual(h.snapshots.map((s) => s.t.slice(8, 10)), ["01", "02", "03"], "应按时间升序");
  h = appendHistory(h, mk("04", 4), 3);
  assert.equal(h.snapshots.length, 3, "应裁剪到 maxSnapshots");
  assert.equal(h.snapshots[0].t.slice(8, 10), "02", "应丢弃最旧的");
  const len = h.snapshots.length;
  h = appendHistory(h, mk("03", 99), 3);
  assert.equal(h.snapshots.length, len, "同一时间戳应替换而非新增");
  assert.equal(h.snapshots.find((s) => s.t.includes("-03")).byNiche.a.mentions, 99);
});

test("appendHistory 损坏输入安全回退，且真实快照攒够 12 个后自动剔除引导数据", () => {
  const h0 = appendHistory("not-json", { t: "2026-01-01T00:00:00Z", byNiche: {} }, 120);
  assert.equal(h0.snapshots.length, 1);
  let h = { schemaVersion: 1, seeded: true, maxSnapshots: 120, snapshots: [] };
  for (let i = 1; i <= 10; i++) {
    h = appendHistory(h, { t: `2026-01-${String(i).padStart(2, "0")}T00:00:00Z`, seeded: true, byNiche: { a: { score: 20, mentions: 5, items: 1 } } }, 120);
  }
  assert.equal(h.seeded, true, "真实快照不足时应保留引导数据标记");
  for (let i = 1; i <= 12; i++) {
    h = appendHistory(h, { t: `2026-02-${String(i).padStart(2, "0")}T00:00:00Z`, byNiche: { a: { score: 20, mentions: 5, items: 1 } } }, 120);
  }
  assert.equal(h.seeded, false, "攒够 12 个真实快照后 seeded 应翻转为 false");
  assert.ok(h.snapshots.every((s) => !s.seeded), "引导快照应被全部剔除");
  assert.equal(h.snapshots.length, 12);
});

test("classifyTrend 正确判定 rising / steady / peaked 与样本不足", () => {
  const mk = (arr) => arr.map((mentions) => ({ score: 20, mentions }));
  assert.equal(classifyTrend(mk([3, 4])), "steady", "少于 3 个快照应诚实返回平稳");
  assert.equal(classifyTrend(mk([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), "rising", "持续上升");
  assert.equal(classifyTrend(mk([10, 10, 10, 10, 10, 10, 10, 10, 10, 10])), "steady", "完全持平");
  assert.equal(classifyTrend(mk([5, 8, 12, 20, 25, 22, 16, 12, 9, 6])), "peaked", "冲高后回落");
});

test("classifyTrend 峰值只看近 12 点，久远历史不永久影响当前判定", () => {
  const old = Array.from({ length: 20 }, () => ({ score: 20, mentions: 100 }));
  const recent = Array.from({ length: 12 }, () => ({ score: 20, mentions: 10 }));
  assert.equal(classifyTrend([...old, ...recent]), "steady", "久远峰值不应让近期平稳序列被判为已过峰");
});

/* ---------------- 噪音标题收紧：资讯/公告 + 开发工单 ---------------- */

test("isNoiseTitle 拒绝资讯/公告类标题（发行公告、路线图、带日期文章、公司动向、研究标题）", () => {
  const noise = [
    "Announcing .NET 11",
    "Connector Ecosystem Roadmap: tracking 120+ connector targets across databases, cloud and IoT",
    "Apple is killing its Support Community forum next week",
    "Scion is back and is going to sell a kei truck in America",
    "Ukraine Pivots to Israeli-Italian Satellite Tech to Bypass Starlink Restrictions",
    "To deter bioterrorism, U.S. imposes new rules on ordering synthetic DNA",
    "AI Users have workdays up to 90 min longer than non-users",
    "A great old-timey game-programming hack (2013)",
    "2026-11-11",
    "Design radar 2026-11-09",
  ];
  for (const t of noise) assert.equal(isNoiseTitle(t), true, `应识别为资讯/公告: ${t}`);
});

test("isNoiseTitle 拒绝开发工单/规格文档类标题（方括号标签、工单号、PRD/spec、review 跟进）", () => {
  const noise = [
    "[$175] Concierge - The empathetic reply does not include a clickable link",
    "[S175] Concierge - The empathetic reply does not include a clickable link",
    "[Consumer/Zoo/P1] Ship an expressive tiger asset as the seventh Zoo 1.0 species",
    "[post-training] Does OPD cause less drift and interference than SFT on Snowball?",
    "[engine] CD audio shutdown destroys worker resources after bounded polling",
    "[Research] Round 3: what users love and hate across SSH tools",
    "STORY-003-010: Conversation view",
    "FIN-04: Add custom CSV mapping through the existing encrypted import plan and Undo",
    "S11.13 A seat the table waits for is asked again after a pause",
    "V4 Enhanced Play Epic: Python plugin framework, community modding and V5 federation",
    "PRD: Grapevine for Ubuntu",
    "Program: Elsa 4 multi-tenancy (provider-agnostic, contract-level)",
    "Configuration: organize setup and options into shared sections",
    "Idea: run B.U.N.N.Y. on the Mac and the PC with shared state",
    "Critical Issue: Helpdesk App Overrides Login Routes and Ignores Portal Settings",
    "Architectural: eliminate LaTeX typesetting whack-a-mole with typed math IR",
    "Taiga TUI: MVP spec",
    "release: complete encrypted backup, restore and clinical acceptance gates",
    "Follow-up to #429: non-blocking review findings (Customer to store chat)",
    "HDB S3 #8329 follow-up: residual review findings (6)",
    "HDB sprite frames (#8339): residual review findings (18)",
    "Extract identity-guarded project configuration access into native adapters",
    "Refresh claims without signing out, and drop allow_any_sign_out_redirect_uri",
  ];
  for (const t of noise) assert.equal(isNoiseTitle(t), true, `应识别为开发工单: ${t}`);
});

test("noiseTitleReasons 覆盖本次新增的每一条规则 id（防止规则写错却漏测）", () => {
  const samples = [
    "Announcing .NET 11",
    "Connector Ecosystem Roadmap: tracking 120+ integrations",
    "2026-11-11",
    "Scion is back and is going to sell a kei truck",
    "AI Users have workdays up to 90 min longer",
    "[engine] CD audio shutdown destroys worker resources",
    "STORY-003-010: Conversation view",
    "PRD: Grapevine for Ubuntu",
    "Taiga TUI: MVP spec",
    "Follow-up to #429: non-blocking review findings",
  ];
  const hit = new Set(samples.flatMap((t) => noiseTitleReasons(t)));
  for (const id of [
    "announcement", "roadmap", "dated_article", "company_news", "study_headline",
    "bracket_prefix", "ticket_id", "doc_prefix", "spec_suffix", "review_followup",
  ]) {
    assert.ok(hit.has(id), `规则 ${id} 应至少命中一个样本`);
  }
});

test("isNoiseTitle 不误杀真实抱怨标题（含祈使动词开头但带抱怨语义的）", () => {
  const keep = [
    "CRM tools are too complex for solo founders",
    "Multi-currency invoices keep breaking exports",
    "No clean way to export support chat transcripts",
    "Booking tools lose recurring appointments",
    "Why is there no simple CRM for freelancers",
    "Invoices fail to export when using multi-currency",
    "Support chat transcripts are a pain to export",
    "Our CRM crashes every time we import contacts",
    "Spent 3 hours manually fixing invoice exports",
    "Billing exports are broken after the 2024 update",
    "Configuration management is a nightmare for our team",
    "Smart home devices should work without the internet",
    "Running Reports over several years can freeze the booking site for everyone for a few seconds",
    "v2 API broke our exports",
    "Users have reported that exports break",
    "Build times are killing our productivity",
    "Create flow keeps losing data",
  ];
  for (const t of keep) assert.equal(isNoiseTitle(t), false, `不应误杀: ${t}`);
});

/* ---------------- B2：源头相关度与评估门禁 ---------------- */

test("matchTopic 词边界、短语、大小写与空配置", () => {
  const terms = ["crm", "invoice", "expense report", "multi-currency"];
  assert.equal(matchTopic("Our CRM keeps crashing", terms), true, "大小写不敏感");
  assert.equal(matchTopic("scrm internal tool", terms), false, "crm 不能命中 scrm（词边界）");
  assert.equal(matchTopic("The expense report is broken", terms), true, "支持短语");
  assert.equal(matchTopic("multi-currency billing fails", terms), true, "支持带连字符短语");
  assert.equal(matchTopic("Totally unrelated headline", terms), false);
  assert.equal(matchTopic("", terms), false, "空文本不命中");
  assert.equal(matchTopic("anything", []), true, "未配置主题词时不设门槛（兼容旧配置）");
  assert.equal(matchTopic("anything", undefined), true);
});

test("buildOpportunities 主题门槛只放行与赛道相关的抱怨", () => {
  const niche = { id: "solo-crm", label: "CRM", topicTerms: ["crm", "sales pipeline"] };
  const cfg = { minScore: 0, lookbackDays: 30 };
  const mk = (title, text, url) => ({ title, text, url, createdAt: "2026-11-01T00:00:00Z", source: "hn" });
  const raw = [
    mk("Our CRM keeps losing contacts", "This CRM is broken and frustrating to use every day", "u1"),
    mk("United Airlines bans AI agents", "Our booking flow is broken and frustrating", "u2"), // 正文有抱怨、标题无主题词
    mk("Announcing .NET 11", "The CRM export is broken", "u3"), // 噪音标题
    mk("Simple CRM alternative", "no complaint words here at all", "u4"), // 无抱怨
    mk("CRM import is empty", "", "u5"), // 正文空
  ];
  const any = buildOpportunities(raw, { niche, cfg, now: new Date("2026-11-02T00:00:00Z"), topicScope: "any" });
  assert.equal(any.stats.raw, 5);
  assert.equal(any.stats.complaintRecords, 1, "any 作用域下标题无主题词也应放行（正文抱怨+正文含 crm 才行）");
  assert.equal(any.items[0].title, "Our CRM keeps losing contacts");
  assert.equal(any.metrics.finalTitleRate, 1, "唯一入选项标题含主题词");

  const titleOnly = buildOpportunities(raw, { niche, cfg, now: new Date("2026-11-02T00:00:00Z"), topicScope: "title" });
  assert.equal(titleOnly.stats.complaintRecords, 1, "title 作用域仍保留标题含 crm 的那条");
});

test("buildOpportunities 无主题词配置时行为与旧管线一致（不误杀）", () => {
  const niche = { id: "x", label: "X" }; // 无 topicTerms
  const cfg = { minScore: 0, lookbackDays: 30 };
  const raw = [
    { title: "A generic tool is broken", text: "It keeps crashing, very frustrating", url: "u1", createdAt: "2026-11-01T00:00:00Z", source: "hn" },
  ];
  const out = buildOpportunities(raw, { niche, cfg, now: new Date("2026-11-02T00:00:00Z") });
  assert.equal(out.items.length, 1, "未配置主题词不应过滤掉任何真实抱怨");
});

test("recallMetrics 区分召回层与最终层相关率", () => {
  const terms = ["crm"];
  const raw = [{ title: "CRM is broken" }, { title: "Random headline" }, { title: "Another thing" }, { title: "CRM pricing" }];
  const items = [{ title: "CRM is broken" }, { title: "Random headline" }];
  const m = recallMetrics(raw, items, terms);
  assert.equal(m.raw, 4);
  assert.equal(m.itemCount, 2);
  assert.equal(m.recallTitleRate, 0.5);
  assert.equal(m.finalTitleRate, 0.5);
  assert.deepEqual(recallMetrics([], [], terms), { raw: 0, itemCount: 0, recallTitleRate: 0, finalTitleRate: 0 });
});

test("evaluateRecall 达标 adopt，数量/质量/退化任一不达标 fallback", () => {
  const mk = (itemCount, finalTitleRate) => ({ metrics: { itemCount, finalTitleRate } });
  assert.equal(evaluateRecall({ relevance: mk(30, 0.8), legacy: mk(40, 0.3), minItems: 24, minFinalTitleRate: 0.6 }).verdict, "adopt");
  assert.equal(evaluateRecall({ relevance: mk(10, 0.9), legacy: mk(40, 0.3), minItems: 24, minFinalTitleRate: 0.6 }).verdict, "fallback", "数量不足");
  assert.match(evaluateRecall({ relevance: mk(10, 0.9), legacy: mk(40, 0.3), minItems: 24, minFinalTitleRate: 0.6 }).reasons.join(), /items 10 < 24/);
  assert.equal(evaluateRecall({ relevance: mk(30, 0.4), legacy: mk(40, 0.3), minItems: 24, minFinalTitleRate: 0.6 }).verdict, "fallback", "质量不足");
  assert.equal(evaluateRecall({ relevance: mk(30, 0.7), legacy: mk(40, 0.9), minItems: 24, minFinalTitleRate: 0.6 }).verdict, "fallback", "相对退化");
  assert.equal(evaluateRecall({ relevance: mk(30, 0.85), legacy: null, minItems: 24, minFinalTitleRate: 0.6 }).verdict, "adopt", "无基线时不阻塞");
  const d = evaluateRecall({ relevance: mk(30, 0.8), legacy: mk(40, 0.3), minItems: 24, minFinalTitleRate: 0.6 });
  assert.equal(d.method, "relevance", "adopt 时 method 给采集端");
  assert.equal(evaluateRecall({ relevance: mk(5, 0.2), legacy: mk(40, 0.3), minItems: 24, minFinalTitleRate: 0.6 }).method, "legacy");
});

/* ---------------- 产物健全性闸门（防限流残缺数据入库） ---------------- */

test("healthCheck 正常数据放行", () => {
  assert.deepEqual(healthCheck({
    itemCount: 36, minHealthyItems: 16,
    sourceStats: [{ source: "github", count: 200 }, { source: "hn", count: 100 }],
    errors: [{ source: "rss", message: "fetch failed" }],
  }), []);
});

test("healthCheck items 塌到个位数时拒绝", () => {
  const r = healthCheck({ itemCount: 7, minHealthyItems: 16, sourceStats: [], errors: [] });
  assert.equal(r.length, 1);
  assert.match(r[0], /items 7 < 16/);
});

test("healthCheck 主源被 403 限流且 0 行时拒绝", () => {
  const r = healthCheck({
    itemCount: 30, minHealthyItems: 16,
    sourceStats: [{ source: "github", count: 0 }, { source: "hn", count: 440 }],
    errors: [{ source: "github", message: "HTTP 403 for api.github.com" }],
  });
  assert.ok(r.some((x) => /限流/.test(x)), "403 + github 0 行应触发");
});

test("healthCheck 有 403 但主源仍有数据时不误杀", () => {
  assert.deepEqual(healthCheck({
    itemCount: 36, minHealthyItems: 16,
    sourceStats: [{ source: "github", count: 120 }, { source: "hn", count: 100 }],
    errors: [{ source: "github", message: "HTTP 403 for api.github.com" }],
  }), [], "偶发单次 403 但整体数据完整，应放行");
});

test("healthCheck minHealthyItems<=0 可显式跳过数量检查（本地诊断）", () => {
  assert.deepEqual(healthCheck({ itemCount: 2, minHealthyItems: 0, sourceStats: [], errors: [] }), []);
});
