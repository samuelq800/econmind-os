import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CircleDotDashed,
  FlaskConical,
  Globe2,
  Newspaper,
  Target,
  UsersRound,
} from "lucide-react";
import { HomeDailyBriefPreview } from "@/components/home/home-daily-brief-preview";
import { PARTICIPATING_SCHOOL_COUNT, PARTICIPATING_SCHOOLS } from "@/lib/league/participating-schools";
import { LEAGUE_CHALLENGES_COMING_SOON, LEAGUE_SEASON } from "@/lib/league/league-season";

const zones = [
  { number: "01", title: "Real World", detail: "Daily Brief · Cases", href: "/daily-brief", icon: Newspaper, description: "Start from a current issue, a published case or a concrete economic decision." },
  { number: "02", title: "Models & Mechanisms", detail: "Model Library · Mechanism Arena", href: "/models", icon: CircleDotDashed, description: "Make assumptions visible, then trace the mechanism that connects them to outcomes." },
  { number: "03", title: "Simulation", detail: "Sandbox · Policy Lab · Workspace", href: "/sandbox", icon: BarChart3, description: "Change a condition and watch a transparent teaching model update in real time." },
  { number: "04", title: "Evidence", detail: "Evidence Lab", href: "/research", icon: BookOpenCheck, description: "Test claims with curated sources, methods and clearly stated limits." },
  { number: "05", title: "League", detail: "Teams · Countries · Decisions", href: "/league", icon: Globe2, description: "Connect schools through one persistent fictional world economy." },
] as const;

const modelFamilies = [
  { title: "Markets", detail: "Supply, demand, tax, elasticity and price controls.", href: "/models/supply-demand", tag: "Curves" },
  { title: "Macroeconomics", detail: "AD–AS, IS–LM, monetary and fiscal policy.", href: "/models/is-lm", tag: "System" },
  { title: "Strategy", detail: "Games, competition, incentives and information.", href: "/mechanism-arena", tag: "Interaction" },
  { title: "Growth & Welfare", detail: "PPF, growth, inequality and public choices.", href: "/models/solow-growth", tag: "Long run" },
] as const;

const howItWorks = [
  ["01", "Observe", "Read a real-world development or open a structured case."],
  ["02", "Model", "State the simplifying assumptions and identify the mechanism."],
  ["03", "Simulate", "Adjust controlled variables in an interactive teaching environment."],
  ["04", "Test", "Use evidence, counterarguments and limitations to challenge the result."],
  ["05", "Evaluate", "Compare distributional effects, trade-offs and unintended consequences."],
  ["06", "Decide", "Explain what you would do—and what the model cannot decide for you."],
] as const;

const leagueCityHubs = [
  { city: "Beijing", schools: 2, x: 68, y: 33, labelX: 10, labelY: -17 },
  { city: "Jinan", schools: 1, x: 72.5, y: 40.2, labelX: 10, labelY: -17 },
  { city: "Nanjing", schools: 2, x: 75.4, y: 46.7, labelX: -58, labelY: -36 },
  { city: "Wuxi", schools: 1, x: 76.5, y: 48.5, labelX: 10, labelY: -12 },
  { city: "Suzhou", schools: 3, x: 78, y: 49.4, labelX: 10, labelY: 12 },
  { city: "Shanghai", schools: 1, x: 79.6, y: 49.4, labelX: 10, labelY: 35 },
  { city: "Hangzhou", schools: 1, x: 76.8, y: 52.2, labelX: -73, labelY: 43 },
  { city: "Chengdu", schools: 1, x: 47.6, y: 51.8, labelX: 10, labelY: -17 },
  { city: "Chongqing", schools: 1, x: 54.2, y: 52.8, labelX: 10, labelY: -17 },
  { city: "Nanning", schools: 1, x: 56.8, y: 64.5, labelX: 10, labelY: -17 },
  { city: "Shenzhen", schools: 1, x: 65.3, y: 65.5, labelX: 10, labelY: -17 },
] as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="home-eyebrow">{children}</p>;
}

export function EditorialHome() {
  return (
    <main className="editorial-home">
      <section className="home-hero">
        <div className="home-hero-grid" aria-hidden="true" />
        <div className="mx-auto grid max-w-[1560px] gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.03fr_.97fr] lg:px-12 lg:pb-28 lg:pt-24">
          <div className="relative z-10 max-w-4xl">
            <Eyebrow>Interactive economics laboratory</Eyebrow>
            <h1 className="home-hero-title">EconMind OS.</h1>
            <p className="home-hero-line">From the real world<br />to economic reasoning.</p>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--ink-muted)]">An interactive economics laboratory for models, policy simulation, evidence and cross-school economic experimentation.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/explore" className="home-primary-action">Explore EconMind <ArrowRight size={17} /></Link>
              <Link href="/league" className="home-secondary-action">League · Season 1 coming soon <Globe2 size={16} /></Link>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="home-process-band" aria-label="Economic reasoning process">
        {[["REAL WORLD", "↓"], ["MODEL", "↓"], ["SIMULATE", "↓"], ["EVIDENCE", "↓"], ["DECIDE", ""]].map(([label, arrow]) => <span key={label}>{label} {arrow}</span>)}
      </section>

      <section className="home-section home-schools-section">
        <div className="home-section-heading"><div><Eyebrow>Participating schools</Eyebrow><h2>Built across a growing school network.</h2></div><p className="max-w-md text-sm leading-6 text-[var(--ink-muted)]">Schools are listed here as a public network directory. Team membership, approval and League access remain managed within the existing account system.</p></div>
        <ol className="home-schools-grid">{PARTICIPATING_SCHOOLS.map((school, index) => <li key={school.name}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{school.name}</h3><p>{school.city} · {school.region}</p></div></li>)}</ol>
      </section>

      <section className="home-section border-y border-[var(--line)] py-14">
        <div className="home-section-heading"><div><Eyebrow>Inter-school League</Eyebrow><h2>Season 1 is preparing to open.</h2><p className="mt-3 max-w-2xl text-[var(--ink-muted)]">{LEAGUE_SEASON.theme} will organise the first monthly Official Season. Schools and Teams can already inspect the shared Challenge briefings and practise their decisions.</p></div><Link href="/league/season" className="home-primary-action">View Season 1 <ArrowRight size={17} /></Link></div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{LEAGUE_CHALLENGES_COMING_SOON.map((challenge) => <Link key={challenge.slug} href={`/league/arena/${challenge.slug}/`} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)]"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--accent)]">Coming soon · {challenge.eyebrow}</p><h3 className="mt-3 text-lg font-bold tracking-[-.035em]">{challenge.title}</h3><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{challenge.stageCount} stages · practice preview available</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)]">View briefing <ArrowRight size={14} /></span></Link>)}</div>
        <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-xl bg-[var(--surface-subtle)] p-5"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--accent)]">Current season</p><p className="mt-2 text-lg font-bold">{LEAGUE_SEASON.title} · Coming soon</p></div><div className="rounded-xl bg-[var(--surface-subtle)] p-5"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--accent)]">League activity</p><p className="mt-2 text-lg font-bold">Partner schools are preparing Teams.</p></div><div className="rounded-xl bg-[var(--surface-subtle)] p-5"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--accent)]">Persistent World</p><Link href="/league/world" className="mt-2 inline-flex text-lg font-bold text-[var(--ink)] hover:text-[var(--accent)]">World Economy remains live <ArrowRight size={15} /></Link></div></div>
      </section>

      <section className="home-section home-thesis-section">
        <div className="home-section-grid">
          <div><Eyebrow>Platform thesis</Eyebrow><h2>Economics does not begin with a graph.</h2><p className="home-display-line">It begins with a problem.</p></div>
          <div className="home-thesis-copy">
            <p>EconMind OS starts with the issue in front of a learner: a price change, a resource constraint, a market failure, a policy choice or a strategic decision.</p>
            <ol>
              <li><b>Observe the situation.</b><span>Identify the people, institutions, constraints and incentives involved.</span></li>
              <li><b>Build a model.</b><span>Choose a mechanism and name the assumptions that make it useful.</span></li>
              <li><b>Run the counterfactual.</b><span>Change a variable, inspect the pathway and compare possible outcomes.</span></li>
              <li><b>Check the evidence.</b><span>Ask what supports the claim, what is missing and what remains uncertain.</span></li>
            </ol>
          </div>
        </div>
      </section>

      <section className="home-section home-explore-section" id="explore">
        <div className="home-section-heading"><div><Eyebrow>Explore EconMind</Eyebrow><h2>Five systems. One disciplined way to reason.</h2></div><Link href="/explore" className="home-text-link">Open the full directory <ArrowRight size={15} /></Link></div>
        <div className="home-zones-grid">{zones.map((zone) => { const Icon = zone.icon; return <Link key={zone.title} href={zone.href} className="home-zone-card"><div className="flex items-start justify-between gap-4"><span className="home-zone-number">{zone.number}</span><Icon size={21} /></div><h3>{zone.title}</h3><p className="home-zone-detail">{zone.detail}</p><p>{zone.description}</p><span className="home-text-link">Enter system <ArrowRight size={15} /></span></Link>; })}</div>
      </section>

      <section className="home-section home-real-world-section">
        <div className="home-split-heading"><div><Eyebrow>Real World</Eyebrow><h2>Economic context, ready for a question.</h2><p>Daily Brief connects reviewed public economic developments to the tools used to investigate them. Cases make a decision, its constraints and its consequences visible.</p></div><HomeContextSummary /></div>
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <HomeDailyBriefPreview />
          <article className="home-case-card"><p className="home-card-eyebrow">Featured case</p><h3>Restaurant Food Waste</h3><p>Balance preparation, stockouts, waste, customer experience and risk in a transparent perishable-inventory decision.</p><div className="mt-6 flex flex-wrap gap-2"><span className="home-chip">Newsvendor logic</span><span className="home-chip">Operational trade-off</span></div><Link href="/cases/restaurant-food-waste" className="home-text-link">Open featured case <ArrowRight size={15} /></Link></article>
        </div>
      </section>

      <section className="home-section home-models-section">
        <div className="home-section-heading"><div><Eyebrow>Models & Simulation</Eyebrow><h2>Start with the mechanism.</h2><p className="mt-3 max-w-2xl text-[var(--ink-muted)]">Thirty-five focused models make the connection between assumption, equation, curve and interpretation inspectable.</p></div><Link href="/models" className="home-primary-action">Browse all models <ArrowRight size={17} /></Link></div>
        <div className="home-model-family-grid">{modelFamilies.map((family, index) => <Link key={family.title} href={family.href} className="home-model-family"><span>{String(index + 1).padStart(2, "0")} · {family.tag}</span><div className={`home-model-motif home-model-motif-${index + 1}`} aria-hidden="true"><i /><b /><em /></div><h3>{family.title}</h3><p>{family.detail}</p><span className="home-text-link">Explore <ArrowRight size={15} /></span></Link>)}</div>
        <div className="home-simulation-ribbon"><div><Eyebrow>Policy transmission</Eyebrow><h3>Sandbox, Policy Lab and Integrated Workspace</h3><p>Explore a policy mechanism, trace delayed effects into indicators and compare distributional consequences. These are transparent educational scenarios—not forecasts.</p></div><div className="home-transmission-chain" aria-label="Policy transmission diagram"><span>Policy</span><ArrowRight size={17} /><span>Mechanism</span><ArrowRight size={17} /><span>Indicators</span><ArrowRight size={17} /><span>Feedback</span></div><div className="flex flex-wrap gap-3"><Link href="/sandbox" className="home-secondary-action">Open Sandbox</Link><Link href="/workspace" className="home-text-link">Integrated Workspace <ArrowRight size={15} /></Link></div></div>
      </section>

      <section className="home-section home-evidence-section">
        <div className="home-evidence-panel"><div><Eyebrow>Evidence Lab</Eyebrow><h2>A model is not the real world.<br />Test it.</h2><p>Move from theory to a focused question, a curated teaching sample, a method, an evidence claim and its limits. Evidence Lab is deliberately upload-free in this release.</p><Link href="/research" className="home-primary-action">Enter Evidence Lab <ArrowRight size={17} /></Link></div><EvidenceMotif /></div>
      </section>

      <section className="home-section home-league-section">
        <div className="home-league-panel"><div><Eyebrow>Inter-school League</Eyebrow><h2>{PARTICIPATING_SCHOOL_COUNT} schools.<br />One connected economic world.</h2><p>Teams learn through one persistent fictional economy: countries remain connected, policies take time to work, and decisions create effects beyond one screen.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/league" className="home-primary-action">Explore the League <ArrowRight size={17} /></Link><Link href="/league/join" className="home-secondary-action">Join a school team <UsersRound size={16} /></Link></div></div><SchoolCityMap /></div>
      </section>

      <section className="home-section home-how-section">
        <div><Eyebrow>How EconMind works</Eyebrow><h2>Reason from a world, not just a worksheet.</h2></div>
        <ol className="home-how-grid">{howItWorks.map(([number, title, detail]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{detail}</p></li>)}</ol>
      </section>

      <section className="home-final-gateway"><div><Eyebrow>Choose your entry point</Eyebrow><h2>Start where the question is.</h2></div><div className="home-final-actions"><Link href="/explore"><Target size={20} /><span>Explore Economics</span><ArrowRight size={17} /></Link><Link href="/league"><Globe2 size={20} /><span>Join the League</span><ArrowRight size={17} /></Link><Link href="/research"><FlaskConical size={20} /><span>Enter Evidence Lab</span><ArrowRight size={17} /></Link></div></section>
    </main>
  );
}

function HeroVisual() {
  return (
    <aside className="home-hero-summary" aria-label="Economic reasoning mechanism">
      <p className="home-hero-summary-kicker">ONE CLEAR MECHANISM</p>
      <div className="home-hero-summary-steps">
        <section>
          <span>01</span>
          <div><b>Assumption</b><p>State the market, agents and constraints.</p></div>
        </section>
        <section>
          <span>02</span>
          <div><b>Mechanism</b><p>Trace how incentives change demand or supply.</p></div>
        </section>
        <section>
          <span>03</span>
          <div><b>Interpretation</b><p>Compare the outcome with the real-world question.</p></div>
        </section>
      </div>
      <div className="home-hero-summary-foot"><p>Y = C + I + G + (X − M)</p><span>Assumptions → mechanism → interpretation</span></div>
    </aside>
  );
}

function HomeContextSummary() {
  return <aside className="home-context-summary" aria-label="Daily Brief learning flow"><p>DAILY BRIEF</p><strong>Context before conclusion.</strong><ol><li>Issue</li><li>Evidence</li><li>Question</li></ol></aside>;
}

function SchoolCityMap() {
  const mapAsset = process.env.GITHUB_PAGES === "true" ? "/econmind-os/league-cities-map.png" : "/league-cities-map.png";
  return <div className="home-league-city-map" aria-label="Participating school cities in China"><div className="home-city-map-art"><Image src={mapAsset} alt="Map of China with Taiwan Island and the South China Sea islands shown, overlaid with participating school cities" width={2356} height={2312} unoptimized /><ol>{leagueCityHubs.map((hub) => <li key={hub.city} style={{ "--city-x": `${hub.x}%`, "--city-y": `${hub.y}%`, "--label-x": `${hub.labelX ?? 10}px`, "--label-y": `${hub.labelY ?? -17}px` } as React.CSSProperties}><i /><span><b>{hub.city}</b>{hub.schools > 1 && <em> · {hub.schools}</em>}</span></li>)}</ol></div><div className="home-city-map-caption"><b>11 city hubs</b><span>{PARTICIPATING_SCHOOL_COUNT} participating schools</span></div></div>;
}

function EvidenceMotif() {
  return <div className="home-evidence-motif" aria-label="Evidence Lab workflow"><p>Evidence workflow</p><ol>{["Theory", "Data", "Method", "Claim", "Limits"].map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><b>{step}</b></li>)}</ol></div>;
}
