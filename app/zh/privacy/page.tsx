import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `隐私政策 — 创意雷达`,
  description: `创意雷达 如何处理账户数据、导入的第一方数据与公开来源内容。`,
  canonicalUrlRelative: "/zh/privacy",
  languages: { "en-US": "/privacy", "zh-CN": "/zh/privacy", "x-default": "/privacy" },
  ogLocale: "zh_CN",
});

export default function ZhPrivacyPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container max-w-[760px] rr-prose">
        <span className="rr-kicker">法律条款</span>
        <h1 className="rr-h2 mt-3 !text-[36px]">隐私政策</h1>
        <p className="rr-note">最后更新：2026 年 11 月 11 日。</p>

        <h2>我们收集什么</h2>
        <p>
          账户信息（邮箱地址与认证标识）、你选择监控的细分市场与关键词，以及你导入的第一方数据。
          我们也会保存为你生成的公开来源结论，每条都附原始链接。
        </p>

        <h2>公开来源</h2>
        <p>
          我们只通过条款允许该用途的来源处理公开可访问的讨论，并且只保存永久链接与摘录，
          不全文转载原讨论串。Reddit 连接器默认关闭，需你自备已获授权的凭证。
        </p>

        <h2>你导入的数据</h2>
        <p>
          导入的数据仅作用于你自己的工作区，不用于训练共享模型。你可以随时导出或删除。
        </p>

        <h2>支付</h2>
        <p>
          支付、税费计算与开票由 Creem 作为收款方处理。我们不在自己的服务器上存储完整的银行卡信息。
        </p>

        <h2>联系我们</h2>
        <p>
          对本政策的疑问：<a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>。
          另见<Link href="/zh/terms">服务条款</Link>与<Link href="/zh/methodology">方法论页面</Link>。
        </p>
      </div>
    </article>
  );
}
