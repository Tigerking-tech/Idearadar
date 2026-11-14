/**
 * 结构化机会卡（Opportunity Card）—— 确定性纯函数层。
 *
 * 设计原则（与项目「诚实、不编造」一致）：
 * 1. 只从已采集的结构化证据推导，绝不生成「市场规模 / 竞品格局」这类无证据的结论。
 * 2. 竞品维度固定为 null（未评估），UI 明确标注，不用 0 分伪造「已分析」。
 * 3. 语言无关：产出的是枚举 code + 数值维度，文案由 lib/i18n.ts 本地化，
 *    中英页共用同一份数据，不会出现「中文页有卡、英文页没卡」。
 * 4. LLM 只做可选的一句话洞察（insight），且失败/缺密钥时整卡仍完整可用。
 *
 * 可被 node --test 与 Next.js 服务端/客户端共同引用。
 */
import { translationKey } from "./ingest-lib.mjs";

export const CARD_VERSION = 1;

/** 赛道 → 目标用户枚举。未知赛道一律 unknown，不猜测。 */
const AUDIENCE_BY_NICHE = Object.freeze({
  "solo-crm": "solo",
  "invoice-export": "ops",
  "support-transcripts": "support",
  scheduling: "ops",
});

const KNOWN_AUDIENCES = new Set(["solo", "team", "enterprise", "developer", "ops", "support", "unknown"]);
const KNOWN_VALIDATIONS = new Set(["interview", "prototype", "landing", "data-pull", "manual-audit"]);

function dim(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

/** 缓存键：与译文同口径（原文哈希），额外带卡片版本，便于将来升级规则时自动重算。 */
export function cardKey(item = {}) {
  return `${translationKey(item)}:v${CARD_VERSION}`;
}

/**
 * 从一条机会信号（或按需扫描的 Signal）生成机会卡。
 * @param {object} item 含 score/mentions/sources/signals/breakdown/willingnessToPay/lastSeen/nicheId
 * @param {Date} now 注入时间，保证可复现
 */
export function buildCard(item = {}, now = new Date()) {
  const bd = item?.breakdown && typeof item.breakdown === "object" ? item.breakdown : {};
  const mentions = Number(item?.mentions) || 0;
  const sources = Array.isArray(item?.sources) ? item.sources.length : 0;
  const signals = Array.isArray(item?.signals) ? item.signals : [];
  const has = (s) => signals.includes(s);

  // 五个「有证据」的维度，规则全部显式列出，可单测。
  const demand = dim((Number(bd.frequency) || 0) / 3 + (Number(bd.intensity) || 0) / 2);
  const urgency = dim(
    (has("broken") ? 3 : 0) + (has("churn") ? 3 : 0) + (has("pain") ? 2 : 0) +
    (has("frustration") ? 2 : 0) + (Number(bd.recency) || 0) / 5,
  );
  const feasibility = dim(2 + (has("manual") ? 4 : 0) + (has("integration") ? 3 : 0) + (has("wish") ? 3 : 0));
  const monetization = dim(
    (item?.willingnessToPay ? 5 : 0) + (Number(bd.willingnessToPay) || 0) / 5 + (has("pricing") ? 2 : 0),
  );
  const confidence = dim(sources * 2 + Math.min(4, mentions / 2) + (Number(bd.corroboration) || 0) / 5);

  // 八维评分：前 5 维有可核查的采集证据（规则推导），后 3 维本项目没有任何
  // 采集证据，一律 null 并在 UI 明确标注「未评估」——绝不用 0 分伪造「已分析」。
  const dimensions = {
    demand, urgency, feasibility, monetization, confidence,
    competition: null,
    marketSize: null,
    retention: null,
  };
  const values = [demand, urgency, feasibility, monetization, confidence];
  const total = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10);

  // 风险标记：全部是可核查的事实判断，不是主观预测。
  const riskFlags = [];
  if (sources < 2) riskFlags.push("single-source");
  if (mentions < 3) riskFlags.push("thin-evidence");
  if (!item?.willingnessToPay) riskFlags.push("no-wtp");
  riskFlags.push("unverified-competition");
  const ts = Date.parse(item?.lastSeen || "");
  if (Number.isFinite(ts) && (now.getTime() - ts) / 86_400_000 > 21) riskFlags.push("stale");

  return {
    version: CARD_VERSION,
    dimensions,
    evaluatedDimensions: values.length,
    totalDimensions: Object.keys(dimensions).length,
    total,
    audience: AUDIENCE_BY_NICHE[String(item?.nicheId || "")] || "unknown",
    validation: sources < 2 ? "interview" : mentions >= 5 ? "landing" : has("broken") ? "prototype" : "manual-audit",
    riskFlags,
  };
}

/** 卡片是否需要（重新）生成：缺失、版本过期、或原文变了。 */
export function needsCard(item = {}) {
  if (!item?.opportunityCard || item.opportunityCard.version !== CARD_VERSION) return true;
  return item.cardKey !== cardKey(item);
}

/** 把 LLM 补充的洞察合并进卡片；非法值一律忽略，不破坏确定性骨架。 */
export function mergeInsight(card, insight) {
  if (!card || typeof card !== "object") return card;
  const zh = typeof insight?.zh === "string" ? insight.zh.trim().slice(0, 160) : "";
  const en = typeof insight?.en === "string" ? insight.en.trim().slice(0, 240) : "";
  if (!zh && !en) return card;
  return { ...card, insight: { ...(zh ? { zh } : {}), ...(en ? { en } : {}) } };
}

/** 给一批 items 附加机会卡；已是最新卡片的条目原样返回。 */
export function attachCards(items = [], now = new Date()) {
  return (Array.isArray(items) ? items : []).map((it) => {
    if (!needsCard(it)) return it;
    const base = it.opportunityCard?.version === CARD_VERSION ? it.opportunityCard : buildCard(it, now);
    return { ...it, opportunityCard: base, cardKey: cardKey(it) };
  });
}

export const CARD_CODES = Object.freeze({
  audiences: KNOWN_AUDIENCES,
  validations: KNOWN_VALIDATIONS,
});
