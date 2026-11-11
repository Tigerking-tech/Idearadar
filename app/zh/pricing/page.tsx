import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { PricingSection, FaqSection, FinalCta } from "@/components/marketing/sections";
import { ZH_DICT } from "@/lib/i18n";

export const metadata = getSEOTags({
  title: "定价 — 创意雷达 套餐与 Creem 计费",
  description:
    "创意雷达 定价：免注册先免费扫 3 次；免费版 $0/月（每月 3 次扫描）、专业版 $49/月（不限扫描、评分、竞品空白）、团队版 $199/月（5 席位、监控、API 与 MCP）。由 Creem 收款。",
  canonicalUrlRelative: "/zh/pricing",
  languages: { "en-US": "/pricing", "zh-CN": "/zh/pricing", "x-default": "/pricing" },
  ogLocale: "zh_CN",
});

export default function ZhPricingPage() {
  return (
    <>
      <section className="pt-16 pb-2 text-center">
        <div className="rr-container">
          <span className="rr-kicker">定价</span>
          <h1 className="rr-h2 mt-3">按研究深度选择的套餐</h1>
          <p className="rr-lead mt-4 text-[16px] max-w-[620px] mx-auto">
            三档套餐：免费版 $0/月、专业版 $49/月、团队版 $199/月。
            订阅计费、增值税与销售税由 Creem 作为收款方统一处理。
          </p>
        </div>
      </section>
      <PricingSection standalone d={ZH_DICT} />
      <FaqSection d={ZH_DICT} />
      <FinalCta d={ZH_DICT} />
      {renderBreadcrumbSchema([
        { name: "首页", path: "/zh" },
        { name: "定价", path: "/zh/pricing" },
      ])}
    </>
  );
}
