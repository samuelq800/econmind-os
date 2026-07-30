"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Filter, GitCompareArrows, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MECHANISM_CATEGORIES, MECHANISM_CONCEPTS, displayMechanismConcept, mechanismPath, mechanismScenarios, type MechanismScenario } from "@/lib/mechanism-arena/catalog";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";

export type ArenaProgress = {
  opened: Record<string, string>;
  completed: string[];
  compared: string[];
};

export const arenaProgressKey = "econmind:mechanism-arena:progress:v2";
export const emptyArenaProgress: ArenaProgress = { opened: {}, completed: [], compared: [] };

type ProgressFilter = "All" | "Not Started" | "In Progress" | "Completed";
type Sort = "Recommended" | "Difficulty" | "Estimated Time" | "Number of Participants" | "Recently Opened";

const difficultyOrder = { Beginner: 1, Intermediate: 2, Advanced: 3 };
const conceptScenarioIds: Record<string, string[]> = {
  "Private Information": ["MA-01-FIRST-PRICE", "MA-02-SECOND-PRICE", "MA-07-INSURANCE", "MA-09-PRINCIPAL-AGENT"],
  "Incentive Compatibility": ["MA-02-SECOND-PRICE", "MA-03-SCHOOL-MATCHING"],
  "Strategy-Proofness": ["MA-03-SCHOOL-MATCHING"],
  Externalities: ["MA-04-PUBLIC-GOODS", "MA-05-COMMON-POOL", "MA-06-CARBON-PERMITS"],
  "Moral Hazard": ["MA-07-INSURANCE", "MA-09-PRINCIPAL-AGENT"],
  "Adverse Selection": ["MA-07-INSURANCE"],
  "Coordination Failure": ["MA-08-BANK-RUN", "MA-10-REPEATED-PD"],
  "Repeated Interaction": ["MA-10-REPEATED-PD"],
  "Public Goods": ["MA-04-PUBLIC-GOODS"],
  "Common Resources": ["MA-05-COMMON-POOL"],
};

function progressStatus(scenario: MechanismScenario, progress: ArenaProgress) {
  if (progress.completed.includes(scenario.scenario_id)) return "Completed" as const;
  if (progress.opened[scenario.scenario_id]) return "In Progress" as const;
  return "Not Started" as const;
}

function participantCount(scenario: MechanismScenario) {
  return Number(scenario.typicalParticipants.match(/\d+/)?.[0] ?? "0");
}

export function MechanismArenaLibrary() {
  const [progress] = usePersistentState<ArenaProgress>(arenaProgressKey, emptyArenaProgress);
  const [category, setCategory] = useState<(typeof MECHANISM_CATEGORIES)[number]>("All");
  const [concept, setConcept] = useState<string>("All concepts");
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("All");
  const [sort, setSort] = useState<Sort>("Recommended");
  const latest = useMemo(() => Object.entries(progress.opened).sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0], [progress.opened]);
  const visible = useMemo(() => mechanismScenarios
    .filter((scenario) => category === "All" || scenario.category === category)
    .filter((scenario) => concept === "All concepts" || conceptScenarioIds[concept]?.includes(scenario.scenario_id))
    .filter((scenario) => progressFilter === "All" || progressStatus(scenario, progress) === progressFilter)
    .sort((a, b) => {
      if (sort === "Difficulty") return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty] || a.number - b.number;
      if (sort === "Estimated Time") return a.estimatedMinutes - b.estimatedMinutes || a.number - b.number;
      if (sort === "Number of Participants") return participantCount(a) - participantCount(b) || a.number - b.number;
      if (sort === "Recently Opened") return (progress.opened[b.scenario_id] ?? "").localeCompare(progress.opened[a.scenario_id] ?? "") || a.number - b.number;
      return a.number - b.number;
    }), [category, concept, progress, progressFilter, sort]);
  const completed = progress.completed.length;
  const compared = progress.compared.length;
  const recentTitle = mechanismScenarios.find((scenario) => scenario.scenario_id === latest)?.title ?? "None yet";

  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-6 sm:px-7 lg:max-h-[320px] lg:py-8">
      <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">Learning system · institutional experiments</p>
      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl"><h1 className="text-3xl font-bold tracking-[-.05em] sm:text-4xl">Mechanism Design Arena</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Change the rules, choose a strategy, and observe how institutions reshape incentives, allocation, efficiency and fairness.</p><ol className="mt-5 flex flex-wrap gap-x-2 gap-y-2 text-xs font-bold text-[var(--ink-muted)]"><li>Understand Rules</li><li aria-hidden="true" className="text-[var(--accent)]">→</li><li>Choose Strategy</li><li aria-hidden="true" className="text-[var(--accent)]">→</li><li>Run Mechanism</li><li aria-hidden="true" className="text-[var(--accent)]">→</li><li>Inspect Payoffs</li><li aria-hidden="true" className="text-[var(--accent)]">→</li><li>Compare Alternatives</li></ol></div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)] text-left sm:grid-cols-4 lg:min-w-[500px]">
          <HeroMetric value="10" label="preset mechanisms" />
          <HeroMetric value={String(completed)} label="experiments completed" />
          <HeroMetric value={String(compared)} label="mechanisms compared" />
          <HeroMetric value={recentTitle} label="recently opened" compact />
        </div>
      </div>
    </section>

    <section aria-label="Mechanism filters" className="mt-7 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-bold"><Filter size={15} className="text-[var(--accent)]" /> Filter the library</div>
      <div className="mt-4 flex flex-wrap gap-2">{MECHANISM_CATEGORIES.map((item) => <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>{item}</FilterChip>)}</div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
        <label className="text-xs font-bold">Concept<select value={concept} onChange={(event) => setConcept(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-normal outline-none focus:border-[var(--accent)]"><option>All concepts</option>{MECHANISM_CONCEPTS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-bold">Progress<select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as ProgressFilter)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-normal outline-none focus:border-[var(--accent)]">{(["All", "Not Started", "In Progress", "Completed"] as const).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-bold"><span className="flex items-center gap-1"><SlidersHorizontal size={13} /> Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-normal outline-none focus:border-[var(--accent)]">{(["Recommended", "Difficulty", "Estimated Time", "Number of Participants", "Recently Opened"] as const).map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
    </section>

    <section className="mt-7"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold tracking-[-.03em]">Preset mechanism library</h2><p className="mt-1 text-xs text-[var(--ink-muted)]">Each experiment discloses its rules, information set and permitted actions before it runs.</p></div><span className="text-xs font-bold text-[var(--ink-faint)]">{visible.length} of 10</span></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((scenario) => <MechanismCard key={scenario.scenario_id} scenario={scenario} status={progressStatus(scenario, progress)} />)}</div>
      {visible.length === 0 && <div className="mt-5 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">No mechanisms match these filters. Clear a filter to return to the full preset library.</div>}
    </section>
  </main>;
}

function HeroMetric({ value, label, compact = false }: { value: string; label: string; compact?: boolean }) { return <div className="min-w-0 bg-[var(--surface)] p-3"><p className={`font-bold tracking-[-.035em] ${compact ? "truncate text-sm" : "text-xl"}`}>{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[.08em] text-[var(--ink-faint)]">{label}</p></div>; }
function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={`min-h-9 rounded-full border px-3 text-xs font-bold transition ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--canvas)] text-[var(--ink-muted)] hover:border-[var(--line-strong)]"}`}>{children}</button>; }

function MechanismCard({ scenario, status }: { scenario: MechanismScenario; status: ReturnType<typeof progressStatus> }) {
  return <article className="flex min-h-[365px] flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-start justify-between gap-3"><Preview type={scenario.preview} /><div className="text-right"><p className="text-[10px] font-bold text-[var(--ink-faint)]">Mechanism {String(scenario.number).padStart(2, "0")}</p><Badge className={status === "Completed" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""}>{status}</Badge></div></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[.11em] text-[var(--ink-faint)]">{scenario.scenario_id}</p><h3 className="mt-2 text-lg font-bold tracking-[-.025em]">{scenario.title}</h3><p className="mt-2 text-sm leading-5 text-[var(--ink-muted)]">{scenario.institutionalProblem}</p><dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-[var(--line)] pt-4 text-xs"><Definition label="Category" value={scenario.category} /><Definition label="Difficulty" value={scenario.difficulty} /><Definition label="Participants" value={scenario.typicalParticipants} /><Definition label="Information" value={scenario.informationStructure} /></dl><div className="mt-4 flex flex-wrap gap-1.5">{scenario.concepts.map((concept) => <Badge key={concept} className="normal-case tracking-normal">{displayMechanismConcept(concept)}</Badge>)}</div><div className="mt-auto flex items-center justify-between gap-3 pt-5"><p className="text-[11px] font-semibold text-[var(--ink-faint)]">{scenario.estimatedMinutes} min</p><div className="flex gap-3"><Link href={mechanismPath(scenario.scenario_id)} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Open <ArrowRight size={13} /></Link>{scenario.comparisonId && <Link href={`${mechanismPath(scenario.scenario_id)}?mode=compare`} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--ink-muted)]"><GitCompareArrows size={13} /> Compare</Link>}</div></div></article>;
}

function Definition({ label, value }: { label: string; value: string }) { return <div><dt className="text-[9px] font-bold uppercase tracking-[.08em] text-[var(--ink-faint)]">{label}</dt><dd className="mt-1 leading-4 text-[var(--ink-muted)]">{value}</dd></div>; }

function Preview({ type }: { type: MechanismScenario["preview"] }) {
  const stroke = "var(--accent)";
  if (type === "matching") return <svg aria-label="Students linked to schools" viewBox="0 0 96 52" className="h-12 w-24"><circle cx="14" cy="12" r="5" fill="none" stroke={stroke} strokeWidth="2"/><circle cx="14" cy="38" r="5" fill="none" stroke={stroke} strokeWidth="2"/><rect x="70" y="7" width="16" height="13" rx="2" fill="none" stroke={stroke} strokeWidth="2"/><rect x="70" y="32" width="16" height="13" rx="2" fill="none" stroke={stroke} strokeWidth="2"/><path d="M20 13 70 13M20 38 70 38" stroke={stroke} strokeWidth="2"/></svg>;
  if (type === "public-goods") return <svg aria-label="Contributions enter a shared pool" viewBox="0 0 96 52" className="h-12 w-24"><circle cx="17" cy="12" r="5" fill="none" stroke={stroke} strokeWidth="2"/><circle cx="17" cy="40" r="5" fill="none" stroke={stroke} strokeWidth="2"/><path d="M23 13 45 22M23 39 45 30" stroke={stroke} strokeWidth="2"/><rect x="47" y="15" width="34" height="22" rx="4" fill="none" stroke={stroke} strokeWidth="2"/><path d="M54 26h20" stroke={stroke} strokeWidth="2"/></svg>;
  if (type === "common-pool") return <svg aria-label="Harvest against regenerating stock" viewBox="0 0 96 52" className="h-12 w-24"><path d="M8 36c14-21 29-21 43 0s28 21 37 0" fill="none" stroke={stroke} strokeWidth="2"/><path d="M25 23v-9m-4 4 4-4 4 4M67 23v-9m-4 4 4-4 4 4" stroke={stroke} strokeWidth="2"/></svg>;
  if (type === "permits") return <svg aria-label="Permit trades between firms" viewBox="0 0 96 52" className="h-12 w-24"><rect x="8" y="13" width="22" height="26" rx="3" fill="none" stroke={stroke} strokeWidth="2"/><rect x="66" y="13" width="22" height="26" rx="3" fill="none" stroke={stroke} strokeWidth="2"/><path d="M33 26h28m-6-6 6 6-6 6" stroke={stroke} strokeWidth="2"/></svg>;
  if (type === "insurance" || type === "bank") return <svg aria-label="Risk enters a shared pool" viewBox="0 0 96 52" className="h-12 w-24"><path d="M48 7 72 16v13c0 10-10 15-24 18-14-3-24-8-24-18V16z" fill="none" stroke={stroke} strokeWidth="2"/><path d="M48 16v20M38 26h20" stroke={stroke} strokeWidth="2"/></svg>;
  if (type === "contract") return <svg aria-label="Contract leads to effort and output" viewBox="0 0 96 52" className="h-12 w-24"><path d="M18 8h34l12 12v24H18z" fill="none" stroke={stroke} strokeWidth="2"/><path d="M52 8v12h12M27 29h26M27 36h20" stroke={stroke} strokeWidth="2"/></svg>;
  if (type === "pd") return <svg aria-label="Repeated payoff matrix" viewBox="0 0 96 52" className="h-12 w-24"><rect x="22" y="8" width="52" height="36" fill="none" stroke={stroke} strokeWidth="2"/><path d="M48 8v36M22 26h52" stroke={stroke} strokeWidth="2"/><path d="m77 18 10 8-10 8" fill="none" stroke={stroke} strokeWidth="2"/></svg>;
  return <svg aria-label="Auction values and bids" viewBox="0 0 96 52" className="h-12 w-24"><path d="M9 44h80" stroke="var(--line-strong)" strokeWidth="2"/><rect x="18" y="20" width="9" height="24" rx="1" fill="var(--accent-soft)" stroke={stroke} strokeWidth="2"/><rect x="30" y="28" width="9" height="16" rx="1" fill="none" stroke={stroke} strokeWidth="2"/><rect x="50" y="11" width="9" height="33" rx="1" fill="var(--accent-soft)" stroke={stroke} strokeWidth="2"/><rect x="62" y="20" width="9" height="24" rx="1" fill="none" stroke={stroke} strokeWidth="2"/></svg>;
}
