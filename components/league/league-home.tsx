"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CalendarDays, CirclePlay, Globe2, History, Landmark, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LEAGUE_CHALLENGES_COMING_SOON, LEAGUE_SEASON } from "@/lib/league/league-season";
import type { PublicLeagueSchool } from "@/lib/supabase/league-directory";
import { listPublicLeagueSchools } from "@/lib/supabase/league-directory";

const icons = { world: Globe2, time_machine: History, industry: Building2, financial: Landmark } as const;

const preparationActivity = [
  { title: "Season 1 is being prepared", detail: "The Global Inflation theme will open once the public season calendar is announced.", when: "Coming soon" },
  { title: "Official Challenges are in preview", detail: "Teams can inspect each shared starting condition before official attempts begin.", when: "Coming soon" },
  { title: "Continuous World remains live", detail: "Its persistent fictional economy keeps its separate time, country ownership and standings.", when: "Live now" },
] as const;

export function LeagueHome() {
  const [schools, setSchools] = useState<PublicLeagueSchool[]>([]);

  useEffect(() => {
    void listPublicLeagueSchools().then(setSchools).catch(() => setSchools([]));
  }, []);

  const rankedSchools = schools
    .filter((school) => school.current_season_points > 0)
    .sort((left, right) => right.current_season_points - left.current_season_points)
    .slice(0, 5);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div className="page-grid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-9 lg:grid-cols-[1.16fr_.84fr] lg:items-end">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">EconMind OS · inter-school academic competition</p>
              <h1 className="mt-3 text-[clamp(3.8rem,8vw,7.5rem)] font-bold leading-[.83] tracking-[-.085em]">League.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--ink-muted)]">A shared organisation for schools, teams, official challenges and a continuously running world economy.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/league/schools" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-white"><Building2 size={16} /> Explore schools</Link>
                <Link href="/league/teams" className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-5 text-sm font-bold"><UsersRound size={16} /> Find your team</Link>
              </div>
            </div>
            <section className="border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">Current season</p><h2 className="mt-2 text-3xl font-bold tracking-[-.05em]">{LEAGUE_SEASON.title}</h2></div><Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]">Coming soon</Badge></div>
              <p className="mt-3 text-sm font-semibold">{LEAGUE_SEASON.theme}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{LEAGUE_SEASON.summary}</p>
              <div className="mt-6 grid grid-cols-2 gap-px bg-[var(--line)]"><Fact value="30 days" label="Season length" /><Fact value="4" label="Official challenges" /></div>
              <Link href="/league/season" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">View season details <ArrowRight size={14} /></Link>
            </section>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-12">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Live School Standings</p><h2 className="mt-2 text-3xl font-bold tracking-[-.055em]">One identity beyond a single simulation.</h2></div><Link href="/league/standings" className="inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)]">All standings <ArrowRight size={14} /></Link></div>
          <Card className="mt-6 overflow-hidden p-0">
            {rankedSchools.length ? <ol>{rankedSchools.map((school, index) => <li key={school.school_id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-[var(--line)] px-5 py-4 last:border-0"><b className="text-[var(--accent)]">{index + 1}</b><div><p className="font-bold">{school.school_name}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">{school.team_count} active team{school.team_count === 1 ? "" : "s"}</p></div><b className="font-mono text-sm">{school.current_season_points.toFixed(1)}</b></li>)}</ol> : <div className="p-6"><p className="font-bold">Season standings will appear here.</p><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">Season 1 is not yet open, so no school has official season points. The standings will aggregate each Team’s best official score for every current challenge.</p></div>}
          </Card>
        </section>

        <section>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Recent League Activity</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-.055em]">What is happening now.</h2>
          <ol className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">{preparationActivity.map((activity) => <li key={activity.title} className="py-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{activity.title}</p><p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{activity.detail}</p></div><span className="shrink-0 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--accent)]">{activity.when}</span></div></li>)}</ol>
        </section>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]"><div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Current Official Challenges</p><h2 className="mt-2 text-3xl font-bold tracking-[-.055em]">Four shared starting conditions.</h2></div><p className="max-w-xl text-sm leading-6 text-[var(--ink-muted)]">Official attempts open with the season. Each card remains available for briefing and practice preview, while the existing simulation engines stay unchanged.</p></div><div className="mt-8 grid gap-5 md:grid-cols-2">{LEAGUE_CHALLENGES_COMING_SOON.map((challenge) => { const Icon = icons[challenge.simulationType]; return <Card key={challenge.slug} className="p-6"><div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={19} /></span><Badge>Coming soon</Badge></div><p className="mt-6 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">{challenge.eyebrow}</p><h3 className="mt-2 text-xl font-bold tracking-[-.035em]">{challenge.title}</h3><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{challenge.summary}</p><div className="mt-5 flex items-center justify-between gap-4 text-xs text-[var(--ink-muted)]"><span>{challenge.stageCount} decision stages</span><span>Official · 5 attempts</span></div><Link href={`/league/arena/${challenge.slug}/`} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><CirclePlay size={15} /> View briefing <ArrowRight size={14} /></Link></Card>; })}</div></div></section>

      <section className="mx-auto grid max-w-[1440px] gap-5 px-5 py-14 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:px-12"><Card className="p-7"><div className="flex items-start justify-between gap-4"><Globe2 className="text-[var(--accent)]" size={22} /><Badge>Independent system</Badge></div><h2 className="mt-6 text-2xl font-bold">Continuous World Economy</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">The Persistent World is not part of Season 1 points. It stays available as its own ongoing simulation with country teams, natural-time policies and its established current ranks.</p><Link href="/league/world" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Open Continuous World <ArrowRight size={14} /></Link></Card><Card className="p-7"><CalendarDays className="text-[var(--accent)]" size={22} /><h2 className="mt-6 text-2xl font-bold">Ready your school.</h2><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">School Leaders manage their own Teams. Participants can join an existing Team with its invite code, then practice before official challenges open.</p><Link href="/league/join" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Join the League <ArrowRight size={14} /></Link></Card></section>
    </main>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return <div className="bg-[var(--surface)] p-4"><p className="text-lg font-bold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-muted)]">{label}</p></div>;
}
