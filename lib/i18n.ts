/**
 * 中英文字典（纯数据，可安全从 Server Component 传给 Client Component）。
 *
 * 设计约束：
 * 1. 英文文案与改造前逐字一致，组件默认取 EN，现有英文页面行为零变化。
 * 2. 中英文各自是服务端静态渲染的完整 HTML，中文正文可被 Google 与 LLM 直接抓取，
 *    不做前端 JS 替换——否则 GEO 层拿不到中文内容。
 * 3. 字典内不含函数，保证可序列化。
 */

const EN = {
  locale: "en",
  brandHome: "IdeaRadar home",
  brand: "IdeaRadar",

  announcement: {
    region: "Announcement",
    text: "Stop guessing what to build — see what your market is already complaining about.",
    cta: "Try 3 scans free →",
    dismiss: "Dismiss announcement",
    ctaHref: "/try",
  },

  nav: {
    aria: "Main navigation",
    items: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Live preview", href: "/#live-preview" },
      { label: "Pricing", href: "/pricing" },
      { label: "Methodology", href: "/methodology" },
      { label: "FAQ", href: "/#faq" },
    ],
    signin: "Sign in",
    cta: "Try 3 scans free",
    ctaHref: "/try",
    menu: "Toggle navigation",
  },

  lang: {
    aria: "Language",
    en: "EN",
    zh: "中文",
    switchTo: "Switch language",
  },

  footer: {
    desc:
      "Evidence-backed market research: we turn real customer complaints into ranked opportunities, with source links, severity scores and competitor gaps attached.",
    billing: "Billing and tax handled by Creem as merchant of record.",
    groups: [
      {
        title: "Product",
        links: [
          { label: "Free trial", href: "/try" },
          { label: "How it works", href: "/#how-it-works" },
          { label: "Live preview", href: "/#live-preview" },
          { label: "Pricing", href: "/pricing" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Methodology", href: "/methodology" },
          { label: "Data sources", href: "/methodology#data-sources" },
          { label: "LLM site index", href: "/llms.txt" },
          { label: "HTML sitemap", href: "/sitemap.xml" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "/methodology#about" },
          { label: "Contact", href: "mailto:hello@idearadar.app" },
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
        ],
      },
    ],
    rights: "All rights reserved.",
    crawler: "Built for Google and AI crawlers · ",
  },

  hero: {
    eyebrow: "Your competitors are already listening",
    line1: "Find validated problems.",
    line2: "Ship winning products.",
    lead:
      "{app} turns real customer complaints from developer communities, review sites and support threads into ranked, evidence-backed business opportunities — with original quotes, willingness-to-pay signals and the exact competitor gaps nobody is filling.",
    cta1: "Try 3 scans free",
    cta2: "See live results",
    cta1Href: "/try",
    cta2Href: "#live-preview",
    note: "No signup required · 3 free scans · No credit card",
  },

  stats: [
    { num: "5", label: "Compliant connectors enabled by default" },
    { num: "0–100", label: "Evidence score on every pain point" },
    { num: "100%", label: "Findings linked to original sources" },
  ],

  preview: {
    kicker: "COMMUNITY SIGNALS → RANKED OPPORTUNITIES",
    h2a: "The pain points worth solving are ",
    h2b: "already online.",
    lead:
      "People describe broken workflows in their own words, in public, every day. We read those conversations, cluster recurring complaints, and rank them by how often they appear and how much frustration they carry — so you start from demand that already exists.",
    bullets: [
      "Every finding links back to the original thread",
      "Cross-source corroboration, not a single-platform echo",
      "Low-signal complaints are rejected, not padded into a list",
    ],
    methodLink: "Read the scoring methodology →",
    methodHref: "/methodology",
    scanHead: "OUTPUT PREVIEW · EXAMPLE FINDINGS",
    samplePains: "4 example pains",
    footLive:
      "Scheduled ingest produced {total} candidates ({sources}) · Updated {date}. The cards above show the output format with example data.",
    footSample: "Illustrative example of the output format — sample data, not live results.",
    dataLinkLabel: "View the live dataset →",
    dataLinkHref: "/opportunities.json",
    sample: [
      { label: "CRM tools are too complex for solo founders", score: 92 },
      { label: "Multi-currency invoices keep breaking exports", score: 87 },
      { label: "No clean way to export support chat transcripts", score: 81 },
      { label: "Booking tools lose recurring appointments", score: 74 },
    ],
  },

  steps: {
    kicker: "How it works",
    h2: "From raw complaints to a business case",
    lead: "Three steps, about five minutes per scan. No surveys, no cold DMs, no guessing.",
    items: [
      {
        n: "1",
        title: "Pick your market",
        text: "Choose communities, keywords, review sites or import your own support tickets and review CSVs. Start as narrow as a single profession or a single workflow.",
      },
      {
        n: "2",
        title: "AI clusters & scores",
        text: "We deduplicate complaints, score severity and frequency, extract explicit willingness-to-pay quotes, and reject anything below the quality threshold.",
      },
      {
        n: "3",
        title: "Get the gap map",
        text: "See who already tries to solve each problem, where their low-star reviews keep failing, and a prioritised opportunity brief you can act on the same day.",
      },
    ],
  },

  evidence: {
    kicker: "Evidence, not inspiration",
    h2: "What one opportunity looks like",
    chip: "Example output",
    chips: ["92 / 100 severity", "47 mentions", "4 sources"],
    title: "Solo founders keep abandoning CRMs during setup",
    quote: "“I just need to track 20 leads, not configure a 200-field enterprise instance.”",
    note: "Illustrative phrasing for layout demonstration. Live findings always carry a permalink to the original post and a verbatim quote.",
    wtpLabel: "WILLINGNESS-TO-PAY SIGNAL",
    wtpText:
      "A stated budget, an existing tool being paid for, or a described cost of the problem — extracted verbatim, never inferred.",
    competitorLabel: "COMPETITOR LANDSCAPE",
    competitors: [
      { name: "Category leader", gap: "Free tier gates the features solo users need" },
      { name: "Mid-market tool", gap: "Setup wizard assumes a sales team" },
      { name: "Spreadsheet templates", gap: "No sync, no pipeline view, manual upkeep" },
    ],
    gapScore: "Market gap score",
    gapNote: "Higher means more underserved.",
  },

  compare: {
    kicker: "Why teams switch",
    h2: "A search bar with extra steps is not research",
    manualTitle: "Manual thread reading",
    manualItems: [
      "Hours of scrolling through unfocused threads",
      "A folder of bookmarks with no ranking or deduplication",
      "No idea who already sells a solution",
      "Findings you cannot verify or share with a team",
      "Research stops the moment you get busy",
    ],
    rrTitle: "IdeaRadar",
    rrItems: [
      "Ranked, deduplicated pain points in about five minutes",
      "Verbatim quotes and permalinks on every finding",
      "Competitor map with documented recurring failures",
      "Continuous monitoring, alerts and structured export",
      "First-party data import so your insight is defensible",
    ],
  },

  roi: {
    title: "Manual research vs. IdeaRadar Pro",
    subtitle: "Drag the sliders to match your own research habits.",
    chip: "$49 / month flat",
    hours: "Hours spent reading threads per week",
    hoursAria: "Hours spent reading threads per week",
    rate: "Your time, per hour",
    rateAria: "Your hourly rate",
    manualCost: "Manual research (4 weeks)",
    toolCost: "IdeaRadar Pro",
    youSave: "You save",
    savedSuffix: "/mo",
    note: "Plus ranked evidence, source links and competitor gaps — not a folder of unread bookmarks.",
  },

  sources: {
    kicker: "Data sources",
    h2: "No single platform can switch you off",
    lead:
      "Reddit's public Data API access ends in March 2027 and unlicensed commercial scraping violates its terms. We built the ingestion layer multi-source from day one.",
    enabled: "On by default",
    optIn: "Opt-in only",
    items: [
      { name: "Hacker News", detail: "Official public API", state: "enabled" },
      { name: "Stack Exchange", detail: "Official public API", state: "enabled" },
      { name: "GitHub Issues", detail: "Public REST API", state: "enabled" },
      { name: "RSS / Atom feeds", detail: "Any feed you configure", state: "enabled" },
      { name: "Your own data", detail: "Tickets, reviews, CSV import", state: "enabled" },
      { name: "Reddit", detail: "Requires your commercial licence", state: "opt-in" },
    ],
    note1: "The scheduled ingestion workflow lives in ",
    noteCode: ".github/workflows/ingest.yml",
    note2: " and runs on GitHub-hosted runners, so collection continues even when your local network is restricted. See ",
    noteLink: "the methodology page",
    noteHref: "/methodology",
    note3: " for compliance details.",
  },

  pricing: {
    kicker: "Pricing",
    h2: "Start with 3 free scans. Upgrade when research becomes a habit.",
    lead: "Subscription billing, tax and invoicing are handled by Creem as merchant of record.",
    badge: "Most popular",
    footA: "All prices in USD. ",
    footSee: "See ",
    footLinkLabel: "the full plan comparison",
    footLinkHref: "/pricing",
    footDot: ".",
    footStandalone: "Questions about billing? Email us — we answer within one business day.",
    plans: [
      {
        name: "Free",
        cadence: "/ month",
        description: "For validating a single idea before you build.",
        features: ["3 free scans, no signup required", "1 data source", "Pain points with source links", "7-day data retention"],
        cta: "Try 3 scans free",
      },
      {
        name: "Pro",
        cadence: "/ month",
        description: "For founders who research a market every week.",
        features: [
          "Unlimited niche scans",
          "All compliant data sources",
          "Severity, frequency & WTP scoring",
          "Competitor gap mapping",
          "CSV / JSON export & weekly digest",
        ],
        cta: "Upgrade to Pro",
      },
      {
        name: "Team",
        cadence: "/ month",
        description: "For product and marketing teams running continuous monitoring.",
        features: [
          "Everything in Pro",
          "5 team seats",
          "Continuous monitoring & alerts",
          "Webhooks, API & MCP access",
          "Shared opportunity workspace",
        ],
        cta: "Talk to us",
      },
    ],
  },

  faq: {
    kicker: "FAQ",
    h2: "Questions founders ask us",
  },

  finalCta: {
    h2: "Your next product idea is already being complained about.",
    lead: "Run your first niche scan today. Keep the evidence, skip the guesswork.",
    cta1: "Try 3 scans free",
    cta1Href: "/try",
    cta2: "See how scoring works",
    cta2Href: "/methodology",
  },

  /** 免注册试用页：/try（英文）与 /zh/try（中文）共用同一套结构。 */
  tryPage: {
    kicker: "FREE TRIAL · NO SIGNUP",
    h1a: "Run 3 real scans.",
    h1b: "No account needed.",
    lead:
      "Not sure what to search? Pick a direction, or type a niche, a workflow or a tool category. IdeaRadar ranks the signals people repeat, quotes them, and shows where existing products keep failing. Three scans are free — no signup, no email, no credit card.",
    badges: ["No signup", "No credit card", "3 free scans"],
    cardHead: "GUEST SCAN",
    cardHeadLive: "LIVE FEED",
    remaining: "Free scans remaining",
    remainingOf: "of 3",
    scoreLabelShort: "score",
    inputLabel: "What do you want to scan?",
    inputPlaceholder: "e.g. CRM for solo founders, invoice export, CI logs…",
    inputHint: "Press Enter or use the button. Each run uses one free scan.",
    browseKicker: "NOT SURE WHAT TO SEARCH?",
    browseTitle: "Start from a direction",
    browseText: "No idea yet? Tap one — these are the angles people explore most. No typing required.",
    // query 是方向对应的检索词，交给 searchSignals 统一按内容命中排序。
    // 不再硬编码条目 id：真实采集的 id 与演示数据完全不同，按 id 取会一条都取不到。
    suggestions: [
      { label: "Solo-founder SaaS", sub: "Lean tools built alone", query: ["crm", "solo", "salesforce", "freelance"] },
      { label: "E-commerce & support", sub: "Checkout, invoices, tickets", query: ["invoice", "export", "support", "ticket", "checkout"] },
      { label: "Developer tools", sub: "CI, analytics, boards", query: ["webhook", "api", "ci", "oauth", "endpoint"] },
      { label: "Booking & collaboration", sub: "Scheduling, docs, mail", query: ["booking", "appointment", "scheduling", "calendar"] },
    ],
    surpriseLabel: "Surprise me with a random angle",
    orInputLabel: "…or type your own niche",
    examplesLabel: "Quick try",
    examples: ["CRM for solo founders", "Invoice export", "Booking tools", "CI logs"],
    run: "Run free scan",
    running: "Scanning…",
    runningSteps: ["Reading public discussions", "Clustering recurring complaints", "Scoring evidence"],
    resetDemo: "Demo only: reset local scan count",
    idleTitle: "Your ranked results will appear here",
    idleText:
      "Every finding carries a 0–100 evidence score, a verbatim signal, the sources it came from, and a documented competitor gap.",
    resultTitle: "Matching pain points for",
    resultOrderNote: "Ordered by relevance to your query. The number on the right is the 0–100 evidence score.",
    demoTag: "Demo dataset",
    noMatch: "No exact match in the demo dataset — showing the highest-scoring findings across all topics.",
    noMatchLive: "No exact match in the live dataset — showing the highest-scoring findings across all topics.",
    liveSearchTag: "Live search",
    liveModeLlm: "AI-summarised",
    liveModeRules: "Rule-filtered",
    liveNote: "Freshly retrieved from public discussions and not yet in the fixed index. Trend shows as Steady until snapshots accumulate.",
    liveRunningSteps: ["Searching public discussions", "Filtering noise and job posts", "Clustering recurring problems"],
    weakTitle: "Not in the fixed index",
    weakText: "The fixed dataset only covers 4 directions, so public discussions were searched live instead.",
    vagueTitle: "Name a concrete industry or workflow",
    vagueText: "That is not a searchable direction. Pick one below, or type something like \"pet sitting\" or \"CI for indie developers\".",
    liveEmptyTitle: "Not enough evidence in public discussions",
    liveEmptyText: "Hacker News, Stack Overflow and GitHub Issues were searched, but no clearly related complaints were found for this direction. Try a more specific phrase, or pick a direction below.",
    liveFailedTitle: "Live search is temporarily unavailable",
    liveFailedText: "This attempt did not use one of your free scans.",
    coveredTitle: "Directions currently indexed",
    liveSourcesLabel: "Sources",
    liveRetry: "Try again",
    scoreLabel: "Evidence score",
    mentions: "mentions",
    sourcesLabel: "Sources",
    quoteLabel: "VERBATIM SIGNAL",
    gapLabel: "COMPETITOR GAP",
    foot: "Guest scan uses a localised demo dataset so the output format reads the same in both languages. The scheduled ingest pipeline's live output is available at",
    footLive: "Live output is from the scheduled ingest pipeline across public, compliant sources. Full dataset with source links:",
    dataLinkLabel: "/opportunities.json",
    feedKicker: "DISCOVER WITHOUT TYPING",
    feedTitle: "Rising demand signals",
    feedText: "A live-style feed of the highest-scoring signals right now. Tap one to explore it — or pick a direction below.",
    feedLiveNote: "Live ingest output · generated",
    feedSeedNote: "Trend curves currently use sample history while live snapshots accumulate — replaced automatically as real data arrives.",
    feedTrendPending: "Trend needs at least 3 ingest snapshots; showing Steady until then.",
    feedRecallSwitch: "Ingest method changed recently — early points in the trend curve use an older data basis.",
    translatedNote: "Chinese titles and quotes are AI-translated from English.",
    viewOriginal: "View original",
    viewTranslation: "View translation",
    exploreLabel: "Explore",
    trendRising: "Rising",
    trendSteady: "Steady",
    trendPeaked: "Peaked",
    liveTag: "Live data",
    signupHref: "/signup",
    pricingHref: "/pricing",
    exhaustedKicker: "3 / 3 USED",
    exhaustedTitle: "You have used your 3 free scans",
    exhaustedText:
      "Create a free account to get 3 scans every month, or upgrade for unlimited scans, all compliant data sources and full exports.",
    ctaAccount: "Create a free account",
    ctaPlans: "Compare plans",
    exhaustedNote: "Your results from this session stay on this page until you close or refresh it.",
    whatKicker: "What the scan returns",
    whatH2: "The same output paid users get",
    whatItems: [
      { n: "01", title: "Ranked pain points", text: "Recurring complaints are deduplicated and ordered by a 0–100 evidence score, so the loudest real problems surface first." },
      { n: "02", title: "Verbatim evidence", text: "Each finding keeps the original wording and the sources behind it. Nothing is inferred or paraphrased into a nicer-sounding claim." },
      { n: "03", title: "Competitor gaps", text: "See what existing products already attempt, and the failure they keep repeating — the part worth building for." },
    ],
    limitsKicker: "Good to know",
    limitsH2: "What the free trial covers",
    limits: [
      "3 scans per device, no signup required",
      "Localised demo dataset; live collection starts after you create an account",
      "No credit card, no email, nothing stored on our servers",
    ],
  },
};

export type Dict = typeof EN;
export type Locale = "en" | "zh";

export const EN_DICT: Dict = EN;

export const ZH_DICT: Dict = {
  locale: "zh",
  brandHome: "创意雷达 首页",
  brand: "创意雷达",

  announcement: {
    region: "公告",
    text: "别再猜该做什么 —— 看看你的市场已经在抱怨什么。",
    cta: "免注册免费扫 3 次 →",
    dismiss: "关闭公告",
    ctaHref: "/zh/try",
  },

  nav: {
    aria: "主导航",
    items: [
      { label: "工作原理", href: "/zh#how-it-works" },
      { label: "实时预览", href: "/zh#live-preview" },
      { label: "定价", href: "/zh#pricing" },
      { label: "数据源", href: "/zh#data-sources" },
      { label: "常见问题", href: "/zh#faq" },
    ],
    signin: "登录",
    cta: "免费扫 3 次",
    ctaHref: "/zh/try",
    menu: "展开导航",
  },

  lang: {
    aria: "语言",
    en: "EN",
    zh: "中文",
    switchTo: "切换语言",
  },

  footer: {
    desc: "有证据支撑的市场调研：把真实的用户抱怨整理成可排序的商机，每条都附上原文链接、严重度评分与竞品空白。",
    billing: "计费与税费由 Creem 作为收款方处理。",
    groups: [
      {
        title: "产品",
        links: [
          { label: "免费试用", href: "/zh/try" },
          { label: "工作原理", href: "/zh#how-it-works" },
          { label: "实时预览", href: "/zh#live-preview" },
          { label: "定价", href: "/zh#pricing" },
        ],
      },
      {
        title: "资源",
        links: [
          { label: "数据源", href: "/zh#data-sources" },
          { label: "方法论", href: "/zh/methodology" },
          { label: "LLM 站点索引", href: "/llms.txt" },
          { label: "站点地图", href: "/sitemap.xml" },
        ],
      },
      {
        title: "公司",
        links: [
          { label: "关于我们", href: "/zh/methodology#about" },
          { label: "联系我们", href: "mailto:hello@idearadar.app" },
          { label: "隐私政策", href: "/zh/privacy" },
          { label: "服务条款", href: "/zh/terms" },
        ],
      },
    ],
    rights: "保留所有权利。",
    crawler: "面向 Google 与 AI 抓取优化 · ",
  },

  hero: {
    eyebrow: "你的竞品早就在听了",
    line1: "找到已被验证的痛点。",
    line2: "做出真正有人要的产品。",
    lead:
      "{app} 把来自开发者社区、测评网站与客服对话的真实用户抱怨，整理成可排序、有证据支撑的商机 —— 附带原文引用、付费意愿信号，以及目前尚无人填补的竞品空白。",
    cta1: "免注册免费扫 3 次",
    cta2: "查看实时结果",
    cta1Href: "/zh/try",
    cta2Href: "#live-preview",
    note: "无需注册 · 免费 3 次扫描 · 无需信用卡",
  },

  stats: [
    { num: "5", label: "默认启用的合规数据源" },
    { num: "0–100", label: "每条痛点的证据评分" },
    { num: "100%", label: "结论可回溯到原始出处" },
  ],

  preview: {
    kicker: "社区信号 → 排序后的商机",
    h2a: "值得解决的痛点，",
    h2b: "早就写在了网上。",
    lead:
      "每天都有人用大白话公开描述自己被卡住的流程。我们读取这些对话，把反复出现的抱怨聚类，按出现频率和情绪强度排序 —— 让你从已经存在的需求出发，而不是从猜测出发。",
    bullets: [
      "每条结论都能点回原始帖子",
      "跨数据源交叉印证，不是单一平台的回声",
      "低信号抱怨直接拒绝，不拿来凑数",
    ],
    methodLink: "查看评分方法 →",
    methodHref: "/zh/methodology",
    scanHead: "输出格式示意 · 评分示例",
    samplePains: "4 条示例",
    footLive:
      "定时采集工作流最近产出 {total} 条候选（{sources}）· 更新于 {date}。上方卡片为输出格式示意，使用示例数据。",
    footSample: "输出格式示意 —— 示例数据，非实时结果。",
    dataLinkLabel: "查看真实采集数据 →",
    dataLinkHref: "/opportunities.json",
    sample: [
      { label: "独立创业者觉得 CRM 配置太复杂", score: 92 },
      { label: "多币种发票导出总是出错", score: 87 },
      { label: "客服聊天记录没有干净的导出方式", score: 81 },
      { label: "预约工具会丢掉重复预约", score: 74 },
    ],
  },

  steps: {
    kicker: "工作原理",
    h2: "从零散抱怨到一份商业论证",
    lead: "三步，每次扫描约五分钟。不发问卷、不私信打扰、不靠猜。",
    items: [
      {
        n: "1",
        title: "选定你的市场",
        text: "选择社区、关键词、测评网站，或导入自己的客服工单与评论 CSV。可以窄到只盯一个职业、一条工作流。",
      },
      {
        n: "2",
        title: "AI 聚类并打分",
        text: "我们去重抱怨、给严重度与频率打分、抽取明确的付费意愿原话，并直接剔除低于质量阈值的内容。",
      },
      {
        n: "3",
        title: "拿到竞品空白图",
        text: "看清谁已经在解决这个问题、他们的差评反复栽在哪，以及一份当天就能动手的优先级商机简报。",
      },
    ],
  },

  evidence: {
    kicker: "要证据，不要灵感",
    h2: "一条商机长什么样",
    chip: "示例输出",
    chips: ["严重度 92 / 100", "47 次提及", "4 个来源"],
    title: "独立创业者在配置阶段就放弃了 CRM",
    quote: "「我只是想跟踪 20 条线索，不是要配置一个 200 字段的企业级系统。」",
    note: "此处措辞仅用于版式演示。真实结论一律附带原帖永久链接与逐字引用。",
    wtpLabel: "付费意愿信号",
    wtpText: "明确写出的预算、正在付费的现有工具，或问题造成的成本描述 —— 逐字抽取，绝不推断。",
    competitorLabel: "竞品格局",
    competitors: [
      { name: "品类头部", gap: "免费版把独立用户最需要的功能锁住了" },
      { name: "中端工具", gap: "配置向导默认你有一支销售团队" },
      { name: "表格模板", gap: "不同步、没有管道视图、全靠手工维护" },
    ],
    gapScore: "市场空白分",
    gapNote: "分数越高，说明需求越没被满足。",
  },

  compare: {
    kicker: "为什么团队会换过来",
    h2: "多几步的搜索框，不叫市场调研",
    manualTitle: "手动翻帖子",
    manualItems: [
      "在漫无边际的帖子里耗上几小时",
      "一堆收藏夹，没有排序也没有去重",
      "不知道谁已经在卖解决方案",
      "结论无法验证，也没法分享给团队",
      "一忙起来，调研就停了",
    ],
    rrTitle: "创意雷达",
    rrItems: [
      "约五分钟拿到排序、去重后的痛点",
      "每条结论带逐字引用与永久链接",
      "竞品地图附可查证的反复失败点",
      "持续监控、告警与结构化导出",
      "支持导入第一方数据，结论站得住脚",
    ],
  },

  roi: {
    title: "人工调研与 创意雷达 Pro 对比",
    subtitle: "拖动滑块，代入你自己的调研习惯。",
    chip: "$49 / 月，固定价",
    hours: "每周花在翻帖子上的小时数",
    hoursAria: "每周花在翻帖子上的小时数",
    rate: "你的每小时时间成本",
    rateAria: "你的小时费率",
    manualCost: "人工调研（4 周）",
    toolCost: "创意雷达 Pro",
    youSave: "你省下",
    savedSuffix: "/月",
    note: "还额外得到排序后的证据、原文链接与竞品空白 —— 而不是一文件夹没读过的收藏。",
  },

  sources: {
    kicker: "数据源",
    h2: "没有任何单一平台能掐断你",
    lead:
      "Reddit 公开数据 API 将于 2027 年 3 月终止，未获授权的商业抓取也违反其条款。我们从第一天起就把采集层做成了多源架构。",
    enabled: "默认开启",
    optIn: "需自行开通",
    items: [
      { name: "Hacker News", detail: "官方公开 API", state: "enabled" },
      { name: "Stack Exchange", detail: "官方公开 API", state: "enabled" },
      { name: "GitHub Issues", detail: "公开 REST API", state: "enabled" },
      { name: "RSS / Atom 订阅", detail: "任意可配置的订阅源", state: "enabled" },
      { name: "第一方数据", detail: "工单、评论、CSV 导入", state: "enabled" },
      { name: "Reddit", detail: "需自备商业授权凭证", state: "opt-in" },
    ],
    note1: "定时采集工作流位于 ",
    noteCode: ".github/workflows/ingest.yml",
    note2: "，跑在 GitHub 托管 runner 上，即使本地网络受限也能持续采集。合规细节见",
    noteLink: "方法论页面",
    noteHref: "/zh/methodology",
    note3: "。",
  },

  pricing: {
    kicker: "定价",
    h2: "先免费扫 3 次。当调研变成习惯再升级。",
    lead: "订阅计费、税费与发票由 Creem 作为收款方统一处理。",
    badge: "最受欢迎",
    footA: "价格均为美元，计费与开票由 Creem 负责。",
    footSee: "",
    footLinkLabel: "",
    footLinkHref: "",
    footDot: "",
    footStandalone: "关于计费有疑问？发邮件给我们，一个工作日内回复。",
    plans: [
      {
        name: "免费版",
        cadence: "/ 月",
        description: "适合在动手之前验证一个想法。",
        features: ["免费扫 3 次，无需注册", "1 个数据源", "痛点附原文链接", "数据保留 7 天"],
        cta: "免费扫 3 次",
      },
      {
        name: "专业版",
        cadence: "/ 月",
        description: "适合每周都要研究一个市场的创业者。",
        features: ["不限次数扫描", "全部合规数据源", "严重度、频率与付费意愿评分", "竞品空白地图", "CSV / JSON 导出与每周摘要"],
        cta: "升级专业版",
      },
      {
        name: "团队版",
        cadence: "/ 月",
        description: "适合需要持续监控的产品与市场团队。",
        features: ["包含专业版全部功能", "5 个团队席位", "持续监控与告警", "Webhook、API 与 MCP 接入", "共享商机工作台"],
        cta: "联系我们",
      },
    ],
  },

  faq: {
    kicker: "常见问题",
    h2: "创业者最常问的问题",
  },

  finalCta: {
    h2: "你的下一个产品点子，已经有人在网上抱怨了。",
    lead: "今天就跑第一次细分市场扫描。留下证据，跳过猜测。",
    cta1: "免注册免费扫 3 次",
    cta1Href: "/zh/try",
    cta2: "看看评分怎么算",
    cta2Href: "/zh/methodology",
  },

  tryPage: {
    kicker: "免费试用 · 无需注册",
    h1a: "先免费扫 3 次。",
    h1b: "不用注册账号。",
    lead:
      "还没想好要搜什么？先挑个方向，或输入一个细分市场、一条工作流或一类工具。创意雷达 会把人们反复提到的需求信号排序，附上原话，并标出现有产品持续栽跟头的地方。3 次扫描全免费 —— 不用注册、不留邮箱、不用信用卡。",
    badges: ["无需注册", "无需信用卡", "免费 3 次"],
    cardHead: "访客扫描",
    cardHeadLive: "实时信号",
    remaining: "剩余免费扫描次数",
    remainingOf: "/ 3 次",
    scoreLabelShort: "分",
    inputLabel: "你想扫描什么？",
    inputPlaceholder: "例如：独立创业者用的 CRM、发票导出、CI 日志……",
    inputHint: "按回车或点按钮即可开始，每次运行消耗 1 次免费额度。",
    browseKicker: "不知道要搜什么？",
    browseTitle: "先挑个方向看看",
    browseText: "还没灵感？直接点一个 —— 这些是大家最常看的方向，不用自己打字。",
    suggestions: [
      { label: "独立创业者小工具", sub: "一人可做的轻量工具", query: ["CRM", "独立", "创业", "Salesforce"] },
      { label: "电商与客服", sub: "结账、发票、工单", query: ["发票", "导出", "客服", "工单", "结账"] },
      { label: "开发者工具", sub: "CI、埋点、看板", query: ["接口", "构建", "webhook", "CI", "同步"] },
      { label: "预约与协作", sub: "排期、文档、邮件", query: ["预约", "排期", "预订", "日程"] },
    ],
    surpriseLabel: "随机给我一个方向",
    orInputLabel: "……或者自己输入一个方向",
    examplesLabel: "快速试一个",
    examples: ["独立创业者的 CRM", "发票导出", "预约工具", "CI 构建日志"],
    run: "开始免费扫描",
    running: "正在扫描…",
    runningSteps: ["读取公开讨论", "聚类反复出现的抱怨", "计算证据评分"],
    resetDemo: "演示用途：重置本机试用次数",
    idleTitle: "排序结果会出现在这里",
    idleText: "每条结论都带 0–100 证据评分、逐字原话、来源出处，以及有据可查的竞品空白。",
    resultTitle: "相关痛点：",
    resultOrderNote: "按与你输入的关键词的相关度排序；右侧数字为 0–100 证据评分。",
    demoTag: "演示数据集",
    noMatch: "演示数据集中没有完全匹配的细分市场，以下展示全库评分最高的结论。",
    noMatchLive: "当前实时数据里没有完全匹配的方向，以下展示全库评分最高的结论。",
    liveSearchTag: "实时检索",
    liveModeLlm: "大模型归纳",
    liveModeRules: "规则筛选",
    liveNote: "以下来自刚检索到的公开讨论，尚未进入固定索引；趋势需要多轮快照，暂显示为平稳。",
    liveRunningSteps: ["正在检索公开讨论", "过滤无关内容与招聘信息", "归纳反复出现的问题"],
    weakTitle: "固定索引没有覆盖这个方向",
    weakText: "当前固定数据只覆盖 4 个方向，已改为实时检索公开讨论。",
    vagueTitle: "请说一个具体的行业或工作流",
    vagueText: "这不是一个可检索的方向。可以点下面的方向，或输入例如「宠物寄养」「独立开发者的 CI」。",
    liveEmptyTitle: "公开讨论里暂时没找到足够证据",
    liveEmptyText: "已检索 Hacker News、Stack Overflow、GitHub Issues，没有找到与该方向明确相关的抱怨记录。换一个更具体的说法，或点下面的方向。",
    liveFailedTitle: "实时检索暂时不可用",
    liveFailedText: "本次没有消耗试用次数。",
    coveredTitle: "目前固定覆盖的方向",
    liveSourcesLabel: "来源",
    liveRetry: "重试",
    scoreLabel: "证据评分",
    mentions: "次提及",
    sourcesLabel: "来源",
    quoteLabel: "逐字原话",
    gapLabel: "竞品空白",
    foot: "访客扫描使用本地化的演示数据集，保证中英文输出格式一致。定时采集工作流产出的真实数据见",
    footLive: "实时数据来自定时采集管线，覆盖公开合规数据源。含来源链接的完整数据集：",
    dataLinkLabel: "/opportunities.json",
    feedKicker: "不用打字也能发现",
    feedTitle: "正在上升的需求信号",
    feedText: "一份按分数排序的实时风格信号流。点一个就能深入查看，也可以下滑挑个方向。",
    feedLiveNote: "实时采集产出 · 生成于",
    feedSeedNote: "趋势曲线暂用演示历史，真实采集积累后会自动替换。",
    feedTrendPending: "趋势需至少 3 次采集快照，攒够前统一显示「平稳」。",
    feedRecallSwitch: "近期更换过采集口径，趋势曲线早期数据点与当前口径不完全可比。",
    translatedNote: "中文标题与引语由 AI 从英文翻译，可随时切回原文核对。",
    viewOriginal: "查看原文",
    viewTranslation: "查看译文",
    exploreLabel: "深入查看",
    trendRising: "上升中",
    trendSteady: "平稳",
    trendPeaked: "已过峰",
    liveTag: "实时数据",
    signupHref: "/signup",
    pricingHref: "/zh/pricing",
    exhaustedKicker: "3 / 3 已用完",
    exhaustedTitle: "3 次免费扫描已经用完了",
    exhaustedText: "注册免费账号后每月可继续扫 3 次；升级后不限次数、开放全部合规数据源与完整导出。",
    ctaAccount: "注册免费账号",
    ctaPlans: "对比套餐",
    exhaustedNote: "本次会话的结果会保留在当前页面，关闭或刷新后清空。",
    whatKicker: "扫描会返回什么",
    whatH2: "和付费用户拿到的是同一种输出",
    whatItems: [
      { n: "01", title: "排序后的痛点", text: "重复的抱怨先去重，再按 0–100 证据评分排序，让最真实、最高频的问题排在最前面。" },
      { n: "02", title: "逐字证据", text: "每条结论保留原始措辞与来源出处，不做推断，也不改写成更好听的说法。" },
      { n: "03", title: "竞品空白", text: "看清现有产品已经尝试了什么，以及它们反复失败的那一环 —— 那才是值得动手的地方。" },
    ],
    limitsKicker: "使用前须知",
    limitsH2: "免费试用包含什么",
    limits: [
      "每台设备 3 次扫描，全程无需注册",
      "使用本地化演示数据集；注册账号后才会启动实时采集",
      "不用信用卡、不留邮箱，服务端不存储任何试用数据",
    ],
  },
};

export function getDict(locale: Locale): Dict {
  return locale === "zh" ? ZH_DICT : EN_DICT;
}

/** 英文页面路径 → 对应中文页面（营销页与试用页已全部中文化）。 */
const EN_TO_ZH: Record<string, string> = {
  "/": "/zh",
  "/try": "/zh/try",
  "/pricing": "/zh/pricing",
  "/faq": "/zh/faq",
  "/methodology": "/zh/methodology",
  "/privacy": "/zh/privacy",
  "/terms": "/zh/terms",
  "/signin": "/signin",
  "/signup": "/signup",
};

/** 中文页面路径 → 对应英文页面。 */
const ZH_TO_EN: Record<string, string> = {
  "/zh": "/",
  "/zh/try": "/try",
  "/zh/pricing": "/pricing",
  "/zh/faq": "/faq",
  "/zh/methodology": "/methodology",
  "/zh/privacy": "/privacy",
  "/zh/terms": "/terms",
};

/** 语言切换器的两个目标路径；同一页面的另一语言版本优先，回退到各自首页。 */
export function switchTargets(locale: Locale, pathname: string): { en: string; zh: string } {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  if (locale === "zh") return { en: ZH_TO_EN[p] ?? "/", zh: p };
  return { en: p, zh: EN_TO_ZH[p] ?? "/zh" };
}
