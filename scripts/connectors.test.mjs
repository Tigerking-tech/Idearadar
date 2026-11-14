import test from "node:test";
import assert from "node:assert/strict";
import { resolveFeeds } from "./connectors.mjs";

test("resolveFeeds 兼容历史字符串数组（默认启用）", () => {
  assert.deepEqual(resolveFeeds(["https://news.ycombinator.com/rss"]), ["https://news.ycombinator.com/rss"]);
  assert.deepEqual(resolveFeeds([]), []);
  assert.deepEqual(resolveFeeds(null), []);
  assert.deepEqual(resolveFeeds(undefined), []);
});

test("resolveFeeds 过滤 enabled:false、去重、跳过非法项", () => {
  const feeds = [
    { url: "https://a.example/rss", enabled: true },
    { url: "https://b.example/rss", enabled: false },
    { url: "https://a.example/rss", enabled: true },
    { url: "ftp://bad.example/rss", enabled: true },
    { url: "" },
    null,
    "https://c.example/rss",
  ];
  assert.deepEqual(resolveFeeds(feeds), ["https://a.example/rss", "https://c.example/rss"]);
});

test("resolveFeeds 对象缺 enabled 时默认启用（向后兼容）", () => {
  assert.deepEqual(resolveFeeds([{ url: "https://x.example/rss", label: "X" }]), ["https://x.example/rss"]);
});

test("resolveFeeds 只放行 http(s)，拒绝 javascript: 等危险协议", () => {
  assert.deepEqual(resolveFeeds(["javascript:alert(1)", "https://ok.example/rss", "file:///etc/passwd"]), ["https://ok.example/rss"]);
});
