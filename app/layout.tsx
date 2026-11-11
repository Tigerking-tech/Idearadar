import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { getSEOTags, renderSchemaTags } from "@/lib/seo";

/**
 * 根布局：静态可抓取的服务端 HTML。
 * 移除了模板自带的第三方统计脚本与强制暗色主题，避免拖慢首屏、干扰抓取与对比度。
 */
export const metadata: Metadata = getSEOTags();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable site index" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
        {renderSchemaTags()}
      </body>
    </html>
  );
}
