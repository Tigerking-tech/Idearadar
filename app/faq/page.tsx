import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { FaqSection, FinalCta } from "@/components/marketing/sections";

export const metadata = getSEOTags({
  title: "FAQ — IdeaRadar Data Sources, Reddit Policy & Billing",
  description:
    "Answers about IdeaRadar: what it does, how pain points are scored, which data sources are used, Reddit API compliance, first-party data import, API/MCP access, and Creem billing.",
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
            Product, data compliance, scoring and billing — answered in plain language.
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
