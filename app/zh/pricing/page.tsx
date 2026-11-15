import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { PricingSection, FaqSection, FinalCta } from "@/components/marketing/sections";
import { ZH_DICT } from "@/lib/i18n";

export const metadata = getSEOTags({
  title: "定价 — 创意雷达 免费使用，没有套餐可买",
  description:
    "创意雷达 免费：免注册 3 次扫描、开放的 /opportunities.json 完整数据，以及明确标注「规划中、尚未实现」的功能清单。没有账号、订阅或收银台。",
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
          <h1 className="rr-h2 mt-3">免费使用，没有套餐可买</h1>
          <p className="rr-lead mt-4 text-[16px] max-w-[620px] mx-auto">
            没有账号、没有订阅、也没有收银台。下面是现在真的能用的东西 —— 免费 3 次演示与开放数据 ——
            以及一份明确标注「规划中、尚未实现」的清单。
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
