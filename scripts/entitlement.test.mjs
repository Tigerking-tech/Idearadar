import test from "node:test";
import assert from "node:assert/strict";
import { resolveEntitlement, serverTokensFromEnv, TIERS } from "./entitlement.mjs";

test("默认关闭：无论带什么凭证都是 guest，行为与现状一致", () => {
  const r = resolveEntitlement({
    env: {},
    apiToken: "some-token",
    session: { userId: "u1", plan: "pro" },
    serverTokens: ["some-token"],
  });
  assert.equal(r.enabled, false);
  assert.equal(r.tier, "guest");
  assert.equal(r.rateLimit, TIERS.guest.rateLimit);
  assert.equal(r.via, "billing-disabled");
  assert.equal(resolveEntitlement({ env: { IDEARADAR_BILLING_ENABLED: "0" } }).enabled, false);
  assert.equal(resolveEntitlement({ env: { IDEARADAR_BILLING_ENABLED: "true" } }).enabled, false, "只有字符串 1 才开启");
});

test("开启后：合法 API token 提升为 pro 且不限次", () => {
  const r = resolveEntitlement({
    env: { IDEARADAR_BILLING_ENABLED: "1" },
    apiToken: "tk_live_abc",
    serverTokens: ["tk_live_abc", "tk_live_def"],
  });
  assert.equal(r.tier, "pro");
  assert.equal(r.unlimited, true);
  assert.equal(r.via, "api-token");
});

test("开启后：伪造 token 不提升额度", () => {
  const r = resolveEntitlement({
    env: { IDEARADAR_BILLING_ENABLED: "1" },
    apiToken: "forged",
    serverTokens: ["tk_live_abc"],
  });
  assert.equal(r.tier, "guest");
  assert.equal(r.via, "anonymous");
});

test("开启后：登录会话按 plan 分档，pro/team/active 不限次", () => {
  const on = { IDEARADAR_BILLING_ENABLED: "1" };
  assert.equal(resolveEntitlement({ env: on, session: { userId: "u", plan: "pro" } }).tier, "pro");
  assert.equal(resolveEntitlement({ env: on, session: { userId: "u", plan: "team" } }).tier, "pro");
  assert.equal(resolveEntitlement({ env: on, session: { userId: "u", plan: "active" } }).tier, "pro");
  const free = resolveEntitlement({ env: on, session: { userId: "u", plan: "free" } });
  assert.equal(free.tier, "member");
  assert.equal(free.rateLimit, TIERS.member.rateLimit);
  assert.equal(free.unlimited, false);
});

test("开启后：API token 优先于普通登录会话", () => {
  const r = resolveEntitlement({
    env: { IDEARADAR_BILLING_ENABLED: "1" },
    apiToken: "tk",
    session: { userId: "u", plan: "free" },
    serverTokens: ["tk"],
  });
  assert.equal(r.via, "api-token");
  assert.equal(r.tier, "pro");
});

test("开启后匿名访问仍是 guest，不白送额度", () => {
  const r = resolveEntitlement({ env: { IDEARADAR_BILLING_ENABLED: "1" } });
  assert.equal(r.tier, "guest");
  assert.equal(r.via, "anonymous");
});

test("serverTokensFromEnv 逗号分隔、去空白、过滤空项", () => {
  assert.deepEqual(serverTokensFromEnv({ IDEARADAR_API_TOKENS: " a , b ,,c " }), ["a", "b", "c"]);
  assert.deepEqual(serverTokensFromEnv({}), []);
});
