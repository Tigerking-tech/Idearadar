import { AnnouncementBar } from "@/components/marketing/interactive";
import { SiteHeader, SiteFooter } from "@/components/marketing/chrome";
import { ZH_DICT } from "@/lib/i18n";

/**
 * 中文站外壳。与英文 (marketing) 布局平行，共享同一套组件但传入中文字典。
 * lang="zh-CN" 落在容器上，供解析器与辅助技术识别正文语言。
 */
export default function ZhLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rr-zh flex flex-col min-h-screen" lang="zh-CN">
      <AnnouncementBar d={ZH_DICT.announcement} />
      <SiteHeader d={ZH_DICT} locale="zh" />
      <main className="flex-1">{children}</main>
      <SiteFooter d={ZH_DICT} locale="zh" />
    </div>
  );
}
