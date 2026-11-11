import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `服务条款 — 创意雷达`,
  description: `创意雷达 的订阅条款、可接受使用规范与数据源责任说明。`,
  canonicalUrlRelative: "/zh/terms",
  languages: { "en-US": "/terms", "zh-CN": "/zh/terms", "x-default": "/terms" },
  ogLocale: "zh_CN",
});

export default function ZhTermsPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container max-w-[760px] rr-prose">
        <span className="rr-kicker">法律条款</span>
        <h1 className="rr-h2 mt-3 !text-[36px]">服务条款</h1>
        <p className="rr-note">最后更新：2026 年 11 月 11 日。</p>

        <h2>订阅</h2>
        <p>
          付费套餐按月自动续订，直至取消。计费、退款、增值税与销售税由 Creem 作为收款方管理。
          各套餐的额度见<Link href="/zh/pricing">定价页面</Link>。
        </p>

        <h2>可接受使用</h2>
        <p>
          你可以把结论用于自己的调研与产品决策。不得转售原始抓取语料、冒充社区成员，
          或利用本服务骚扰其帖子被分析的用户。
        </p>

        <h2>数据源责任</h2>
        <p>
          默认连接器使用访问条款清晰的公开来源。若你启用需要凭证的可选连接器（包括 Reddit 连接器），
          你有责任持有相应授权并遵守该平台的条款。
        </p>

        <h2>不保证商业结果</h2>
        <p>
          评分与商机简报是决策辅助，不保证产品一定成功。动手之前请自行独立验证需求。
        </p>

        <h2>联系我们</h2>
        <p>
          <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> · <Link href="/zh/privacy">隐私政策</Link>。
        </p>
      </div>
    </article>
  );
}
