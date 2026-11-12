import test from "node:test";
import assert from "node:assert/strict";
import {
  hasChinese,
  fieldsToTranslate,
  needsTranslation,
  parseModelJson,
  translateItems,
  translateBatch,
} from "./translate.mjs";
import { quoteOf, translationKey } from "./ingest-lib.mjs";

/** 从请求体里还原送翻的数组，供 mock responder 使用。 */
function batchOf(init) {
  const body = JSON.parse(init.body);
  const content = body.messages[1].content;
  return JSON.parse(content.slice(content.indexOf("\n\n") + 2));
}

/** 构造 OpenAI 兼容的假 Response，并记录每次调用。 */
function modelFetch(responder = defaultResponder) {
  const calls = [];
  const fn = async (url, init) => {
    const batch = batchOf(init);
    calls.push({ url, init, batch });
    const content = typeof responder === "function" ? responder(batch, calls.length) : responder;
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
    };
  };
  fn.calls = calls;
  return fn;
}

function defaultResponder(batch) {
  return JSON.stringify(
    batch.map((b) => {
      const o = { id: b.id };
      if (Object.prototype.hasOwnProperty.call(b, "t")) o.t = `中文标题 ${b.id}`;
      if (Object.prototype.hasOwnProperty.call(b, "q")) o.q = `中文引语 ${b.id}`;
      return o;
    }),
  );
}

function httpError(status) {
  return async () => ({ ok: false, status, json: async () => ({}) });
}

function makeItem(n, extra = {}) {
  return {
    id: `niche-item-${n}`,
    title: `WISH: import Expense Report lines from CSV #${n}`,
    evidence: [{ excerpt: `### Feature Request I wish I could import CSV lines for item ${n}` }],
    signals: ["manual", "integration"],
    ...extra,
  };
}

const noSleep = async () => {};
const baseOpts = { token: "test-token", sleepImpl: noSleep };

test("hasChinese 只认含汉字的字符串", () => {
  assert.equal(hasChinese("从 CSV 导入费用报表"), true);
  assert.equal(hasChinese("CSV import"), false);
  assert.equal(hasChinese(""), false);
  assert.equal(hasChinese(undefined), false);
  assert.equal(hasChinese(123), false);
});

test("fieldsToTranslate 只送缺失字段，引语取自 evidence", () => {
  const raw = makeItem(1);
  const all = fieldsToTranslate(raw);
  assert.equal(all.id, raw.id);
  assert.equal(all.t, raw.title);
  assert.equal(all.q, quoteOf(raw));

  const half = fieldsToTranslate(makeItem(2, { titleZh: "从 CSV 导入费用报表" }));
  assert.equal(half.t, undefined, "已有中文标题时不应重翻");
  assert.equal(half.q, quoteOf(makeItem(2)));

  const cached = fieldsToTranslate(
    makeItem(3, { titleZh: "中文标题", quoteZh: "中文引语" }),
  );
  assert.deepEqual(cached, { id: "niche-item-3" });
});

test("needsTranslation 与字段有效性一致", () => {
  assert.equal(needsTranslation(makeItem(1)), true);
  assert.equal(needsTranslation(makeItem(2, { titleZh: "中文标题" })), true);
  assert.equal(needsTranslation(makeItem(3, { titleZh: "中文标题", quoteZh: "中文引语" })), false);
  assert.equal(needsTranslation(makeItem(4, { titleZh: "CSV import", quoteZh: "中文引语" })), true);
});

test("parseModelJson 兼容裸数组 / markdown fence / 前后夹带说明", () => {
  assert.deepEqual(parseModelJson('[{"id":"a","t":"中文"}]'), [{ id: "a", t: "中文" }]);
  assert.deepEqual(parseModelJson('```json\n[{"id":"a","t":"中文"}]\n```'), [{ id: "a", t: "中文" }]);
  assert.deepEqual(parseModelJson('Here is the result:\n[{"id":"a","t":"中文"}]\nDone.'), [{ id: "a", t: "中文" }]);
  assert.throws(() => parseModelJson("no json here"));
  assert.throws(() => parseModelJson('{"id":"a"}'), /no JSON array|not an array/);
  assert.throws(() => parseModelJson("[not valid json]"));
});

test("无 GITHUB_TOKEN 时跳过翻译且原样返回，不发起请求", async () => {
  const items = [makeItem(1), makeItem(2)];
  const fetchImpl = modelFetch();
  const { items: out, stats } = await translateItems(items, { ...baseOpts, token: "", fetchImpl });
  assert.match(stats.skippedReason, /GITHUB_TOKEN/);
  assert.equal(stats.requests, 0);
  assert.equal(out, items, "跳过时应返回原数组引用");
  assert.equal(fetchImpl.calls.length, 0);
});

test("全部已缓存时 0 请求，不重复调模型", async () => {
  const items = [
    makeItem(1, { titleZh: "中文标题", quoteZh: "中文引语" }),
    makeItem(2, { titleZh: "中文标题", quoteZh: "中文引语" }),
  ];
  const fetchImpl = modelFetch();
  const { stats } = await translateItems(items, { ...baseOpts, fetchImpl });
  assert.equal(stats.cached, 2);
  assert.equal(stats.pending, 0);
  assert.equal(stats.requests, 0);
  assert.equal(fetchImpl.calls.length, 0);
});

test("正常批量翻译：写回中文字段与缓存键，且不改动入参数组", async () => {
  const items = [makeItem(1), makeItem(2)];
  const fetchImpl = modelFetch();
  const { items: out, stats } = await translateItems(items, { ...baseOpts, fetchImpl });
  assert.equal(stats.pending, 2);
  assert.equal(stats.translated, 2);
  assert.equal(stats.failed, 0);
  assert.equal(stats.requests, 1);
  assert.equal(fetchImpl.calls.length, 1);
  for (const it of out) {
    assert.equal(hasChinese(it.titleZh), true);
    assert.equal(hasChinese(it.quoteZh), true);
    assert.equal(it.translationKey, translationKey(it));
  }
  assert.equal(items[0].titleZh, undefined, "translateItems 必须是纯函数");
  // 请求确实打到了 GitHub Models 端点并带上 Bearer token
  assert.equal(fetchImpl.calls[0].url, "https://models.github.ai/inference/chat/completions");
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, "Bearer test-token");
  assert.equal(JSON.parse(fetchImpl.calls[0].init.body).model, "openai/gpt-4o-mini");
});

test("标题已有译文时只请求引语，回填不覆盖已有中文标题", async () => {
  const items = [makeItem(1, { titleZh: "人工翻译的中文标题" })];
  const fetchImpl = modelFetch();
  const { items: out, stats } = await translateItems(items, { ...baseOpts, fetchImpl });
  assert.equal(stats.translated, 1);
  assert.deepEqual(fetchImpl.calls[0].batch[0], { id: "niche-item-1", q: quoteOf(items[0]) });
  assert.equal(out[0].titleZh, "人工翻译的中文标题");
  assert.equal(hasChinese(out[0].quoteZh), true);
});

test("按 batchSize 分批，25 条走 3 次请求", async () => {
  const items = Array.from({ length: 25 }, (_, i) => makeItem(i));
  const fetchImpl = modelFetch();
  const { items: out, stats } = await translateItems(items, { ...baseOpts, batchSize: 10, fetchImpl });
  assert.equal(stats.requests, 3);
  assert.equal(stats.translated, 25);
  assert.deepEqual(fetchImpl.calls.map((c) => c.batch.length), [10, 10, 5]);
  assert.equal(out.filter((x) => hasChinese(x.titleZh)).length, 25);
});

test("429 限流：重试后整批判失败、保留英文原文、不抛异常", async () => {
  const items = [makeItem(1), makeItem(2)];
  const { items: out, stats } = await translateItems(items, {
    ...baseOpts,
    fetchImpl: httpError(429),
  });
  assert.equal(stats.failed, 2);
  assert.equal(stats.translated, 0);
  assert.ok(stats.errors.some((e) => /429|rate limited/.test(e)));
  assert.equal(out[0].titleZh, undefined);
  assert.equal(out[1].quoteZh, undefined);
});

test("响应缺汉字 / 条数不符 / 缺 id 时判失败，不写半截译文", async () => {
  const badZh = modelFetch((batch) =>
    JSON.stringify(batch.map((b) => ({ id: b.id, t: "CSV import", q: "CSV import" }))),
  );
  const r1 = await translateItems([makeItem(1)], { ...baseOpts, fetchImpl: badZh });
  assert.equal(r1.stats.failed, 1);
  assert.equal(r1.items[0].titleZh, undefined);

  const badLen = modelFetch(() => "[]");
  const r2 = await translateItems([makeItem(2)], { ...baseOpts, fetchImpl: badLen });
  assert.equal(r2.stats.failed, 1);

  const badId = modelFetch((batch) =>
    JSON.stringify(batch.map((b) => ({ id: "wrong-id", t: "中文标题", q: "中文引语" }))),
  );
  const r3 = await translateItems([makeItem(3)], { ...baseOpts, fetchImpl: badId });
  assert.equal(r3.stats.failed, 1);
});

test("markdown fence 包裹的响应也能正确写回", async () => {
  const fetchImpl = modelFetch((batch) => "```json\n" + defaultResponder(batch) + "\n```");
  const { items: out, stats } = await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  assert.equal(stats.translated, 1);
  assert.equal(hasChinese(out[0].titleZh), true);
});

test("术语与产品名原样保留（模型返回什么就存什么）", async () => {
  const fetchImpl = modelFetch((batch) =>
    JSON.stringify(batch.map((b) => ({ id: b.id, t: "希望从 CSV 导入 Xero 费用报表", q: "Stripe 手续费同步到 QuickBooks 失败" }))),
  );
  const { items: out } = await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  assert.match(out[0].titleZh, /CSV/);
  assert.match(out[0].titleZh, /Xero/);
  assert.match(out[0].quoteZh, /Stripe/);
  assert.match(out[0].quoteZh, /QuickBooks/);
});

test("部分批次失败不影响其他批，状态为 partial 可追溯", async () => {
  const items = Array.from({ length: 15 }, (_, i) => makeItem(i));
  // 第二批（item-10..14）无论如何重试都返回 503，其余批次正常。
  // 按批次内容判断，避免把「重试成功的那一次」误算成新批次。
  const fetchImpl = async (url, init) => {
    const batch = batchOf(init);
    const isSecondBatch = batch.some((b) => Number(String(b.id).split("-").pop()) >= 10);
    if (isSecondBatch) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: defaultResponder(batch) } }] }) };
  };
  const { items: out, stats } = await translateItems(items, { ...baseOpts, batchSize: 10, fetchImpl });
  assert.equal(stats.translated, 10);
  assert.equal(stats.failed, 5);
  assert.equal(stats.requests, 1);
  assert.ok(stats.errors.some((e) => /503/.test(e)));
  assert.equal(out.filter((x) => hasChinese(x.titleZh)).length, 10);
});

test("translateBatch 直接调用也能做严格校验", async () => {
  const batch = [{ id: "a", t: "Import CSV", q: "I wish I could import CSV" }];
  const ctx = {
    endpoint: "https://example.invalid",
    model: "test-model",
    token: "tok",
    fetchImpl: modelFetch(),
    sleepImpl: noSleep,
    timeoutMs: 5000,
  };
  const res = await translateBatch(batch, ctx);
  assert.equal(hasChinese(res.get("a").titleZh), true);
  assert.equal(hasChinese(res.get("a").quoteZh), true);
});
