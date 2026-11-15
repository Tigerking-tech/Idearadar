import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import {
  Hero,
  StatsBar,
  LivePreview,
  HowItWorks,
  EvidenceSection,
  ComparisonSection,
  DataSourcesSection,
  PricingSection,
  FaqSection,
  FinalCta,
} from "@/components/marketing/sections";

export const metadata = getSEOTags({
  title: "IdeaRadar — Real public problems, with the wording and source to check",
  description:
    "IdeaRadar turns real, public complaints into an 8-part, decision-ready opportunity brief: the scenario, the pain it costs, the root obstacle, the smallest thing worth building, the cheapest test and the stop signal. Every inference is tagged and links back to the verbatim quote and original discussion. Fresh live searches show the real wording first. Free to try, no signup.",
  canonicalUrlRelative: "/",
  languages: { "en-US": "/", "zh-CN": "/zh", "x-default": "/" },
});

/** 服务端静态渲染，全部正文出现在初始 HTML 中，便于 Google 与 LLM 抓取。 */
export default function Home() {
  return (
    <>
      <Hero />
      <StatsBar />
      <LivePreview />
      <HowItWorks />
      <EvidenceSection />
      <ComparisonSection />
      <DataSourcesSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      {renderBreadcrumbSchema([{ name: "Home", path: "/" }])}
    </>
  );
}
