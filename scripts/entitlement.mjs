/**
 * P2 商业化骨架：凭证驱动的权益判定（默认关闭）。
 *
 * 设计约束（与方案「触发条件未满足前不加收费墙」一致）：
 * 1. 默认关闭：IDEARADAR_BILLING_ENABLED 未显式设为 "1" 时，一律返回 guest，
 *    行为与现在完全一致（3 次试用 + 服务端 IP 限流），不引入任何付费墙。
 * 2. 凭证驱动：开启后，仅凭「服务端配置的 API token」或「已登录会话」提升额度，
 *    不解析支付页、不改动 Creem/prisma 链路（那条链路模板已自带，见 README）。
 * 3. 纯函数：resolveEntitlement 不碰网络/数据库，可离线单测；会话读取交给调用方。
 *
 * 触发条件（写在这里，避免误开）：只有当 3 次试用的用完率与回访率证明需求后，
 * 才把 IDEARADAR_BILLING_ENABLED=1 并配置 token。在此之前不启用。
 */

/** 各档权益。rateLimit 是 10 分钟窗口内的最大请求数（/api/scan 的限流单位）。 */
export const TIERS = Object.freeze({
  guest: { tier: "guest", rateLimit: 20, unlimited: false, label: "guest" },
  member: { tier: "member", rateLimit: 40, unlimited: false, label: "member" },
  pro: { tier: "pro", rateLimit: 120, unlimited: true, label: "pro" },
});

/**
 * @param {object} p
 * @param {object} p.env 环境变量（可注入）
 * @param {string|null} p.apiToken 请求携带的 Bearer token（调用方已解析好）
 * @param {object|null} p.session 已登录会话（{ userId } 或 null）
 * @param {string[]} p.serverTokens 服务端配置的合法 token 列表
 * @returns {{enabled:boolean, tier:string, rateLimit:number, unlimited:boolean, label:string, via:string}}
 */
export function resolveEntitlement({
  env = process.env,
  apiToken = null,
  session = null,
  serverTokens = [],
} = {}) {
  const enabled = String(env.IDEARADAR_BILLING_ENABLED ?? "") === "1";
  if (!enabled) return { ...TIERS.guest, enabled: false, via: "billing-disabled" };

  const tokens = (Array.isArray(serverTokens) ? serverTokens : [])
    .map((t) => String(t).trim()).filter(Boolean);
  // 凭证 1：显式配置的 API token（团队 / API 接入场景，优先于会话）
  if (apiToken && tokens.includes(String(apiToken).trim())) {
    return { ...TIERS.pro, enabled: true, via: "api-token" };
  }
  // 凭证 2：已登录会话。是否升级为 pro 由调用方传入的 session.plan 决定
  // （调用方从 Subscription 表读取；本纯函数不碰数据库）。
  const userId = session?.userId || session?.user?.id || null;
  if (userId) {
    const plan = String(session?.plan || "").toLowerCase();
    if (plan === "pro" || plan === "team" || plan === "active") {
      return { ...TIERS.pro, enabled: true, via: "session-pro" };
    }
    return { ...TIERS.member, enabled: true, via: "session" };
  }
  // 开启计费但未带任何凭证：仍是游客，不白送额度。
  return { ...TIERS.guest, enabled: true, via: "anonymous" };
}

/** 从环境变量解析 token 白名单（逗号分隔），供 route 使用。 */
export function serverTokensFromEnv(env = process.env) {
  return String(env.IDEARADAR_API_TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
