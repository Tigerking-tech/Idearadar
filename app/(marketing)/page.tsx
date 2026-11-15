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
  title: "IdeaRadar — One-line business ideas from real public discussions",
  description:
    "IdeaRadar turns real, public questions and complaints into one-line business ideas: who has the problem, the small tool you could build, and the cheapest first step. Every idea links back to its source. Free to try, no signup.",
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
