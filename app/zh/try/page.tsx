import Link from "next/link";
import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { ZH_DICT } from "@/lib/i18n";
import { GuestScan } from "@/components/marketing/guest-scan";
import { resolveSignals } from "@/lib/signals";

export const dynamic = "force-dynamic";

const title = "免费试用 — 免注册扫描 3 次 | 创意雷达";
const description =
  "免注册试用 创意雷达：不用账号、不用信用卡，先免费扫描 3 次细分市场。输入一个市场或工作流，即可拿到排序后的痛点、证据评分、逐字原话、来源出处与竞品空白。";

export const metadata = getSEOTags({
  title,
  description,
  keywords: ["免费试用", "无需注册", "用户抱怨分析", "痛点挖掘", "细分市场扫描", "创意雷达 免费"],
  canonicalUrlRelative: "/zh/try",
  languages: { "en-US": "/try", "zh-CN": "/zh/try", "x-default": "/try" },
  ogLocale: "zh_CN",
  openGraph: { title, description, url: "/zh/try" },
});

export default function ZhTryPage() {
  const d = ZH_DICT;
  const t = d.tryPage;
  const feed = resolveSignals("zh");
  return (
    <>
      <section className="rr-grid-bg border-b border-[#e8e9f0]">
        <div className="rr-container pt-[72px] pb-14 md:pt-[92px] md:pb-16 text-center">
          <span className="rr-eyebrow">{t.kicker}</span>
          <h1 className="rr-h1 rr-h1-zh mt-7">
            {t.h1a}
            <br />
            <span className="rr-gradient-text">{t.h1b}</span>
          </h1>
          <p className="rr-lead rr-lead-zh max-w-[720px] mx-auto mt-7">{t.lead}</p>
          <div className="rr-try-badges">
            {t.badges.map((b) => (
              <span key={b} className="rr-chip rr-chip-green">{b}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="rr-section-tight">
        <div className="rr-container max-w-[900px]">
          <GuestScan d={d} locale="zh" signals={feed.signals} live={feed.live} generatedAt={feed.generatedAt} historySeeded={feed.historySeeded} trendReady={feed.trendReady} recallSwitch={feed.recallSwitch} />
        </div>
      </section>

      <section className="rr-section-tight border-t border-[#e8e9f0]">
        <div className="rr-container">
          <div className="rr-section-head">
            <span className="rr-kicker">{t.whatKicker}</span>
            <h2 className="rr-h2 mt-3">{t.whatH2}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-[1080px] mx-auto">
            {t.whatItems.map((item) => (
              <div key={item.n} className="rr-card rr-card-hover p-7">
                <div className="rr-step-num">{item.n}</div>
                <h3 className="rr-h3 mt-5">{item.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#5c6273] mt-3">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rr-section-tight pb-24">
        <div className="rr-container max-w-[860px]">
          <div className="rr-card p-7 md:p-9">
            <span className="rr-kicker">{t.limitsKicker}</span>
            <h2 className="rr-h2 mt-3 !text-[28px]">{t.limitsH2}</h2>
            <div className="rr-try-limits">
              {t.limits.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
            <p className="rr-note mt-6">
              <Link href="/zh/methodology">查看评分方法 →</Link>
            </p>
          </div>
        </div>
      </section>

      {renderBreadcrumbSchema([
        { name: "首页", path: "/zh" },
        { name: "免费试用", path: "/zh/try" },
      ])}
    </>
  );
}
