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

test("parseModelJson 兼容 response_format=json_object 的 {\"items\":[...]} 包装", () => {
  const wrapped = '{"items":[{"id":"a","t":"中文标题","q":"中文引语"}]}';
  assert.deepEqual(parseModelJson(wrapped), [{ id: "a", t: "中文标题", q: "中文引语" }]);
  assert.deepEqual(parseModelJson(`Here:\n${wrapped}\nDone.`), [{ id: "a", t: "中文标题", q: "中文引语" }]);
  assert.deepEqual(parseModelJson("```json\n" + wrapped + "\n```"), [{ id: "a", t: "中文标题", q: "中文引语" }]);
});

test("无 IDEARADAR_TRANSLATE_TOKEN 时跳过翻译且原样返回，不发起请求", async () => {
  const items = [makeItem(1), makeItem(2)];
  const fetchImpl = modelFetch();
  const { items: out, stats } = await translateItems(items, { ...baseOpts, token: "", fetchImpl });
  assert.match(stats.skippedReason, /IDEARADAR_TRANSLATE_TOKEN/);
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
  // 请求带上 Bearer token，且不绑定任何具体厂商（换端点只需改环境变量）
  assert.match(fetchImpl.calls[0].url, /^https:\/\/.*\/chat\/completions$/);
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, "Bearer test-token");
  assert.equal(typeof JSON.parse(fetchImpl.calls[0].init.body).model, "string");
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

test("端点返回 text/plain 占位时判为端点级故障，快速跳过剩余批次", async () => {
  const items = Array.from({ length: 25 }, (_, i) => makeItem(i));
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true, status: 200,
      headers: { get: () => "text/plain" },
      json: async () => { throw new SyntaxError("Unexpected token 'O'"); },
    };
  };
  const { items: out, stats } = await translateItems(items, { ...baseOpts, batchSize: 10, fetchImpl });
  assert.equal(stats.requests, 0);
  assert.equal(stats.translated, 0);
  assert.equal(stats.failed, 25, "全部待翻条目都记为跳过");
  assert.match(stats.skippedReason, /非 JSON|网络出口|text\/plain/);
  assert.equal(calls, 2, "首批重试 2 次后立即停止，后续 2 批不再发起");
  assert.equal(out[0].titleZh, undefined);
});

test("响应体不是 JSON 时给出明确的端点级错误", async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => { throw new SyntaxError("Unexpected token 'O', \"OK\" is not valid JSON"); },
  });
  const { stats } = await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  assert.match(stats.skippedReason, /非 JSON 响应/);
  assert.match(stats.errors[0], /非 JSON 响应/);
  assert.equal(stats.failed, 1);
});

test("IDEARADAR_TRANSLATE_TOKEN 环境变量可注入密钥（BYOK 切换）", async () => {
  process.env.IDEARADAR_TRANSLATE_TOKEN = "byok-key";
  process.env.GITHUB_TOKEN = "github-token-should-not-be-used";
  try {
    const fetchImpl = modelFetch();
    const { stats } = await translateItems([makeItem(1)], { ...baseOpts, token: undefined, fetchImpl });
    assert.equal(stats.translated, 1);
    assert.equal(fetchImpl.calls[0].init.headers.Authorization, "Bearer byok-key");
  } finally {
    delete process.env.IDEARADAR_TRANSLATE_TOKEN;
    delete process.env.GITHUB_TOKEN;
  }
});

/* ---------------- TokenHub / 推理模型兼容（BYOK 回退） ---------------- */

test("推理模型只吐思考链、content 为空时给出可操作的诊断", async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => ({
      choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "我需要把标题翻译成中文……" } }],
    }),
  });
  const { stats } = await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  assert.equal(stats.translated, 0);
  assert.match(stats.errors[0], /思考链|reasoning/);
  assert.match(stats.errors[0], /MAX_TOKENS|REASONING_EFFORT/);
});

test("reasoning_effort 配置会随请求下发，且默认不带（保持纯净 OpenAI 兼容）", async () => {
  const withEffort = modelFetch();
  const plain = modelFetch();
  await translateItems([makeItem(1)], { ...baseOpts, fetchImpl: withEffort });
  await translateItems([makeItem(2)], { ...baseOpts, fetchImpl: plain, reasoningEffort: "low" });
  assert.equal(withEffort.calls[0].init.body.includes("reasoning_effort"), false);
  assert.equal(JSON.parse(plain.calls[0].init.body).reasoning_effort, "low");
});

test("max_tokens 可配置，默认 8000 上限（兼容 BYOK 推理模型，不影响翻译模型实际消耗）", async () => {
  const fetchImpl = modelFetch();
  await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  assert.equal(JSON.parse(fetchImpl.calls[0].init.body).max_tokens, 8000);
  const custom = modelFetch();
  await translateItems([makeItem(2)], { ...baseOpts, fetchImpl: custom, maxTokens: 12000 });
  assert.equal(JSON.parse(custom.calls[0].init.body).max_tokens, 12000);
});

test("401/403 视为端点级故障：首批重试后立即跳过剩余批次", async () => {
  const items = Array.from({ length: 20 }, (_, i) => makeItem(i));
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: false, status: 401, json: async () => ({ error: { message: "Invalid API key" } }) };
  };
  const { stats } = await translateItems(items, { ...baseOpts, batchSize: 5, fetchImpl });
  assert.match(stats.skippedReason, /HTTP 401|API Key/);
  assert.equal(calls, 2, "重试 2 次即收手，不刷满 4 批");
  assert.equal(stats.failed, 20);
  assert.equal(stats.requests, 0);
});

test("响应体带 error 字段时归为端点级故障", async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => ({ error: { message: "model not subscribed" } }),
  });
  const { stats } = await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  assert.match(stats.skippedReason, /model not subscribed/);
  assert.equal(stats.translated, 0);
});

test("默认端点/模型指向 TokenHub 的翻译专用模型，且不下发推理/厂商专用字段", async () => {
  const fetchImpl = modelFetch();
  await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  const { url, init } = fetchImpl.calls[0];
  assert.match(url, /tokenhub\.tencentmaas\.com\/v1\/chat\/completions/);
  const body = JSON.parse(init.body);
  assert.equal(body.model, "hy-mt2-plus");
  assert.equal(body.reasoning_effort, undefined, "翻译专用模型不能带推理参数");
  assert.deepEqual(body.response_format, { type: "json_object" }, "强制合法 JSON，避免畸形数组");
  assert.equal(init.headers["X-GitHub-Api-Version"], undefined);
});

/* ---------------- 结构化输出（response_format） ---------------- */

test("默认下发 response_format=json_object，可用 jsonMode:false 关闭", async () => {
  const on = modelFetch();
  await translateItems([makeItem(1)], { ...baseOpts, fetchImpl: on });
  assert.deepEqual(JSON.parse(on.calls[0].init.body).response_format, { type: "json_object" });

  const off = modelFetch();
  await translateItems([makeItem(2)], { ...baseOpts, fetchImpl: off, jsonMode: false });
  assert.equal(JSON.parse(off.calls[0].init.body).response_format, undefined);
});

test("IDEARADAR_TRANSLATE_JSON_MODE=0 可由环境变量关闭结构化输出", async () => {
  process.env.IDEARADAR_TRANSLATE_JSON_MODE = "0";
  try {
    const fetchImpl = modelFetch();
    await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
    assert.equal(JSON.parse(fetchImpl.calls[0].init.body).response_format, undefined);
  } finally {
    delete process.env.IDEARADAR_TRANSLATE_JSON_MODE;
  }
});

test("端点不认识 response_format 返回 400 时自动去掉参数重试一次并成功", async () => {
  const bodies = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    n += 1;
    bodies.push(JSON.parse(init.body));
    if (n === 1) return { ok: false, status: 400, json: async () => ({}) };
    return {
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: defaultResponder(batchOf(init)) } }] }),
    };
  };
  const { stats } = await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  assert.equal(n, 2, "降级只发一次，不占用 translateBatch 的重试次数");
  assert.deepEqual(bodies[0].response_format, { type: "json_object" });
  assert.equal(bodies[1].response_format, undefined);
  assert.equal(stats.translated, 1);
  assert.equal(stats.failed, 0);
  assert.equal(stats.requests, 1);
});

test("降级后端点仍返回 400 时整批失败、保留英文原文", async () => {
  let n = 0;
  const fetchImpl = async () => { n += 1; return { ok: false, status: 400, json: async () => ({}) }; };
  const { items: out, stats } = await translateItems([makeItem(1)], { ...baseOpts, fetchImpl });
  assert.equal(n, 4, "2 次降级 × 2 次 translateBatch 重试");
  assert.equal(stats.failed, 1);
  assert.equal(out[0].titleZh, undefined);
});
