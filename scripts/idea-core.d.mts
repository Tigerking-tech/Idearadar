/** 一句话机会的数据结构（与 lib/signals.ts 的 Idea 对齐）。 */
export interface IdeaData {
  version: number;
  origin: "llm" | "template";
  persona: string;
  headline: { zh: string; en: string };
  who: { zh: string; en: string };
  why: { zh: string; en: string };
  step: { zh: string; en: string };
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
export const NICHE_PERSONA: Readonly<Record<string, string>>;
export const PERSONAS: readonly string[];
export const PERSONA_LABEL: Readonly<Record<string, { zh: string; en: string }>>;
export const IDEA_SYSTEM_PROMPT: string;
export const IDEA_USER_PREFIX: string;

export function personaOf(item?: IdeaRecord): string;
export function templateIdea(item?: IdeaRecord): IdeaData;
export function ideaKey(item?: IdeaRecord): string;
export function ideaInput(item?: IdeaRecord, k?: string): {
  k: string; title: string; titleZh: string; quote: string; niche: string; signals: string[];
};
export function normalizeIdea(raw: unknown, item?: IdeaRecord): IdeaData;
