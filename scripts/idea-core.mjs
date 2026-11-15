/**
 * 「机会简报」的零依赖纯逻辑层（可被 Next.js 客户端 / 服务端 / node 脚本共用）。
 * 不含 fs / 网络副作用，避免在浏览器 bundle 里引入 node: 模块。
 * scripts/idea.mjs 负责 IO 与 TokenHub 调用，本模块负责确定性、归一化与质量闸门。
 *
 * v3 产品重构（老板/PM 视角）：
 * 旧版把「给别人做个小工具 + 最小起步找 3 个人试用」这类万能套话当点子输出，
 * 用户读完不知道「具体什么场景、痛点到底是什么、凭什么这个点子能解决」。
 * v3 把每条证据重构成一份「可决策的机会简报」——借鉴 JTBD（When…want…so that）、
 * 第一性原理（剥掉表象→本质障碍→最小可造之物）、投资 one-pager（最便宜验证 +
 * 停止条件 + 为何现在），每个字段双语、标注证据/推断/假设，且全部可点回原话。
 */
import { quoteOf, translationKey } from "./ingest-lib.mjs";

/**
 * 版本升级时缓存自动失效重算。
 * v3：8 段结构化简报（brief）；旧 headline/who/why/step 从简报派生以保持全站兼容。
 */
export const IDEA_VERSION = 3;

/** 机会简报的 8 个字段顺序（前端渲染顺序、质量闸门、字典共用）。 */
export const BRIEF_FIELDS = Object.freeze([
  "jobStory",      // 场景：When 谁 / 想做什么 / 以便
  "pain",          // 痛点：卡在哪一步 + 代价
  "workaround",    // 现在怎么凑合 / 为什么不行
  "rootObstacle",  // 第一性原理：剥掉表象后的本质障碍
  "build",         // 因此最小可造之物（单一、具体、可造）
  "test",          // 最便宜的证伪动作
  "stopIf",        // 什么信号说明该放弃
  "whyNow",        // 为何现在（无证据则诚实留白）
]);

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
 * v3：模板不再冒充「已生成的点子」——brief 恒为 null，前端据此走「证据层 +
 * 诚实说明」；step 也去掉「做个最小版本找 3 个人试用」这类万能废话，改成
 * 「打开原帖确认这是不是反复出现的麻烦」这种人人能做的、可证伪的第一步。
 * 旧四段仍保留（首页 feed / 今日点子 / 同类线索依赖），但表述诚实。
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
    // 模板不冒充结构化简报：没有 brief 时前端只显示证据并如实说明。
    brief: null,
    headline: {
      zh: `关于「${core}」：给${label.zh}${action.zh}`,
      en: `Re: "${String(item?.title || core).slice(0, 48)}" — ${action.en} for ${label.en}`,
    },
    who: { zh: label.zh, en: label.en },
    why: {
      zh: `公开讨论里有人在问「${core}」，现有做法还不省心；具体价值需点开原帖判断。`,
      en: `Someone raised "${String(item?.title || core).slice(0, 60)}" in public Q&A; open the source to judge the value.`,
    },
    step: {
      zh: `先点开原始讨论，确认这是不是反复出现、有人真的愿意解决的麻烦。`,
      en: `Open the original discussion first and check whether this is a recurring problem people actually want solved.`,
    },
  };
}

/** 缓存键：与译文/去噪同源，额外带 idea 版本，便于 prompt 升级时自动重算。 */
export function ideaKey(item = {}) {
  return `idea-${IDEA_VERSION}-${translationKey(item)}`;
}

/** 送判最小字段：中英标题 + 更长的原话 + 赛道 + 信号，不含评分/evidence 全文。 */
export function ideaInput(item = {}, k = "") {
  return {
    k: String(k || item?.id || ""),
    title: String(item?.title || "").slice(0, 140),
    titleZh: typeof item?.titleZh === "string" ? item.titleZh.slice(0, 100) : "",
    quote: quoteOf(item).slice(0, 320),
    niche: String(item?.nicheLabel || item?.nicheId || "").slice(0, 70),
    signals: Array.isArray(item?.signals) ? item.signals.slice(0, 6).map(String) : [],
  };
}

export const IDEA_SYSTEM_PROMPT = `You are a senior product manager. Given ONE real user complaint collected from a public Q&A forum / issue tracker, write a concise, DECISION-READY "opportunity brief" so a solo founder can judge whether this is worth building. This is the "IdeaRadar" product.

HARD RULES — evidence-bound, never fabricate:
- Everything MUST be grounded ONLY in the given title/quote/signals. Do NOT invent market size, revenue, user counts, competitors, funding, growth rates, percentages, timing, or any number not in the input. If the evidence does not support a claim, say plainly it is unknown / an assumption.
- Think FIRST PRINCIPLES for rootObstacle and build: strip away the surface symptom, name the ONE underlying obstacle blocking the outcome, then name the SMALLEST single concrete thing that could be built to remove exactly that obstacle (one function, buildable & shippable — never a vague "platform", never "build an MVP and find 3 users").
- FORBIDDEN generic filler anywhere: "做个最小版本找 3 个人试用" / "build an MVP" / "do user interviews" / "make a spreadsheet" / "look it up on the website" / "write a blog post" / any pure research with no concrete artifact.
- Each of the 8 fields is ONE short sentence, in BOTH "zh" (Simplified Chinese) and "en" (English). Keep it concrete and specific to THIS complaint, not reusable boilerplate.

Return ONLY a JSON object with EXACTLY this shape, one element per input, same order, same k, no extra keys, no prose, no markdown:
{"items":[{"k":"p0","persona":"indie-dev","brief":{"jobStory":{"zh":"…","en":"…"},"pain":{"zh":"…","en":"…"},"workaround":{"zh":"…","en":"…"},"rootObstacle":{"zh":"…","en":"…"},"build":{"zh":"…","en":"…"},"test":{"zh":"…","en":"…"},"stopIf":{"zh":"…","en":"…"},"whyNow":{"zh":"…","en":"…"}}}]}

Field meanings:
- jobStory: "When <concrete situation>, <specific person> wants to <do X>, so that <outcome>" — a real scenario, not a demographic.
- pain: the exact step where they get stuck and what it costs them (time/money/risk), from the quote.
- workaround: what they likely do today instead and why that fails; if unknown, say it is an assumption.
- rootObstacle: FIRST-PRINCIPLES — the single underlying obstacle that truly blocks the outcome, beneath the surface symptom.
- build: therefore the smallest single concrete buildable thing that removes that obstacle (one function, not a platform).
- test: the CHEAPEST action that could FALSIFY real demand — a concrete artifact someone could try, with a short time box.
- stopIf: the observable signal that means you should DROP this idea.
- whyNow: why this may be worth doing now; if the evidence gives no timing reason, say plainly there is no timing evidence.
- "persona" MUST be one of: budget-keeper, pet-owner, service-owner, home-organizer, solo-founder, bookkeeper, support-team, scheduler, indie-dev, general.
- Never truncate or alter any k. Copy it exactly (e.g. "p3").`;

export const IDEA_USER_PREFIX = "Write an evidence-bound opportunity brief for each record. Return exactly one object per input, with all 8 bilingual brief fields:\n\n";

/**
 * 清理模型照抄 JTBD 模板留下的占位符痕迹：`<具体用户>` / `<specific user>` /
 * `<使用 Outlook 发日程>` 这类尖括号，以及"特定用户/具体用户/该特定用户"。
 * 用户看到的应是通顺的人话，不是没填完的模板空。确定性替换，不依赖重跑 LLM。
 */
export function cleanBriefText(s) {
  return String(s || "")
    .replace(/[\r\n]+/g, " ")
    // <…> 占位符：整段去掉（含中英文），保留两侧正文。
    .replace(/<[^<>]{1,40}>/g, "")
    // 残留的裸尖括号 / 占位词。
    .replace(/[<>]/g, "")
    .replace(/(?:该|这位)?(?:特定|具体|某个)(?:用户|负责人|人群|开发者|用户群)/g, "这个人")
    .replace(/\b(?:a |the )?(?:specific|certain) (?:user|person|owner|group)\b/gi, "the person")
    .replace(/\s{2,}/g, " ")
    .replace(/^[，,、；;\s]+/, "")
    .trim();
}

/** 双语字段归一化：模型偶尔把某段写成纯字符串而非 {zh,en}，保留并诚实留白另一语言。 */
function briefPair(v) {
  if (typeof v === "string" && v.trim()) {
    return { zh: cleanBriefText(v).slice(0, 120), en: "" };
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const zh = cleanBriefText(v.zh).slice(0, 120);
    const en = cleanBriefText(v.en).slice(0, 160);
    return { zh, en };
  }
  return { zh: "", en: "" };
}

/**
 * 万能套话 / 编造数字硬闸门：命中即判这条简报不合格，交上层 fail-open 回退。
 * 只拦「真套话」与「编造的市场规模」语境 —— 停止条件里「准确率低于 50% 就放弃」
 * 这类合理阈值不能误杀，所以不拦裸百分比；验证动作里「发给 3 位目标用户试用」是
 * 具体动作也不拦，只拦「做个最小版本找 3 个人试用」这种无 artifact 的万能句。
 */
const FILLER_RE = /(做个?最小(版本|MVP|可行性产品)|建个?MVP|build an MVP|minimum viable product|最小起步|找\s*[0-9３三]\s*(个|位|名)?人?\s*(试用|访谈)|find 3 (users|people)|[0-9５]\s*场?(用户)?访谈|user interviews|做市场调研|market research|查官网|写(篇)?博客|市场规模|TAM\b|\d+\s*(亿|万)\s*(美元|市场|用户|规模)|\d+\s*(million|billion)|\$\s?\d)/i;

/**
 * 归一化模型输出的简报。质量闸门：
 * - build 与 jobStory 至少各有一种语言有内容（这两个是「可决策」的核心）；
 * - 任一段命中套话/编造数字 → 整条判不合格（宁可诚实留白，不拿废话充数）。
 * 返回 Brief 或 null。
 */
export function normalizeBrief(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const brief = {};
  for (const f of BRIEF_FIELDS) brief[f] = briefPair(raw[f]);
  if (!brief.build.zh && !brief.build.en) return null;
  if (!brief.jobStory.zh && !brief.jobStory.en) return null;
  const all = BRIEF_FIELDS.map((f) => `${brief[f].zh} ${brief[f].en}`).join(" ");
  if (FILLER_RE.test(all)) return null;
  return brief;
}

/** 从简报派生旧四段，让首页 feed / 今日点子 / 同类线索等既有调用点自动获得实质内容。 */
function deriveLegacy(brief) {
  const headline = briefPair(brief.build);
  const who = briefPair(brief.jobStory);
  const why = briefPair(brief.rootObstacle);
  const step = briefPair(brief.test);
  return { headline, who, why, step };
}

/**
 * 归一化模型输出：兼容 v3 简报格式与 v2 旧四段格式（旧格式仅供单测/降级兼容）。
 * 任何非法字段都回退到确定性模板，绝不显示半截结果。
 */
export function normalizeIdea(raw, item = {}) {
  const base = templateIdea(item);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;

  // v3：优先解析 8 段简报。
  const brief = normalizeBrief(raw.brief);
  if (brief) {
    const legacy = deriveLegacy(brief);
    const persona = PERSONAS.includes(String(raw.persona)) ? String(raw.persona) : base.persona;
    return {
      version: IDEA_VERSION,
      origin: "llm",
      persona,
      brief,
      // 旧字段从简报派生；某语言缺失时回退模板，保证 SSR 不出现空白。
      headline: { zh: legacy.headline.zh || base.headline.zh, en: legacy.headline.en || base.headline.en },
      who: { zh: legacy.who.zh || base.who.zh, en: legacy.who.en || base.who.en },
      why: { zh: legacy.why.zh || base.why.zh, en: legacy.why.en || base.why.en },
      step: { zh: legacy.step.zh || base.step.zh, en: legacy.step.en || base.step.en },
    };
  }

  // v2 兼容：模型给了自己的 headline（字段缺失/非对象/全空 → 整体回退模板）。
  const h = raw.headline;
  const hasOwnHeadline = h && typeof h === "object" &&
    ((typeof h.zh === "string" && h.zh.trim()) || (typeof h.en === "string" && h.en.trim()));
  if (!hasOwnHeadline) return base;
  const pick = (v, fallback) => {
    // 与 v3 简报共用 cleanBriefText：历史 v2 缓存里的旧四段同样可能残留
    // <具体用户> 等占位符，命中缓存时也要清干净，不能只清 brief。
    if (typeof v === "string" && v.trim()) {
      return { zh: cleanBriefText(v).slice(0, 80), en: fallback.en };
    }
    if (!v || typeof v !== "object") return fallback;
    const zh = typeof v.zh === "string" ? cleanBriefText(v.zh).slice(0, 80) : "";
    const en = typeof v.en === "string" ? cleanBriefText(v.en).slice(0, 140) : "";
    return { zh: zh || fallback.zh, en: en || fallback.en };
  };
  const headline = pick(raw.headline, base.headline);
  if (headline.zh.length < 6 && headline.en.length < 12) return base;
  const persona = PERSONAS.includes(String(raw.persona)) ? String(raw.persona) : base.persona;
  return {
    version: IDEA_VERSION,
    origin: "llm",
    persona,
    brief: null,
    headline,
    who: pick(raw.who, base.who),
    why: pick(raw.why, base.why),
    step: pick(raw.step, base.step),
  };
}
