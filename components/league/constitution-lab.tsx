"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const institutions = [
  { id: "central-bank", title: "Independent Central Bank", benefit: "Improves the credibility of long-run price stability.", risk: "Can reduce elected governments’ room for short-run coordination.", implication: "May resist politically popular but inflationary crisis measures." },
  { id: "debt-ceiling", title: "Debt Ceiling", benefit: "Creates a visible fiscal guardrail.", risk: "Can constrain emergency support during a deep downturn.", implication: "Forces earlier choices between taxes, spending and exceptional borrowing." },
  { id: "stabilisers", title: "Automatic Welfare Stabilisers", benefit: "Supports incomes without waiting for a new vote.", risk: "Raises spending automatically when fiscal capacity is weakest.", implication: "Softens demand collapses and unemployment spikes." },
  { id: "emergency-powers", title: "Emergency Executive Powers", benefit: "Can speed up action when coordination is urgently needed.", risk: "Requires strong checks to avoid overreach.", implication: "Makes rapid energy or financial interventions possible." },
  { id: "free-trade", title: "Free Trade Commitment", benefit: "Supports competition, resilience and access to inputs.", risk: "Limits protectionist responses to domestic pressure.", implication: "Keeps trade channels open during an external supply shock." },
] as const;

export function ConstitutionLab() {
  const [enabled, setEnabled] = useState<string[]>(["central-bank", "stabilisers", "free-trade"]);
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-12 sm:px-8"><Badge className="border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]">Preview</Badge><header className="mt-5 max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Economic Constitution Lab</p><h1 className="mt-3 text-5xl font-bold tracking-[-.06em]">Design the rules before the crisis arrives.</h1><p className="mt-5 text-sm leading-7 text-[var(--ink-muted)]">This front-end preview lets you compare institutional choices. It does not save results or claim to predict an actual constitution.</p></header><section className="mt-10 grid gap-4 lg:grid-cols-2">{institutions.map((institution) => { const selected = enabled.includes(institution.id); return <Card key={institution.id} className={`p-6 ${selected ? "border-[var(--accent)]" : ""}`}><label className="flex cursor-pointer items-start justify-between gap-5"><div><h2 className="text-lg font-bold">{institution.title}</h2><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{selected ? institution.implication : "Select this institution to inspect its crisis implication."}</p></div><input type="checkbox" checked={selected} onChange={() => setEnabled((current) => selected ? current.filter((item) => item !== institution.id) : [...current, institution.id])} className="mt-1 size-4 accent-[var(--accent)]" /></label>{selected && <div className="mt-5 grid gap-3 border-t border-[var(--line)] pt-4 text-xs leading-5"><p><b className="text-[var(--accent)]">Potential benefit:</b> {institution.benefit}</p><p><b className="text-[var(--red)]">Potential risk:</b> {institution.risk}</p></div>}</Card>; })}</section><Card className="mt-8 flex gap-4 p-6"><Landmark className="shrink-0 text-[var(--accent)]" size={21} /><p className="text-sm leading-6 text-[var(--ink-muted)]">Selected institutions change the guardrails available to policymakers. A complete Constitution Lab simulation is planned for a later League phase.</p></Card></main>;
}
