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
      "Not sure what to build? Start from one plain-language idea: who has the problem, the small tool you could make, and the cheapest first step. Every idea links back to the original wording. Three scans are free — no signup, no email, no credit card.",
    badges: ["No signup", "No credit card", "3 free scans"],
    cardHead: "GUEST SCAN",
    cardHeadLive: "LIVE FEED",
    remaining: "Free scans remaining",
    remainingOf: "of 3",
    scoreLabelShort: "score",
    inputLabel: "What do you want to scan?",
    inputPlaceholder: "e.g. pet care records, booking changes, tracking subscriptions…",
    inputHint: "Press Enter or use the button. Each run uses one free scan.",
    browseKicker: "NOT SURE WHAT TO SEARCH?",
    browseTitle: "Start with who has the problem",
    browseText: "No idea yet? Pick the kind of person or situation you care about — no typing needed.",
    // 方向卡改成「人 + 场景」：query 用真实采集里出现过的普通词，
    // 不再有 CI / webhook / 埋点这类技术黑话，也不再按演示数据的短 id 取条目。
    suggestions: [
      { label: "People tracking bills & subscriptions", sub: "Recurring charges, receipts, budgets", query: ["subscription", "expense", "receipt", "budget", "reimbursement"], persona: "budget-keeper" },
      { label: "Pet owners & home care", sub: "Care records, reminders, vet visits", query: ["pet", "records", "care", "reminder", "vaccination"], persona: "pet-owner" },
      { label: "Small shops taking bookings", sub: "Appointments, changes, no-shows", query: ["booking", "appointment", "scheduling", "calendar", "cancel"], persona: "service-owner" },
      { label: "Anyone buried in personal admin", sub: "Contacts, photos, files, forms", query: ["contacts", "export", "organize", "files", "spreadsheet"], persona: "home-organizer" },
    ],
    surpriseLabel: "Surprise me with a random angle",
    orInputLabel: "…or type your own niche",
    examplesLabel: "Quick try",
    examples: ["Tracking my subscriptions", "Pet care records", "Booking changes", "Exporting contacts"],
    run: "Run free scan",
    running: "Scanning…",
    runningSteps: ["Reading public discussions", "Clustering recurring complaints", "Scoring evidence"],
    resetDemo: "Demo only: reset local scan count",
    idleTitle: "Your ranked results will appear here",
    idleText:
      "Each result opens with one plain-language idea: who has the problem, why there is room, and the smallest first step. Expand it to read the original wording and sources.",
    resultTitle: "Ideas for",
    resultOrderNote: "Ordered by relevance to your query. The number on the right is the 0–100 evidence score.",
    demoTag: "Demo dataset",
    noMatch: "No exact match in the current index — showing the highest-scoring findings across all topics.",
    noMatchLive: "No exact match in the live dataset — showing the highest-scoring findings across all topics.",
    liveSearchTag: "Live search",
    liveModeLlm: "AI-summarised",
    liveModeRules: "Rule-filtered",
    liveNote: "Freshly retrieved from public discussions and not yet in the fixed index. Trend shows as Steady until snapshots accumulate.",
    liveRunningSteps: ["Searching public discussions", "Filtering noise and job posts", "Clustering recurring problems"],
    weakTitle: "Not in the fixed index",
    weakText: "The fixed dataset only covers 4 directions, so public discussions were searched live instead.",
    vagueTitle: "Name a concrete industry or workflow",
    vagueText: "That is too vague to search. Pick one below, or try a phrase like pet care records or booking cancellations.",
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
    gapLabel: "SIGNALS FOUND",
    foot: "Guest scan uses a localised demo dataset so the output format reads the same in both languages. The scheduled ingest pipeline's live output is available at",
    footLive: "Live output is from the scheduled ingest pipeline across public, compliant sources. Full dataset with source links:",
    dataLinkLabel: "/opportunities.json",
    feedKicker: "DISCOVER WITHOUT TYPING",
    feedTitle: "Ideas grouped by who has the problem",
    feedText: "No keyword needed. Each card is one small tool someone could build, grouped by the people who would use it. Tap one to see the evidence behind it.",
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
      { n: "03", title: "One-line opportunities", text: "Each finding is rewritten into who has the problem, why there is room, and the smallest first step — so you can judge it in ten seconds." },
    ],
    // L1/L2「一句话机会」：把证据翻译成「给谁 + 做什么」，首屏 10 秒可读。
    idea: {
      kicker: "ONE IDEA YOU COULD ACT ON",
      aiNote: "AI-written from the evidence below",
      templateNote: "Auto-summarised from the evidence below",
      whoLabel: "WHO HAS THIS PROBLEM",
      whyLabel: "WHY THERE'S ROOM",
      stepLabel: "FIRST SMALL STEP",
      evidenceOpen: "See the original evidence",
      evidenceClose: "Hide evidence",
      signalLabel: "SIGNALS FOUND",
      nextDirection: "Try another direction",
      similar: "More like this",
      similarEmpty: "No other findings for this group yet",
      groupUnit: "ideas",
      personaNames: {
        "budget-keeper": "Budget & subscription trackers",
        "pet-owner": "Pet owners & carers",
        "service-owner": "Shops taking bookings",
        "home-organizer": "People organising personal admin",
        "solo-founder": "Solo founders",
        bookkeeper: "Bookkeepers & finance staff",
        "support-team": "Support teams",
        scheduler: "People scheduling appointments",
        "indie-dev": "Indie developers",
        general: "People running into this",
      },
    },
    // P0-3 结构化机会卡：全部是枚举 code 的本地化文案，卡片数据本身语言无关。
    card: {
      toggle: "Opportunity card",
      scoreLabel: "Opportunity score",
      scored: "scored from real evidence",
      dimsTitle: "Eight scoring dimensions",
      notAssessed: "Not assessed",
      dim: {
        demand: "Demand", urgency: "Urgency", feasibility: "Feasibility",
        monetization: "Monetization", confidence: "Evidence",
        competition: "Competition", marketSize: "Market size", retention: "Retention",
      },
      audience: "Likely user",
      validation: "Cheapest first validation",
      risks: "Risk flags",
      insight: "Analyst note",
      audienceCode: {
        solo: "Solo founders", team: "Small teams", enterprise: "Enterprise",
        developer: "Developers", ops: "Ops / finance", support: "Support teams",
        unknown: "Not determined",
      },
      validationCode: {
        interview: "5 user interviews", prototype: "A clickable prototype",
        landing: "A landing-page test", "data-pull": "A one-off data pull",
        "manual-audit": "A manual audit of existing threads",
      },
      riskCode: {
        "single-source": "Single source only", "thin-evidence": "Thin evidence",
        "no-wtp": "No stated willingness to pay",
        "unverified-competition": "Competitors not verified",
        stale: "Signal older than 21 days",
      },
      noRisks: "No flags raised",
      basis: "Derived only from collected evidence. Unassessed dimensions are left blank, never guessed.",
    },
    // P1 外部搜索热度：与站内多快照趋势是两套不同口径，必须分开标注。
    externalHeat: {
      label: "External search interest",
      basis: "Google Trends daily list (US) — a different measure from the in-product multi-snapshot trend.",
      unavailable: "External trend data unavailable for this run",
      noMatch: "Not on today's external trend list",
      hit: "Trending: {term} · ~{traffic} searches",
    },
    // P2 会员额度：仅当服务端开启计费时才会出现，默认关闭时前端不展示。
    entitlement: {
      unlimited: "Pro member · unlimited scans",
      member: "Signed-in member",
    },
    limitsKicker: "Good to know",
    limitsH2: "What the free trial covers",
    limits: [
      "3 scans per device, no signup required",
      "Reads the live, scheduled ingest dataset; a vague direction triggers a fresh public search",
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
      "还没想好要做什么？先从一个看得懂的点子开始：谁遇到这个麻烦、能做个什么小工具、最小第一步怎么试。每个点子都能点开核对原始讨论。3 次扫描全免费 —— 不用注册、不留邮箱、不用信用卡。",
    badges: ["无需注册", "无需信用卡", "免费 3 次"],
    cardHead: "访客扫描",
    cardHeadLive: "实时信号",
    remaining: "剩余免费扫描次数",
    remainingOf: "/ 3 次",
    scoreLabelShort: "分",
    inputLabel: "你想扫描什么？",
    inputPlaceholder: "例如：宠物照护记录、预约改期、追踪订阅扣费……",
    inputHint: "按回车或点按钮即可开始，每次运行消耗 1 次免费额度。",
    browseKicker: "不知道要搜什么？",
    browseTitle: "先从「谁会遇到」挑起",
    browseText: "还没灵感？挑一类你关心的人或场景就行，不用自己打字。",
    suggestions: [
      { label: "管订阅、对账单的人", sub: "自动扣费、发票、预算", query: ["订阅", "账", "发票", "报销", "预算"], persona: "budget-keeper" },
      { label: "养宠物、记照护的人", sub: "疫苗、用药、照护记录", query: ["宠物", "记录", "照护", "提醒", "疫苗"], persona: "pet-owner" },
      { label: "要管预约的小店老板", sub: "排期、改约、被放鸽子", query: ["预约", "排期", "预订", "取消", "日程"], persona: "service-owner" },
      { label: "被杂事淹没的上班族", sub: "通讯录、照片、文件、表格", query: ["通讯录", "整理", "导出", "文件", "表格"], persona: "home-organizer" },
    ],
    surpriseLabel: "随机给我一个方向",
    orInputLabel: "……或者自己输入一个方向",
    examplesLabel: "快速试一个",
    examples: ["追踪订阅扣费", "宠物照护记录", "预约改期", "导出通讯录"],
    run: "开始免费扫描",
    running: "正在扫描…",
    runningSteps: ["读取公开讨论", "聚类反复出现的抱怨", "计算证据评分"],
    resetDemo: "演示用途：重置本机试用次数",
    idleTitle: "排序结果会出现在这里",
    idleText: "每条结论开头都有一句看得懂的点子：谁遇到这个麻烦、为什么还有空间、最小第一步做什么。点开还能核对原话与来源。",
    resultTitle: "相关点子：",
    resultOrderNote: "按与你输入的关键词的相关度排序；右侧数字为 0–100 证据评分。",
    demoTag: "演示数据集",
    noMatch: "当前索引里没有完全匹配的方向，以下展示全库评分最高的结论。",
    noMatchLive: "当前实时数据里没有完全匹配的方向，以下展示全库评分最高的结论。",
    liveSearchTag: "实时检索",
    liveModeLlm: "大模型归纳",
    liveModeRules: "规则筛选",
    liveNote: "以下来自刚检索到的公开讨论，尚未进入固定索引；趋势需要多轮快照，暂显示为平稳。",
    liveRunningSteps: ["正在检索公开讨论", "过滤无关内容与招聘信息", "归纳反复出现的问题"],
    weakTitle: "固定索引没有覆盖这个方向",
    weakText: "当前固定数据只覆盖 4 个方向，已改为实时检索公开讨论。",
    vagueTitle: "请说一个具体的行业或工作流",
    vagueText: "这个说法太笼统，没法检索。可以点下面的方向，或试试「宠物照护记录」「预约改期」这类具体说法。",
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
    gapLabel: "识别到的信号",
    foot: "访客扫描使用本地化的演示数据集，保证中英文输出格式一致。定时采集工作流产出的真实数据见",
    footLive: "实时数据来自定时采集管线，覆盖公开合规数据源。含来源链接的完整数据集：",
    dataLinkLabel: "/opportunities.json",
    feedKicker: "不用打字也能发现",
    feedTitle: "按「谁会遇到」分组的点子",
    feedText: "不用输入关键词。每张卡是一个有人真能做的小工具，按会用它的那群人分组；点开能看到背后的原话证据。",
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
      { n: "03", title: "一句话机会", text: "每条结论都会改写成：谁遇到这个麻烦、为什么还有空间、最小第一步做什么 —— 十秒就能判断值不值得继续看。" },
    ],
    // L1/L2「一句话机会」：把证据翻译成「给谁 + 做什么」，首屏 10 秒能读懂。
    idea: {
      kicker: "今天就能琢磨的一个点子",
      aiNote: "由下方证据归纳，可点开核对",
      templateNote: "依据下方证据自动归纳",
      whoLabel: "谁在痛",
      whyLabel: "为什么有机会",
      stepLabel: "最小起步",
      evidenceOpen: "看原文证据",
      evidenceClose: "收起证据",
      signalLabel: "识别到的信号",
      nextDirection: "换个方向看看",
      similar: "看同类机会",
      similarEmpty: "这个方向暂时只有这一条",
      groupUnit: "个点子",
      personaNames: {
        "budget-keeper": "管账、盯订阅的人",
        "pet-owner": "养宠物、记照护的人",
        "service-owner": "要管预约的小店",
        "home-organizer": "被杂事淹没的人",
        "solo-founder": "独立创业者",
        bookkeeper: "代账会计与财务",
        "support-team": "客服团队",
        scheduler: "天天排期约时间的人",
        "indie-dev": "独立开发者",
        general: "遇到这类麻烦的人",
      },
    },
    // P0-3 结构化机会卡：枚举 code 的中文文案，与 EN 结构一一对应。
    card: {
      toggle: "机会卡",
      scoreLabel: "机会评分",
      scored: "依据真实证据推导",
      dimsTitle: "八维评分",
      notAssessed: "未评估",
      dim: {
        demand: "需求强度", urgency: "紧迫度", feasibility: "可构建性",
        monetization: "变现信号", confidence: "证据置信",
        competition: "竞品格局", marketSize: "市场规模", retention: "留存复购",
      },
      audience: "目标用户",
      validation: "最低成本验证",
      risks: "风险提示",
      insight: "分析备注",
      audienceCode: {
        solo: "独立创业者", team: "小型团队", enterprise: "企业客户",
        developer: "开发者", ops: "运营 / 财务", support: "客服团队",
        unknown: "暂不确定",
      },
      validationCode: {
        interview: "先做 5 场用户访谈", prototype: "做一个可点击原型",
        landing: "做一个落地页测试", "data-pull": "先手工拉一次数据",
        "manual-audit": "人工复核现有讨论",
      },
      riskCode: {
        "single-source": "仅单一来源", "thin-evidence": "证据偏薄",
        "no-wtp": "未见明确付费意愿",
        "unverified-competition": "竞品格局未核实",
        stale: "信号超过 21 天",
      },
      noRisks: "未发现明显风险",
      basis: "全部由已采集证据推导；没有证据的维度留空，绝不猜测。",
    },
    // P1 外部搜索热度：与站内多快照趋势口径不同，必须分开标注。
    externalHeat: {
      label: "外部搜索热度",
      basis: "来自 Google Trends 每日热榜（美国），与站内多快照趋势是不同口径。",
      unavailable: "本次未取到外部趋势数据",
      noMatch: "未进入今日外部热榜",
      hit: "上榜：{term} · 约 {traffic} 次搜索",
    },
    // P2 会员额度：仅当服务端开启计费时才出现，默认关闭时前端不展示。
    entitlement: {
      unlimited: "专业版会员 · 不限次数",
      member: "已登录会员",
    },
    limitsKicker: "使用前须知",
    limitsH2: "免费试用包含什么",
    limits: [
      "每台设备 3 次扫描，全程无需注册",
      "读取定时采集的真实数据；方向太笼统时会现场检索公开讨论",
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
