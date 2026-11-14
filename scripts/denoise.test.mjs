import test from "node:test";
import assert from "node:assert/strict";
import {
  CODES, DEFAULT_MAX_REJECT_RATIO, denoiseInput, denoiseItems, denoiseKey,
  judgeBatch, mergeRejected, normalizeVerdict, parseVerdictArray,
} from "./denoise.mjs";

const item = (id, title, extra = {}) => ({
  id,
  title,
  titleZh: `中文：${title}`,
  score: 61,
  signals: ["broken", "manual"],
  sources: ["hn", "so"],
  mentions: 4,
  nicheLabel: "scheduling",
  evidence: [{ title, excerpt: "the export keeps breaking and we copy everything manually" }],
  opportunityCard: { version: 1 },
  ...extra,
});

/**
 * 依据请求体里的 {items:[{id,...}]} 回一条合法判定。
 * 默认：标题含 outage / template / WISH 判为噪声，其余保留。
 */
function denoiseFetch(overrides = {}) {
  const calls = [];
  const fn = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (overrides.fail) return { ok: false, status: 500, json: async () => ({}) };
    if (overrides.badContent !== undefined) {
      return {
        ok: true, status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ choices: [{ message: { content: overrides.badContent } }] }),
      };
    }
    const uc = String(body.messages?.[1]?.content || "");
    let items = [];
    try { items = JSON.parse(uc.slice(uc.indexOf("{"))).items || []; } catch { items = []; }
    const decide = overrides.decide || ((x) => !/outage|template|WISH|Planned:/i.test(x.title));
    const verdicts = items.map((x) => {
      const keep = decide(x);
      const key = x.k ?? x.id;
      return {
        k: key,
        id: key,
        keep,
        code: keep ? "complaint" : "status-news",
        reason: keep ? "具体抱怨" : "服务中断公告",
      };
    });
    return {
      ok: true, status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: verdicts }) } }] }),
    };
  };
  fn.calls = calls;
  return fn;
}

const OPTS = (fetchImpl, extra = {}) => ({ enabled: true, token: "tk", fetchImpl, sleepImpl: async () => {}, ...extra });

test("默认关闭：不发起请求、原样返回同一个数组引用", async () => {
  const fetchImpl = denoiseFetch();
  const items = [item("a", "Export keeps breaking")];
  const { items: out, stats } = await denoiseItems(items, { enabled: false, token: "tk", fetchImpl });
  assert.equal(stats.enabled, false);
  assert.equal(stats.requests, 0);
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(out, items, "关闭时不得复制/修改输入");
  assert.equal(stats.status, "skipped");
  assert.match(stats.skippedReason, /IDEARADAR_DENOISE/);
});

test("无 token 时跳过，不报错，状态 skipped", async () => {
  const fetchImpl = denoiseFetch();
  const { items: out, stats } = await denoiseItems([item("a", "Export keeps breaking")], { enabled: true, token: "", fetchImpl });
  assert.equal(stats.requests, 0);
  assert.equal(stats.status, "skipped");
  assert.match(stats.skippedReason, /IDEARADAR_TRANSLATE_TOKEN/);
  assert.equal(out.length, 1);
});

test("开启后按 id 判定：剔除噪声、保留真实抱怨，并写增量缓存", async () => {
  const fetchImpl = denoiseFetch();
  // 显式关闭安全阀以聚焦判定逻辑；默认阈值 0.4 另有独立测试覆盖。
  const items = [
    item("a", "Export keeps breaking"),
    item("b", "Global Microsoft Outage"),
    item("c", "WISH: ## Problem Parent epic"),
    item("d", "Booking loses slots"),
  ];
  const { items: out, rejected, verdicts, stats } = await denoiseItems(items, OPTS(fetchImpl, { maxRejectRatio: 1 }));
  assert.equal(stats.requests, 1);
  assert.equal(stats.judged, 4);
  assert.equal(stats.ratioGuard, false);
  assert.deepEqual(out.map((x) => x.id), ["a", "d"]);
  assert.deepEqual(rejected.map((x) => x.id), ["b", "c"]);
  assert.equal(rejected[0].layer, "denoise");
  assert.deepEqual(rejected[0].reasons, ["llm:status-news"]);
  assert.equal(rejected[0].note, "服务中断公告");
  assert.equal(stats.status, "ok");
  assert.equal(stats.kept, 2);
  assert.equal(stats.rejected, 2);
  for (const it of items) assert.ok(verdicts[denoiseKey(it)], "每条都应落缓存");
  assert.equal(Object.keys(verdicts).length, 4);
});

test("送判字段最小化：只含可核查字段，不含 evidence 全文 / score / signals", () => {
  const input = denoiseInput(item("a", "Export keeps breaking", { sources: ["hn", "so", "github", "rss", "extra"] }));
  assert.deepEqual(Object.keys(input).sort(), ["k", "niche", "quote", "sources", "title", "titleZh"]);
  assert.equal(input.id, undefined, "长 id 不送给模型，避免被截断");
  assert.equal(input.evidence, undefined);
  assert.equal(input.score, undefined);
  assert.equal(input.signals, undefined);
  assert.equal(input.sources.length, 4, "来源最多 4 个");
  assert.ok(input.quote.length <= 200);
});

test("增量缓存：已判定条目不再请求；第二轮零请求且结果一致", async () => {
  const fetchImpl = denoiseFetch();
  const items = [item("a", "Export keeps breaking"), item("b", "Booking loses slots")];
  const first = await denoiseItems(items, OPTS(fetchImpl));
  assert.equal(first.stats.requests, 1);
  assert.equal(first.stats.cached, 0);

  const fetch2 = denoiseFetch({ fail: true });
  const second = await denoiseItems(items, OPTS(fetch2, { cache: { verdicts: first.verdicts } }));
  assert.equal(fetch2.calls.length, 0, "全部命中缓存不得发起请求");
  assert.equal(second.stats.cached, 2);
  assert.equal(second.stats.judged, 0);
  assert.deepEqual(second.items.map((x) => x.id), ["a", "b"]);
});

test("批次请求失败：该批整批保留、不抛异常、status=partial", async () => {
  const fetchImpl = denoiseFetch({ fail: true });
  const items = [item("a", "Export keeps breaking"), item("b", "Global Microsoft Outage")];
  const { items: out, rejected, stats } = await denoiseItems(items, OPTS(fetchImpl));
  assert.equal(stats.errors.length, 1);
  assert.equal(stats.status, "partial");
  assert.equal(out.length, 2, "失败批次必须 fail-open 全部保留");
  assert.equal(rejected.length, 0);
  assert.equal(stats.judged, 0);
});

test("模型返回非法 JSON：整批保留，不误杀", async () => {
  const fetchImpl = denoiseFetch({ badContent: "not json at all" });
  const { items: out, stats } = await denoiseItems([item("a", "Export keeps breaking")], OPTS(fetchImpl));
  assert.equal(out.length, 1);
  assert.equal(stats.status, "partial");
  assert.ok(stats.errors.length >= 1);
});

test("模型漏单条 id：其余判定仍生效，漏的条目保留且下轮可重判", async () => {
  const fetchImpl = denoiseFetch({
    badContent: JSON.stringify({
      items: [
        { k: "p0", keep: false, code: "status-news", reason: "服务中断公告" },
        { k: "p2", keep: true, code: "complaint", reason: "具体抱怨" },
      ],
    }),
  });
  const items = [
    item("a", "Global Microsoft Outage"),
    item("b", "Export keeps breaking"),
    item("c", "Booking loses slots"),
  ];
  const { items: out, rejected, verdicts, stats } = await denoiseItems(items, OPTS(fetchImpl));
  assert.deepEqual(out.map((x) => x.id), ["b", "c"], "漏判的 b 必须保留");
  assert.deepEqual(rejected.map((x) => x.id), ["a"]);
  assert.equal(stats.judged, 2);
  assert.equal(stats.status, "ok");
  assert.equal(verdicts[denoiseKey(items[1])], undefined, "b 无缓存 → 下轮自动重判");
});

test("判定覆盖率过低：整批判失败，全部保留（不把全保留误记成成功）", async () => {
  const fetchImpl = denoiseFetch({ badContent: JSON.stringify({ items: [{ k: "zzz", keep: false }] }) });
  const { items: out, stats } = await denoiseItems(
    [item("a", "Export keeps breaking"), item("b", "Booking loses slots"), item("c", "CSV export")],
    OPTS(fetchImpl),
  );
  assert.equal(out.length, 3);
  assert.equal(stats.status, "partial");
  assert.match(stats.errors[0], /coverage|verdict|JSON/i);
});

test("normalizeVerdict：只有显式 false 才剔除，缺失/非法一律保留", () => {
  assert.equal(normalizeVerdict({ keep: false, code: "status-news" }).keep, false);
  assert.equal(normalizeVerdict({ keep: "false", code: "status-news" }).keep, false);
  assert.equal(normalizeVerdict(null), null);
  assert.equal(normalizeVerdict({}).keep, true, "缺 keep 必须保留");
  assert.equal(normalizeVerdict({ keep: "maybe" }).keep, true, "非法类型必须保留");
  assert.equal(normalizeVerdict({ keep: true }).code, "complaint");
  assert.equal(normalizeVerdict({ keep: false, code: "瞎写的" }).code, "other");
  assert.equal(normalizeVerdict({ keep: false, reason: "  x  ".repeat(40) }).reason.length <= 80, true);
});

test("parseVerdictArray：JSON 后多吐一段时取第一个完整数组，兼容 fence/裸数组", () => {
  const good = JSON.stringify({ items: [{ id: "a", keep: true, code: "complaint", reason: "ok" }] });
  const noisy = `${good}\n${JSON.stringify({ items: [{ id: "b", keep: false }] })}`;
  const out = parseVerdictArray(noisy);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a");
  assert.equal(parseVerdictArray(`\`\`\`json\n${good}\n\`\`\``).length, 1);
  assert.equal(parseVerdictArray(JSON.stringify([{ id: "a", keep: true }])).length, 1);
  assert.throws(() => parseVerdictArray("完全不是 JSON"));
});

test("judgeBatch：未知 code 归一化、id 对齐、code 枚举合法", async () => {
  const fetchImpl = denoiseFetch({ decide: () => false });
  const out = await judgeBatch([denoiseInput(item("a", "Global Microsoft Outage"))], {
    endpoint: "x", model: "m", token: "tk", fetchImpl,
  });
  assert.equal(out.get("a").keep, false);
  assert.ok(CODES.includes(out.get("a").code));
});

test("安全阀：驳回比例超阈值时整批回退保留，status=suspicious", async () => {
  const fetchImpl = denoiseFetch({ decide: () => false });
  const items = [item("a", "one"), item("b", "two"), item("c", "three")];
  const { items: out, rejected, stats } = await denoiseItems(items, OPTS(fetchImpl, { maxRejectRatio: 0.3 }));
  assert.equal(fetchImpl.calls.length > 0, true);
  assert.equal(stats.ratioGuard, true);
  assert.equal(stats.status, "suspicious");
  assert.equal(out.length, 3, "整批回退，一条都不能删");
  assert.equal(rejected.length, 0);
  assert.equal(stats.kept, 3);
  assert.ok(DEFAULT_MAX_REJECT_RATIO > 0 && DEFAULT_MAX_REJECT_RATIO <= 1);
});

test("默认安全阀阈值 0.4：驳回比例过高时整批回退", async () => {
  const fetchImpl = denoiseFetch({ decide: () => false });
  const items = [item("a", "one"), item("b", "two"), item("c", "three"), item("d", "four")];
  const { items: out, stats } = await denoiseItems(items, OPTS(fetchImpl));
  assert.equal(DEFAULT_MAX_REJECT_RATIO, 0.4);
  assert.equal(stats.ratioGuard, true);
  assert.equal(stats.status, "suspicious");
  assert.equal(out.length, 4, "一条都不能删");
});

test("forceKeepIds 人工翻案：被判 false 的条目强制保留", async () => {
  const fetchImpl = denoiseFetch({ decide: () => false });
  const items = [
    item("a", "Global Microsoft Outage"),
    item("b", "Salesforce job is never recovered"),
    item("c", "CSV export"),
    item("d", "Booking"),
  ];
  const { items: out, rejected, stats } = await denoiseItems(
    items, OPTS(fetchImpl, { maxRejectRatio: 1, keepIds: ["b"] }),
  );
  assert.equal(stats.forceKept, 1);
  assert.deepEqual(out.map((x) => x.id), ["b"]);
  assert.deepEqual(rejected.map((x) => x.id), ["a", "c", "d"]);
});

test("安全阀阈值可关闭（=1）：允许全量驳回", async () => {
  const fetchImpl = denoiseFetch({ decide: () => false });
  const { items: out, stats } = await denoiseItems(
    [item("a", "one")], OPTS(fetchImpl, { maxRejectRatio: 1 }),
  );
  assert.equal(stats.ratioGuard, false);
  assert.equal(out.length, 0);
});

test("原文变化会使缓存键改变，触发重新判定", async () => {
  const a = item("a", "Export keeps breaking");
  const b = item("a", "Export keeps failing");
  assert.notEqual(denoiseKey(a), denoiseKey(b));
  const first = await denoiseItems([a], OPTS(denoiseFetch()));
  const second = await denoiseItems([b], OPTS(denoiseFetch(), { cache: { verdicts: first.verdicts } }));
  assert.equal(second.stats.cached, 0);
  assert.equal(second.stats.judged, 1);
});

test("mergeRejected：保留策展层记录、去重、按层统计、不覆盖原有字段", async () => {
  const prev = {
    schemaVersion: 1, generatedAt: "old", curationVersion: 7, count: 1,
    items: [{ id: "x", title: "fad", reasons: ["excludeTerm:movie"] }],
  };
  const doc = await mergeRejected(
    [
      { id: "b", title: "Outage", layer: "denoise", reasons: ["llm:status-news"], note: "公告" },
      { id: "x", title: "dup", layer: "denoise", reasons: ["llm:other"], note: "" },
    ],
    "2026-11-14T00:00:00Z",
    prev,
  );
  assert.equal(doc.curationVersion, 7, "原有元信息不得丢失");
  assert.equal(doc.generatedAt, "2026-11-14T00:00:00Z");
  assert.equal(doc.count, 2, "同 id 去重");
  assert.deepEqual(doc.items.map((x) => x.id), ["x", "b"]);
  assert.equal(doc.items[0].layer, undefined, "原策展记录原样保留");
  assert.equal(doc.curationCount, 1);
  assert.equal(doc.denoiseCount, 1);
});

test("mergeRejected：空驳回时不改写 items 顺序、只补统计", async () => {
  const prev = { schemaVersion: 1, count: 1, items: [{ id: "x", reasons: ["a"] }] };
  const doc = await mergeRejected([], "t", prev);
  assert.equal(doc.count, 1);
  assert.equal(doc.curationCount, 1);
  assert.equal(doc.denoiseCount, 0);
});

test("mergeRejected：无既有文件时从空文档起步", async () => {
  const doc = await mergeRejected([{ id: "b", layer: "denoise", reasons: [], note: "" }], "t", {});
  assert.equal(doc.count, 1);
  assert.equal(doc.denoiseCount, 1);
});

test("幂等：同一批连续跑两次，第二次全命中缓存且输出一致", async () => {
  const fetchImpl = denoiseFetch();
  const items = [item("a", "Export keeps breaking"), item("b", "Global Microsoft Outage")];
  const one = await denoiseItems(items, OPTS(fetchImpl, { maxRejectRatio: 1 }));
  const two = await denoiseItems(one.items.concat(
    items.filter((x) => x.id === "b"),
  ), OPTS(denoiseFetch({ fail: true }), { cache: { verdicts: one.verdicts }, maxRejectRatio: 1 }));
  assert.equal(two.stats.requests, 0);
  assert.deepEqual(two.items.map((x) => x.id), ["a"], "被剔除条目即使重新进入也按缓存剔除");
});
