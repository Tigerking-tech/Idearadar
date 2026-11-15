import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `隐私政策 — 创意雷达`,
  description: `创意雷达 如何处理数据：无账号、试用数据不存服务器、公开来源只保留链接与摘录。`,
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
        <p className="rr-note">最后更新：2026 年 11 月 15 日。</p>

        <h2>一句话说明</h2>
        <p>
          创意雷达 没有账号，也没有付费套餐。你可以免注册试用 3 次，不用留邮箱、不用填信用卡。
          我们的服务器上没有存放你个人数据的用户数据库。
        </p>

        <h2>哪些数据只留在你的设备上</h2>
        <p>
          免费试用次数、你输入过的方向、以及本次会话展示的结果，都保存在你的浏览器（localStorage）并渲染在页面上。
          试用过程不会在服务端留下任何记录。清除站点数据即可重置 3 次额度。我们不投放广告，也不设置跨站追踪 cookie。
        </p>

        <h2>公开来源</h2>
        <p>
          点子来自通过条款允许该用途的来源采集的公开讨论，我们只保留永久链接和一小段摘录，不全文转载原讨论串。
          Reddit 连接器默认关闭，需你自备已获授权的凭证。中文标题与原话为机器翻译，随时可点「查看原文」读回确切措辞。
        </p>

        <h2>没有导入数据，也没有支付</h2>
        <p>
          没有第一方数据导入、没有账户数据、也没有收银台。既然没有订阅，我们或任何收款方都不会收集或处理支付、账单信息。
        </p>

        <h2>开放数据</h2>
        <p>
          完整采集结果是一个公开的机器可读文件 <code>/opportunities.json</code>，只包含公开来源内容与据此生成的点子，不含访客数据。
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
