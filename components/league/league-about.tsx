"use client";

import Link from "next/link";
import { ArrowRight, Building2, CircleCheck, CirclePlay, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLiveLeagueSchools } from "@/components/league/use-live-league-schools";

export function LeagueAbout() {
  const { schools, syncStatus } = useLiveLeagueSchools();

  return (
    <main className="mx-auto min-h-screen max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12">
      <header className="border-b border-[var(--line)] pb-10">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">EconMind OS League</p>
        <h1 className="mt-2 text-5xl font-bold tracking-[-.07em] sm:text-6xl">About the League</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-muted)]">
          EconMind League is the organisational layer for schools and teams:
          maintain school identities, build local communities and coordinate
          participation across the network.
        </p>
      </header>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        <Principle icon={Building2} title="Schools" detail="Each participating school has a public identity and one or more School Leaders." />
        <Principle icon={UsersRound} title="Teams" detail="School Leaders can create and organise Teams within their own school." />
        <Principle icon={CircleCheck} title="Privacy" detail="Membership and invite codes remain available only to the people authorised for that school." />
      </section>

      <section className="mt-12 grid gap-7 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">How participation works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-.055em]">Join a school, then join a team.</h2>
          <ol className="mt-6 space-y-5">
            <Step number="01" title="Create or sign in to an EconMind account" detail="League participation uses an individual account, so school membership and responsibility remain attributable." />
            <Step number="02" title="Choose an existing school or request a new one" detail="School requests follow the established approval workflow. Approved schools receive a School Leader." />
            <Step number="03" title="Join a Team" detail="A School Leader can create, rename and archive Teams for their own school. Participants use an active invite code to join." />
          </ol>
        </div>
        <Card className="p-7">
          <CirclePlay className="text-[var(--accent)]" size={24} />
          <h2 className="mt-6 text-2xl font-bold">Simulation is open separately.</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Simulation is available directly to explore economic systems. It is
            not part of the League organisation or its school membership flow.
          </p>
          <Link href="/simulation" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
            Open Simulation <ArrowRight size={14} />
          </Link>
        </Card>
      </section>

      <section className="mt-10 border-y border-[var(--line)] py-9">
        <div className="grid gap-5 sm:grid-cols-3">
          <Stat value={String(schools.length)} label="Partner schools" detail={schoolCountStatus(syncStatus)} />
          <Stat value="School-led" label="Local coordination" />
          <Stat value="Open" label="Simulation access" />
        </div>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <CircleCheck className="text-[var(--accent)]" size={21} />
          <h2 className="mt-5 text-xl font-bold">Public and private by design</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            School identities and public Team counts may appear in the directory.
            Emails, invite codes and individual membership details do not.
          </p>
        </Card>
        <Card className="p-6">
          <UsersRound className="text-[var(--accent)]" size={21} />
          <h2 className="mt-5 text-xl font-bold">School Leader responsibility</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            School Leaders maintain their own school profile, view their school
            members and manage their own Teams. They do not receive cross-school administration rights.
          </p>
          <Link href="/league/schools" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
            Explore Schools <ArrowRight size={14} />
          </Link>
        </Card>
      </section>
    </main>
  );
}

function Principle({ icon: Icon, title, detail }: { icon: typeof Building2; title: string; detail: string }) {
  return <Card className="p-6"><Icon className="text-[var(--accent)]" size={21} /><h2 className="mt-5 text-xl font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{detail}</p></Card>;
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <li className="grid grid-cols-[2.5rem_1fr] gap-3"><b className="text-[var(--accent)]">{number}</b><div><p className="font-bold">{title}</p><p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{detail}</p></div></li>;
}

function schoolCountStatus(status: "syncing" | "live" | "fallback") {
  if (status === "live") return "Live directory checked";
  if (status === "fallback") return "Verified roster shown while live sync reconnects";
  return "Checking live directory…";
}

function Stat({ value, label, detail }: { value: string; label: string; detail?: string }) {
  return <div><p className="text-3xl font-bold tracking-[-.06em]">{value}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-muted)]">{label}</p>{detail && <p className="mt-2 text-xs text-[var(--ink-faint)]" role="status" aria-live="polite">{detail}</p>}</div>;
}
