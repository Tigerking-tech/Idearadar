import { AnnouncementBar } from "@/components/marketing/interactive";
import { SiteHeader, SiteFooter } from "@/components/marketing/chrome";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
