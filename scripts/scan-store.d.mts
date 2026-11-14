/** scan-store.mjs 的类型声明，供 TypeScript 服务端路由引用。 */
export const QUERIES: "query-scans";
export const CANDIDATES: "scan-candidates";

export interface QueryRecord {
  q: string;
  at: string;
  hits: number;
  locale: string;
  mode: string;
}
export interface QueryDoc {
  version: number;
  queries: QueryRecord[];
  updatedAt: string | null;
  [key: string]: unknown;
}
export interface CandidateItem {
  id: string;
  title: string;
  titleOriginal: string;
  quote: string;
  quoteOriginal: string;
  score: number;
  sources: string[];
}
export interface CandidateDirection {
  q: string;
  at: string;
  locale: string;
  mode: string;
  terms: string[];
  items: CandidateItem[];
}
export interface CandidateDoc {
  version: number;
  directions: CandidateDirection[];
  updatedAt: string | null;
  [key: string]: unknown;
}
export interface StoreOpts {
  root?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export function emptyQueries(): QueryDoc;
export function emptyCandidates(): CandidateDoc;
export function storeConfig(env?: Record<string, unknown>): { url: string; token: string; remote: boolean };
export function loadDoc(kind: string, opts?: StoreOpts): Promise<QueryDoc | CandidateDoc>;
export function saveDoc(kind: string, data: object, opts?: StoreOpts): Promise<boolean>;
export function appendQuery(
  query: string,
  meta?: { hits?: number; locale?: string; mode?: string },
  opts?: StoreOpts,
): Promise<boolean>;
export function putCandidates(
  query: string,
  items?: object[],
  meta?: { locale?: string; mode?: string; terms?: string[] },
  opts?: StoreOpts,
): Promise<boolean>;
