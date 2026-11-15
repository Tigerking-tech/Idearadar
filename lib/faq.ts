/** 单一事实源：页面可见 FAQ 与 FAQPage 结构化数据共用，确保 Google/LLM 看到的内容一致。
 *  文案只描述当前真实实现：免注册 3 次、8 段可决策机会简报、实时检索按需生成简报、
 *  证据/推断/假设标注、按人群分组、可点回原文、公开合规数据源。
 *  未上线的能力（账号/付费/导入/监控/商业化 API/MCP/导出）一律不写成「已有」。 */
export const FAQ_ITEMS = [
  {
    q: "What is IdeaRadar?",
    a: "IdeaRadar turns real, public complaints into an 8-part, decision-ready opportunity brief: the scenario where someone gets stuck, the pain it costs, the workaround they use today, the root obstacle behind it (first principles), the smallest thing worth building, the cheapest way to disprove it, the signal that says stop, and why now. Every inference is tagged evidence / inference / assumption and links back to the verbatim wording and source. You can try it 3 times with no signup, or browse briefs grouped by the kind of person who would use them.",
  },
  {
    q: "How is this different from a keyword monitor or a raw forum feed?",
    a: "A raw feed shows you bug reports, news and job posts mixed together. IdeaRadar filters out that noise, then structures each real problem into an 8-part brief that separates what the person actually wrote from what is inferred. It does not run continuous monitoring, and it does not invent a market-size or severity score — if the evidence is thin, the brief leaves that field blank instead of filling it with advice.",
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
    q: "How is an opportunity brief produced from a complaint?",
    a: "Collected wording is filtered for noise, de-duplicated, and passed through an LLM denoise step. A second LLM step writes the 8-part brief strictly from that wording; a hard gate rejects filler advice ('build an MVP and find 3 users') and invented market numbers, falling back to a deterministic template instead. The brief's headline and first-step fields are derived from the brief itself, so they never drift apart. Nothing is passed off as a verbatim quote.",
  },
  {
    q: "What is an opportunity brief?",
    a: "It is 8 short fields that let you decide whether an idea is worth acting on: the scenario (When… I want… so I can…), the pain and what it costs, today's workaround, the root obstacle stripped of symptoms, the smallest build that removes that obstacle, the cheapest test that could disprove it, the stop signal, and any timing evidence (left blank when there is none). Each field is tagged evidence / inference / assumption and can be checked against the original quote with one tap. For a fresh live search the brief is not assumed: you get the quote, a source link and an 8-question judgement framework first, and can generate a full brief on demand. It is a judgement aid, not a validated business case; no market size or revenue numbers are invented.",
  },
  {
    q: "Why is some text in Chinese, and is it machine-translated?",
    a: "The public sources are mostly English. A scheduled translation step writes Chinese titles and quotes into the dataset, and you can toggle View original to read the exact English wording. Titles, translated quotes and the brief's wording all come from the same collected record, so they never drift apart.",
  },
  {
    q: "Do you provide accounts, monitoring, alerts, an API or MCP access?",
    a: "Not as a product. Those are ideas for a future version and are marked 'planned' on the pricing section — none of them are built. What works today is the free 3-scan demo, the open /opportunities.json dataset, and the internal endpoints that power the trial and on-demand brief generation. There is no account, continuous monitoring, alerting, paid API product or MCP endpoint.",
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
    a: "创意雷达把公开的真实抱怨整理成一份 8 段、能判断要不要动手的机会简报：谁在什么场景卡住、痛点让人付出什么、现在怎么凑合、剥开表象后的本质障碍（第一性原理）、最小值得造的那个东西、最便宜的证伪动作、什么信号出现就该放弃，以及为什么是现在。每段推断都标了「证据 / 推断 / 假设」，都能点回逐字原话与来源。免注册就能试 3 次，也可以按「谁会用」分组浏览，不用输入任何关键词。",
  },
  {
    q: "它和关键词监控、或者直接翻论坛有什么不一样？",
    a: "原始信息流里 bug 报告、新闻、招聘贴混在一起。创意雷达先滤掉这些噪音，再把真实问题拆成 8 段简报，把「对方到底写了什么」和「我们据此推断了什么」分开摆出来。它不做持续监控，也不编造市场规模或严重度评分 —— 证据不足时，对应字段会如实留白，不拿建议凑数。",
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
    q: "一条抱怨是怎么变成机会简报的？",
    a: "采集到的原话先做噪音过滤、去重，再经一道 LLM 去噪；随后第二道 LLM 严格依据这段原话写出 8 段简报。硬闸门会驳回「做个最小版本找 3 个人试用」这类万能套话和编造的市场数字，改为确定性模板兜底。简报的标题与「最小起步」字段都从简报本身派生，不会张冠李戴。绝不把归纳内容冒充逐字原话。",
  },
  {
    q: "什么是机会简报？",
    a: "它是 8 个短字段，帮你判断一个想法值不值得动手：具体场景（当……时，想……，以便……）、痛点及代价、现在怎么凑合、剥掉表象后的本质障碍、能消除该障碍的最小可造之物、最便宜的证伪动作、放弃信号，以及时间性证据（没有就留白）。每段都标「证据 / 推断 / 假设」，点一下就能对照原话核对。实时检索的新方向不会硬塞一份简报：先给原话、来源链接和 8 个判断框架问题，想要完整简报再点一下按需生成。它是辅助判断的工具，不是已验证的商业论证；不会编造市场规模或营收数字。",
  },
  {
    q: "为什么有中文？是机器翻译的吗？",
    a: "公开来源大多是英文。定时翻译步骤会把中文标题与原话写进数据产物，点「查看原文」即可读到确切英文。标题、译后原话与简报文字都来自同一条采集记录，不会出现张冠李戴。",
  },
  {
    q: "有账号、持续监控、告警、API 或 MCP 接入吗？",
    a: "没有作为产品提供。这些是以后可能做的方向，在页面里都标注为「规划中」，一个都还没上线。现在能用的是免费 3 次演示、开放的 /opportunities.json 完整数据，以及支撑试用与按需生成简报的内部接口。没有账号系统、持续监控、告警、付费 API 产品或 MCP 端点。",
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
