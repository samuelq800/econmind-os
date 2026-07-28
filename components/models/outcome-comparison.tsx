"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, GitCompareArrows } from "lucide-react";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";
import { safePercentChange } from "@/lib/economics/types";

export type ComparisonReference = { label: string; results: Record<string, number> };

const pretty = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
const format = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

export function OutcomeComparison({
  current,
  metrics,
  defaultBaseline,
  scenarioA,
  modelLabel,
}: {
  current: Record<string, number>;
  metrics: string[];
  defaultBaseline?: Record<string, number>;
  scenarioA?: Record<string, number> | null;
  modelLabel?: string;
}) {
  const previous = useRef(current);
  const [previousState, setPreviousState] = useState(current);
  const [initialBaseline] = useState(() => defaultBaseline ?? current);
  const [reference, setReference] = useState<"previous" | "default" | "scenario-a">("previous");
  const signature = JSON.stringify(current);

  useEffect(() => {
    if (JSON.stringify(previous.current) !== signature) {
      setPreviousState(previous.current);
      previous.current = current;
    }
  }, [current, signature]);

  const selected = useMemo<ComparisonReference>(() => {
    if (reference === "scenario-a" && scenarioA) return { label: "Scenario A", results: scenarioA };
    if (reference === "default") return { label: "Default baseline", results: defaultBaseline ?? initialBaseline };
    return { label: "Immediately previous state", results: previousState };
  }, [defaultBaseline, initialBaseline, previousState, reference, scenarioA]);

  return <ExpandableAnalysisPanel title="Outcome comparison" modelLabel={modelLabel} subtitle="Numerical direction only: an increase or decrease is not automatically a welfare judgement.">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]"><GitCompareArrows size={16} /><span>Current state versus a declared reference</span></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Comparison baseline">
        {(["previous", "default", "scenario-a"] as const).map((option) => <button key={option} type="button" disabled={option === "scenario-a" && !scenarioA} onClick={() => setReference(option)} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-bold ${reference === option ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--ink-muted)]"} disabled:cursor-not-allowed disabled:opacity-40`}>{option === "previous" ? "Previous state" : option === "default" ? "Default baseline" : "Scenario A"}</button>)}
      </div>
    </div>
    <p className="mt-3 text-xs text-[var(--ink-muted)]">Reference: <strong className="text-[var(--ink)]">{selected.label}</strong>. Arrows indicate numerical movement, not whether an outcome is economically good or bad.</p>
    <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--line)]">
      <table className="min-w-[680px] w-full border-collapse text-left text-xs"><thead><tr className="bg-[var(--surface-subtle)] text-[9px] font-bold uppercase tracking-wider text-[var(--ink-faint)]"><th className="p-3">Outcome</th><th className="p-3 text-right">Reference</th><th className="p-3 text-right">Current</th><th className="p-3 text-right">Numerical change</th></tr></thead><tbody>{metrics.map((metric) => {
        const before = selected.results[metric]; const after = current[metric];
        const delta = Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
        const percent = delta === null ? null : safePercentChange(before, after);
        const Direction = delta === null || Math.abs(delta) < 1e-9 ? ArrowRight : delta > 0 ? ArrowUp : ArrowDown;
        return <tr key={metric} className="border-t border-[var(--line)]"><td className="p-3 font-semibold">{pretty(metric)}</td><td className="p-3 text-right font-mono text-[var(--ink-muted)]">{before === undefined ? "—" : format(before)}</td><td className="p-3 text-right font-mono">{after === undefined ? "—" : format(after)}</td><td className="p-3 text-right"><span className={`inline-flex items-center gap-1 font-mono font-semibold ${delta !== null && delta > 0 ? "text-[var(--accent)]" : delta !== null && delta < 0 ? "text-[var(--red)]" : "text-[var(--ink-muted)]"}`}><Direction size={13} />{delta === null ? "—" : `${delta > 0 ? "+" : ""}${format(delta)}${percent === null ? "" : ` (${percent > 0 ? "+" : ""}${format(percent)}%)`}`}</span></td></tr>;
      })}</tbody></table>
    </div>
  </ExpandableAnalysisPanel>;
}
