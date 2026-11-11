import Link from "next/link";
import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { EN_DICT } from "@/lib/i18n";
import { GuestScan } from "@/components/marketing/guest-scan";
import { resolveSignals } from "@/lib/signals";

export const dynamic = "force-dynamic";

const title = "Free trial — 3 niche scans, no signup | IdeaRadar";
const description =
  "Try IdeaRadar without an account: run 3 free niche scans, no signup and no credit card. Type a market or workflow and get ranked pain points with evidence scores, verbatim quotes, sources and competitor gaps.";

export const metadata = getSEOTags({
  title,
  description,
  keywords: [
    "free trial no signup",
    "customer complaint analysis free",
    "niche scan",
    "pain point research",
    "IdeaRadar free trial",
  ],
  canonicalUrlRelative: "/try",
  languages: { "en-US": "/try", "zh-CN": "/zh/try", "x-default": "/try" },
  openGraph: { title, description, url: "/try" },
});

export default function TryPage() {
  const d = EN_DICT;
  const t = d.tryPage;
  const feed = resolveSignals("en");
  return (
    <>
      <section className="rr-grid-bg border-b border-[#e8e9f0]">
        <div className="rr-container pt-[72px] pb-14 md:pt-[92px] md:pb-16 text-center">
          <span className="rr-eyebrow">{t.kicker}</span>
          <h1 className="rr-h1 mt-7">
            {t.h1a}
            <br />
            <span className="rr-gradient-text">{t.h1b}</span>
          </h1>
          <p className="rr-lead max-w-[720px] mx-auto mt-7">{t.lead}</p>
          <div className="rr-try-badges">
            {t.badges.map((b) => (
              <span key={b} className="rr-chip rr-chip-green">{b}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="rr-section-tight">
        <div className="rr-container max-w-[900px]">
          <GuestScan d={d} locale="en" signals={feed.signals} live={feed.live} generatedAt={feed.generatedAt} />
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
              <Link href="/methodology">Read the scoring methodology →</Link>
            </p>
          </div>
        </div>
      </section>

      {renderBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Free trial", path: "/try" },
      ])}
    </>
  );
}
