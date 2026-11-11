import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Privacy Policy — ${config.appName}`,
  description: `How ${config.appName} handles account data, imported first-party data and public-source content.`,
  canonicalUrlRelative: "/privacy",
  languages: { "en-US": "/privacy", "zh-CN": "/zh/privacy", "x-default": "/privacy" },
});

export default function PrivacyPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container max-w-[760px] rr-prose">
        <span className="rr-kicker">Legal</span>
        <h1 className="rr-h2 mt-3 !text-[36px]">Privacy Policy</h1>
        <p className="rr-note">Last updated: 11 November 2026.</p>

        <h2>What we collect</h2>
        <p>
          Account information (email address and authentication identifier), the niches and keywords you
          choose to monitor, and any first-party data you import. We also store the public-source
          findings generated for you, each linked to its original URL.
        </p>

        <h2>Public sources</h2>
        <p>
          We only process publicly accessible discussions through sources whose terms permit the use,
          and we store a permalink plus an excerpt rather than republishing entire threads. The Reddit
          connector is disabled by default and requires your own licensed credentials.
        </p>

        <h2>Your imported data</h2>
        <p>
          Data you import stays scoped to your workspace and is not used to train shared models. You can
          export or delete it at any time.
        </p>

        <h2>Payments</h2>
        <p>
          Payments, tax calculation and invoicing are processed by Creem as merchant of record. We do
          not store full payment card details on our servers.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy: <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>.
          See also the <Link href="/terms">Terms of Service</Link> and the{" "}
          <Link href="/methodology">methodology page</Link>.
        </p>
      </div>
    </article>
  );
}
