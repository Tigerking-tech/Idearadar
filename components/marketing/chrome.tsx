import Link from "next/link";
import config from "@/config";
import { EN_DICT, type Dict, type Locale } from "@/lib/i18n";
import { LanguageSwitcher, MobileMenu } from "./interactive";

/** 自有品牌标识：自绘雷达波纹 SVG，不使用任何竞品 logo 或素材 */
export function BrandLogo({
  compact = false,
  homeHref = "/",
  ariaLabel = EN_DICT.brandHome,
  label = config.appName,
}: {
  compact?: boolean;
  homeHref?: string;
  ariaLabel?: string;
  label?: string;
}) {
  return (
    <Link href={homeHref} className="rr-logo" aria-label={ariaLabel}>
      <span className="rr-logo-mark" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="2.1" fill="#fff" stroke="none" />
          <path d="M7.6 7.6a6.2 6.2 0 0 0 0 8.8" />
          <path d="M4.6 4.6a10.4 10.4 0 0 0 0 14.8" />
          <path d="M16.4 7.6a6.2 6.2 0 0 1 0 8.8" opacity=".75" />
          <path d="M19.4 4.6a10.4 10.4 0 0 1 0 14.8" opacity=".5" />
        </svg>
      </span>
      {!compact && <span>{label}</span>}
    </Link>
  );
}

export function SiteHeader({
  d = EN_DICT,
  locale = "en",
}: {
  d?: Dict;
  locale?: Locale;
}) {
  const homeHref = locale === "zh" ? "/zh" : "/";
  return (
    <header className="rr-header relative">
      <div className="rr-container rr-header-inner">
        <div className="flex items-center gap-10">
          <BrandLogo homeHref={homeHref} ariaLabel={d.brandHome} label={d.brand} />
          <nav className="rr-nav" aria-label={d.nav.aria}>
            {d.nav.items.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="rr-header-actions">
          <Link href="/signin" className="rr-signin rr-desktop-only">
            {d.nav.signin}
          </Link>
          <Link href={d.nav.ctaHref} className="rr-btn rr-btn-primary rr-btn-sm rr-desktop-only">
            {d.nav.cta}
          </Link>
          <LanguageSwitcher locale={locale} d={d.lang} />
          <MobileMenu d={d.nav} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({
  d = EN_DICT,
  locale = "en",
}: {
  d?: Dict;
  locale?: Locale;
}) {
  const homeHref = locale === "zh" ? "/zh" : "/";
  return (
    <footer className="rr-footer">
      <div className="rr-container">
        <div className="rr-footer-grid">
          <div>
            <BrandLogo homeHref={homeHref} ariaLabel={d.brandHome} label={d.brand} />
            <p className="text-[13px] leading-relaxed text-[#5c6273] mt-4 max-w-[300px]">{d.footer.desc}</p>
            <p className="rr-note mt-4">{d.footer.billing}</p>
          </div>
          {d.footer.groups.map((group) => (
            <div key={group.title}>
              <div className="rr-footer-title">{group.title}</div>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="rr-divider mt-12 mb-6" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <p className="rr-note">
            © {new Date().getFullYear()} {d.brand}. {d.footer.rights}
          </p>
          <p className="rr-note">
            {d.footer.crawler}<Link href="/llms.txt">llms.txt</Link> · <Link href="/robots.txt">robots.txt</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
