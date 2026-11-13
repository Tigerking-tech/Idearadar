/** live-scan.mjs 的类型声明，供 TypeScript 服务端路由与客户端引用。 */
export type LiveScanMode = "llm" | "rules" | "no-evidence" | "vague";

export interface LiveScanEnv {
  token?: string;
  endpoint?: string;
  model?: string;
}

export interface LiveScanResult {
  items: unknown[];
  mode: LiveScanMode;
  sources: string[];
  terms: string[];
  errors: { source?: string; query?: string; message: string }[];
}

export const SOURCE_LABELS: Record<string, string>;

export function normalizeQuery(raw: unknown): string;
export function queryTokens(q: string): string[];
export function isVagueQuery(q: string): boolean;
export function hintTerms(q: string): string[];
export function expandQuery(q: string, env?: LiveScanEnv, fetchImpl?: typeof fetch): Promise<string[]>;
export function scoreRows(rows: unknown[], terms: string[] | string): Record<string, unknown>[];
export function summarizeWithLlm(
  scored: Record<string, unknown>[],
  q: string,
  locale: string,
  env?: LiveScanEnv,
  fetchImpl?: typeof fetch,
): Promise<Record<string, unknown>[] | null>;
export function buildSignals(
  scored: Record<string, unknown>[],
  q: string,
  locale: string,
  llmItems?: Record<string, unknown>[] | null,
): unknown[];
export function collectRows(
  terms: string[],
  opts?: { root?: string; errors?: unknown[]; fetchImpl?: typeof fetch },
): Promise<Record<string, unknown>[]>;
export function runLiveScan(opts: {
  query: string;
  locale?: string;
  root?: string;
  env?: LiveScanEnv;
  fetchImpl?: typeof fetch;
  collect?: (terms: string[], opts?: unknown) => Promise<Record<string, unknown>[]>;
}): Promise<LiveScanResult>;
export function recordQuery(
  query: string,
  meta?: { hits?: number; locale?: string; mode?: string },
  root?: string,
): Promise<boolean>;
