"use client";

import { useMemo, useState } from "react";
import { Dices, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FINAL_WORLD_TEACHING, asArray, asRecord, numeric } from "@/lib/economics/final-world-teaching/catalog";

type ArenaScenario = { scenario_id: string; title: string; participants: string[]; information: string; rules: string; actions: Record<string, unknown>; timeline: string[]; payoff: string; editable: Record<string, unknown>; defaults: Record<string, unknown>; outcomes: Record<string, string>; links: Record<string, string[]> };
type RunResult = { headline: string; rows: Array<[string, string]>; note: string };
const scenarios = asArray<ArenaScenario>(asRecord(FINAL_WORLD_TEACHING.mechanismArenaScenarios).scenarios);
const metrics = asRecord(asRecord(FINAL_WORLD_TEACHING.mechanismResultMetrics).metrics);
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function defaultParameters(scenario: ArenaScenario) {
  return Object.fromEntries(Object.entries(scenario.editable).map(([key, range]) => {
    if (Array.isArray(range) && range.every((item) => typeof item === "number")) return [key, numeric(scenario.defaults[key], (Number(range[0]) + Number(range[1])) / 2)];
    return [key, scenario.defaults[key] ?? (Array.isArray(range) ? range[0] : "")];
  }));
}

function gini(values: number[]) {
  const shifted = values.map((value) => value - Math.min(...values)); const total = shifted.reduce((sum, value) => sum + value, 0);
  if (!total) return 0; const sorted = [...shifted].sort((a, b) => a - b); const n = sorted.length;
  return sorted.reduce((sum, value, index) => sum + (2 * (index + 1) - n - 1) * value, 0) / (n * total);
}

function run(scenario: ArenaScenario, parameters: Record<string, unknown>): RunResult {
  const defaults = scenario.defaults;
  if (scenario.scenario_id === "MA-01-FIRST-PRICE" || scenario.scenario_id === "MA-02-SECOND-PRICE") {
    const values = asArray<number>(defaults.values).map(Number); const bids = asArray<number>(defaults.bids).map(Number); const highest = Math.max(...bids); const winner = bids.indexOf(highest); const payment = scenario.scenario_id === "MA-01-FIRST-PRICE" ? highest : [...bids].sort((a, b) => b - a)[1];
    const reserve = numeric(parameters.reserve_price); const allocated = highest >= reserve;
    const efficient = values[winner] === Math.max(...values);
    return { headline: allocated ? `Bidder ${winner + 1} receives the item.` : "Reserve price leaves the item unallocated.", rows: [["Winner", allocated ? `Bidder ${winner + 1}` : "No allocation"], ["Payment", allocated ? `${payment.toFixed(2)} GCU` : "0 GCU"], ["Allocative efficiency", efficient && allocated ? "1.00" : "0.00"], ["Seller revenue", allocated ? `${payment.toFixed(2)} GCU` : "0 GCU"]], note: scenario.scenario_id === "MA-01-FIRST-PRICE" ? "The rule uses the stated bids; bid shading is possible, so truthful bidding is not generally dominant." : "Under independent private values, truthful bidding is the benchmark strategy; the winner pays the second highest bid." };
  }
  if (scenario.scenario_id === "MA-04-PUBLIC-GOODS") {
    const endowment = numeric(parameters.endowment, numeric(defaults.endowment, 10)); const multiplier = numeric(parameters.multiplier, numeric(defaults.multiplier, 1.6)); const contributions = asArray<number>(defaults.contributions).map(Number); const n = Math.max(2, Math.round(numeric(parameters.players, numeric(defaults.players, contributions.length)))); const total = contributions.slice(0, n).reduce((sum, item) => sum + item, 0); const payoffs = contributions.slice(0, n).map((contribution) => endowment - contribution + multiplier * total / n);
    return { headline: `${total.toFixed(1)} of ${endowment * n} GCU is contributed to the public account.`, rows: [["Total contribution", `${total.toFixed(1)} GCU`], ["Payoff per player", `${(payoffs[0] ?? endowment).toFixed(2)} GCU`], ["Payoff Gini", gini(payoffs).toFixed(3)], ["Efficiency signal", total > 0 ? "Some cooperation" : "Free-riding outcome"]], note: "This one-shot game reports the stated rule result. It does not invent participants or an AI opponent; extensions such as punishment must be explicitly chosen in another preset." };
  }
  if (scenario.scenario_id === "MA-05-COMMON-POOL") {
    const stock = numeric(defaults.initial_stock, 100); const growth = numeric(defaults.growth_rate, 0.2); const capacity = numeric(defaults.carrying_capacity, 200); const harvests = asArray<number>(defaults.harvests).map(Number); const total = harvests.reduce((sum, item) => sum + item, 0); const next = Math.max(0, stock + growth * stock * (1 - stock / capacity) - total);
    return { headline: next === 0 ? "The common resource is exhausted under this preset." : "The resource survives this period under the stated harvests.", rows: [["Opening stock", `${stock.toFixed(1)} units`], ["Total harvest", `${total.toFixed(1)} units`], ["Next-period stock", `${next.toFixed(1)} units`], ["Stability", next > stock * 0.25 ? "Viable" : "At risk"]], note: "Stock evolves using the scenario’s stated logistic growth function. A collapse is a model outcome, not a permanent exclusion from a future, redesigned mechanism." };
  }
  const outcomeEntries = Object.entries(scenario.outcomes).slice(0, 4).map(([key, value]) => [label(key), value] as [string, string]);
  return { headline: "Deterministic baseline prepared from the preset rules.", rows: [["Seed", "20260730 (fixed for replay)"], ["Participants", scenario.participants.join(", ")], ...outcomeEntries], note: "The rules, information set, timeline and payoff are fixed by this scenario. Any bot-like counterpart follows disclosed deterministic rules; no external AI is used." };
}

export function MechanismArenaLab() {
  const [activeId, setActiveId] = useState(scenarios[0]?.scenario_id ?? ""); const active = useMemo(() => scenarios.find((item) => item.scenario_id === activeId) ?? scenarios[0], [activeId]);
  const [parameters, setParameters] = useState<Record<string, unknown>>(() => active ? defaultParameters(active) : {}); const [result, setResult] = useState<RunResult | null>(null);
  if (!active) return null;
  const selectScenario = (next: ArenaScenario) => { setActiveId(next.scenario_id); setParameters(defaultParameters(next)); setResult(null); };
  return <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-8 lg:p-10"><div className="max-w-4xl"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Learning system · governed rules</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">Mechanism Design Arena</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">Ten preset institutions with stated participants, information, choices, rules and outcomes. Every run is deterministic and replayable from the fixed seed and recorded inputs.</p></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[270px_minmax(0,1fr)]"><aside className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 xl:self-start"><p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">10 mechanisms</p><div className="space-y-1">{scenarios.map((scenario) => <button key={scenario.scenario_id} type="button" onClick={() => selectScenario(scenario)} className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-xs ${scenario.scenario_id === active.scenario_id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}><span>{scenario.title}</span><span className="text-[10px] opacity-70">{scenario.scenario_id.slice(3, 5)}</span></button>)}</div></aside>
      <section className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex flex-wrap gap-2"><Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">{active.scenario_id}</Badge>{asArray<string>(active.links.models).map((model) => <Badge key={model}>{label(model)}</Badge>)}</div><h2 className="mt-4 text-2xl font-bold tracking-[-.035em]">{active.title}</h2><div className="mt-6 grid gap-3 md:grid-cols-2"><Detail label="Participants" value={active.participants.join(" · ")} /><Detail label="Information" value={active.information} /><Detail label="Rules" value={active.rules} /><Detail label="Payoff" value={active.payoff} /></div>
        <div className="mt-7 border-t border-[var(--line)] pt-6"><p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-faint)]">Timeline</p><ol className="mt-3 flex flex-wrap gap-2">{active.timeline.map((step, index) => <li key={step} className="rounded-md bg-[var(--surface-subtle)] px-3 py-2 text-xs"><span className="mr-2 font-bold text-[var(--accent)]">{index + 1}</span>{label(step)}</li>)}</ol></div>
        <div className="mt-7 border-t border-[var(--line)] pt-6"><p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-faint)]">Editable parameters</p><div className="mt-4 grid gap-4 md:grid-cols-2">{Object.entries(active.editable).map(([key, specification]) => <ParameterControl key={key} field={key} specification={specification} value={parameters[key]} onChange={(value) => { setParameters((current) => ({ ...current, [key]: value })); setResult(null); }} />)}</div></div>
        <div className="mt-7 flex flex-wrap gap-3"><Button onClick={() => setResult(run(active, parameters))}><Dices size={15} />Run stated mechanism</Button><Button variant="secondary" onClick={() => { setParameters(defaultParameters(active)); setResult(null); }}><RotateCcw size={15} />Reset preset</Button></div>
        {result && <div className="mt-6 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-5"><p className="flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><ShieldCheck size={17} />{result.headline}</p><dl className="mt-4 grid gap-3 sm:grid-cols-2">{result.rows.map(([key, value]) => <div key={key} className="rounded-md bg-[var(--surface)] p-3"><dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{key}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl><p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">{result.note}</p></div>}
        <div className="mt-7 rounded-lg bg-[var(--surface-subtle)] p-4"><p className="text-xs font-bold">Result metrics</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(metrics).slice(0, 6).map(([key, value]) => <p key={key} className="text-xs leading-5 text-[var(--ink-muted)]"><span className="font-semibold text-[var(--ink)]">{label(key)}:</span> {String(value)}</p>)}</div></div>
      </section></div></main>;
}

function Detail({ label: heading, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[var(--surface-subtle)] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{heading}</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{value}</p></div>; }
function ParameterControl({ field, specification, value, onChange }: { field: string; specification: unknown; value: unknown; onChange: (value: string | number) => void }) { const range = asArray(specification); const numericRange = range.length === 2 && range.every((item) => typeof item === "number"); return <label className="rounded-lg bg-[var(--surface-subtle)] p-4"><span className="flex justify-between gap-2 text-sm font-bold"><span>{label(field)}</span><output className="text-[var(--accent)]">{String(value)}</output></span>{numericRange ? <><input className="mt-4 w-full accent-[var(--accent)]" type="range" min={Number(range[0])} max={Number(range[1])} step={Number(range[1]) - Number(range[0]) <= 10 ? 0.1 : 1} value={numeric(value)} onChange={(event) => onChange(Number(event.target.value))} /><span className="mt-2 flex justify-between text-[10px] text-[var(--ink-faint)]"><span>{String(range[0])}</span><span>{String(range[1])}</span></span></> : <select className="mt-4 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm" value={String(value)} onChange={(event) => onChange(event.target.value)}>{range.map((option) => <option key={String(option)} value={String(option)}>{label(String(option))}</option>)}</select>}</label>; }
