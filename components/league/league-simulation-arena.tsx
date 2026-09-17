"use client";

import Link from "next/link";
import { ArrowRight, CirclePlay, Factory, Globe2, History, Landmark } from "lucide-react";
import { LEAGUE_CHALLENGE_CATALOG } from "@/lib/economics/league-arena";

const modeIcons = { world: Globe2, time_machine: History, industry: Factory, financial: Landmark } as const;
const formatFacts = {
  world: ["12 economies", "4 portfolios", "Shared starting condition"],
  time_machine: ["5 decision stages", "Historical information", "Counterfactual path"],
  industry: ["5 core decisions", "Strategic competition", "Ghost Strategies"],
  financial: ["Interbank network", "Liquidity risk", "Contagion"],
} as const;

/** Shared by the public Simulation routes. Legacy League routes redirect here. */
export function LeagueSimulationArena({ basePath = "/simulation/arena", systemLabel = "EconMind OS Simulation" }: { basePath?: string; systemLabel?: string } = {}) {
  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12"><section className="relative overflow-hidden border-b border-[var(--line)] pb-12"><div className="page-grid absolute inset-0 opacity-40" /><div className="relative grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end"><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">{systemLabel} · scenario library</p><h1 className="mt-3 text-5xl font-bold tracking-[-.07em] sm:text-7xl">Simulation<br />Arena.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--ink-muted)]">Open a scenario, inspect its starting conditions and experiment with decisions at your own pace. No League season or team is required.</p></div><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><ArenaFact icon={Globe2} label="Access" value="Open exploration" /><ArenaFact icon={History} label="Scenarios" value={`${LEAGUE_CHALLENGE_CATALOG.length} systems`} /><ArenaFact icon={CirclePlay} label="Mode" value="Practice and replay" /></div></div></section><section className="mt-8 divide-y divide-[var(--line)]">{LEAGUE_CHALLENGE_CATALOG.map((definition, index) => { const Icon = modeIcons[definition.simulationType]; return <article key={definition.slug} className="grid gap-8 py-10 lg:grid-cols-[.55fr_1.1fr_.85fr] lg:items-center"><div><p className="text-6xl font-bold tracking-[-.08em] text-[var(--accent)]">0{index + 1}</p><p className="mt-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">{definition.eyebrow}</p></div><div><h2 className="text-3xl font-bold tracking-[-.055em] sm:text-4xl">{definition.title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">{definition.summary}</p><div className="mt-5 flex flex-wrap gap-2">{formatFacts[definition.simulationType].map((fact) => <span key={fact} className="border border-[var(--line)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ink-muted)]">{fact}</span>)}</div></div><div className="border-l-0 border-[var(--line)] pl-0 lg:border-l lg:pl-8"><span className="grid size-12 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--accent)]"><Icon size={22} /></span><p className="mt-5 text-xs text-[var(--ink-muted)]">{definition.stageCount} stages</p><Link href={`${basePath}/${definition.slug}/`} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white"><CirclePlay size={15} /> Explore scenario</Link><Link href={`${basePath}/${definition.slug}/workspace/?mode=practice`} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Start simulation <ArrowRight size={14} /></Link></div></article>; })}</section></main>;
}

function ArenaFact({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: string }) {
  return <div className="flex items-center gap-3 border border-[var(--line)] bg-[var(--surface-subtle)] p-4"><Icon size={17} className="text-[var(--accent)]" /><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--ink-faint)]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div></div>;
}
