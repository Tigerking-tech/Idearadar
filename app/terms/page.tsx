import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Terms of Service — ${config.appName}`,
  description: `Subscription terms, acceptable use and data-source responsibilities for ${config.appName}.`,
  canonicalUrlRelative: "/terms",
  languages: { "en-US": "/terms", "zh-CN": "/zh/terms", "x-default": "/terms" },
});

export default function TermsPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container max-w-[760px] rr-prose">
        <span className="rr-kicker">Legal</span>
        <h1 className="rr-h2 mt-3 !text-[36px]">Terms of Service</h1>
        <p className="rr-note">Last updated: 11 November 2026.</p>

        <h2>Subscriptions</h2>
        <p>
          Paid plans renew monthly until cancelled. Billing, refunds, VAT and sales tax are administered
          by Creem as merchant of record. Plan limits are described on the <Link href="/pricing">pricing page</Link>.
        </p>

        <h2>Acceptable use</h2>
        <p>
          You may use findings for your own research and product decisions. You may not resell raw
          scraped corpora, impersonate community members, or use the service to harass individuals whose
          posts were analysed.
        </p>

        <h2>Data-source responsibility</h2>
        <p>
          Default connectors use public sources with clear access terms. If you enable an optional
          connector that requires credentials — including the Reddit connector — you are responsible for
          holding the appropriate licence and for complying with that platform&apos;s terms.
        </p>

        <h2>No guarantee of business outcome</h2>
        <p>
          Scores and opportunity briefs are decision support, not a guarantee that a product will
          succeed. Validate demand independently before building.
        </p>

        <h2>Contact</h2>
        <p>
          <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> · <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </article>
  );
}
