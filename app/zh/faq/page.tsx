import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { FaqSection, FinalCta } from "@/components/marketing/sections";
import { ZH_DICT } from "@/lib/i18n";

export const metadata = getSEOTags({
  title: "常见问题 — 创意雷达 数据源、Reddit 政策与计费",
  description:
    "关于 创意雷达 的常见问题：产品用途、痛点如何评分、使用哪些数据源、Reddit API 合规、第一方数据导入、API 与 MCP 接入，以及 Creem 计费。",
  canonicalUrlRelative: "/zh/faq",
  languages: { "en-US": "/faq", "zh-CN": "/zh/faq", "x-default": "/faq" },
  ogLocale: "zh_CN",
});

export default function ZhFaqPage() {
  return (
    <>
      <section className="pt-16 text-center">
        <div className="rr-container">
          <span className="rr-kicker">常见问题</span>
          <h1 className="rr-h2 mt-3">常见问题</h1>
          <p className="rr-lead mt-4 text-[16px] max-w-[620px] mx-auto">
            关于产品、数据合规、评分与计费，用大白话一次讲清楚。
          </p>
        </div>
      </section>
      <FaqSection d={ZH_DICT} />
      <FinalCta d={ZH_DICT} />
      {renderBreadcrumbSchema([
        { name: "首页", path: "/zh" },
        { name: "常见问题", path: "/zh/faq" },
      ])}
    </>
  );
}
