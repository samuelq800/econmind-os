"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Factory,
  Globe2,
  History,
  LoaderCircle,
  LockKeyhole,
  Play,
  TimerReset,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  LEAGUE_CHALLENGE_CATALOG,
} from "@/lib/economics/league-arena";
import type { LeagueChallenge } from "@/lib/league/async-challenge-types";
import { listLeagueChallenges } from "@/lib/supabase/league-challenges";

const modeIcons = {
  world: Globe2,
  time_machine: History,
  industry: Factory,
} as const;

export function LeagueSimulationArena() {
  const [challenges, setChallenges] = useState<LeagueChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listLeagueChallenges()
      .then(setChallenges)
      .catch(() => setChallenges([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-6 py-10 sm:px-10 lg:px-12">
        <div className="page-grid absolute inset-0 opacity-50" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">
              EconMind OS League
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-[-.06em] sm:text-5xl lg:text-6xl">
              Simulation Arena
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-muted)]">
              Shared starting conditions. Flexible team sizes. No live-round
              requirement. Practise freely, then make up to five saved official
              attempts per team and compete on a transparent 0–100 score.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <ArenaFact icon={Building2} label="Competitive unit" value="Team" />
            <ArenaFact icon={TimerReset} label="Official attempts" value="5 best-score" />
            <ArenaFact icon={LockKeyhole} label="Decision rule" value="Stage locks" />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">
              Challenge library
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-.045em]">
              Choose a system to run.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[var(--ink-muted)]">
            Practice does not affect standings. Official runs use a fixed
            snapshot; submitted stages cannot be changed after later
            information is revealed.
          </p>
        </div>
        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <LoaderCircle className="animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <div className="mt-7 grid gap-5 xl:grid-cols-3">
            {LEAGUE_CHALLENGE_CATALOG.map((definition) => {
              const configured = challenges.find(
                (challenge) => challenge.slug === definition.slug,
              );
              const Icon = modeIcons[definition.simulationType];
              const open = configured?.status === "open";
              return (
                <Card key={definition.slug} className="flex min-h-[450px] flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Icon size={21} />
                    </span>
                    <Badge className={open ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : ""}>
                      {open ? "Official open" : "Preview"}
                    </Badge>
                  </div>
                  <p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">
                    {definition.eyebrow}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold tracking-[-.04em]">
                    {definition.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
                    {definition.summary}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ink-muted)]">
                      {definition.stageCount} decision stages
                    </span>
                    <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ink-muted)]">
                      {definition.officialAttemptLimit} official attempts
                    </span>
                  </div>
                  <div className="mt-auto grid gap-2 pt-8 sm:grid-cols-2">
                    <Link
                      href={`/league/arena/${definition.slug}/?mode=practice`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold hover:bg-[var(--surface-subtle)]"
                    >
                      <Play size={14} /> Practice
                    </Link>
                    <Link
                      href={`/league/arena/${definition.slug}/?mode=official`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-white hover:bg-[var(--accent-strong)]"
                    >
                      Official <ArrowRight size={14} />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <BadgeCheck className="text-[var(--accent)]" size={21} />
          <h2 className="mt-5 text-xl font-bold">A score you can audit</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Every official result is a deterministic Performance Score out of
            100. World Economy starts from 100 and shows four capped penalties;
            Time Machine and Industry Arena display their published category
            weights.
          </p>
        </Card>
        <Card className="p-6">
          <History className="text-[var(--accent)]" size={21} />
          <h2 className="mt-5 text-xl font-bold">Ghosts without information leaks</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Completed official strategies become reusable Ghosts automatically.
            While a Challenge is open, they are anonymous and expose behaviour,
            not a competing team’s identity or full strategy record.
          </p>
        </Card>
      </section>
    </main>
  );
}

function ArenaFact({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
      <Icon size={17} className="text-[var(--accent)]" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--ink-faint)]">{label}</p>
        <p className="mt-1 text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}
