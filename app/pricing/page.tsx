import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { PricingSection, FaqSection, FinalCta } from "@/components/marketing/sections";

export const metadata = getSEOTags({
  title: "Pricing — IdeaRadar Plans & Creem Billing",
  description:
    "IdeaRadar pricing: try 3 niche scans free with no signup, Free $0/month (3 scans), Pro $49/month (unlimited scans, scoring, competitor gaps), Team $199/month (5 seats, monitoring, API and MCP). Billing by Creem.",
  canonicalUrlRelative: "/pricing",
  languages: { "en-US": "/pricing", "zh-CN": "/zh/pricing", "x-default": "/pricing" },
});

export default function PricingPage() {
  return (
    <>
      <section className="pt-16 pb-2 text-center">
        <div className="rr-container">
          <span className="rr-kicker">Pricing</span>
          <h1 className="rr-h2 mt-3">Plans that scale with your research</h1>
          <p className="rr-lead mt-4 text-[16px] max-w-[620px] mx-auto">
            Three plans: Free at $0/month, Pro at $49/month and Team at $199/month. All billing, VAT and
            sales tax are handled by Creem as merchant of record.
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
