import Link from "next/link";
import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { FinalCta } from "@/components/marketing/sections";
import { ZH_DICT } from "@/lib/i18n";

export const metadata = getSEOTags({
  title: "方法论 — 创意雷达 如何给痛点打分与选择数据源",
  description:
    "创意雷达 评分方法：出现频率、情绪强度、时效性、跨源印证与付费意愿信号合成 0–100 证据分。含数据源合规政策、Reddit API 时间线与自动采集工作流说明。",
  canonicalUrlRelative: "/zh/methodology",
  languages: { "en-US": "/methodology", "zh-CN": "/zh/methodology", "x-default": "/methodology" },
  ogLocale: "zh_CN",
});

const SCORE_DIMENSIONS = [
  ["出现频率", "30%", "同一抱怨在互不相关的讨论中重复出现的次数，去重后统计。"],
  ["情绪强度", "20%", "情绪词、紧迫措辞，以及问题造成的实际后果描述。"],
  ["时效性", "15%", "近期讨论权重高于历史讨论，过时的问题逐步衰减。"],
  ["跨源印证", "20%", "同一问题出现在相互独立、互不引用的多个平台上。"],
  ["付费意愿", "15%", "明确写出的预算、正在付费的工具或量化的成本。推断意图计零分。"],
] as const;

const REDDIT_TIMELINE = [
  ["2023 年", "Reddit 开始对高频商业 API 调用收费，多个第三方客户端关停。"],
  ["2025 年 6 月", "Reddit 起诉 Anthropic 未经授权商业抓取用户内容。"],
  ["2025 年 11 月", "GummySearch 公告因未取得商业数据 API 授权而关停。"],
  ["2026 年 10 月", "Reddit 停止受理新的公开 API 访问申请。"],
  ["2026 年 11 月", "Reddit 终止 RSS 订阅支持。"],
  ["2027 年 3 月", "剩余公开 Data API 访问终止，第三方应用迁往开发者平台。"],
] as const;

export default function ZhMethodologyPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container">
        <div className="max-w-[820px] mx-auto rr-prose">
          <span className="rr-kicker">方法论</span>
          <h1 className="rr-h2 mt-3 !text-[clamp(32px,4vw,48px)]">
            创意雷达 如何把用户抱怨变成 0–100 证据分
          </h1>
          <p className="rr-lead mt-5">
            这一页完整说明 创意雷达 测量什么、使用哪些数据源，以及自动采集工作流背后的合规规则。
            全文以平实、可核查的服务端静态文本写成，方便搜索引擎与 AI 助手准确引用。
          </p>
          <p className="rr-note">最后更新：2026 年 11 月 11 日。</p>

          <h2 id="about">什么是痛点？</h2>
          <p>
            痛点是人们在没有问卷引导的情况下，公开用自己的话反复描述的具体问题。
            创意雷达 只统计自发讨论中出现的抱怨；仅仅提到某个关键词的帖子不算痛点。
            采集层会先排除新闻标题、发行公告、开发工单与 CI 日志，再从正文判断是否存在抱怨信号。
          </p>

          <h2>什么是竞品空白？</h2>
          <p>
            竞品空白指一个既被频繁抱怨、又被所有已知解决方案处理得很差的问题。
            对每条痛点，我们会列出已经在解决它的产品，并根据差评与抱怨讨论归纳它们反复失败的地方。
          </p>

          <h2>什么是付费意愿信号？</h2>
          <p>
            付费意愿（WTP）信号是逐字写出的预算、正在付费的工具，或问题造成的量化成本。
            它是判断一条抱怨能否成为商机最可靠的单一指标。创意雷达 逐字抽取 WTP 表述，绝不从语气推断。
          </p>

          <h2 id="scoring">评分模型</h2>
          <p>
            每条候选痛点得到 0 到 100 的分数。低于质量阈值的结论会被直接拒绝而不展示，
            让商机清单保持短且可验证。
          </p>
          <table>
            <thead>
              <tr>
                <th>维度</th>
                <th>权重</th>
                <th>衡量内容</th>
              </tr>
            </thead>
            <tbody>
              {SCORE_DIMENSIONS.map(([name, weight, detail]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td>{weight}</td>
                  <td>{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 id="data-sources">数据源与合规</h2>
          <p>
            默认开启的连接器只使用访问条款清晰的公开来源：Hacker News 官方 API、
            Stack Exchange 官方 API、公开的 GitHub Issues API，以及自行配置的 RSS／Atom 订阅源。
            你还可以导入第一方数据 —— 客服工单、通话记录、问卷导出与评论 CSV，因为你本来就持有这些数据的权利。
          </p>
          <p>
            Reddit 连接器<strong>默认关闭</strong>，仅在提供受 Reddit 商业数据授权覆盖的凭证时才启用。
            Reddit 用户协议禁止未经授权的商业抓取，平台也正在关闭公开数据访问。
            因此任何单一平台修改条款，都无法让本产品停摆。
          </p>
          <p>
            需要特别说明：Apify、Bright Data、Anysite 这类第三方抓取服务商<strong>不是 Reddit 授权渠道</strong>，
            购买其取数服务不会洗掉权利瑕疵。第三方抓取通道在工程上也是军备竞赛，
            不应作为收费产品的数据地基。
          </p>

          <h2>Reddit 数据政策时间线</h2>
          <table>
            <thead>
              <tr><th>时间</th><th>事件</th></tr>
            </thead>
            <tbody>
              {REDDIT_TIMELINE.map(([date, event]) => (
                <tr key={date}><td><strong>{date}</strong></td><td>{event}</td></tr>
              ))}
            </tbody>
          </table>

          <h2>自动采集工作流</h2>
          <p>
            采集按计划运行于 GitHub 托管 runner 上的 <code>.github/workflows/ingest.yml</code>。
            各连接器彼此独立；工作流把结果归一化到统一结构、按语义相似度去重、套用上面的评分模型，
            并写出结构化 JSON。因为采集发生在 runner 而非本地工作站，本地网络受限时也能持续工作。
          </p>
          <p>
            结构化输出面向下游使用：专业版提供 CSV 与 JSON 导出，团队版另有 Webhook、
            JSON API 与 MCP 端点，便于 AI 助手直接查询商机库。
          </p>

          <h2>持续监控与一次性点子清单</h2>
          <p>
            一次性点子清单只回答一次「我可以做什么」。创意雷达 围绕持续监控构建：
            同一细分市场按计划重复扫描，新抱怨与历史结果做差分，重要变化通过 Slack、邮件或 Webhook 推送。
            这让市场调研成为可重复的工作流，而不是一次性的消费。
          </p>

          <h2>补充数据源的接入优先级</h2>
          <p>
            按合规成本从低到高排序：① 客服工单与第一方数据（零平台风险，也是最难被通用工具复制的壁垒）；
            ② 官方开放 API（Hacker News、Stack Exchange、GitHub Issues、YouTube Data、News／GDELT）；
            ③ 需要商业谈判的来源（Reddit 商业数据协议、X 官方 API）；
            ④ 不接入 —— 电商评论的使用条款普遍禁止自动化抓取。
          </p>

          <div className="rr-card p-6 mt-10 not-prose">
            <h3 className="rr-h3">继续阅读</h3>
            <ul className="mt-3 space-y-2 text-[14px]">
              <li><Link href="/zh/pricing">套餐与功能对比 →</Link></li>
              <li><Link href="/zh/faq">常见问题 →</Link></li>
              <li><Link href="/llms.txt">LLM 可读站点索引（llms.txt）→</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <FinalCta d={ZH_DICT} />
      {renderBreadcrumbSchema([
        { name: "首页", path: "/zh" },
        { name: "方法论", path: "/zh/methodology" },
      ])}
    </article>
  );
}
