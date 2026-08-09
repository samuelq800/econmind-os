"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Factory, Globe2, History, Landmark, LoaderCircle, LockKeyhole, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LEAGUE_CHALLENGE_CATALOG } from "@/lib/economics/league-arena";
import type { LeagueChallenge } from "@/lib/league/async-challenge-types";
import { listLeagueChallenges } from "@/lib/supabase/league-challenges";

const modeIcons = { world: Globe2, time_machine: History, industry: Factory, financial: Landmark } as const;
const formatFacts = {
  world: ["12 economies", "4 portfolios", "Interconnected world", "0–100 score"],
  time_machine: ["5 decision stages", "Historical information", "Counterfactual path", "0–100 score"],
  industry: ["5 core decisions", "Strategic competition", "League Ghosts", "0–100 score"],
  financial: ["Interbank network", "Liquidity risk", "Contagion", "0–100 score"],
} as const;

export function LeagueSimulationArena() {
  const [challenges, setChallenges] = useState<LeagueChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void listLeagueChallenges().then(setChallenges).catch(() => setChallenges([])).finally(() => setLoading(false)); }, []);
  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12"><section className="relative overflow-hidden border-b border-[var(--line)] pb-12"><div className="page-grid absolute inset-0 opacity-40" /><div className="relative grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end"><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">EconMind OS League</p><h1 className="mt-3 text-5xl font-bold tracking-[-.07em] sm:text-7xl">Simulation<br />Arena.</h1><p className="mt-5 max-w-xl text-lg leading-8 text-[var(--ink-muted)]">Four ways to think. One economic league. Teams work asynchronously from shared conditions; practice freely, then submit up to five official attempts for a transparent best-score ranking.</p></div><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><ArenaFact icon={Building2} label="Competitive unit" value="Team" /><ArenaFact icon={TimerReset} label="Official attempts" value="5 · highest score" /><ArenaFact icon={LockKeyhole} label="Progress rule" value="Decision stages lock" /></div></div></section><section className="mt-8">{loading ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : <div className="divide-y divide-[var(--line)]">{LEAGUE_CHALLENGE_CATALOG.map((definition, index) => { const configured = challenges.find((challenge) => challenge.slug === definition.slug); const Icon = modeIcons[definition.simulationType]; return <article key={definition.slug} className="grid gap-8 py-10 lg:grid-cols-[.55fr_1.1fr_.85fr] lg:items-center"><div><p className="text-6xl font-bold tracking-[-.08em] text-[var(--accent)]">0{index + 1}</p><p className="mt-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">{definition.eyebrow}</p></div><div><h2 className="text-4xl font-bold tracking-[-.06em] sm:text-5xl">{definition.simulationType === "world" ? "Run a country." : definition.simulationType === "time_machine" ? "Enter history." : definition.simulationType === "industry" ? "Run a firm." : "Run a bank."}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">{definition.summary}</p><div className="mt-5 flex flex-wrap gap-2">{formatFacts[definition.simulationType].map((fact) => <span key={fact} className="border border-[var(--line)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ink-muted)]">{fact}</span>)}</div></div><div className="border-l-0 border-[var(--line)] pl-0 lg:border-l lg:pl-8"><span className="grid size-12 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--accent)]"><Icon size={22} /></span><div className="mt-5 flex items-center gap-3"><Badge className={configured?.status === "open" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : ""}>{configured?.status === "open" ? "Official open" : "Preview"}</Badge><span className="text-xs text-[var(--ink-muted)]">{definition.stageCount} stages</span></div><Link href={`/league/arena/${definition.slug}/`} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Explore challenge <ArrowRight size={15} /></Link></div></article>; })}</div>}</section></main>;
}

function ArenaFact({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: string }) {
  return <div className="flex items-center gap-3 border border-[var(--line)] bg-[var(--surface-subtle)] p-4"><Icon size={17} className="text-[var(--accent)]" /><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--ink-faint)]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div></div>;
}
