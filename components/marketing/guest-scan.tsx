"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EN_DICT, type Dict, type Locale } from "@/lib/i18n";
import {
  searchSignals,
  groupByPersona,
  ideaText,
  type Signal,
  type OpportunityCard,
  type ExternalHeat,
} from "@/lib/signals";

type Suggestion = { label: string; sub: string; query: string[]; persona?: string };

type TrendKey = Signal["trend"];

/** 八维的固定顺序；前 5 维有证据，后 3 维展示为「未评估」。 */
const CARD_DIMS: (keyof OpportunityCard["dimensions"])[] = [
  "demand", "urgency", "feasibility", "monetization", "confidence",
  "competition", "marketSize", "retention",
];

/**
 * 免注册试用（Guest Scan）
 *
 * 产品逻辑：访客不用注册即可跑 3 次扫描；次数用 localStorage 记在本机，
 * 中英两个语言版本共用同一额度（切语言不能刷次数）。第 3 次的结果仍完整保留，
 * 只是不再接受新的扫描，并在结果下方出现注册 / 升级引导。
 *
 * 数据接口：本组件只消费统一的 `Signal[]`（来自 props），不关心数据是演示还是实时。
 * 服务端 `resolveSignals(locale)` 决定喂演示还是实时——这是"接好管线后自动替换"的预留位。
 *
 * 边界（会在交付说明里明说）：localStorage 是客户端计数，清缓存或换设备可重置，
 * 属于演示环境的合理妥协；正式上线应换成服务端匿名 session + IP 限流 + 验签 token。
 */
const STORAGE_KEY = "rr_guest_scans_v1";
const MAX_FREE = 3;

type Phase = "idle" | "running" | "done";

/** 迷你曲线（sparkline）：纯 SVG，无依赖，按 0–1 的点序列绘制。 */
function Sparkline({ points, trend }: { points: number[]; trend: TrendKey }) {
  const w = 132;
  const h = 34;
  const n = points.length;
  const max = Math.max(...points, 0.0001);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = n === 1 ? w / 2 : (i / (n - 1)) * (w - 8) + 4;
    const y = h - 4 - ((p - min) / span) * (h - 8);
    return [x, y] as const;
  });
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  const stroke = trend === "rising" ? "#16a34a" : trend === "peaked" ? "#dc2626" : "#6366f1";
  return (
    <svg className="rr-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={stroke} />
    </svg>
  );
}

function trendLabel(t: TrendKey, d: Dict): string {
  return t === "rising" ? d.tryPage.trendRising : t === "peaked" ? d.tryPage.trendPeaked : d.tryPage.trendSteady;
}

/** 来源名是平台专有名词（保留英文品牌名），但中文页用「、」连接并加「来源」前缀，避免读成英文句子。 */
function fmtSources(sources: string[], zh: boolean): string {
  return zh ? sources.join("、") : sources.join(" · ");
}

/**
 * P1 外部搜索热度：与内部趋势芯片严格分开展示，明确写出「不同口径」。
 * 无数据 / 未命中都如实说明，绝不把「没上榜」伪装成「热度低」。
 */
function ExternalHeatNote({ heat, d, zh }: { heat: ExternalHeat | null | undefined; d: Dict; zh: boolean }) {
  const t = d.tryPage.externalHeat;
  if (!heat || heat.status !== "ok") {
    return <span className="rr-heat rr-heat-unavailable">{t.unavailable}</span>;
  }
  if (!heat.matched || !heat.term) {
    return <span className="rr-heat rr-heat-nomatch" title={t.basis}>{t.noMatch}</span>;
  }
  const traffic = heat.traffic ? heat.traffic.toLocaleString(zh ? "zh-CN" : "en-US") : "—";
  const text = t.hit.replace("{term}", heat.term).replace("{traffic}", traffic);
  return <span className="rr-heat rr-heat-hit" title={t.basis}>{text}</span>;
}

/**
 * P0-3 结构化机会卡（可折叠）。
 * 只渲染 data 里真实存在的维度，未评估维度显式标「未评估」而不是 0 分；
 * 所有文案来自 i18n，卡片数据本身语言无关，中英页共用同一份。
 */
function CardPanel({ card, d, zh }: { card: OpportunityCard; d: Dict; zh: boolean }) {
  const c = d.tryPage.card;
  const dimLabel = (k: string) => c.dim[k as keyof typeof c.dim] ?? k;
  const audience = c.audienceCode[card.audience as keyof typeof c.audienceCode] ?? c.audienceCode.unknown;
  const validation = c.validationCode[card.validation as keyof typeof c.validationCode] ?? card.validation;
  const insight = card.insight ? (zh ? card.insight.zh || card.insight.en : card.insight.en || card.insight.zh) : null;
  return (
    <details className="rr-card-panel">
      <summary className="rr-card-panel-summary">
        <span>{c.toggle}</span>
        <span className="rr-card-panel-score" title={c.scored}>
          {c.scoreLabel} <strong>{card.total}</strong>
          <small>/100</small>
        </span>
      </summary>
      <div className="rr-card-panel-body">
        <div className="rr-card-dims-title">{c.dimsTitle}</div>
        <div className="rr-card-dims">
          {CARD_DIMS.map((k) => {
            const v = card.dimensions[k];
            const assessed = typeof v === "number";
            return (
              <div className="rr-card-dim" key={k}>
                <span className="rr-card-dim-label">{dimLabel(k)}</span>
                <span className="rr-card-dim-track" aria-hidden="true">
                  {assessed && <i style={{ width: `${Math.max(4, (v as number) * 10)}%` }} />}
                </span>
                <span className={`rr-card-dim-val${assessed ? "" : " is-na"}`}>
                  {assessed ? `${v}/10` : c.notAssessed}
                </span>
              </div>
            );
          })}
        </div>
        <dl className="rr-card-facts">
          <div><dt>{c.audience}</dt><dd>{audience}</dd></div>
          <div><dt>{c.validation}</dt><dd>{validation}</dd></div>
          <div><dt>{c.risks}</dt><dd>
            {card.riskFlags.length
              ? card.riskFlags.map((f) => c.riskCode[f as keyof typeof c.riskCode] ?? f).join(zh ? "、" : " · ")
              : c.noRisks}
          </dd></div>
          {insight && <div><dt>{c.insight}</dt><dd>{insight}</dd></div>}
        </dl>
        <p className="rr-card-basis">{c.basis}</p>
      </div>
    </details>
  );
}

export function GuestScan({
  d = EN_DICT,
  locale = "en",
  signals,
  live = false,
  generatedAt = null,
  historySeeded = false,
  trendReady = true,
  recallSwitch = false,
}: {
  d?: Dict;
  locale?: Locale;
  signals: Signal[];
  live?: boolean;
  generatedAt?: string | null;
  historySeeded?: boolean;
  trendReady?: boolean;
  recallSwitch?: boolean;
}) {
  const t = d.tryPage;
  const zh = locale === "zh";
  const qMark: [string, string] = zh ? ["「", "」"] : ["“", "”"];
  const displayTitle = (s: Signal) => (showOriginal ? s.titleOriginal : s.title);
  const displayQuote = (s: Signal) => (showOriginal ? s.quoteOriginal : s.quote);

  const [used, setUsed] = useState(0);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Signal[] | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  /** 中文页「查看原文」开关：一键把所有 AI 译文切回英文证据原文。 */
  const [showOriginal, setShowOriginal] = useState(false);
  /** 本次结果来自固定索引还是现场实时检索（决定来源标注与说明文案）。 */
  const [scanMode, setScanMode] = useState<"local" | "live" | null>(null);
  /** 实时检索状态机：失败 / 无证据 / 元词都需要诚实空态，不能再兜底伪装成相关结果。 */
  const [liveState, setLiveState] = useState<null | "searching" | "done" | "empty" | "vague" | "failed">(null);
  const [liveMeta, setLiveMeta] = useState<{
    mode: string; sources: string[]; elapsedMs: number;
    entitlement?: { enabled: boolean; tier: string; unlimited: boolean };
  } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** 在途请求编号：resetDemo 或新扫描会让旧响应失效，避免结果串台。 */
  const requestIdRef = useRef(0);

  useEffect(() => {
    try {
      const raw = Number(window.localStorage.getItem(STORAGE_KEY));
      setUsed(Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 0), MAX_FREE) : 0);
    } catch {
      setUsed(0);
    }
    setReady(true);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const exhausted = used >= MAX_FREE;
  const left = Math.max(0, MAX_FREE - used);
  const isRunning = phase === "running";

  /**
   * 统一的扫描入口：输入框、快捷词、发现流卡片、方向卡片都走这里。
   *
   * 两条路径：
   * - 本地索引强命中 → 秒出结果（0.3s 读文件级别，无网络）。
   * - 弱命中 / 无命中 → 调 /api/scan 现场检索公开讨论。旧版在这里把按分数兜底的
   *   4 条标成「相关痛点」，是「创意需求」返回「预约取消」的直接原因，现已移除。
   *
   * forceLocal 用于方向卡片 / 随机方向：它们本来就是固定索引覆盖的方向，
   * 传入的是一组关键词，不适合拿去现场检索。
   */
  function runScan(raw?: string, display?: string, opts?: { forceLocal?: boolean; preset?: Signal[] }) {
    const q = (raw ?? query).trim();
    if (!q || !ready || exhausted || phase === "running") return;

    // 方向卡按人群直取该人群的机会（与 L2 分组同口径），不再靠关键词兜底串到别的赛道。
    const preset = opts?.preset;
    const usePreset = Array.isArray(preset) && preset.length > 0;
    const ranked = usePreset
      ? { list: preset as Signal[], noMatch: false, quality: "strong" as const }
      : searchSignals(q, signals);
    const useLive = !opts?.forceLocal && !usePreset && ranked.quality !== "strong";
    const label = display ?? q;
    const requestId = (requestIdRef.current += 1);

    const next = used + 1;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* 隐私模式下 localStorage 不可用时，本次会话内仍可计数 */
    }
    setUsed(next);
    setQuery(label);
    setLastQuery(label);
    setPhase("running");
    setStep(0);
    setResults(null);
    setNoMatch(false);
    setScanMode(useLive ? "live" : "local");
    setLiveState(useLive ? "searching" : null);
    setLiveMeta(null);

    timers.current.forEach(clearTimeout);
    timers.current = [];
    const steps = useLive ? t.liveRunningSteps : t.runningSteps;
    steps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), (i + 1) * (useLive ? 600 : 300)));
    });

    if (!useLive) {
      timers.current.push(
        setTimeout(() => {
          if (requestIdRef.current !== requestId) return;
          setResults(ranked.list);
          setNoMatch(ranked.noMatch);
          setPhase("done");
        }, 1050),
      );
      return;
    }

    void (async () => {
      const started = Date.now();
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, locale }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(String(data?.error || res.status));
        // 至少给 1.2s 进度反馈，避免结果秒回时界面闪一下就跳到结果。
        const wait = Math.max(0, 1200 - (Date.now() - started));
        if (wait) await new Promise((r) => setTimeout(r, wait));
        if (requestIdRef.current !== requestId) return;

        const items = (Array.isArray(data.items) ? data.items : []) as Signal[];
        setLiveMeta({
          mode: String(data.mode || "rules"),
          sources: Array.isArray(data.sources) ? data.sources : [],
          elapsedMs: Number(data.elapsedMs) || 0,
          entitlement: data.entitlement && typeof data.entitlement === "object"
            ? {
                enabled: Boolean(data.entitlement.enabled),
                tier: String(data.entitlement.tier || "guest"),
                unlimited: Boolean(data.entitlement.unlimited),
              }
            : undefined,
        });
        setResults(items);
        setNoMatch(false);
        // 没给出任何结果（元词 / 证据不足）时同样不占用免费次数：
        // 用户期待的是「3 次有效扫描」，不是 3 次尝试。
        if (!items.length) {
          try {
            window.localStorage.setItem(STORAGE_KEY, String(used));
          } catch {
            /* noop */
          }
          setUsed(used);
        }
        setLiveState(items.length ? "done" : data.mode === "vague" ? "vague" : "empty");
        setPhase("done");
      } catch {
        if (requestIdRef.current !== requestId) return;
        // 实时检索失败不能让用户白扣一次：回滚本机额度与会话计数。
        try {
          window.localStorage.setItem(STORAGE_KEY, String(used));
        } catch {
          /* noop */
        }
        setUsed(used);
        setResults(null);
        setLiveState("failed");
        setPhase("done");
      }
    })();
  }

  /**
   * 方向卡片 / 随机方向：按该方向的检索词走统一内容检索。
   *
   * 历史实现用 pinnedSignals(s.pinned, signals) 按演示数据的短 id 取条目；
   * 切到真实采集管线后 id 变成 "solo-crm-issues-in-crm" 这类长名，一个都匹配不上，
   * 函数里的 `if (!list.length) return` 会让点击静默无反应。改为内容检索后，
   * 演示数据与实时数据都能出结果，且不需要随采集条目变化维护 id 清单。
   */
  function runSuggestion(s: Suggestion) {
    const preset = s.persona
      ? [...signals]
          .filter((x) => (x.idea?.persona || "general") === s.persona)
          .sort((a, b) => b.score - a.score || b.mentions - a.mentions)
          .slice(0, 4)
      : [];
    runScan(s.query.join(" "), s.label, {
      forceLocal: true,
      ...(preset.length ? { preset } : {}),
    });
  }

  function runSurprise() {
    const pool = t.suggestions;
    if (!pool.length) return;
    runSuggestion(pool[Math.floor(Math.random() * pool.length)]);
  }

  function resetDemo() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    requestIdRef.current += 1; // 让在途的实时检索响应失效
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setUsed(0);
    setQuery("");
    setLastQuery("");
    setPhase("idle");
    setStep(0);
    setResults(null);
    setNoMatch(false);
    setScanMode(null);
    setLiveState(null);
    setLiveMeta(null);
  }

  // 只有中文页且确实存在 AI 译文时才出现切换；英文页展示的本就是原文。
  // 实时检索的大模型结果也带译文，必须一并计入，否则「查看原文」不会出现在实时结果上。
  // 必须放在所有 state 声明之后：立即求值的表达式引用 state 会落进暂时性死区。
  const hasTranslations = zh && (signals.some((s) => s.translated) || (results ?? []).some((s) => s.translated));
  // L2：零输入首屏按「人群 / 场景」分组展示一句话机会，而不是按分数排技术 bug 流。
  const personaGroups = groupByPersona(signals, 4, 2);
  const todayIdea = personaGroups[0]?.items[0] ?? null;
  const personaName = (code: string) =>
    t.idea.personaNames[code as keyof typeof t.idea.personaNames] ?? code;
  const runningSteps = scanMode === "live" ? t.liveRunningSteps : t.runningSteps;

  return (
    <>
      <div className="rr-try-card">
        <div className="rr-try-card-head">
          <span className="rr-try-card-title">{live ? t.cardHeadLive : t.cardHead}</span>
          <span className="rr-try-remaining" aria-label={`${t.remaining} ${left} ${t.remainingOf}`}>
            <span className="rr-try-dots" aria-hidden="true">
              {Array.from({ length: MAX_FREE }).map((_, i) => (
                <i key={i} className={i < left ? "is-on" : ""} />
              ))}
            </span>
            <span className="rr-try-remaining-text">
              {t.remaining} <strong>{left}</strong> {t.remainingOf}
            </span>
          </span>
        </div>

        <div className="rr-try-card-body">
          {!exhausted ? (
            <>
              {/* 零输入发现流：对标 Exploding Topics 的首屏趋势信息流（结果出现后仍常驻） */}
              <section className="rr-feed" aria-label={t.feedTitle}>
                <div className="rr-feed-head">
                  <span className="rr-feed-kicker">{t.feedKicker}</span>
                  <h3 className="rr-feed-title">{t.feedTitle}</h3>
                  <p className="rr-feed-text">{t.feedText}</p>
                </div>

                {/* 今日一点子：零输入时首屏 10 秒就能读懂一个「给谁 + 做什么」 */}
                {todayIdea && (
                  <div className="rr-today-idea">
                    <span className="rr-today-kicker">{t.idea.kicker}</span>
                    <p className="rr-today-headline">{ideaText(todayIdea.idea, "headline", locale) || displayTitle(todayIdea)}</p>
                    <p className="rr-today-step">{ideaText(todayIdea.idea, "step", locale)}</p>
                    <button
                      type="button"
                      className="rr-feed-explore"
                      disabled={!ready || isRunning}
                      onClick={() => runScan(todayIdea.title, ideaText(todayIdea.idea, "headline", locale) || todayIdea.title, { forceLocal: true })}
                    >
                      {t.exploreLabel} →
                    </button>
                  </div>
                )}

                {personaGroups.map((g) => (
                  <div className="rr-persona-group" key={g.persona}>
                    <div className="rr-persona-head">
                      <span className="rr-persona-name">{personaName(g.persona)}</span>
                      <span className="rr-persona-count">{g.items.length} {t.idea.groupUnit}</span>
                    </div>
                    <div className="rr-feed-grid">
                      {g.items.map((s) => (
                        <article className="rr-feed-item" key={s.id}>
                          <div className="rr-feed-item-top">
                            <span className="rr-cat-badge">{s.category}</span>
                            <span className={`rr-trend rr-trend-${s.trend}`}>
                              <span aria-hidden="true">{s.trend === "rising" ? "▲" : s.trend === "peaked" ? "▼" : "■"}</span>
                              {trendLabel(s.trend, d)}
                            </span>
                          </div>
                          <h4 className="rr-feed-item-title">{ideaText(s.idea, "headline", locale) || displayTitle(s)}</h4>
                          <p className="rr-feed-item-step">{ideaText(s.idea, "step", locale)}</p>
                          <div className="rr-feed-item-meta">
                            <span>{s.mentions} {t.mentions}</span>
                            <span>· {zh ? "来源 " : ""}{fmtSources(s.sources.slice(0, 2), zh)}</span>
                          </div>
                          <button
                            type="button"
                            className="rr-feed-explore"
                            disabled={!ready || isRunning}
                            onClick={() => runScan(s.title, ideaText(s.idea, "headline", locale) || s.title, { forceLocal: true })}
                          >
                            {t.exploreLabel} →
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
                {live && generatedAt && (
                  <p className="rr-feed-live-note">{t.feedLiveNote} {new Date(generatedAt).toLocaleDateString(zh ? "zh-CN" : "en-US")}</p>
                )}
                {/* 诚实标注：引导历史 / 样本不足 / 口径切换时不把演示趋势冒充真实趋势 */}
                {live && historySeeded && <p className="rr-feed-seed-note">{t.feedSeedNote}</p>}
                {live && !historySeeded && !trendReady && <p className="rr-feed-seed-note">{t.feedTrendPending}</p>}
                {live && recallSwitch && <p className="rr-feed-seed-note">{t.feedRecallSwitch}</p>}
                {/* AI 译文标注与「查看原文」切换：引语是证据链，必须能一键回看英文原文 */}
                {hasTranslations && (
                  <p className="rr-feed-translate-note">
                    {t.translatedNote}{" "}
                    <button
                      type="button"
                      className="rr-translate-toggle"
                      aria-pressed={showOriginal}
                      onClick={() => setShowOriginal((v) => !v)}
                    >
                      {showOriginal ? t.viewTranslation : t.viewOriginal}
                    </button>
                  </p>
                )}
              </section>

              {/* 方向浏览：没想法时直接点（解决冷启动），结果出现后仍常驻 */}
              <div className="rr-try-browse" id="rr-browse">
                  <div className="rr-try-browse-kicker">{t.browseKicker}</div>
                  <h3 className="rr-try-browse-title">{t.browseTitle}</h3>
                  <div className="rr-try-tiles">
                    {t.suggestions.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="rr-try-tile"
                        disabled={!ready || isRunning}
                        onClick={() => runSuggestion(s)}
                      >
                        <span className="rr-try-tile-label">{s.label}</span>
                        <span className="rr-try-tile-sub">{s.sub}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="rr-try-surprise" disabled={!ready || isRunning} onClick={runSurprise}>
                    <span aria-hidden="true">✦</span> {t.surpriseLabel}
                  </button>
                </div>

              <div className="rr-try-or">
                <span>{t.orInputLabel}</span>
              </div>

              {!exhausted && (
                <form
                  className="rr-try-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    runScan();
                  }}
                >
                  <label htmlFor="rr-try-input" className="rr-try-label-main">
                    {t.inputLabel}
                  </label>
                  <div className="rr-try-input-row">
                    <input
                      id="rr-try-input"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t.inputPlaceholder}
                      autoComplete="off"
                      maxLength={120}
                      disabled={!ready || phase === "running"}
                      className="rr-try-input"
                    />
                    <button
                      type="submit"
                      className="rr-btn rr-btn-primary rr-try-run"
                      disabled={!ready || isRunning || !query.trim()}
                    >
                      {phase === "running" ? t.running : t.run}
                    </button>
                  </div>
                  <p className="rr-note mt-2">{t.inputHint}</p>
                  <div className="rr-try-examples">
                    <span className="rr-try-examples-label">{t.examplesLabel}</span>
                    {t.examples.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        className="rr-try-example"
                        disabled={!ready || phase === "running"}
                        onClick={() => runScan(ex, undefined, { forceLocal: true })}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="rr-try-locked" role="status">
              <strong>{t.exhaustedKicker}</strong>
              <span>{t.exhaustedText}</span>
              <div className="rr-try-locked-actions">
                <Link href={t.signupHref} className="rr-btn rr-btn-primary rr-btn-sm">
                  {t.ctaAccount}
                </Link>
                <Link href={t.pricingHref} className="rr-btn rr-btn-outline rr-btn-sm">
                  {t.ctaPlans}
                </Link>
              </div>
            </div>
          )}

          {phase === "running" && (
            <div className="rr-try-progress" role="status" aria-live="polite">
              <div className="rr-try-progress-bar">
                {/* 实时检索未返回前不走到 100%，避免进度条假完成 */}
                <span style={{ width: `${Math.min(scanMode === "live" ? 92 : 100, (step + 1) * 30)}%` }} />
              </div>
              <p>{runningSteps[Math.min(step, runningSteps.length - 1)]}</p>
            </div>
          )}

          <div className="rr-try-results" aria-live="polite">
            {phase === "done" && results && results.length > 0 && (
              <>
                <div className="rr-try-results-head">
                  <h3>
                    {t.resultTitle} <span className="rr-gradient-text">{qMark[0]}{lastQuery}{qMark[1]}</span>
                  </h3>
                  <span className={`rr-chip ${live || scanMode === "live" ? "rr-chip-green" : "rr-chip-blue"}`}>
                    {scanMode === "live" ? t.liveSearchTag : live ? t.liveTag : t.demoTag}
                  </span>
                  {scanMode === "live" && liveMeta && (
                    <span className="rr-live-mode">
                      {liveMeta.mode === "llm" ? t.liveModeLlm : t.liveModeRules}
                    </span>
                  )}
                  {/* P2 会员额度标签：默认关闭计费时不渲染，不影响现有界面。 */}
                  {liveMeta?.entitlement?.enabled && liveMeta.entitlement.tier !== "guest" && (
                    <span className="rr-entitlement">
                      {liveMeta.entitlement.unlimited ? t.entitlement.unlimited : t.entitlement.member}
                    </span>
                  )}
                  {hasTranslations && (
                    <button
                      type="button"
                      className="rr-translate-toggle"
                      aria-pressed={showOriginal}
                      onClick={() => setShowOriginal((v) => !v)}
                    >
                      {showOriginal ? t.viewTranslation : t.viewOriginal}
                    </button>
                  )}
                </div>
                {scanMode === "live" ? (
                  <p className="rr-try-order-note">
                    {t.liveNote}
                    {liveMeta && liveMeta.sources.length > 0
                      ? ` ${t.liveSourcesLabel}${zh ? "：" : ": "}${liveMeta.sources.join(zh ? "、" : " · ")}`
                      : ""}
                  </p>
                ) : (
                  <p className="rr-try-order-note">{t.resultOrderNote}</p>
                )}
                {noMatch && <p className="rr-try-nomatch">{live ? t.noMatchLive : t.noMatch}</p>}
                {results.map((it, i) => {
                  const idea = it.idea;
                  const headline = ideaText(idea, "headline", locale) || displayTitle(it);
                  const persona = idea?.persona || "general";
                  const similar = signals
                    .filter((s) => s.id !== it.id && (s.idea?.persona || "general") === persona)
                    .slice(0, 4);
                  return (
                    <article className="rr-try-result" key={it.id}>
                      {/* L1：一句话机会置顶，证据与评分降为可展开详情 */}
                      <div className="rr-idea-head">
                        <span className="rr-try-rank">{String(i + 1).padStart(2, "0")}</span>
                        <div className="rr-idea-head-main">
                          <span className="rr-idea-kicker">{t.idea.kicker}</span>
                          <h4 className="rr-idea-headline">{headline}</h4>
                        </div>
                        <span className="rr-try-score" aria-label={`${t.scoreLabel} ${it.score}`}>
                          {it.score}<small>/100</small>
                        </span>
                      </div>
                      <p className="rr-idea-note">{idea?.origin === "llm" ? t.idea.aiNote : t.idea.templateNote}</p>
                      <dl className="rr-idea-grid">
                        <div><dt>{t.idea.whoLabel}</dt><dd>{ideaText(idea, "who", locale)}</dd></div>
                        <div><dt>{t.idea.whyLabel}</dt><dd>{ideaText(idea, "why", locale)}</dd></div>
                        <div><dt>{t.idea.stepLabel}</dt><dd>{ideaText(idea, "step", locale)}</dd></div>
                      </dl>

                      {/* 三个追问：都是确定性本地动作，不假装有 AI、不额外消耗免费额度 */}
                      <div className="rr-idea-actions">
                        <details className="rr-idea-action">
                          <summary className="rr-idea-btn">
                            <span className="rr-lbl-open">{t.idea.evidenceOpen}</span>
                            <span className="rr-lbl-close">{t.idea.evidenceClose}</span>
                          </summary>
                          <div className="rr-evidence-body">
                            <p className="rr-evidence-title">{displayTitle(it)}</p>
                            <div className="rr-try-result-meta">
                              <span className="rr-cat-badge rr-cat-badge-sm">{it.category}</span>
                              <span className={`rr-trend rr-trend-${it.trend} rr-trend-sm`}>
                                <span aria-hidden="true">{it.trend === "rising" ? "▲" : it.trend === "peaked" ? "▼" : "■"}</span>
                                {trendLabel(it.trend, d)}
                              </span>
                              <span className="rr-try-result-mentions">{it.mentions} {t.mentions}</span>
                            </div>
                            <div className="rr-try-result-spark">
                              <Sparkline points={it.spark} trend={it.trend} />
                              <span className="rr-try-result-sources">{zh ? "来源：" : `${t.sourcesLabel}: `}{fmtSources(it.sources, zh)}</span>
                            </div>
                            {it.externalHeat !== undefined && it.externalHeat !== null && (
                              <div className="rr-heat-row">
                                <span className="rr-try-label">{t.externalHeat.label}</span>
                                <ExternalHeatNote heat={it.externalHeat} d={d} zh={zh} />
                              </div>
                            )}
                            <div className="rr-try-quote">
                              <span className="rr-try-label">{t.quoteLabel}</span>
                              <p>{qMark[0]}{displayQuote(it)}{qMark[1]}</p>
                            </div>
                            <div className="rr-try-gap">
                              <span className="rr-try-label">{t.idea.signalLabel}</span>
                              <p>{it.gap}</p>
                            </div>
                            {it.card && <CardPanel card={it.card} d={d} zh={zh} />}
                          </div>
                        </details>
                        <details className="rr-idea-action">
                          <summary className="rr-idea-btn">{t.idea.similar}</summary>
                          <div className="rr-similar-body">
                            {similar.length ? (
                              <ul className="rr-similar-list">
                                {similar.map((s) => (
                                  <li key={s.id}>{ideaText(s.idea, "headline", locale) || displayTitle(s)}</li>
                                ))}
                              </ul>
                            ) : <p className="rr-note">{t.idea.similarEmpty}</p>}
                          </div>
                        </details>
                        <button
                          type="button"
                          className="rr-idea-btn rr-idea-btn-scroll"
                          onClick={() => document.getElementById("rr-browse")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        >
                          {t.idea.nextDirection}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </>
            )}

            {/* 诚实空态：弱命中、元词、无证据、实时检索失败时都不再兜底伪装成「相关痛点」 */}
            {phase === "done" && (!results || results.length === 0) && (
              <div className="rr-try-empty" role="status">
                <h3 className="rr-try-empty-title">
                  {liveState === "vague"
                    ? t.vagueTitle
                    : liveState === "failed"
                      ? t.liveFailedTitle
                      : liveState === "empty"
                        ? t.liveEmptyTitle
                        : t.weakTitle}
                </h3>
                <p className="rr-try-empty-text">
                  {liveState === "vague"
                    ? t.vagueText
                    : liveState === "failed"
                      ? t.liveFailedText
                      : liveState === "empty"
                        ? t.liveEmptyText
                        : t.weakText}
                </p>
                {(liveState === "vague" || liveState === "empty" || liveState === "failed") && (
                  <p className="rr-note mt-2">{t.liveFailedText}</p>
                )}
                {liveState === "failed" && (
                  <button
                    type="button"
                    className="rr-btn rr-btn-outline rr-btn-sm"
                    disabled={!ready || exhausted || isRunning}
                    onClick={() => runScan(lastQuery)}
                  >
                    {t.liveRetry}
                  </button>
                )}
                <div className="rr-try-empty-dirs">
                  <span className="rr-try-empty-dirs-label">{t.coveredTitle}</span>
                  <div className="rr-try-empty-dirs-btns">
                    {t.suggestions.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="rr-try-example"
                        disabled={!ready || exhausted || isRunning}
                        onClick={() => runSuggestion(s)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rr-try-foot">
            <p>
              {live ? t.footLive : t.foot}{" "}
              <Link href="/opportunities.json">{t.dataLinkLabel}</Link>
            </p>
            <button type="button" className="rr-try-reset" onClick={resetDemo}>
              {t.resetDemo}
            </button>
          </div>
        </div>
      </div>

      {exhausted && (
        <div className="rr-try-upsell">
          <span className="rr-kicker">{t.exhaustedKicker}</span>
          <h2 className="rr-h2 mt-3">{t.exhaustedTitle}</h2>
          <p className="rr-lead mt-4 text-[16px]">{t.exhaustedText}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
            <Link href={t.signupHref} className="rr-btn rr-btn-primary">
              {t.ctaAccount}
            </Link>
            <Link href={t.pricingHref} className="rr-btn rr-btn-outline">
              {t.ctaPlans}
            </Link>
          </div>
          <p className="rr-note mt-5">{t.exhaustedNote}</p>
        </div>
      )}
    </>
  );
}
