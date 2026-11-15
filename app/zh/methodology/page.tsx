import Link from "next/link";
import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { FinalCta } from "@/components/marketing/sections";
import { ZH_DICT } from "@/lib/i18n";

export const metadata = getSEOTags({
  title: "方法论 — 创意雷达 如何把公开抱怨变成可决策机会简报",
  description:
    "创意雷达 的真实工作方式：定时从公开 API 采集、噪音过滤与抱怨判定、LLM 去噪、8 段可决策机会简报生成与模板兜底、增量翻译、多快照趋势。含数据源合规说明与如实标注的已知限制。",
  canonicalUrlRelative: "/zh/methodology",
  languages: { "en-US": "/methodology", "zh-CN": "/zh/methodology", "x-default": "/methodology" },
  ogLocale: "zh_CN",
});

const PIPELINE = [
  ["采集", "定时任务查询官方公开 API，把结构化 JSON 写回仓库。"],
  ["过滤", "确定性规则先丢掉新闻、招聘、发行公告与模板套话，再保留带抱怨或求助信号的记录。"],
  ["去噪", "LLM 判定每条是否是真实用户问题；若驳回过多则整批回退保留（安全阀），且全程失败不阻断。"],
  ["成简报", "第二道 LLM 严格依据逐字原话写出 8 段可决策简报：具体场景、痛点、现在怎么凑合、本质障碍、最小可造之物、最便宜的验证、放弃信号、为什么是现在。硬闸门驳回万能套话与编造的市场数字；不可用时用确定性模板兜底。"],
  ["翻译", "增量翻译步骤把中文标题、原话与简报写进数据产物，用户可随时切回查看原文。"],
  ["趋势", "每次采集向 history.json 追加一个快照；真实快照攒够之前，趋势一律显示「平稳」。"],
] as const;

export default function ZhMethodologyPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container">
        <div className="max-w-[820px] mx-auto rr-prose">
          <span className="rr-kicker">方法论</span>
          <h1 className="rr-h2 mt-3 !text-[clamp(32px,4vw,48px)]">
            创意雷达 如何把公开抱怨变成可决策机会简报
          </h1>
          <p className="rr-lead mt-5">
            这一页如实说明 创意雷达 到底做了什么、用了哪些数据源，以及结论的边界在哪里。
            全文以平实、可核查的服务端静态文本写成，方便搜索引擎与 AI 助手准确引用。
          </p>
          <p className="rr-note">最后更新：2026 年 11 月 15 日。</p>

          <h2 id="about">这个产品实际做了什么</h2>
          <p>
            创意雷达 读取公开论坛与问答社区里、人们自发提出的真实提问与抱怨，把每条拆成一份 8 段机会简报，
            帮你判断一个想法值不值得动手。它先给「最小值得造的那个东西」，再给具体场景、痛点代价、
            剥开表象后的本质障碍，以及最便宜的证伪动作。每段推断都能点回逐字原话与原始讨论。
            它不编造市场规模、营收估算或严重度评分。这是一个免费、可自行托管的开源项目 —— 没有账号、没有订阅、没有收银台。
          </p>

          <h2 id="brief">8 段简报里到底有什么</h2>
          <p>
            每条已整理的方向都给出 8 个短字段：<strong>具体应用场景</strong>（当……时，想……，以便……）、
            <strong>痛点及代价</strong>、<strong>现在怎么凑合</strong>、<strong>剥掉表象后的本质障碍</strong>、
            <strong>能消除该障碍的最小可造之物</strong>、<strong>最便宜的证伪动作</strong>、
            <strong>什么信号出现就放弃</strong>、<strong>为什么是现在</strong>（原话没有时间性证据就留白）。
            每段都标注「证据 / 推断 / 假设」，推断可点回逐字原话自行核对，验证清单还能一键复制。
          </p>

          <h2 id="scoring">采集管线</h2>
          <p>
            每一步彼此独立，且都按「失败不阻断」设计：某道 LLM 不可用或输出非法时，管线保留确定性结果，
            而不是丢掉记录或让整轮采集失败。缓存里的简报每轮都会重新归一化，因此修过的文本清洗规则
            不会被一条旧缓存悄悄带回来。
          </p>
          <table>
            <thead>
              <tr>
                <th>阶段</th>
                <th>做了什么</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE.map(([name, detail]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td>{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 id="data-sources">数据源与合规</h2>
          <p>
            默认连接器只使用访问条款清晰的公开来源：Hacker News 官方 API、Stack Exchange 官方 API
            （含记账、宠物、差旅、职场等日常问答站点）、公开的 GitHub Issues API，以及任意可配置的
            RSS／Atom 订阅。因为是多源采集，任何单一平台修改条款都不会让产品停摆。
          </p>
          <p>
            Reddit 连接器<strong>默认关闭</strong>，需要你自备受 Reddit 商业数据授权覆盖的凭证。
            电商与本地生活评论（电商平台、餐饮与生活服务应用）没有面向此用途的合规公开接口，
            因此 创意雷达 不从这些来源采集 —— 没有的接口，我们不假装接了。
          </p>

          <h2>自动采集工作流</h2>
          <p>
            采集按计划运行于 GitHub 托管 runner 上的 <code>.github/workflows/ingest.yml</code>。
            工作流把结果归一化到统一结构、去重、滤噪、跑 LLM 去噪与简报生成、写入中文、再提交刷新后的 JSON。
            因为采集发生在 runner 而非本地工作站，本地网络受限时也能持续工作。若数据提交与其他推送撞车，
            并发保护会自动 rebase 后重试。
          </p>
          <p>
            完整结果是一个机器可读的纯文本文件 <code>/opportunities.json</code> —— 对所有人开放，
            不用登录、不限次数。没有 CSV 导出、Webhook、付费 JSON API 或 MCP 端点；那些是规划中的想法，
            不是已上线的功能。（试用页与「按需生成简报」按钮走的是内部接口，不是对外提供的 API 产品。）
          </p>

          <h2>输入固定索引之外的方向会怎样</h2>
          <p>
            如果你输入的方向不在固定数据里，免费试用会现场检索一次公开讨论。这些结果会明确标注为
            「实时检索 / 规则筛选」，<strong>不会</strong>被伪装成已验证、已入索引的点子 —— 质量低于夜间策展的数据。
            一条实时检索结果先给逐字原话、来源链接和 8 个判断框架问题；点「生成完整简报」会走一个独立接口，
            只为这一条补上同样的 8 段，不拖慢主检索。实时检索不可用或证据不足时，页面会如实说明而不是编造结果，
            且失败的尝试不扣 3 次免费额度。
          </p>

          <h2>如实标注的限制</h2>
          <p>
            机会简报是从采集原话出发的结构化判断辅助，不是已验证的商业论证，也不保证产品一定成功。
            其中「推断」字段是依据单条公开记录推理出来的，可能出错 —— 正因如此才要标注、才要能点回原话核对。
            部分来源本身就是冷门问答，生成的简报仍可能偏窄。中文为机器翻译，原始措辞始终可查。
            3 次额度只存在浏览器里，是演示用的限制，不是生产级配额。早期趋势曲线在真实快照攒够前使用引导样本，
            攒够后自动切换为真实数据。
          </p>

          <div className="rr-card p-6 mt-10 not-prose">
            <h3 className="rr-h3">继续阅读</h3>
            <ul className="mt-3 space-y-2 text-[14px]">
              <li><Link href="/zh/pricing">哪些免费、哪些还在规划 →</Link></li>
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
