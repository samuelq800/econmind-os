"use client";

import { ArrowRight, GitBranch } from "lucide-react";
import { useParameterChange } from "@/lib/hooks/use-recent-parameter";
import { modelMechanismChain, type MechanismStep } from "@/lib/models/explanations";
import { parameterLabel, type SupportedModelKey } from "@/lib/models/change-tracking";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";

const focusedKeys = new Set(["supply-demand", "policy", "price-controls", "elasticity", "externalities", "monopoly", "ppf", "ad-as"]);

export function MechanismChain({ modelKey, parameters, steps: suppliedSteps, modelLabel }: { modelKey?: SupportedModelKey; parameters?: Record<string, number | string | boolean>; steps?: MechanismStep[]; modelLabel?: string }) {
  const lastChanged = useParameterChange(parameters ?? {}, modelKey);
  const steps = suppliedSteps ?? (modelKey && focusedKeys.has(modelKey) ? modelMechanismChain(modelKey as "supply-demand" | "policy" | "price-controls" | "elasticity" | "externalities" | "monopoly" | "ppf" | "ad-as", parameters ?? {}, lastChanged?.parameterKey, lastChanged ?? undefined) : []);
  return <ExpandableAnalysisPanel title="Mechanism chain" modelLabel={modelLabel} subtitle="A live causal sequence based on the current parameters.">
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]"><GitBranch size={16} /><span>From cause to outcome</span></div>{lastChanged && <span className="rounded-md bg-[var(--accent-soft)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Latest change: {parameterLabel(modelKey, lastChanged.parameterKey)} {lastChanged.direction}</span>}</div>
    {lastChanged && <div className="mt-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-xs leading-5 text-[var(--ink-muted)]"><strong className="text-[var(--ink)]">Tracked update:</strong> {parameterLabel(modelKey, lastChanged.parameterKey)} moved from {String(lastChanged.previousValue)} to {String(lastChanged.currentValue)}. It affects {lastChanged.affectedEquations.join(", ")} and {lastChanged.affectedOutputs.join(", ")}.</div>}
    <ol className="mt-5 grid gap-3 xl:grid-cols-6">{steps.map((step, index) => <li key={step.stage} className="relative rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-faint)]">{index + 1}. {step.stage}</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{step.text}</p>{index < steps.length - 1 && <ArrowRight size={13} className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-[var(--accent)] xl:block" />}</li>)}</ol>
  </ExpandableAnalysisPanel>;
}
