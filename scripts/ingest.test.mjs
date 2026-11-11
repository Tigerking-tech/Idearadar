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
