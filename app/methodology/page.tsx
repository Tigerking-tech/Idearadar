import Link from "next/link";
import { getSEOTags, renderBreadcrumbSchema } from "@/lib/seo";
import { FinalCta } from "@/components/marketing/sections";

export const metadata = getSEOTags({
  title: "Methodology — How IdeaRadar Scores Pain Points & Data Sources",
  description:
    "The IdeaRadar scoring methodology: frequency, intensity, recency, cross-source corroboration and willingness-to-pay signals combined into a 0-100 evidence score. Includes our data-source compliance policy and the Reddit API timeline.",
  canonicalUrlRelative: "/methodology",
  languages: { "en-US": "/methodology", "zh-CN": "/zh/methodology", "x-default": "/methodology" },
});

const SCORE_DIMENSIONS = [
  ["Frequency", "30%", "How often the same complaint recurs across unrelated threads, after deduplication."],
  ["Intensity", "20%", "Emotional strength, urgency language and described consequences of the problem."],
  ["Recency", "15%", "Recent discussions weigh more than historical ones; stale problems decay."],
  ["Cross-source corroboration", "20%", "The same problem appearing on independent platforms, none referencing the other."],
  ["Willingness to pay", "15%", "Explicit statements of budget, current spend or quantified cost. Inferred intent scores zero."],
] as const;

const REDDIT_TIMELINE = [
  ["2023", "Reddit begins charging for high-volume commercial API access; several third-party clients shut down."],
  ["June 2025", "Reddit sues Anthropic over unauthorised commercial scraping of user content."],
  ["Nov 2025", "GummySearch announces shutdown after failing to obtain a commercial Data API licence."],
  ["Oct 2026", "Reddit stops accepting new public API access requests."],
  ["Nov 2026", "Reddit ends RSS feed support."],
  ["March 2027", "Remaining public Data API access ends; third-party apps move to the Developer Platform."],
] as const;

export default function MethodologyPage() {
  return (
    <article className="rr-section-tight">
      <div className="rr-container">
        <div className="max-w-[820px] mx-auto rr-prose">
          <span className="rr-kicker">Methodology</span>
          <h1 className="rr-h2 mt-3 !text-[clamp(32px,4vw,48px)]">
            How IdeaRadar turns complaints into a 0–100 evidence score
          </h1>
          <p className="rr-lead mt-5">
            This page describes exactly what IdeaRadar measures, which data sources it uses, and the
            compliance rules behind its automated collection workflow. It is written as plain, factual,
            server-rendered text so that both search engines and AI assistants can quote it accurately.
          </p>
          <p className="rr-note">Last updated: 11 November 2026.</p>

          <h2 id="about">What is a pain point?</h2>
          <p>
            A pain point is a recurring, specific problem that a person describes in their own words,
            in public, without being prompted by a survey. IdeaRadar only counts complaints that appear
            in an unprompted discussion. A post that merely mentions a keyword is not a pain point.
          </p>

          <h2>What is a competitor gap?</h2>
          <p>
            A competitor gap is a problem that is both frequently complained about and poorly handled by
            every existing solution we can identify. For each pain point we list the products already
            addressing it and summarise their documented recurring failures from low-star reviews and
            complaint threads.
          </p>

          <h2>What is a willingness-to-pay signal?</h2>
          <p>
            A willingness-to-pay (WTP) signal is a verbatim statement of a budget, a current tool being
            paid for, or a quantified cost of the problem. It is the single most reliable indicator that
            a complaint is a business opportunity. IdeaRadar extracts WTP statements verbatim and never
            infers them from tone.
          </p>

          <h2 id="scoring">The scoring model</h2>
          <p>
            Each candidate pain point receives a score from 0 to 100. Findings below the quality
            threshold are rejected rather than displayed, so an opportunity list stays short and
            verifiable.
          </p>
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Weight</th>
                <th>What it measures</th>
              </tr>
            </thead>
            <tbody>
              {SCORE_DIMENSIONS.map(([name, weight, detail]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td>{weight}</td>
                  <td>{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 id="data-sources">Data sources and compliance</h2>
          <p>
            The default ingestion connectors use sources with clear public access terms: the Hacker News
            API, the Stack Exchange API, the public GitHub Issues API, and any RSS/Atom feed you
            configure. You can also import first-party data — support tickets, call notes, survey
            exports and review CSVs — because you already hold the rights to it.
          </p>
          <p>
            The Reddit connector is <strong>disabled by default</strong>. It is enabled only when you
            provide credentials covered by a Reddit commercial data licence. Reddit&apos;s User Agreement
            prohibits unlicensed commercial scraping, and the platform is closing public data access.
            A single platform changing its terms therefore cannot disable this product.
          </p>

          <h2>The Reddit data policy timeline</h2>
          <table>
            <thead>
              <tr><th>Date</th><th>Event</th></tr>
            </thead>
            <tbody>
              {REDDIT_TIMELINE.map(([date, event]) => (
                <tr key={date}><td><strong>{date}</strong></td><td>{event}</td></tr>
              ))}
            </tbody>
          </table>

          <h2>Automated collection workflow</h2>
          <p>
            Collection runs on a schedule from <code>.github/workflows/ingest.yml</code> on
            GitHub-hosted runners. Each connector is independent; the workflow normalises results into a
            common schema, deduplicates by semantic similarity, applies the scoring model above, and
            writes structured JSON. Because collection happens on the runner rather than on your
            workstation, it keeps working when a local network restricts outbound access.
          </p>
          <p>
            Structured output is designed for downstream use: CSV and JSON export on Pro, plus webhooks,
            a JSON API and an MCP endpoint on Team, so AI assistants can query the opportunity database
            directly.
          </p>

          <h2>Continuous monitoring versus one-off idea lists</h2>
          <p>
            A one-off idea list answers &ldquo;what could I build&rdquo; once. IdeaRadar is built around
            continuous monitoring: the same niche is re-scanned on a schedule, new complaints are
            diffed against previous runs, and material changes are pushed by Slack, email or webhook.
            This makes the research a repeatable workflow rather than a single purchase.
          </p>

          <div className="rr-card p-6 mt-10 not-prose">
            <h3 className="rr-h3">Read next</h3>
            <ul className="mt-3 space-y-2 text-[14px]">
              <li><Link href="/pricing">Pricing and plan comparison →</Link></li>
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
