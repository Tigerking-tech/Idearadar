import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import config from "@/config";
import { FAQ_ITEMS, FAQ_ITEMS_ZH } from "@/lib/faq";
import { EN_DICT, type Dict } from "@/lib/i18n";
import { renderFaqSchema } from "@/lib/seo";
import { RoiCalculator, SubscribeButton } from "./interactive";

/**
 * 读取定时 workflow 产出的结构化数据（服务端、构建时读取）。
 *
 * 设计边界（重要）：营销首页的评分卡片是「输出格式示意」，固定使用字典中
 * 各语言自带的示例条目，绝不把采集到的原文标题直接铺到页面上。原因：
 * 1. 采集源以英文社区为主，原文标题放在中文页会破坏语言一致性；
 * 2. 原始标题常含 issue 编号、多语言正文、噪声短语，且被硬截断会出现半个单词；
 * 3. 卡片是版式演示，不是数据看板，混入未经复核的原文反而降低可信度。
 *
 * 真实采集结果只以「产出条数 / 数据源 / 更新日期」三项统计出现在脚注，
 * 并链接到 /opportunities.json 供需要原始数据的人查看。这样中英文两版都
 * 干净、可抓取，且与 workflow 的闭环仍然存在（数字随每次采集刷新）。
 */
function getLatestScanStats() {
  try {
    const file = path.join(process.cwd(), "data", "opportunities.json");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const total = Number(data.totals?.opportunities);
    if (!Number.isFinite(total) || total <= 0) return null;
    return {
      total,
      generatedAt: String(data.generatedAt || "").slice(0, 10),
      sources: Array.from(
        new Set<string>((data.items || []).flatMap((i: any) => (i.sources || []) as string[])),
      )
        .filter((s) => /^[a-z0-9_-]+$/i.test(s))
        .slice(0, 4),
    };
  } catch {
    return null;
  }
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type SectionProps = { d?: Dict };

/* ---------------- Hero（对标：渐变公告条 + 居中超粗双行标题 + 双 CTA） --------------- */
export function Hero({ d = EN_DICT }: SectionProps) {
  const zh = d.locale === "zh";
  return (
    <section className="text-center pt-[92px] pb-16 md:pt-[110px] md:pb-20">
      <div className="rr-container">
        <span className="rr-eyebrow">{d.hero.eyebrow}</span>
        <h1 className={`rr-h1 mt-8 ${zh ? "rr-h1-zh" : ""}`}>
          {d.hero.line1}
          <br />
          <span className="rr-gradient-text">{d.hero.line2}</span>
        </h1>
        <p className={`rr-lead max-w-[680px] mx-auto mt-7 ${zh ? "rr-lead-zh" : ""}`}>
          {d.hero.lead.replace("{app}", d.brand)}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
          <Link href={d.hero.cta1Href} className="rr-btn rr-btn-primary">
            {d.hero.cta1}
          </Link>
          <Link href={d.hero.cta2Href} className="rr-btn rr-btn-outline">
            {d.hero.cta2}
          </Link>
        </div>
        <p className="rr-note mt-5">{d.hero.note}</p>
      </div>
    </section>
  );
}

/* ---------------- 数据条（对标：三列大数字 + 灰色小标签） --------------- */
export function StatsBar({ d = EN_DICT }: SectionProps) {
  return (
    <section className="pb-20 md:pb-24">
      <div className="rr-container">
        <div className="border-y border-[#e8e9f0] py-10">
          <div className="rr-stats text-center max-w-[820px] mx-auto">
            {d.stats.map((s) => (
              <div key={s.num}>
                <div className="rr-stat-num">{s.num}</div>
                <div className="rr-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 产品预览（对标：网格底 + 左对齐巨标题 + 右侧评分条卡片） --------------- */
export function LivePreview({ d = EN_DICT }: SectionProps) {
  const stats = getLatestScanStats();
  const p = d.preview;
  const footLive = stats
    ? p.footLive
        .replace("{total}", String(stats.total))
        .replace("{sources}", stats.sources.join(", "))
        .replace("{date}", stats.generatedAt)
    : p.footSample;
  return (
    <section id="live-preview" className="rr-grid-bg border-y border-[#e8e9f0] rr-section scroll-mt-20">
      <div className="rr-container">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="flex items-center gap-2 mb-7">
              <span className="w-2 h-2 rounded-[2px] bg-[#5b4bf5]" />
              <span className="text-[11px] font-bold tracking-[0.16em] text-[#5c6273]">{p.kicker}</span>
            </div>
            <h2 className="rr-h2 !text-[clamp(34px,4.4vw,56px)] !leading-[1.08]">
              {p.h2a}
              <span className="rr-gradient-text">{p.h2b}</span>
            </h2>
            <p className="rr-lead mt-7 max-w-[560px]">{p.lead}</p>
            <ul className="mt-8 space-y-3">
              {p.bullets.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[14.5px] text-[#4a4f5e]">
                  <span className="mt-0.5 text-[#5b4bf5]"><CheckIcon /></span>
                  {t}
                </li>
              ))}
            </ul>
            <Link href={p.methodHref} className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b4bf5] mt-8">
              {p.methodLink}
            </Link>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="rr-card rr-scan shadow-[0_24px_60px_rgba(16,24,40,0.10)]">
              <div className="rr-scan-head">
                <span>{p.scanHead}</span>
                <span className="rr-scan-badge">{p.samplePains}</span>
              </div>
              {p.sample.map((row) => (
                <div className="rr-scan-row" key={row.label}>
                  <div className="rr-scan-row-top">
                    <span>{row.label}</span>
                    <span className="rr-scan-score">{row.score}</span>
                  </div>
                  <div className="rr-bar-track">
                    <div className="rr-bar-fill" style={{ width: `${row.score}%` }} />
                  </div>
                </div>
              ))}
              <div className="rr-scan-foot">
                {footLive}
                {stats ? (
                  <>
                    {" "}
                    <Link href={p.dataLinkHref} className="underline underline-offset-2">
                      {p.dataLinkLabel}
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- How it works（对标：三步卡片） --------------- */
export function HowItWorks({ d = EN_DICT }: SectionProps) {
  const s = d.steps;
  return (
    <section id="how-it-works" className="rr-section scroll-mt-20">
      <div className="rr-container">
        <div className="rr-section-head">
          <span className="rr-kicker">{s.kicker}</span>
          <h2 className="rr-h2 mt-3">{s.h2}</h2>
          <p className="rr-lead mt-4 text-[16px]">{s.lead}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {s.items.map((item) => (
            <div key={item.n} className="rr-card rr-card-hover p-7">
              <div className="rr-step-num">{item.n}</div>
              <h3 className="rr-h3 mt-5">{item.title}</h3>
              <p className="text-[14px] leading-relaxed text-[#5c6273] mt-3">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 示例输出 / 证据链 --------------- */
export function EvidenceSection({ d = EN_DICT }: SectionProps) {
  const e = d.evidence;
  return (
    <section className="rr-section-tight pb-24">
      <div className="rr-container">
        <div className="rr-card p-7 md:p-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <span className="rr-kicker">{e.kicker}</span>
              <h2 className="rr-h2 mt-3 !text-[30px]">{e.h2}</h2>
            </div>
            <span className="rr-chip rr-chip-blue self-start">{e.chip}</span>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 mt-9">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rr-chip rr-chip-red">{e.chips[0]}</span>
                <span className="rr-chip rr-chip-blue">{e.chips[1]}</span>
                <span className="rr-chip rr-chip-green">{e.chips[2]}</span>
              </div>
              <h3 className="rr-h3 mt-5 text-[17px]">{e.title}</h3>
              <div className="rr-quote mt-4">{e.quote}</div>
              <p className="rr-note mt-3">{e.note}</p>
              <div className="mt-6">
                <div className="text-[12px] font-bold tracking-[0.1em] text-[#8b90a0] mb-2">{e.wtpLabel}</div>
                <p className="text-[14px] text-[#4a4f5e]">{e.wtpText}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#e8e9f0] bg-[#fbfbfe] p-6">
              <div className="text-[12px] font-bold tracking-[0.1em] text-[#8b90a0] mb-4">{e.competitorLabel}</div>
              <ul className="space-y-4">
                {e.competitors.map((c) => (
                  <li key={c.name} className="text-[13.5px]">
                    <strong className="block text-[#0b0b12]">{c.name}</strong>
                    <span className="text-[#5c6273]">{c.gap}</span>
                  </li>
                ))}
              </ul>
              <div className="rr-divider my-5" />
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold">{e.gapScore}</span>
                <span className="rr-gradient-text text-2xl font-extrabold">88</span>
              </div>
              <p className="rr-note mt-2">{e.gapNote}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 对比 + ROI --------------- */
export function ComparisonSection({ d = EN_DICT }: SectionProps) {
  const c = d.compare;
  return (
    <section className="rr-section-tight pb-24">
      <div className="rr-container">
        <div className="rr-section-head">
          <span className="rr-kicker">{c.kicker}</span>
          <h2 className="rr-h2 mt-3">{c.h2}</h2>
        </div>
        <div className="rr-compare">
          <div className="rr-compare-col">
            <h3 className="rr-h3">{c.manualTitle}</h3>
            <ul className="rr-compare-list">
              {c.manualItems.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div className="rr-compare-col is-good">
            <h3 className="rr-h3">{c.rrTitle}</h3>
            <ul className="rr-compare-list">
              {c.rrItems.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </div>
        <div className="mt-8">
          <RoiCalculator d={d.roi} />
        </div>
      </div>
    </section>
  );
}

/* ---------------- 数据源与合规（延续赛道结论：多源 = 生存前提） --------------- */
export function DataSourcesSection({ d = EN_DICT }: SectionProps) {
  const s = d.sources;
  return (
    <section id="data-sources" className="rr-section rr-grid-bg border-y border-[#e8e9f0] scroll-mt-20">
      <div className="rr-container">
        <div className="rr-section-head">
          <span className="rr-kicker">{s.kicker}</span>
          <h2 className="rr-h2 mt-3">{s.h2}</h2>
          <p className="rr-lead mt-4 text-[16px]">{s.lead}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {s.items.map((item) => (
            <div key={item.name} className="rr-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="rr-h3 !text-[15px]">{item.name}</h3>
                <span className={`rr-chip ${item.state === "enabled" ? "rr-chip-green" : "rr-chip-red"}`}>
                  {item.state === "enabled" ? s.enabled : s.optIn}
                </span>
              </div>
              <p className="text-[13px] text-[#5c6273] mt-2">{item.detail}</p>
            </div>
          ))}
        </div>
        <p className="rr-note mt-6 text-center max-w-[760px] mx-auto">
          {s.note1}<code>{s.noteCode}</code>{s.note2}
          <Link href={s.noteHref}>{s.noteLink}</Link>
          {s.note3}
        </p>
      </div>
    </section>
  );
}

/* ---------------- 定价 --------------- */
export function PricingSection({
  standalone = false,
  d = EN_DICT,
}: {
  standalone?: boolean;
  d?: Dict;
}) {
  const p = d.pricing;
  return (
    <section id="pricing" className={`rr-section scroll-mt-20 ${standalone ? "!pt-8" : ""}`}>
      <div className="rr-container">
        {!standalone && (
          <div className="rr-section-head">
            <span className="rr-kicker">{p.kicker}</span>
            <h2 className="rr-h2 mt-3">{p.h2}</h2>
            <p className="rr-lead mt-4 text-[16px]">{p.lead}</p>
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-5 items-stretch max-w-[1080px] mx-auto pt-4">
          {config.plans.map((plan, i) => {
            const t = p.plans[i];
            return (
              <div key={plan.id} className={`rr-price-card ${plan.featured ? "is-featured" : ""}`}>
                {plan.featured && <span className="rr-price-badge">{p.badge}</span>}
                <h3 className="rr-h3">{t.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="rr-price-amount">${plan.price}</span>
                  <span className="text-[13px] text-[#8b90a0]">{t.cadence}</span>
                </div>
                <p className="text-[13.5px] text-[#5c6273] mt-3 min-h-[40px]">{t.description}</p>
                <ul className="rr-price-feature-list">
                  {t.features.map((f) => (
                    <li key={f}>
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <SubscribeButton
                  productId={plan.productId}
                  label={t.cta}
                  loadingLabel={d.locale === "zh" ? "正在打开结账页…" : "Opening checkout…"}
                  variant={plan.featured ? "primary" : "outline"}
                  block
                  fallbackHref={
                    plan.id === "free"
                      ? d.locale === "zh" ? "/zh/try" : "/try"
                      : plan.id === "team"
                        ? `mailto:${config.supportEmail}`
                        : "/signup"
                  }
                />
              </div>
            );
          })}
        </div>
        <p className="rr-note text-center mt-8">
          {standalone ? (
            <>{p.footA}{p.footStandalone}</>
          ) : (
            <>
              {p.footA}{p.footSee}
              {p.footLinkHref ? <Link href={p.footLinkHref}>{p.footLinkLabel}</Link> : null}
              {p.footDot}
            </>
          )}
        </p>
      </div>
    </section>
  );
}

/* ---------------- FAQ（原生 details，无需 JS 即可被抓取） --------------- */
export function FaqSection({ d = EN_DICT }: SectionProps) {
  const items = d.locale === "zh" ? FAQ_ITEMS_ZH : FAQ_ITEMS;
  return (
    <section id="faq" className="rr-section-tight pb-24 scroll-mt-20">
      <div className="rr-container max-w-[860px]">
        <div className="rr-section-head">
          <span className="rr-kicker">{d.faq.kicker}</span>
          <h2 className="rr-h2 mt-3">{d.faq.h2}</h2>
        </div>
        <div className="border-t border-[#e8e9f0]">
          {items.map((item) => (
            <details key={item.q} className="rr-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        {renderFaqSchema(items)}
      </div>
    </section>
  );
}

/* ---------------- 底部 CTA --------------- */
export function FinalCta({ d = EN_DICT }: SectionProps) {
  const f = d.finalCta;
  return (
    <section className="pb-24">
      <div className="rr-container">
        <div
          className="rounded-[20px] px-8 py-14 md:py-16 text-center text-white"
          style={{ background: "linear-gradient(115deg,#4f46e5 0%,#6d4bf6 50%,#a855f7 100%)" }}
        >
          <h2 className="rr-h2 !text-white">{f.h2}</h2>
          <p className="text-[16px] text-white/85 max-w-[620px] mx-auto mt-4">{f.lead}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
            <Link href={f.cta1Href} className="rr-btn bg-white text-[#3b2fb8] hover:bg-white/90">
              {f.cta1}
            </Link>
            <Link href={f.cta2Href} className="rr-btn border border-white/45 text-white hover:bg-white/10">
              {f.cta2}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
