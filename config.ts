/**
 * IdeaRadar — 站点与商业化配置
 * 模板原仓库缺失 @/config，此文件补齐并统一为单一配置源。
 * 站点域名通过 NEXT_PUBLIC_SITE_URL 覆盖，供 metadata / canonical / sitemap / robots 使用。
 */

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://idearadar.app").replace(/\/$/, "");

const config = {
  appName: "IdeaRadar",
  appDescription:
    "IdeaRadar turns real customer complaints from Reddit, Hacker News, reviews and support threads into evidence-backed business opportunities. Scan a niche, score pain severity, and map competitor gaps.",
  domainName: siteUrl.replace(/^https?:\/\//, ""),
  siteUrl,
  tagline: "Find validated problems. Ship winning products.",
  supportEmail: "hello@idearadar.app",
  creem: {
    url: process.env.CREEM_API_URL || "https://test-api.creem.io",
    pricingTableId: process.env.CREEM_PRICING_TABLE_ID || "",
  },
  plans: [
    {
      id: "free",
      name: "Free",
      price: 0,
      cadence: "/ month",
      description: "For validating a single idea before you build.",
      productId: "",
      features: [
        "3 free scans, no signup required",
        "1 data source",
        "Pain points with source links",
        "7-day data retention",
      ],
      cta: "Try 3 scans free",
      featured: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: 49,
      cadence: "/ month",
      description: "For founders who research a market every week.",
      productId: process.env.CREEM_PRODUCT_PRO || "",
      features: [
        "Unlimited niche scans",
        "All compliant data sources",
        "Severity, frequency & WTP scoring",
        "Competitor gap mapping",
        "CSV / JSON export & weekly digest",
      ],
      cta: "Upgrade to Pro",
      featured: true,
    },
    {
      id: "team",
      name: "Team",
      price: 199,
      cadence: "/ month",
      description: "For product and marketing teams running continuous monitoring.",
      productId: process.env.CREEM_PRODUCT_TEAM || "",
      features: [
        "Everything in Pro",
        "5 team seats",
        "Continuous monitoring & alerts",
        "Webhooks, API & MCP access",
        "Shared opportunity workspace",
      ],
      cta: "Talk to us",
      featured: false,
    },
  ],
};

export default config;
