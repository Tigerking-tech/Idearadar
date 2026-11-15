import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { PricingSection, FaqSection, FinalCta } from "@/components/marketing/sections";

export const metadata = getSEOTags({
  title: "Pricing — IdeaRadar is free, no plans to buy",
  description:
    "IdeaRadar is free: 3 scans with no signup, an open /opportunities.json dataset, and a clearly marked list of features that are planned but not built. No account, no subscription, no checkout.",
  canonicalUrlRelative: "/pricing",
  languages: { "en-US": "/pricing", "zh-CN": "/zh/pricing", "x-default": "/pricing" },
});

export default function PricingPage() {
  return (
    <>
      <section className="pt-16 pb-2 text-center">
        <div className="rr-container">
          <span className="rr-kicker">Pricing</span>
          <h1 className="rr-h2 mt-3">Free to use, no plans to buy</h1>
          <p className="rr-lead mt-4 text-[16px] max-w-[620px] mx-auto">
            There is no account, no subscription and no checkout. Below is what works today — a free 3-scan
            demo and an open dataset — plus a clearly marked list of things that are planned but not built.
          </p>
        </div>
      </section>
      <PricingSection standalone />
      <FaqSection />
      <FinalCta />
      {renderBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Pricing", path: "/pricing" },
      ])}
    </>
  );
}
