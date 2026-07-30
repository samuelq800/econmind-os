"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, CircleAlert, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FINAL_WORLD_TEACHING, asArray, asRecord, numeric } from "@/lib/economics/final-world-teaching/catalog";

type Challenge = {
  challenge_id: string; title: string; territory: string; scenario: string;
  initial_state: Record<string, unknown>; model_options: string[];
  adjustable: Record<string, [number, number]>; policy_options: string[];
  goal: Record<string, unknown>; constraints: Record<string, unknown>;
  accept: { all: string[] }; wrong_types: string[]; model_chain: string; explanation: string;
};

const challenges = asArray<Challenge>(asRecord(FINAL_WORLD_TEACHING.econbenchScenarioLibrary).challenges);
const human = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function defaultsFor(challenge: Challenge) {
  return Object.fromEntries(Object.entries(challenge.adjustable).map(([key, [min, max]]) => [key, Number(((min + max) / 2).toFixed(2))]));
}

export function checkEconBenchCondition(condition: string, models: string[], values: Record<string, number>, claims: Record<string, boolean>): boolean {
  if (condition.includes(" OR ")) return condition.split(" OR ").some((part) => checkEconBenchCondition(part.trim(), models, values, claims));
  const select = condition.match(/^select\s+(.+)$/i);
  if (select) return models.includes(select[1]);
  const between = condition.match(/^([a-z0-9_]+) between (-?[\d.]+) and (-?[\d.]+)$/i);
  if (between) return numeric(values[between[1]]) >= Number(between[2]) && numeric(values[between[1]]) <= Number(between[3]);
  const compare = condition.match(/^([a-z0-9_]+)\s*(>=|<=|>|<)\s*(-?[\d.]+)$/i);
  if (compare) {
    const value = numeric(values[compare[1]]); const target = Number(compare[3]);
    return compare[2] === ">=" ? value >= target : compare[2] === "<=" ? value <= target : compare[2] === ">" ? value > target : value < target;
  }
  return Boolean(claims[condition]);
}

export function EconBenchLab() {
  const [activeId, setActiveId] = useState(challenges[0]?.challenge_id ?? "");
  const challenge = useMemo(() => challenges.find((item) => item.challenge_id === activeId) ?? challenges[0], [activeId]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, number>>(() => challenge ? defaultsFor(challenge) : {});
  const [claims, setClaims] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<{ correct: boolean; failed: string[] } | null>(null);
  if (!challenge) return null;

  const reset = (next: Challenge) => { setSelectedModels([]); setValues(defaultsFor(next)); setClaims({}); setResult(null); };
  const selectChallenge = (next: Challenge) => { setActiveId(next.challenge_id); reset(next); };
  const conditions = challenge.accept.all;
  const claimConditions = conditions.filter((item) => !/^select\s|^[a-z0-9_]+ between |^[a-z0-9_]+\s*(>=|<=|>|<)\s*/i.test(item) && !item.includes(" OR "));

  return <main className="min-h-[calc(100vh-4rem)] p-5 sm:p-8 lg:p-10">
    <div className="max-w-4xl">
      <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Learning system · prescribed challenges</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">EconBench</h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">Ten fully specified economics challenges. Choose models, make the allowed intervention, and submit a reproducible answer. This is separate from Sandbox and does not alter the World Economy.</p>
    </div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 xl:self-start">
        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">10 preset challenges</p>
        <div className="space-y-1">{challenges.map((item, index) => <button key={item.challenge_id} type="button" onClick={() => selectChallenge(item)} className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-xs transition-colors ${item.challenge_id === challenge.challenge_id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}><span><span className="mr-2 font-bold opacity-60">{String(index + 1).padStart(2, "0")}</span>{item.title}</span><ChevronRight size={14} /></button>)}</div>
      </aside>
      <section className="min-w-0">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2"><Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">{challenge.challenge_id}</Badge><Badge>{challenge.territory}</Badge></div>
          <h2 className="mt-4 text-2xl font-bold tracking-[-.035em]">{challenge.title}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{challenge.scenario}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><InfoBlock label="Initial conditions" data={challenge.initial_state} /><InfoBlock label="Goal" data={challenge.goal} /><InfoBlock label="Constraints" data={challenge.constraints} /></div>
          <div className="mt-8 border-t border-[var(--line)] pt-7"><p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-faint)]">1 · Select the mechanisms you will use</p><div className="mt-3 flex flex-wrap gap-2">{challenge.model_options.map((model) => <button key={model} type="button" aria-pressed={selectedModels.includes(model)} onClick={() => { setSelectedModels((current) => current.includes(model) ? current.filter((value) => value !== model) : [...current, model]); setResult(null); }} className={`rounded-lg border px-3 py-2 text-xs font-bold ${selectedModels.includes(model) ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)]"}`}>{human(model)}</button>)}</div></div>
          <div className="mt-8 border-t border-[var(--line)] pt-7"><p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-faint)]">2 · Set the permitted intervention</p><div className="mt-4 grid gap-4 md:grid-cols-2">{Object.entries(challenge.adjustable).map(([key, [min, max]]) => <label key={key} className="rounded-lg bg-[var(--surface-subtle)] p-4"><span className="flex justify-between gap-3 text-sm font-bold"><span>{human(key)}</span><output className="text-[var(--accent)]">{values[key]}</output></span><input className="mt-4 w-full accent-[var(--accent)]" type="range" min={min} max={max} step={(max - min) <= 10 ? 0.1 : 1} value={values[key]} onChange={(event) => { setValues((current) => ({ ...current, [key]: Number(event.target.value) })); setResult(null); }} /><span className="mt-2 flex justify-between text-[10px] text-[var(--ink-faint)]"><span>{min}</span><span>{max}</span></span></label>)}</div></div>
          {claimConditions.length > 0 && <div className="mt-8 border-t border-[var(--line)] pt-7"><p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-faint)]">3 · State the required interpretation</p><div className="mt-3 space-y-2">{claimConditions.map((condition) => <label key={condition} className="flex gap-3 rounded-lg border border-[var(--line)] p-3 text-sm text-[var(--ink-muted)]"><input type="checkbox" checked={Boolean(claims[condition])} onChange={(event) => { setClaims((current) => ({ ...current, [condition]: event.target.checked })); setResult(null); }} className="mt-0.5 accent-[var(--accent)]" /><span>{human(condition)}</span></label>)}</div></div>}
          <div className="mt-8 flex flex-wrap gap-3"><Button onClick={() => { const failed = conditions.filter((condition) => !checkEconBenchCondition(condition, selectedModels, values, claims)); setResult({ correct: failed.length === 0, failed }); }}>Check response</Button><Button variant="secondary" onClick={() => reset(challenge)}><RotateCcw size={15} />Reset</Button></div>
          {result && <div className={`mt-5 rounded-lg border p-4 text-sm ${result.correct ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]"}`}>{result.correct ? <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={17} />Correct — every required condition is met.</p> : <><p className="flex items-center gap-2 font-bold"><CircleAlert size={17} />Incorrect — review the model, policy range, or interpretation.</p><p className="mt-2 text-xs opacity-90">Unmet checks: {result.failed.join(" · ")}</p></>}</div>}
          <div className="mt-7 rounded-lg bg-[var(--surface-subtle)] p-4"><p className="text-xs font-bold">Why this works</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{challenge.explanation}</p><p className="mt-3 text-xs leading-5 text-[var(--ink-faint)]">Model chain: {challenge.model_chain}</p></div>
        </div>
      </section>
    </div>
  </main>;
}

function InfoBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return <div className="rounded-lg bg-[var(--surface-subtle)] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{label}</p><dl className="mt-2 space-y-1 text-xs">{Object.entries(data).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">{human(key)}</dt><dd className="font-bold text-right">{String(value)}</dd></div>)}</dl></div>;
}
