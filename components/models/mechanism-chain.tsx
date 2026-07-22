"use client";

import { ArrowRight, GitBranch } from "lucide-react";
import { useRecentParameter } from "@/lib/hooks/use-recent-parameter";
import { modelMechanismChain } from "@/lib/models/explanations";
import type { FocusedModelKey } from "@/lib/experiments/model-runtime";

export function MechanismChain({ modelKey, parameters }: { modelKey: FocusedModelKey; parameters: Record<string, unknown> }) {
  const lastChanged = useRecentParameter(parameters);
  const steps = modelMechanismChain(modelKey, parameters, lastChanged);
  return <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]"><GitBranch size={16} /><h2>Mechanism chain</h2></div><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">A live causal sequence based on the current parameters.</p></div>{lastChanged && <span className="rounded-md bg-[var(--accent-soft)] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--accent)]">Latest change: {lastChanged}</span>}</div><ol className="mt-5 grid gap-2 xl:grid-cols-6">{steps.map((step, index) => <li key={step.stage} className="relative rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--ink-faint)]">{index + 1}. {step.stage}</p><p className="mt-2 text-[11px] leading-5 text-[var(--ink-muted)]">{step.text}</p>{index < steps.length - 1 && <ArrowRight size={13} className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-[var(--accent)] xl:block" />}</li>)}</ol></section>;
}
