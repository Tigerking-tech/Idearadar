import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Terms of Service — ${config.appName}`,
  description: `Terms for ${config.appName}: a free, open, self-hostable project with no account, no paid plan, and no guarantee of business outcome.`,
  canonicalUrlRelative: "/terms",
  languages: { "en-US": "/terms", "zh-CN": "/zh/terms", "x-default": "/terms" },
});

export default function TermsPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container max-w-[760px] rr-prose">
        <span className="rr-kicker">Legal</span>
        <h1 className="rr-h2 mt-3 !text-[36px]">Terms of Service</h1>
        <p className="rr-note">Last updated: 15 November 2026.</p>

        <h2>Free to use, no account</h2>
        <p>
          IdeaRadar is a free, open, self-hostable project. There is no account, no subscription, no
          paid plan and no checkout. The public demo lets any visitor run 3 scans without signing up;
          the 3-scan count is a demonstration limit stored in your browser, not a production entitlement.
          What is available now and what is only planned is described on the <Link href="/pricing">pricing page</Link>.
        </p>

        <h2>Acceptable use</h2>
        <p>
          You may use the ideas for your own research and product decisions. You may not resell raw
          collected corpora, impersonate community members, or use the service to harass individuals
          whose public posts were analysed. Respect the source link and the original author when you
          quote a finding.
        </p>

        <h2>Data-source responsibility</h2>
        <p>
          Default connectors use public sources with clear access terms. If you self-host and enable an
          optional connector that requires credentials — including the Reddit connector — you are
          responsible for holding the appropriate licence and for complying with that platform&apos;s terms.
        </p>

        <h2>No guarantee of business outcome</h2>
        <p>
          A one-line idea is a starting point derived from public wording, not a validated business
          case or a guarantee that a product will succeed. Some source records are narrow questions and
          the resulting ideas can be niche. Chinese text is machine-translated. Validate demand
          independently before building.
        </p>

        <h2>Contact</h2>
        <p>
          <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> · <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </article>
  );
}
