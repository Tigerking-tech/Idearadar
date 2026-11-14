/**
 * 「一句话机会」的零依赖纯逻辑层（可被 Next.js 客户端 / 服务端 / node 脚本共用）。
 * 不含 fs / 网络副作用文件读写，避免在浏览器 bundle 里引入 node: 模块。
 * scripts/idea.mjs 负责 IO 与 TokenHub 调用，本模块负责确定性与归一化。
 */
import { quoteOf, translationKey } from "./ingest-lib.mjs";

/**
 * 版本升级时缓存自动失效重算。
 * v2：单条批次解析修复（原 15 批只采纳 15 条）、模板话术重写、字符串字段容错。
 */
export const IDEA_VERSION = 2;

/** 赛道 → 人群 / 场景的稳定映射（确定性模板与前端分组共用，语言无关）。 */
export const NICHE_PERSONA = Object.freeze({
  "everyday-money": "budget-keeper",
  "pet-and-home-care": "pet-owner",
  "local-service-booking": "service-owner",
  "personal-admin": "home-organizer",
  "solo-crm": "solo-founder",
  "invoice-export": "bookkeeper",
  "support-transcripts": "support-team",
  scheduling: "scheduler",
  "dev-workflow": "indie-dev",
});
export const PERSONAS = Object.freeze([
  "budget-keeper", "pet-owner", "service-owner", "home-organizer",
  "solo-founder", "bookkeeper", "support-team", "scheduler", "indie-dev", "general",
]);

/** 人群 code → 中英短标签（模板兜底用；正式 UI 文案在 i18n 字典里维护）。 */
export const PERSONA_LABEL = Object.freeze({
  "budget-keeper": { zh: "管账、盯订阅的普通人", en: "people tracking budgets and subscriptions" },
  "pet-owner": { zh: "养宠物、要记照护安排的人", en: "pet owners juggling care schedules" },
  "service-owner": { zh: "要管预约和退改的小商家", en: "small businesses handling bookings" },
  "home-organizer": { zh: "要整理通讯录、照片、文件的人", en: "people organizing contacts, photos and files" },
  "solo-founder": { zh: "一个人干全部活的独立创业者", en: "solo founders doing everything themselves" },
  bookkeeper: { zh: "代账会计和管报销的财务", en: "bookkeepers and finance staff" },
  "support-team": { zh: "客服团队", en: "support teams" },
  scheduler: { zh: "天天排期、约时间的人", en: "people scheduling appointments" },
  "indie-dev": { zh: "独立开发者", en: "indie developers" },
  general: { zh: "有这类麻烦的人", en: "people running into this" },
});

export function personaOf(item = {}) {
  const code = NICHE_PERSONA[String(item?.nicheId || "")];
  return code && PERSONA_LABEL[code] ? code : "general";
}

/** 从信号枚举提取一个「动作」短语，让模板不是纯套话。 */
function actionOf(item = {}) {
  const signals = Array.isArray(item?.signals) ? item.signals : [];
  if (signals.some((s) => ["manual", "seeking", "question"].includes(s))) {
    return { zh: "把这件反复手动折腾的事一步做完", en: "turn this repeated manual chore into one step" };
  }
  if (signals.some((s) => ["missing", "wish", "feature_request"].includes(s))) {
    return { zh: "补上现在缺的这个功能", en: "add the capability that is missing today" };
  }
  if (signals.some((s) => ["broken", "data_loss", "churn"].includes(s))) {
    return { zh: "把这个老出错的环节做稳", en: "make this failing step reliable" };
  }
  return { zh: "把这个麻烦解决掉", en: "remove this friction" };
}

/**
 * 确定性模板（fail-open 兜底，零网络、零编造）。
 * 只用标题/译文与信号枚举拼一句「给谁 + 做什么」，并诚实留一句证据边界。
 */
export function templateIdea(item = {}) {
  const persona = personaOf(item);
  const label = PERSONA_LABEL[persona];
  const action = actionOf(item);
  const title = String(item?.titleZh || item?.title || "").trim().slice(0, 60);
  const core = title || label.zh;
  return {
    version: IDEA_VERSION,
    origin: "template",
    persona,
    // 模板只在 LLM 失败/关闭时兜底，不把原始问句硬塞进标题（"做一个「某问句」
    // 相关的小工具"既空洞又容易把无关问答包装成机会）。改为「给谁 + 做什么」，
    // 具体标题留给正文证据区，诚实且可读。
    // 保留具体标题 core：实时检索结果每条不同，避免 5 张卡全是一句套话；
    // 用「关于 X」而非「做一个 X 相关的小工具」，不把无关问答硬包装成机会。
    headline: {
      zh: `关于「${core}」：给${label.zh}做个小工具，${action.zh}`,
      en: `A small tool for ${label.en} to ${action.en} (re: ${String(item?.title || core).slice(0, 48)})`,
    },
    who: { zh: label.zh, en: label.en },
    why: {
      zh: `公开讨论里有人在问「${core}」，说明现有做法还不够省心。`,
      en: `Someone asked about "${String(item?.title || core).slice(0, 60)}" in public Q&A — the current way is not smooth enough.`,
    },
    step: {
      zh: `先做一个只解决这一件事的最小版本，找 3 个${label.zh}试用。`,
      en: `Build a minimal version that solves only this one thing, then try it with 3 ${label.en}.`,
    },
  };
}

/** 缓存键：与译文/去噪同源，额外带 idea 版本，便于 prompt 升级时自动重算。 */
export function ideaKey(item = {}) {
  return `idea-${IDEA_VERSION}-${translationKey(item)}`;
}

/** 送判最小字段：中英标题 + 原话 + 赛道 + 信号，不含评分/evidence 全文。 */
export function ideaInput(item = {}, k = "") {
  return {
    k: String(k || item?.id || ""),
    title: String(item?.title || "").slice(0, 140),
    titleZh: typeof item?.titleZh === "string" ? item.titleZh.slice(0, 100) : "",
    quote: quoteOf(item).slice(0, 180),
    niche: String(item?.nicheLabel || item?.nicheId || "").slice(0, 70),
    signals: Array.isArray(item?.signals) ? item.signals.slice(0, 6).map(String) : [],
  };
}

export const IDEA_SYSTEM_PROMPT = `You turn ONE real user problem collected from public Q&A / forums into ONE concrete, actionable business opportunity for a solo founder. This is the "IdeaRadar" product.

You receive records with a short key k, an English title, a Chinese title, a short verbatim quote, the topic niche and signal labels.

HARD RULES — evidence-bound, never fabricate:
- Everything you write MUST be grounded in the given title/quote/signals. It is a REWRITE into "for whom + do what" form, NOT new market research.
- FORBIDDEN: market size, revenue, user counts, competitor names, funding, growth rates, percentages, predictions, or any number not present in the input. If you cannot support a claim from the input, do not say it.
- "headline" is ONE short sentence in the form "给「具体人群」做一个「具体、单一功能」的小工具" (zh) / "A small tool for <specific people> to <one concrete job>" (en). It MUST describe a BUILDABLE software product / small tool that someone could actually make and sell or ship — a concrete single function, not a vague platform, and NOT just "look something up" or "read the docs".
- "who" names the person who has this problem (1 short noun phrase). "why" states the concrete friction visible in the quote (1 short sentence).
- "step" is the CHEAPEST FIRST MOVE to VALIDATE THE PRODUCT IDEA — a concrete micro-action that tests whether people want the tool: e.g. "做一个只解决X的单页工具，找3个人试用", "先做一个手动代跑版本接3单", "做一个能上传文件就出结果的原型". FORBIDDEN as step: "查官网/查规则" (look up a website), "写篇博客/教程" (write a blog post), "用Excel做个模板" (make a spreadsheet template), "做市场调研", "5场用户访谈" (generic interviews), or any pure research/lookup with no product artifact. The step must produce something a potential user could try.
- Keep every field SHORT (<=34 Chinese chars or <=70 English chars), single line, no quotes, no line breaks.
- If the record is too thin to say anything concrete, still return a conservative version of the four fields based on the title; never invent.
- Output ONLY a JSON object {"items":[{"k":"p0","persona":"...","headline":{"zh":"...","en":"..."},"who":{"zh":"...","en":"..."},"why":{"zh":"...","en":"..."},"step":{"zh":"...","en":"..."}}]}, exactly one element per input, same order, same k. No extra keys, no prose, no markdown.
- "persona" MUST be one of: budget-keeper, pet-owner, service-owner, home-organizer, solo-founder, bookkeeper, support-team, scheduler, indie-dev, general.
- Never truncate or alter any k. Copy it exactly (e.g. "p3").`;

export const IDEA_USER_PREFIX = "Rewrite each record into one concrete opportunity. Return exactly one object per input:\n\n";

/** 归一化模型输出：任何非法字段都回退到确定性模板，绝不显示半截结果。 */
export function normalizeIdea(raw, item = {}) {
  const base = templateIdea(item);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  // 模型没给出自己的 headline（字段缺失/非对象/全空）说明这条基本没生成，
  // 整体回退模板，不能靠 pick 用模板补齐后误标成 llm 产出。
  // 用 OR：只给了中文或只给了英文也算有效产出，另一语言由 pick 用模板补齐。
  const h = raw.headline;
  const hasOwnHeadline = h && typeof h === "object" &&
    ((typeof h.zh === "string" && h.zh.trim()) || (typeof h.en === "string" && h.en.trim()));
  if (!hasOwnHeadline) return base;
  const pick = (v, fallback) => {
    // 模型偶发把 step / who 写成一句纯中文字符串（而非 {zh,en}）。保留中文
    // 内容，英文侧诚实回退模板，避免整段模型产出被丢掉、降级成模板套话。
    if (typeof v === "string" && v.trim()) {
      return { zh: v.trim().replace(/[\r\n]+/g, " ").slice(0, 80), en: fallback.en };
    }
    if (!v || typeof v !== "object") return fallback;
    const zh = typeof v.zh === "string" ? v.zh.trim().replace(/[\r\n]+/g, " ").slice(0, 80) : "";
    const en = typeof v.en === "string" ? v.en.trim().replace(/[\r\n]+/g, " ").slice(0, 140) : "";
    return { zh: zh || fallback.zh, en: en || fallback.en };
  };
  const headline = pick(raw.headline, base.headline);
  if (headline.zh.length < 6 && headline.en.length < 12) return base;
  const persona = PERSONAS.includes(String(raw.persona)) ? String(raw.persona) : base.persona;
  return {
    version: IDEA_VERSION,
    origin: "llm",
    persona,
    headline,
    who: pick(raw.who, base.who),
    why: pick(raw.why, base.why),
    step: pick(raw.step, base.step),
  };
}
