import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `服务条款 — 创意雷达`,
  description: `创意雷达 服务条款：一个免费、开源、可自行托管的项目，无账号、无付费套餐，也不保证商业结果。`,
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
        <p className="rr-note">最后更新：2026 年 11 月 15 日。</p>

        <h2>免费使用，无需账号</h2>
        <p>
          创意雷达 是一个免费、开源、可自行托管的项目。没有账号、没有订阅、没有付费套餐，也没有收银台。
          公开演示允许任何访客免注册扫描 3 次；3 次额度是存在浏览器里的演示限制，不是生产级配额。
          现在能用的与仍在规划的，见<Link href="/zh/pricing">定价页面</Link>。
        </p>

        <h2>可接受使用</h2>
        <p>
          你可以把点子用于自己的调研与产品决策。不得转售原始采集语料、冒充社区成员，
          或利用本服务骚扰其公开帖子被分析的用户。引用结论时请尊重来源链接与原作者。
        </p>

        <h2>数据源责任</h2>
        <p>
          默认连接器使用访问条款清晰的公开来源。若你自行托管并启用需要凭证的可选连接器（包括 Reddit 连接器），
          你有责任持有相应授权并遵守该平台的条款。
        </p>

        <h2>不保证商业结果</h2>
        <p>
          一句话点子只是从公开措辞出发的起点，不是已验证的商业论证，也不保证产品一定成功。
          部分来源本身就是冷门问答，改写出的点子仍可能偏窄。中文为机器翻译。动手之前请自行独立验证需求。
        </p>

        <h2>联系我们</h2>
        <p>
          <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> · <Link href="/zh/privacy">隐私政策</Link>。
        </p>
      </div>
    </article>
  );
}
