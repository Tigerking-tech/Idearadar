import Link from "next/link";
import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { FinalCta } from "@/components/marketing/sections";

export const metadata = getSEOTags({
  title: "Methodology — How IdeaRadar turns public questions into one-line ideas",
  description:
    "How IdeaRadar actually works: scheduled collection from public APIs, noise filtering and complaint detection, LLM denoising, one-line idea generation with a template fallback, incremental translation, and multi-snapshot trends. Includes data-source compliance and honest limitations.",
  canonicalUrlRelative: "/methodology",
  languages: { "en-US": "/methodology", "zh-CN": "/zh/methodology", "x-default": "/methodology" },
});

const PIPELINE = [
  ["Collect", "A scheduled GitHub Actions workflow queries official public APIs and writes structured JSON to the repo."],
  ["Filter", "Deterministic rules drop news, job posts, release notes and boilerplate, then keep records with complaint or help-seeking signals."],
  ["Denoise", "An LLM pass judges whether each record is a real user problem; a safety valve keeps the whole batch if too many are rejected, and it fails open."],
  ["Ideate", "A second LLM pass writes a one-line idea: who has the problem, why there is room, and the cheapest first step. If unavailable, a deterministic template is used."],
  ["Translate", "Chinese titles, quotes and idea text are written into the dataset by an incremental translation step; users can toggle to the original wording."],
  ["Track", "Each ingest appends a snapshot to history.json; trends need several real snapshots before they move off Steady."],
] as const;

export default function MethodologyPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container">
        <div className="max-w-[820px] mx-auto rr-prose">
          <span className="rr-kicker">Methodology</span>
          <h1 className="rr-h2 mt-3 !text-[clamp(32px,4vw,48px)]">
            How IdeaRadar turns public questions into one-line ideas
          </h1>
          <p className="rr-lead mt-5">
            This page describes exactly what IdeaRadar does, which data sources it uses, and the honest
            limits of the results. It is written as plain, factual, server-rendered text so that both
            search engines and AI assistants can quote it accurately.
          </p>
          <p className="rr-note">Last updated: 15 November 2026.</p>

          <h2 id="about">What the product actually does</h2>
          <p>
            IdeaRadar reads real, unprompted questions and complaints from public forums and Q&A sites,
            and turns each into one plain-language idea: who has the problem, the small tool you could
            build, and the cheapest first step. Every idea links back to the original discussion and its
            source. It does not invent a market size, a revenue estimate, or a severity score. It is a
            free, self-hostable open project — there is no account, subscription, or checkout.
          </p>

          <h2 id="scoring">The collection pipeline</h2>
          <p>
            Each stage is independent and designed to fail open: if an LLM step is unavailable or its
            output is malformed, the pipeline keeps the deterministic result rather than dropping the
            record or blocking the run.
          </p>
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE.map(([name, detail]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td>{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 id="data-sources">Data sources and compliance</h2>
          <p>
            The default connectors use only sources with clear public access terms: the Hacker News
            official API, the Stack Exchange official API (including everyday Q&A sites about money,
            pets, travel and work), the public GitHub Issues API, and any RSS/Atom feed you configure.
            Because collection is multi-source, no single platform changing its terms can disable it.
          </p>
          <p>
            The Reddit connector is <strong>disabled by default</strong> and would require your own
            credentials covered by a Reddit commercial data licence. E-commerce and local-life review
            sites (marketplaces, food and lifestyle apps) do not offer a compliant public API for this
            use, so IdeaRadar does not collect from them — we do not pretend a source exists when it
            does not.
          </p>

          <h2>Automated collection workflow</h2>
          <p>
            Collection runs on a schedule from <code>.github/workflows/ingest.yml</code> on
            GitHub-hosted runners. The workflow normalises results into a common schema, de-duplicates,
            filters noise, runs the LLM denoise and idea steps, writes Chinese text, and commits the
            refreshed JSON. Because it runs on the runner rather than your workstation, it keeps working
            when a local network restricts outbound access. A concurrency guard rebases and retries if a
            data commit races another push.
          </p>
          <p>
            The full result is a plain, machine-readable file at <code>/opportunities.json</code> —
            open to anyone, no login and no scan limit. There is no CSV export, webhook, JSON API or MCP
            endpoint; those are planned ideas, not built features.
          </p>

          <h2>What a direction outside the fixed index does</h2>
          <p>
            If you type a direction the fixed dataset does not cover, the free trial can run a fresh,
            on-demand search of public discussions. Those results are labelled as live search and rule
            or AI filtered, and are explicitly <strong>not</strong> presented as verified, indexed
            ideas — their quality is lower than the curated nightly set. When live search is unavailable
            or returns too little evidence, the trial says so instead of inventing results, and a failed
            attempt does not use one of your 3 free scans.
          </p>

          <h2>Honest limitations</h2>
          <p>
            A one-line idea is a starting point derived from collected wording, not a validated business
            case or a guarantee that a product will succeed. Some source records are niche questions and
            the resulting ideas can still feel narrow. Chinese text is machine-translated; the original
            wording is always available. The 3-scan quota is stored in the browser only — it is a
            demonstration limit, not a production-grade entitlement. Early trend curves use seeded
            sample history until enough real snapshots accumulate, then switch to real data automatically.
          </p>

          <div className="rr-card p-6 mt-10 not-prose">
            <h3 className="rr-h3">Read next</h3>
            <ul className="mt-3 space-y-2 text-[14px]">
              <li><Link href="/pricing">What is free and what is planned →</Link></li>
              <li><Link href="/faq">Frequently asked questions →</Link></li>
              <li><Link href="/llms.txt">LLM-readable site index (llms.txt) →</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <FinalCta />
      {renderBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Methodology", path: "/methodology" },
      ])}
    </article>
  );
}
