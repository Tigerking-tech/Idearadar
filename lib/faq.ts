/** 单一事实源：页面可见 FAQ 与 FAQPage 结构化数据共用，确保 Google/LLM 看到的内容一致。 */
export const FAQ_ITEMS = [
  {
    q: "What is IdeaRadar?",
    a: "IdeaRadar is a voice-of-customer research tool that turns real customer complaints into evidence-backed business opportunities. You pick a niche, we collect public discussions from forums, review sites and developer communities, cluster recurring complaints, score their severity, and map which existing products fail to solve them.",
  },
  {
    q: "How is IdeaRadar different from a Reddit keyword monitor?",
    a: "A keyword monitor tells you that a word was mentioned. IdeaRadar tells you which problem is worth solving: it groups similar complaints, scores severity and frequency, extracts explicit willingness-to-pay signals, links every finding back to its original post, and maps competitor weaknesses. It also runs as continuous monitoring rather than a one-off idea list.",
  },
  {
    q: "Which data sources does IdeaRadar use?",
    a: "The default connectors cover sources with clear public access terms: Hacker News (official API), Stack Exchange (official API), public GitHub issues and discussions, and any RSS/Atom feed you configure. Review-site and community connectors are opt-in and require your own licensed credentials. Reddit is disabled by default and is only enabled when you supply credentials covered by a Reddit commercial data license.",
  },
  {
    q: "Is scraping Reddit allowed, and how do you handle Reddit's API policy?",
    a: "Reddit's User Agreement prohibits unlicensed commercial scraping, and Reddit has announced that remaining public Data API access ends in March 2027 as apps move to its Developer Platform. IdeaRadar therefore does not depend on unlicensed Reddit access: the Reddit connector is off by default, requires you to provide your own authorised credentials, and every other connector is independent. A single platform changing its terms cannot disable the product.",
  },
  {
    q: "How is a pain point scored?",
    a: "Each pain point receives a 0-100 score combining frequency (how often it recurs across unrelated threads), intensity (emotional strength and language), recency, cross-source corroboration, and explicit willingness-to-pay signals. Findings below the quality threshold are rejected rather than shown, so the opportunity list stays short and verifiable.",
  },
  {
    q: "What is a one-line opportunity?",
    a: "Raw complaints are hard to act on, so each finding is rewritten into one plain-language idea: who has the problem, why there is room for a small tool, and the cheapest first step to test it. It is derived strictly from the collected wording; you can always expand the card to read the original quote and sources. No market size or revenue numbers are invented.",
  },
  {
    q: "Can I use my own support tickets, reviews or CSV data?",
    a: "Yes. You can import your own support conversations, call notes, survey exports and review CSVs. First-party data is the most defensible source because you already have the rights to use it, and it usually contains the buying language that public forums miss.",
  },
  {
    q: "Do you provide ongoing monitoring, alerts, an API or MCP access?",
    a: "Team plans include continuous monitoring with Slack, email and webhook alerts, plus a JSON API and an MCP endpoint so AI assistants can query your opportunity database directly. Pro plans include weekly digests and CSV/JSON export.",
  },
  {
    q: "Do I need to sign up to try IdeaRadar?",
    a: "No. You can run 3 scans straight from /try with no account, no email and no credit card. Guest scans read the same live ingest dataset as the rest of the site, and a vague direction triggers a fresh search of public discussions; the 3-scan count is stored on your device. After 3 scans, create a free account for 3 scans every month, or upgrade for unlimited scans.",
  },
  {
    q: "How much does IdeaRadar cost?",
    a: "The Free plan is $0 with 3 scans per month after signup. Pro is $49/month with unlimited scans, all compliant data sources, scoring, competitor gaps and exports. Team is $199/month with 5 seats, monitoring, webhooks, API and MCP access. All plans are billed through Creem as merchant of record, so sales tax and VAT handling are included.",
  },
] as const;

/** 中文版 FAQ：与英文版同为单一事实源，供 /zh 页面正文与 FAQPage 结构化数据共用。 */
export const FAQ_ITEMS_ZH = [
  {
    q: "创意雷达 是什么？",
    a: "创意雷达 是一款客户声音研究工具，把真实的用户抱怨转成有证据支撑的商机。你选定一个细分市场，我们从论坛、测评网站与开发者社区采集公开讨论，把反复出现的抱怨聚类，评估严重度，并标出哪些现有产品没能解决它。",
  },
  {
    q: "它和 Reddit 关键词监控有什么不一样？",
    a: "关键词监控只会告诉你某个词被提到了。创意雷达 回答的是「哪个问题值得解决」：把相似抱怨归组，给严重度与频率打分，抽取明确的付费意愿信号，把每条结论链回原帖，并标出竞品的弱点。它还是持续监控，而不是一次性给你一堆点子。",
  },
  {
    q: "创意雷达 用哪些数据源？",
    a: "默认连接器只覆盖访问条款清晰的公开来源：Hacker News（官方 API）、Stack Exchange（官方 API）、公开的 GitHub issue 与讨论，以及你自己配置的任意 RSS/Atom 订阅。测评网站与社区连接器需自行开通并提供合法授权凭证。Reddit 默认关闭，只有在你提供受 Reddit 商业数据许可覆盖的凭证时才会启用。",
  },
  {
    q: "抓取 Reddit 允许吗？你们怎么处理 Reddit 的 API 政策？",
    a: "Reddit 用户协议禁止未获许可的商业抓取，且 Reddit 已宣布剩余的公开数据 API 访问将于 2027 年 3 月终止、应用需迁入其开发者平台。因此 创意雷达 不依赖未授权的 Reddit 访问：Reddit 连接器默认关闭、需你自备授权凭证，其余每个连接器彼此独立。任何单一平台修改条款，都不会让产品停摆。",
  },
  {
    q: "痛点是怎么评分的？",
    a: "每个痛点得到一个 0–100 分，综合频率（在互不相关的帖子里重复出现多少次）、强度（情绪与措辞）、近期性、跨数据源印证，以及明确的付费意愿信号。低于质量阈值的结论会被拒绝而不是展示，让商机列表保持短且可核验。",
  },
  {
    q: "什么是一句话机会？",
    a: "原始抱怨很难直接拿来用，所以每条结论都会被改写成一句看得懂的点子：谁遇到这个麻烦、为什么还有做一个小工具的空间、以及成本最低的第一步怎么验证。它只依据采集到的原话推导，点开卡片随时能核对原文与来源；不会编造市场规模或营收数字。",
  },
  {
    q: "能导入我自己的客服工单、评论或 CSV 数据吗？",
    a: "可以。支持导入自有客服对话、通话记录、问卷导出与评论 CSV。第一方数据是最站得住脚的来源——你本来就拥有使用权限，而且它往往包含公开论坛里看不到的购买语言。",
  },
  {
    q: "提供持续监控、告警、API 或 MCP 接入吗？",
    a: "团队版包含持续监控，支持 Slack、邮件与 Webhook 告警，并提供 JSON API 和 MCP 端点，让 AI 助手直接查询你的商机库。专业版包含每周摘要与 CSV/JSON 导出。",
  },
  {
    q: "试用 创意雷达 需要先注册吗？",
    a: "不需要。打开 /zh/try 就能免注册扫描 3 次，不用账号、不留邮箱、不用信用卡。访客扫描读取的是和站内一致的真实采集数据，输入的方向太笼统时还会现场检索公开讨论；3 次额度记在本机设备上。用完 3 次后，注册免费账号可每月继续扫 3 次，升级后不限次数。",
  },
  {
    q: "创意雷达 多少钱？",
    a: "注册后免费版 $0，每月 3 次扫描。专业版 $49/月，不限次数扫描、开放全部合规数据源、评分、竞品空白与导出。团队版 $199/月，含 5 个席位、监控、Webhook、API 与 MCP 接入。所有套餐均通过 Creem 作为收款方计费，销售税与增值税处理已包含在内。",
  },
] as const;
