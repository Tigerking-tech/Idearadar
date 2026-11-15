/** 机会简报 / 一句话机会的数据结构（与 lib/signals.ts 的 Idea / Brief 对齐）。 */
export interface Localized {
  zh: string;
  en: string;
}

export interface BriefData {
  jobStory: Localized;
  pain: Localized;
  workaround: Localized;
  rootObstacle: Localized;
  build: Localized;
  test: Localized;
  stopIf: Localized;
  whyNow: Localized;
}

export interface IdeaData {
  version: number;
  origin: "llm" | "template";
  persona: string;
  /** v3 结构化机会简报；模板/旧格式降级为 null。 */
  brief: BriefData | null;
  headline: Localized;
  who: Localized;
  why: Localized;
  step: Localized;
}

export interface IdeaRecord {
  id?: string;
  nicheId?: string;
  nicheLabel?: string;
  title?: string;
  titleZh?: string;
  signals?: string[];
  evidence?: { excerpt?: string }[];
  [key: string]: unknown;
}

export const IDEA_VERSION: number;
export const BRIEF_FIELDS: readonly string[];
export const NICHE_PERSONA: Readonly<Record<string, string>>;
export const PERSONAS: readonly string[];
export const PERSONA_LABEL: Readonly<Record<string, Localized>>;
export const IDEA_SYSTEM_PROMPT: string;
export const IDEA_USER_PREFIX: string;

export function personaOf(item?: IdeaRecord): string;
export function templateIdea(item?: IdeaRecord): IdeaData;
export function ideaKey(item?: IdeaRecord): string;
export function ideaInput(item?: IdeaRecord, k?: string): {
  k: string; title: string; titleZh: string; quote: string; niche: string; signals: string[];
};
export function normalizeBrief(raw: unknown): BriefData | null;
/** 清理模型照抄 JTBD 模板留下的 <具体用户> 等占位符，确定性、不依赖重跑 LLM。 */
export function cleanBriefText(s: unknown): string;
export function normalizeIdea(raw: unknown, item?: IdeaRecord): IdeaData;
