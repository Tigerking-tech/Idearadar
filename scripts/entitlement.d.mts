/** entitlement.mjs 的类型声明，供 TypeScript 服务端路由引用。 */
export interface Entitlement {
  enabled: boolean;
  tier: "guest" | "member" | "pro";
  rateLimit: number;
  unlimited: boolean;
  label: string;
  via: string;
}
export interface EntitlementInput {
  env?: Record<string, string | undefined>;
  apiToken?: string | null;
  session?: { userId?: string; user?: { id?: string }; plan?: string } | null;
  serverTokens?: string[];
}

export const TIERS: Readonly<Record<"guest" | "member" | "pro", {
  tier: string; rateLimit: number; unlimited: boolean; label: string;
}>>;

export function resolveEntitlement(input?: EntitlementInput): Entitlement;
export function serverTokensFromEnv(env?: Record<string, string | undefined>): string[];
