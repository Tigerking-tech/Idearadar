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

const title = "创意雷达 中文 — 真实公开问题，附带可核对的原话与来源";
const description =
  "创意雷达 把公开论坛与问答社区里的真实提问和抱怨摆到你面前：逐字原话、来源，以及点回原始讨论的链接。已整理的方向另附一句大白话点子，实时检索的新方向先给原话，不拿套话充数。免注册免费试用 3 次，只用合规公开数据源。";

/** 独立 URL 的服务端静态中文页：中文正文直接出现在初始 HTML 中，Google 与 LLM 均可抓取。 */
export const metadata = getSEOTags({
  title,
  description,
  keywords: [
    "一句话点子",
    "公开问答挖掘",
    "创业点子发现",
    "抱怨变产品点子",
    "免注册点子工具",
    "可自托管趋势雷达",
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
