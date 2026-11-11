import type { MetadataRoute } from "next";
import config from "@/config";

/** 为一对中英页面生成双向 hreflang 与 x-default。 */
const alternatesFor = (en: string, zh: string) => ({
  languages: {
    "en-US": `${config.siteUrl}${en}`,
    "zh-CN": `${config.siteUrl}${zh}`,
    "x-default": `${config.siteUrl}${en}`,
  },
});

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-11-11T00:00:00Z");

  const pages = [
    { path: "/", en: "/", zh: "/zh", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/zh", en: "/", zh: "/zh", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/try", en: "/try", zh: "/zh/try", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/zh/try", en: "/try", zh: "/zh/try", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/pricing", en: "/pricing", zh: "/zh/pricing", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/zh/pricing", en: "/pricing", zh: "/zh/pricing", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/methodology", en: "/methodology", zh: "/zh/methodology", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/zh/methodology", en: "/methodology", zh: "/zh/methodology", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/faq", en: "/faq", zh: "/zh/faq", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/zh/faq", en: "/faq", zh: "/zh/faq", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/privacy", en: "/privacy", zh: "/zh/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/zh/privacy", en: "/privacy", zh: "/zh/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", en: "/terms", zh: "/zh/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/zh/terms", en: "/terms", zh: "/zh/terms", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return pages.map((p) => ({
    url: `${config.siteUrl}${p.path}`,
    lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    alternates: alternatesFor(p.en, p.zh),
  }));
}
