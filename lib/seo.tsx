import config from "@/config";
import type { Metadata } from "next";

/**
 * SEO + GEO 元数据生成器
 * - Google：canonical / OG / Twitter / robots / 结构化数据
 * - LLM 抓取：语义化标题、可被直接引用的事实性描述、llms.txt（见 /llms.txt）
 */
export const getSEOTags = ({
  title,
  description,
  keywords,
  canonicalUrlRelative,
  openGraph,
  extraTags,
  languages,
  ogLocale,
}: Metadata & {
  canonicalUrlRelative?: string;
  extraTags?: Record<string, any>;
  /** hreflang 映射；双语页面传入 en/zh 对应关系 */
  languages?: Record<string, string>;
  ogLocale?: string;
} = {}) => {
  const desc = description || config.appDescription;
  return {
    metadataBase: new URL(config.siteUrl),
    title: title || `${config.appName} — ${config.tagline}`,
    description: desc,
    applicationName: config.appName,
    keywords: keywords || [
      "Reddit pain points",
      "customer complaint analysis",
      "SaaS idea validation",
      "competitor gap analysis",
      "voice of customer",
      "market research tool",
      config.appName,
    ],
    authors: [{ name: `${config.appName} Team`, url: config.siteUrl }],
    creator: `${config.appName} Team`,
    publisher: config.appName,
    category: "technology",
    alternates: {
      canonical: canonicalUrlRelative || "/",
      languages: languages || { "en-US": canonicalUrlRelative || "/" },
    },
    openGraph: {
      type: "website",
      siteName: config.appName,
      title: openGraph?.title || `${config.appName} — ${config.tagline}`,
      description: openGraph?.description || desc,
      url: openGraph?.url || config.siteUrl,
      locale: ogLocale || "en_US",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: `${config.appName} — ${config.tagline}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: openGraph?.title || `${config.appName} — ${config.tagline}`,
      description: openGraph?.description || desc,
      images: ["/og.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
    },
    ...extraTags,
  } satisfies Metadata;
};

/** 站点级结构化数据：Organization + WebSite + SoftwareApplication（@graph 单块注入） */
export function renderSchemaTags() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${config.siteUrl}/#organization`,
      name: config.appName,
      url: config.siteUrl,
      email: config.supportEmail,
      description: config.appDescription,
    },
    {
      "@type": "WebSite",
      "@id": `${config.siteUrl}/#website`,
      url: config.siteUrl,
      name: config.appName,
      publisher: { "@id": `${config.siteUrl}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${config.siteUrl}/#software`,
      name: config.appName,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: config.siteUrl,
      description: config.appDescription,
      featureList: [
        "3 free niche scans without signup",
        "AI pain point extraction",
        "Severity and frequency scoring",
        "Willingness-to-pay signal extraction",
        "Competitor gap mapping",
        "Continuous monitoring and alerts",
        "CSV, JSON, API and MCP access",
      ],
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "0",
        highPrice: "199",
        offerCount: "3",
      },
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }}
    />
  );
}

export function renderFaqSchema(items: readonly { q: string; a: string }[]) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((i) => ({
            "@type": "Question",
            name: i.q,
            acceptedAnswer: { "@type": "Answer", text: i.a },
          })),
        }),
      }}
    />
  );
}

export function renderBreadcrumbSchema(items: { name: string; path: string }[]) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((i, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            name: i.name,
            item: `${config.siteUrl}${i.path}`,
          })),
        }),
      }}
    />
  );
}
