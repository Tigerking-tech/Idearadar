import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Privacy Policy — ${config.appName}`,
  description: `How ${config.appName} handles data: no account, no server-side storage of your scans, and public-source content kept as links and excerpts.`,
  canonicalUrlRelative: "/privacy",
  languages: { "en-US": "/privacy", "zh-CN": "/zh/privacy", "x-default": "/privacy" },
});

export default function PrivacyPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container max-w-[760px] rr-prose">
        <span className="rr-kicker">Legal</span>
        <h1 className="rr-h2 mt-3 !text-[36px]">Privacy Policy</h1>
        <p className="rr-note">Last updated: 15 November 2026.</p>

        <h2>The short version</h2>
        <p>
          IdeaRadar has no accounts and no paid plans. You can try 3 scans without signing up, giving
          an email, or entering a credit card. There is no user database on our servers holding your
          personal data.
        </p>

        <h2>What stays on your device</h2>
        <p>
          Your free-scan counter, the directions you typed, and the results shown during a session are
          kept in your browser (localStorage) and rendered on the page. Nothing about your trial is
          stored on our servers. Clearing site data resets the 3-scan counter. We do not set advertising
          or cross-site tracking cookies.
        </p>

        <h2>Public sources</h2>
        <p>
          The ideas come from publicly accessible discussions collected through sources whose terms
          permit the use. We keep a permalink and a short excerpt rather than republishing entire
          threads. The Reddit connector is disabled by default and would require your own licensed
          credentials. Chinese titles and quotes are machine-translated; the original wording is always
          available via View original.
        </p>

        <h2>No imported data, no payments</h2>
        <p>
          There is no first-party data import, no account data, and no checkout. Since there is no
          subscription, no payment or billing information is collected or processed by us or any
          merchant of record.
        </p>

        <h2>Open dataset</h2>
        <p>
          The full collected dataset is a public, machine-readable file at <code>/opportunities.json</code>.
          It contains only public-source content and derived ideas, not visitor data.
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
