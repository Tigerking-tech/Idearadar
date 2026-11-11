"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EN_DICT, type Dict, type Locale } from "@/lib/i18n";
import {
  searchSignals,
  pinnedSignals,
  topSignals,
  type Signal,
} from "@/lib/signals";

type Suggestion = { label: string; sub: string; pinned: string[] };

type TrendKey = Signal["trend"];

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

export function GuestScan({
  d = EN_DICT,
  locale = "en",
  signals,
  live = false,
  generatedAt = null,
  historySeeded = false,
  trendReady = true,
}: {
  d?: Dict;
  locale?: Locale;
  signals: Signal[];
  live?: boolean;
  generatedAt?: string | null;
  historySeeded?: boolean;
  trendReady?: boolean;
}) {
  const t = d.tryPage;
  const zh = locale === "zh";
  const qMark: [string, string] = zh ? ["「", "」"] : ["“", "”"];

  const [used, setUsed] = useState(0);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Signal[] | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  function runScan(raw?: string) {
    const q = (raw ?? query).trim();
    if (!q || !ready || exhausted || phase === "running") return;

    const next = used + 1;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* 隐私模式下 localStorage 不可用时，本次会话内仍可计数 */
    }
    setUsed(next);
    setQuery(q);
    setLastQuery(q);
    setPhase("running");
    setStep(0);
    setResults(null);
    setNoMatch(false);

    const ranked = searchSignals(q, signals);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    t.runningSteps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), (i + 1) * 300));
    });
    timers.current.push(
      setTimeout(() => {
        setResults(ranked.list);
        setNoMatch(ranked.noMatch);
        setPhase("done");
      }, 1050),
    );
  }

  function runSuggestion(s: Suggestion) {
    if (!ready || exhausted || phase === "running") return;
    const list = pinnedSignals(s.pinned, signals);
    if (!list.length) return;
    const next = used + 1;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* 隐私模式不可用时的会话内计数 */
    }
    setUsed(next);
    setQuery(s.label);
    setLastQuery(s.label);
    setPhase("running");
    setStep(0);
    setResults(null);
    setNoMatch(false);

    timers.current.forEach(clearTimeout);
    timers.current = [];
    t.runningSteps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), (i + 1) * 300));
    });
    timers.current.push(
      setTimeout(() => {
        setResults(list);
        setNoMatch(false);
        setPhase("done");
      }, 1050),
    );
  }

  function runSurprise() {
    const pool = t.suggestions;
    if (!pool.length) return;
    runSuggestion(pool[Math.floor(Math.random() * pool.length)]);
  }

  function resetDemo() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
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
  }

  const feedItems = topSignals(signals, 6);

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
                  <div className="rr-feed-grid">
                    {feedItems.map((s) => (
                      <article className="rr-feed-item" key={s.id}>
                        <div className="rr-feed-item-top">
                          <span className="rr-cat-badge">{s.category}</span>
                          <span className={`rr-trend rr-trend-${s.trend}`}>
                            <span aria-hidden="true">{s.trend === "rising" ? "▲" : s.trend === "peaked" ? "▼" : "■"}</span>
                            {trendLabel(s.trend, d)}
                          </span>
                        </div>
                        <h4 className="rr-feed-item-title">{s.title}</h4>
                        <div className="rr-feed-item-mid">
                          <Sparkline points={s.spark} trend={s.trend} />
                          <div className="rr-feed-item-score">
                            <strong>{s.score}</strong>
                            <span>{t.scoreLabelShort}</span>
                          </div>
                        </div>
                        <div className="rr-feed-item-meta">
                          <span>{s.mentions} {t.mentions}</span>
                          <span>· {zh ? "来源 " : ""}{fmtSources(s.sources.slice(0, 2), zh)}</span>
                        </div>
                        <button
                          type="button"
                          className="rr-feed-explore"
                          disabled={!ready || isRunning}
                          onClick={() => runScan(s.title)}
                        >
                          {t.exploreLabel} →
                        </button>
                      </article>
                    ))}
                  </div>
                  {live && generatedAt && (
                    <p className="rr-feed-live-note">{t.feedLiveNote} {new Date(generatedAt).toLocaleDateString(zh ? "zh-CN" : "en-US")}</p>
                  )}
                  {/* 诚实标注：引导历史 / 样本不足时不把演示趋势冒充真实趋势 */}
                  {live && historySeeded && <p className="rr-feed-seed-note">{t.feedSeedNote}</p>}
                  {live && !historySeeded && !trendReady && <p className="rr-feed-seed-note">{t.feedTrendPending}</p>}
                </section>

              {/* 方向浏览：没想法时直接点（解决冷启动），结果出现后仍常驻 */}
              <div className="rr-try-browse">
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
                        onClick={() => runScan(ex)}
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
                <span style={{ width: `${Math.min(100, (step + 1) * 30)}%` }} />
              </div>
              <p>{t.runningSteps[Math.min(step, t.runningSteps.length - 1)]}</p>
            </div>
          )}

          <div className="rr-try-results" aria-live="polite">
            {results && phase === "done" && (
              <>
                <div className="rr-try-results-head">
                  <h3>
                    {t.resultTitle} <span className="rr-gradient-text">{qMark[0]}{lastQuery}{qMark[1]}</span>
                  </h3>
                  <span className={`rr-chip ${live ? "rr-chip-green" : "rr-chip-blue"}`}>
                    {live ? t.liveTag : t.demoTag}
                  </span>
                </div>
                <p className="rr-try-order-note">{t.resultOrderNote}</p>
                {noMatch && <p className="rr-try-nomatch">{t.noMatch}</p>}
                {results.map((it, i) => (
                  <article className="rr-try-result" key={it.id}>
                    <div className="rr-try-result-top">
                      <span className="rr-try-rank">{String(i + 1).padStart(2, "0")}</span>
                      <h4>{it.title}</h4>
                      <span className="rr-try-score" aria-label={`${t.scoreLabel} ${it.score}`}>
                        {it.score}<small>/100</small>
                      </span>
                    </div>
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
                    <div className="rr-try-quote">
                      <span className="rr-try-label">{t.quoteLabel}</span>
                      <p>{qMark[0]}{it.quote}{qMark[1]}</p>
                    </div>
                    <div className="rr-try-gap">
                      <span className="rr-try-label">{t.gapLabel}</span>
                      <p>{it.gap}</p>
                    </div>
                  </article>
                ))}
              </>
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
