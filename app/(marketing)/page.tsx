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
    "IdeaRadar surfaces real, public questions and complaints with the verbatim wording and a link to the original discussion. Indexed directions also carry a one-line idea; fresh live searches show the real quote first, never filler. Free to try, no signup.",
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
