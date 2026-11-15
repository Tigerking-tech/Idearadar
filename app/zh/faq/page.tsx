import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { FaqSection, FinalCta } from "@/components/marketing/sections";
import { ZH_DICT } from "@/lib/i18n";

export const metadata = getSEOTags({
  title: "常见问题 — 创意雷达 数据源、机会简报与免费试用",
  description:
    "关于 创意雷达 的常见问题：产品做了什么、抱怨如何变成 8 段可决策机会简报、用哪些公开数据源、机器翻译、免注册 3 次试用，以及哪些功能还没上线。",
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
            现在能用的、数据从哪来、还有哪些只在规划中 —— 用大白话一次讲清楚。
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
