/**
 * IdeaRadar — 站点与商业化配置
 * 模板原仓库缺失 @/config，此文件补齐并统一为单一配置源。
 * 站点域名通过 NEXT_PUBLIC_SITE_URL 覆盖，供 metadata / canonical / sitemap / robots 使用。
 */

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://idearadar.app").replace(/\/$/, "");

const config = {
  appName: "IdeaRadar",
  appDescription:
    "IdeaRadar shows real, public questions and complaints with the verbatim wording and a link to the original discussion. For indexed directions it adds a one-line idea; fresh live searches show the real wording first. Try 3 scans free, no signup.",
  domainName: siteUrl.replace(/^https?:\/\//, ""),
  siteUrl,
  tagline: "Real public problems, with the wording and source to check.",
  supportEmail: "hello@idearadar.app",
  creem: {
    url: process.env.CREEM_API_URL || "https://test-api.creem.io",
    pricingTableId: process.env.CREEM_PRICING_TABLE_ID || "",
  },
  plans: [
    {
      id: "free",
      name: "Free",
      // 价格与文案以 lib/i18n.ts 的字典为单一事实源；此处仅供定价组件按序渲染卡片。
      featured: true,
    },
    {
      id: "pro",
      name: "Pro",
      featured: false,
    },
    {
      id: "team",
      name: "Team",
      featured: false,
    },
  ],
};

export default config;
