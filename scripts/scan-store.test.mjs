import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  QUERIES,
  CANDIDATES,
  emptyQueries,
  emptyCandidates,
  storeConfig,
  loadDoc,
  saveDoc,
  appendQuery,
  putCandidates,
} from "./scan-store.mjs";

async function tmp() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ir-store-"));
  return root;
}

const resp = (ok, status, body) => ({
  ok,
  status,
  json: async () => (typeof body === "function" ? body() : body),
});

test("storeConfig 默认走本地文件；配了 URL 才走远端并去尾斜杠", () => {
  const local = storeConfig({});
  assert.equal(local.remote, false);
  assert.equal(local.url, "");
  const remote = storeConfig({ IDEARADAR_STORE_URL: "https://kv.example.com/api///", IDEARADAR_STORE_TOKEN: "t" });
  assert.equal(remote.remote, true);
  assert.equal(remote.url, "https://kv.example.com/api");
  assert.equal(remote.token, "t");
});

test("emptyQueries / emptyCandidates 是独立的新对象", () => {
  const a = emptyQueries();
  const b = emptyQueries();
  assert.notEqual(a, b);
  assert.deepEqual(a.queries, []);
  assert.deepEqual(emptyCandidates().directions, []);
});

test("本地 saveDoc / loadDoc 往返，含 updatedAt 自动写入", async () => {
  const root = await tmp();
  try {
    const opts = { root, env: {} };
    assert.equal(await saveDoc(QUERIES, { version: 1, queries: [{ q: "CRM", at: "x" }] }, opts), true);
    const doc = await loadDoc(QUERIES, opts);
    assert.equal(doc.queries.length, 1);
    assert.equal(doc.queries[0].q, "CRM");
    assert.ok(doc.updatedAt, "saveDoc 应写入 updatedAt");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("本地读不存在 / 损坏 / 结构不合法的文件，一律回退空文档", async () => {
  const root = await tmp();
  try {
    const opts = { root, env: {} };
    assert.deepEqual((await loadDoc(QUERIES, opts)).queries, []);
    await fs.mkdir(path.join(root, "data"), { recursive: true });
    await fs.writeFile(path.join(root, "data", "query-scans.json"), "{ not json");
    assert.deepEqual((await loadDoc(QUERIES, opts)).queries, []);
    await fs.writeFile(path.join(root, "data", "query-scans.json"), JSON.stringify({ version: 1, queries: "oops" }));
    assert.deepEqual((await loadDoc(QUERIES, opts)).queries, [], "queries 非数组时视为非法");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("远端 404 / 非 2xx / 非法 JSON / 网络异常都回退空文档，不抛", async () => {
  const env = { IDEARADAR_STORE_URL: "https://kv.example.com/api" };
  const cases = [
    resp(false, 404, {}),
    resp(false, 500, {}),
    resp(true, 200, () => { throw new Error("bad json"); }),
    resp(true, 200, { queries: "oops" }),
  ];
  for (const r of cases) {
    const doc = await loadDoc(QUERIES, { env, fetchImpl: async () => r });
    assert.deepEqual(doc.queries, []);
  }
  const thrown = await loadDoc(QUERIES, { env, fetchImpl: async () => { throw new Error("offline"); } });
  assert.deepEqual(thrown.queries, []);
});

test("远端 loadDoc 成功读取合法文档；saveDoc 返回 2xx 判定", async () => {
  const env = { IDEARADAR_STORE_URL: "https://kv.example.com/api", IDEARADAR_STORE_TOKEN: "secret" };
  let seenUrl = "";
  let seenInit = null;
  const ok = await loadDoc(CANDIDATES, {
    env,
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return resp(true, 200, { version: 1, directions: [{ q: "pet care", items: [] }] });
    },
  });
  assert.equal(ok.directions.length, 1);
  assert.equal(seenUrl, `https://kv.example.com/api/${CANDIDATES}`);
  assert.match(seenInit.headers.Authorization, /^Bearer secret$/);

  const putOk = await saveDoc(CANDIDATES, { version: 1, directions: [] }, {
    env,
    fetchImpl: async () => resp(true, 204, {}),
  });
  assert.equal(putOk, true);
  const putFail = await saveDoc(CANDIDATES, { version: 1, directions: [] }, {
    env,
    fetchImpl: async () => resp(false, 503, {}),
  });
  assert.equal(putFail, false);
  const putThrow = await saveDoc(CANDIDATES, { version: 1, directions: [] }, {
    env,
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(putThrow, false);
});

test("appendQuery 追加方向并归一字段，超过 500 条截断", async () => {
  const root = await tmp();
  try {
    const opts = { root, env: {} };
    await appendQuery("  宠物寄养  ", { hits: 3, locale: "zh", mode: "llm" }, opts);
    await appendQuery("CRM", {}, opts);
    const doc = await loadDoc(QUERIES, opts);
    assert.equal(doc.queries.length, 2);
    assert.equal(doc.queries[0].q, "宠物寄养", "存储层自行 trim，避免脏方向名");
    assert.equal(doc.queries[0].hits, 3);
    assert.equal(doc.queries[0].locale, "zh");
    assert.equal(doc.queries[0].mode, "llm");
    assert.equal(doc.queries[1].mode, "rules", "缺省 mode 走 rules");
    for (let i = 0; i < 520; i += 1) await appendQuery(`q${i}`, {}, opts);
    const capped = await loadDoc(QUERIES, opts);
    assert.equal(capped.queries.length, 500);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("putCandidates 同方向覆盖式、字段裁剪、按 200 方向截断", async () => {
  const root = await tmp();
  try {
    const opts = { root, env: {} };
    const rows = [
      { id: "x1", title: "A", titleOriginal: "A en", quote: "q", quoteOriginal: "q en", score: 78, sources: ["hn", "so"], extraneous: "drop me" },
    ];
    await putCandidates("pet sitting", rows, { locale: "en", mode: "llm", terms: ["pet app"] }, opts);
    let doc = await loadDoc(CANDIDATES, opts);
    assert.equal(doc.directions[0].terms[0], "pet app");
    assert.equal(doc.directions[0].items[0].extraneous, undefined, "只保留可核查字段");
    assert.equal(doc.directions[0].items[0].titleOriginal, "A en");
    await putCandidates("Pet Sitting", [{ id: "x2", title: "B" }], { locale: "en" }, opts);
    doc = await loadDoc(CANDIDATES, opts);
    assert.equal(doc.directions.length, 1, "大小写不同视为同一方向，覆盖而非追加");
    assert.equal(doc.directions[0].items[0].id, "x2", "最近一次为准");
    assert.equal(await putCandidates("", rows, {}, opts), false, "空方向不写入");
    for (let i = 0; i < 210; i += 1) await putCandidates(`dir-${i}`, rows, {}, opts);
    doc = await loadDoc(CANDIDATES, opts);
    assert.equal(doc.directions.length, 200);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
