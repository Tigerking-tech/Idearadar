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
  title: "IdeaRadar — Turn real customer signals into validated business ideas",
  description:
    "IdeaRadar finds recurring customer signals across Reddit, Hacker News, review sites and support threads, scores their strength, and maps the competitor gaps worth building for. Every finding links to its source.",
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
