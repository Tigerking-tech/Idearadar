import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { ZH_DICT } from "@/lib/i18n";
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

const title = "创意雷达 中文 — 把真实需求信号变成可验证的创业点子";
const description =
  "创意雷达 从开发者社区、测评网站与客服对话中采集反复出现的需求信号，聚类并按强度、频率与付费意愿打分，标出现有产品没能解决的竞品空白。每条结论都附原文链接。默认只用合规公开数据源，Reddit 需自备商业授权。";

/** 独立 URL 的服务端静态中文页：中文正文直接出现在初始 HTML 中，Google 与 LLM 均可抓取。 */
export const metadata = getSEOTags({
  title,
  description,
  keywords: [
    "用户抱怨分析",
    "客户声音",
    "商机挖掘",
    "痛点发现",
    "竞品空白",
    "Reddit 痛点",
    "SaaS 点子验证",
    "创意雷达",
  ],
  canonicalUrlRelative: "/zh",
  languages: { "en-US": "/", "zh-CN": "/zh", "x-default": "/" },
  ogLocale: "zh_CN",
  openGraph: { title, description, url: "/zh" },
});

export default function ZhHome() {
  const d = ZH_DICT;
  return (
    <>
      <Hero d={d} />
      <StatsBar d={d} />
      <LivePreview d={d} />
      <HowItWorks d={d} />
      <EvidenceSection d={d} />
      <ComparisonSection d={d} />
      <DataSourcesSection d={d} />
      <PricingSection d={d} />
      <FaqSection d={d} />
      <FinalCta d={d} />
      {renderBreadcrumbSchema([{ name: "首页", path: "/zh" }])}
    </>
  );
}
