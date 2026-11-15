import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { FaqSection, FinalCta } from "@/components/marketing/sections";

export const metadata = getSEOTags({
  title: "FAQ — IdeaRadar data sources, opportunity briefs & the free trial",
  description:
    "Answers about IdeaRadar: what it does, how a complaint becomes an 8-part decision-ready opportunity brief, which public data sources are used, machine translation, the no-signup 3-scan trial, and which features are not built yet.",
  canonicalUrlRelative: "/faq",
  languages: { "en-US": "/faq", "zh-CN": "/zh/faq", "x-default": "/faq" },
});

export default function FaqPage() {
  return (
    <>
      <section className="pt-16 text-center">
        <div className="rr-container">
          <span className="rr-kicker">FAQ</span>
          <h1 className="rr-h2 mt-3">Frequently asked questions</h1>
          <p className="rr-lead mt-4 text-[16px] max-w-[620px] mx-auto">
            What works today, where the data comes from, and what is still only planned — in plain language.
          </p>
        </div>
      </section>
      <FaqSection />
      <FinalCta />
      {renderBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "FAQ", path: "/faq" },
      ])}
    </>
  );
}
