/** 单一事实源：页面可见 FAQ 与 FAQPage 结构化数据共用，确保 Google/LLM 看到的内容一致。
 *  文案只描述当前真实实现：免注册 3 次、一句话点子、按人群分组、可点回原文、公开合规数据源。
 *  未上线的能力（账号/付费/导入/监控/API/MCP/导出）一律不写成「已有」。 */
export const FAQ_ITEMS = [
  {
    q: "What is IdeaRadar?",
    a: "IdeaRadar turns real, public questions and complaints into one-line business ideas you can actually read: who has the problem, the small tool you could build, and the cheapest first step. Every idea links back to the original discussion and source. You can try it 3 times with no signup, or just browse the ideas grouped by the kind of person who would use them.",
  },
  {
    q: "How is this different from a keyword monitor or a raw forum feed?",
    a: "A raw feed shows you bug reports, news and job posts mixed together. IdeaRadar filters out that noise and rewrites each real problem into one plain-language idea, then groups ideas by who would use them. It does not run continuous monitoring, and it does not invent a market-size or severity score — if the evidence is thin, the card says so.",
  },
  {
    q: "Which data sources does it use?",
    a: "A scheduled workflow collects from sources with clear public terms: Hacker News (official API), Stack Exchange (official API, including everyday Q&A sites about money, pets, travel and work), public GitHub issues, and any RSS/Atom feed you configure. Reddit is off by default and would require your own commercial-licence credentials.",
  },
  {
    q: "Is scraping Reddit allowed, and how do you handle Reddit's API policy?",
    a: "Reddit's User Agreement prohibits unlicensed commercial scraping, so the Reddit connector is off by default and requires you to supply authorised credentials. Every other connector is independent, so a single platform changing its terms cannot disable the product.",
  },
  {
    q: "How is an idea produced from a complaint?",
    a: "Collected wording is filtered for noise, de-duplicated, and passed through an LLM denoise step. A second LLM step writes the one-line idea (who, why, first step); if that step is unavailable, a deterministic template is used instead. Nothing is inferred as a verbatim quote, and no revenue or market-size numbers are invented.",
  },
  {
    q: "What is a one-line opportunity?",
    a: "Raw complaints are hard to act on, so each finding is rewritten into one plain-language idea: who has the problem, why there is room for a small tool, and the cheapest first step to test it. It is derived strictly from the collected wording; you can always expand the card to read the original quote and sources. No market size or revenue numbers are invented.",
  },
  {
    q: "Why is some text in Chinese, and is it machine-translated?",
    a: "The public sources are mostly English. A scheduled translation step writes Chinese titles and quotes into the dataset, and you can toggle View original to read the exact English wording. Titles, translated quotes and the one-line idea all come from the same collected record, so they never drift apart.",
  },
  {
    q: "Do you provide accounts, monitoring, alerts, an API or MCP access?",
    a: "Not yet. Those are ideas for a future version and are marked 'planned' on the pricing section — none of them are built. What works today is the free 3-scan demo and the open /opportunities.json dataset. There is no continuous monitoring, alerting, JSON API or MCP endpoint.",
  },
  {
    q: "Do I need to sign up to try IdeaRadar?",
    a: "No. Open /try to run 3 scans with no account, no email and no credit card. Guest scans read the same scheduled ingest dataset as the rest of the site, and a vague direction triggers a fresh search of public discussions; the 3-scan count is stored on your device. There is no account system to sign up for, and after 3 scans the full public dataset is still open to browse.",
  },
  {
    q: "How much does IdeaRadar cost?",
    a: "It is free. There is no account, no subscription, no paid plan and no checkout — the 3 free scans are simply how the public demo works, and the full collected dataset is open at /opportunities.json. IdeaRadar is a self-hostable open project, not a billed SaaS.",
  },
] as const;

/** 中文版 FAQ：与英文版同为单一事实源，供 /zh 页面正文与 FAQPage 结构化数据共用。 */
export const FAQ_ITEMS_ZH = [
  {
    q: "创意雷达 是什么？",
    a: "创意雷达把公开的真实提问与抱怨，整理成一句能读懂的点子：谁遇到这个麻烦、能做个什么小工具、最小第一步怎么试。每个点子都能点回原始讨论与来源。免注册就能试 3 次，也可以直接按「谁会用」分组浏览，不用输入任何关键词。",
  },
  {
    q: "它和关键词监控、或者直接翻论坛有什么不一样？",
    a: "原始信息流里 bug 报告、新闻、招聘贴混在一起。创意雷达先滤掉这些噪音，再把真实问题改写成一句大白话点子，并按「谁会用」分好组。它不做持续监控，也不编造市场规模或严重度评分 —— 证据不足时，卡片会如实说明。",
  },
  {
    q: "创意雷达 用哪些数据源？",
    a: "由定时工作流从访问条款清晰的公开来源采集：Hacker News（官方 API）、Stack Exchange（官方 API，含记账、宠物、差旅、职场等日常问答站点）、公开的 GitHub issue，以及任意可配置的 RSS/Atom 订阅。Reddit 默认关闭，需要你自备商业授权凭证才会启用。",
  },
  {
    q: "抓取 Reddit 允许吗？你们怎么处理 Reddit 的 API 政策？",
    a: "Reddit 用户协议禁止未获许可的商业抓取，因此 Reddit 连接器默认关闭、需你自备授权凭证。其余每个连接器彼此独立，任何单一平台修改条款都不会让产品停摆。",
  },
  {
    q: "一条抱怨是怎么变成点子的？",
    a: "采集到的原话先做噪音过滤、去重，再经一道 LLM 去噪；随后第二道 LLM 写出一句话点子（谁、为什么、第一步）。若该步骤不可用，则用确定性模板兜底。绝不把归纳内容冒充逐字原话，也绝不编造营收或市场规模数字。",
  },
  {
    q: "什么是一句话机会？",
    a: "原始抱怨很难直接拿来用，所以每条结论都会被改写成一句看得懂的点子：谁遇到这个麻烦、为什么还有做一个小工具的空间、以及成本最低的第一步怎么验证。它只依据采集到的原话推导，点开卡片随时能核对原文与来源；不会编造市场规模或营收数字。",
  },
  {
    q: "为什么有中文？是机器翻译的吗？",
    a: "公开来源大多是英文。定时翻译步骤会把中文标题与原话写进数据产物，点「查看原文」即可读到确切英文。标题、译后原话与一句话点子都来自同一条采集记录，不会出现张冠李戴。",
  },
  {
    q: "有账号、持续监控、告警、API 或 MCP 接入吗？",
    a: "目前还没有。这些是以后可能做的方向，在页面里都标注为「规划中」，一个都还没上线。现在能用的是免费 3 次演示，以及开放的 /opportunities.json 完整数据。没有持续监控、告警、JSON API 或 MCP 端点。",
  },
  {
    q: "试用 创意雷达 需要先注册吗？",
    a: "不需要。打开 /zh/try 就能免注册扫描 3 次，不用账号、不留邮箱、不用信用卡。访客扫描读取的是和站内一致的真实采集数据，输入的方向太笼统时还会现场检索公开讨论；3 次额度记在本机设备上。目前没有账号系统，3 次用完后完整公开数据依然开放浏览。",
  },
  {
    q: "创意雷达 多少钱？",
    a: "免费。没有账号、没有订阅、没有付费套餐，也没有收银台 —— 免费 3 次只是公开演示的工作方式，完整采集数据在 /opportunities.json 一直开放。创意雷达是一个可自行托管的开源项目，不是按套餐收费的 SaaS。",
  },
] as const;
