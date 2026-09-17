"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CirclePlay, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PublicLeagueSchool } from "@/lib/supabase/league-directory";
import { listPublicLeagueSchools } from "@/lib/supabase/league-directory";

export function LeagueHome() {
  const [schools, setSchools] = useState<PublicLeagueSchool[]>([]);

  useEffect(() => {
    void listPublicLeagueSchools().then(setSchools).catch(() => setSchools([]));
  }, []);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div className="page-grid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-9 lg:grid-cols-[1.16fr_.84fr] lg:items-end">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">
                EconMind OS · inter-school network
              </p>
              <h1 className="mt-3 text-[clamp(3.8rem,8vw,7.5rem)] font-bold leading-[.83] tracking-[-.085em]">
                League.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--ink-muted)]">
                A shared organisation for schools, school leaders and teams to
                build an academic economics community together.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/league/schools" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-white">
                  <Building2 size={16} /> Explore schools
                </Link>
                <Link href="/league/teams" className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-5 text-sm font-bold">
                  <UsersRound size={16} /> Find your team
                </Link>
              </div>
            </div>
            <Card className="p-6">
              <Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
                Open now
              </Badge>
              <h2 className="mt-5 text-3xl font-bold tracking-[-.05em]">
                Simulation is separate.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                Explore the open economic simulations directly, without joining
                a League season or a school team first.
              </p>
              <Link href="/simulation" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
                Open Simulation <ArrowRight size={14} />
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-12">
        <section>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
            Partner schools
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-.055em]">
            A growing school network.
          </h2>
          <Card className="mt-6 overflow-hidden p-0">
            {schools.length ? (
              <ol>
                {schools.slice(0, 5).map((school) => (
                  <li key={school.school_id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-[var(--line)] px-5 py-4 last:border-0">
                    <Building2 className="text-[var(--accent)]" size={16} />
                    <div>
                      <p className="font-bold">{school.school_name}</p>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">
                        {school.team_count} active team{school.team_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Link href={`/league/schools/profile/?school=${encodeURIComponent(school.school_name)}`} className="text-xs font-bold text-[var(--accent)]">
                      Profile
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="p-6">
                <p className="font-bold">School profiles will appear here.</p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
                  The League directory is available once partner-school records
                  are loaded.
                </p>
              </div>
            )}
          </Card>
          <Link href="/league/schools" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
            View all schools <ArrowRight size={14} />
          </Link>
        </section>

        <section>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
            League participation
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-.055em]">
            Organise locally.
          </h2>
          <div className="mt-6 grid gap-4">
            <Card className="p-6">
              <Building2 className="text-[var(--accent)]" size={21} />
              <h3 className="mt-5 text-xl font-bold">Schools</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Maintain a school identity and designate School Leaders to keep
                its public profile and member community current.
              </p>
            </Card>
            <Card className="p-6">
              <UsersRound className="text-[var(--accent)]" size={21} />
              <h3 className="mt-5 text-xl font-bold">Teams</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Create teams inside your school and use invite codes to manage
                membership privately.
              </p>
              <Link href="/league/join" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
                Join the League <ArrowRight size={14} />
              </Link>
            </Card>
          </div>
        </section>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-6 px-5 py-10 sm:px-8 lg:px-12">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Open learning</p>
            <h2 className="mt-2 text-2xl font-bold">Ready to explore an economy?</h2>
          </div>
          <Link href="/simulation" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-white">
            <CirclePlay size={16} /> Open Simulation
          </Link>
        </div>
      </section>
    </main>
  );
}
