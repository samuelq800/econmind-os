"use client";

import Link from "next/link";
import { ArrowRight, Building2, ChartNoAxesCombined, CircleAlert, FlaskConical, Landmark, Scale, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const moduleCards = [
  { title: "Economic Crisis Sprint", status: "Playable", href: "/league/crisis-sprint", icon: CircleAlert, play: "Make two rounds of connected monetary, fiscal and energy decisions under an oil shock.", skill: "Policy trade-offs, macro transmission and consequence analysis." },
  { title: "Model Battle", status: "Pilot Ready", href: "/league/model-battle", icon: Scale, play: "Compare competing economic models against one policy question.", skill: "Assumptions, evidence and model evaluation." },
  { title: "Market Strategy League", status: "Planned", href: "/league/market-strategy", icon: ChartNoAxesCombined, play: "A future macro-informed virtual investment format.", skill: "Risk, diversification and investment reasoning." },
  { title: "Live Behavioural Economics Lab", status: "Preview", href: "/league/behavioural-lab", icon: Users, play: "A future collection of strategic decision experiments.", skill: "Incentives, coordination and behavioural evidence." },
  { title: "Economic Constitution Lab", status: "Preview", href: "/league/constitution-lab", icon: Landmark, play: "Test institutional choices against future economic shocks.", skill: "Institutional design and long-run trade-offs." },
] as const;

function Status({ value }: { value: string }) {
  const style = value === "Playable" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : value === "Pilot Ready" ? "border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]" : value === "Preview" ? "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]" : "";
  return <Badge className={style}>{value}</Badge>;
}

export function LeagueHome() {
  const { user, roleLoading, openAuth } = useAuth();
  return <main>
    <section className="relative overflow-hidden border-b border-[var(--line)]">
      <div className="page-grid absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]">Inter-school pilot · in development</Badge>
        <div className="mt-7 grid gap-12 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div className="max-w-4xl"><h1 className="text-[clamp(3.3rem,7vw,6.6rem)] font-bold leading-[.9] tracking-[-.075em]">EconMind Inter-School Economic League</h1><p className="mt-7 text-xl font-semibold tracking-[-.02em] sm:text-2xl">Don’t just study the economy. Run it.</p><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">A cross-school platform where students make economic decisions, respond to crises, test models and analyse real consequences.</p></div>
          <Card className="grid gap-px overflow-hidden bg-[var(--line)] sm:grid-cols-2">
            {[['6–7', 'Founding Schools in Discussion'], ['Multiple', 'Competition Formats'], ['Policy, Markets', 'and Behaviour'], ['First Pilot', 'Under Development']].map(([value, label]) => <div key={label} className="bg-[var(--surface)] p-5"><p className="text-2xl font-bold tracking-[-.04em]">{value}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">{label}</p></div>)}
          </Card>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          {user ? <Link href="/league/dashboard" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-white hover:bg-[var(--accent-strong)]">View My Dashboard <ArrowRight size={16} /></Link> : <Button onClick={() => openAuth("sign-up")} disabled={roleLoading}>Join the League <ArrowRight size={16} /></Button>}
          <Link href="/league/crisis-sprint" className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-5 text-sm font-bold hover:bg-[var(--surface-subtle)]">Try Crisis Sprint <CircleAlert size={16} /></Link>
          {user && <Link href="/league/join" className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)]">Join the League</Link>}
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">How it works</p><h2 className="mt-3 text-4xl font-bold tracking-[-.05em]">A decision loop, not a quiz.</h2><div className="mt-10 grid gap-3 md:grid-cols-6">{["Real-World Scenario", "Economic Diagnosis", "Policy Decision", "Black Swan Shock", "Economic Outcome", "Reflection"].map((step, index) => <div key={step} className="relative min-h-36 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><span className="text-[10px] font-bold text-[var(--accent)]">0{index + 1}</span><p className="mt-6 text-sm font-bold leading-5">{step}</p>{index < 5 && <ArrowRight className="absolute -right-5 top-1/2 z-10 hidden -translate-y-1/2 bg-[var(--canvas)] text-[var(--ink-faint)] md:block" size={16} />}</div>)}</div></section>

    <section className="border-y border-[var(--line)] bg-[var(--surface)]"><div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">League modules</p><h2 className="mt-3 text-4xl font-bold tracking-[-.05em]">Different formats. One economic lens.</h2></div><p className="max-w-sm text-sm leading-6 text-[var(--ink-muted)]">Only the Crisis Sprint is fully playable in this meeting demo. Every other format is labelled honestly.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{moduleCards.map((module) => { const Icon = module.icon; return <Card key={module.title} className="flex min-h-80 flex-col p-6"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--accent)]"><Icon size={19} /></span><Status value={module.status} /></div><h3 className="mt-9 text-xl font-bold">{module.title}</h3><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{module.play}</p><p className="mt-5 text-xs font-semibold leading-5">Trains: <span className="font-normal text-[var(--ink-muted)]">{module.skill}</span></p><Link href={module.href} className="mt-auto flex items-center gap-2 pt-8 text-xs font-bold text-[var(--accent)]">View details <ArrowRight size={14} /></Link></Card>; })}</div></div></section>

    <section className="mx-auto grid max-w-[1440px] gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-12"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">For schools</p><h2 className="mt-3 text-4xl font-bold tracking-[-.05em]">A small commitment to start a serious pilot.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-[var(--ink-muted)]">The first pilot is designed to be practical. It does not require sensitive school data, expensive software or a pre-existing competition structure.</p></div><Card className="grid gap-px overflow-hidden bg-[var(--line)] sm:grid-cols-2">{[[Building2, "One School Liaison"], [Users, "One team of 4–6 students"], [ShieldCheck, "One pilot activity commitment"], [FlaskConical, "No sensitive school data required"]].map(([Icon, text]) => { const IconComponent = Icon as typeof Building2; return <div key={String(text)} className="flex items-center gap-4 bg-[var(--surface)] p-6"><IconComponent size={19} className="text-[var(--accent)]" /><p className="text-sm font-bold">{String(text)}</p></div>; })}</Card></section>
  </main>;
}
