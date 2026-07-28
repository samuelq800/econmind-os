import { ArrowRight } from "lucide-react";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";
import type { SandboxResult } from "@/lib/economics/sandbox/types";

export function PolicyTransmissionMap({ result, modelLabel = "Economic Sandbox" }: { result: SandboxResult; modelLabel?: string }) {
  const direct = result.directContributions.slice(0, 5);
  const interactions = result.interactionContributions.slice(0, 3);
  const outcomes = [
    "GDP " + result.indicators.gdpIndex,
    "Inflation " + result.indicators.inflationRate + "%",
    "Unemployment " + result.indicators.unemploymentRate + "%",
    "Emissions " + result.indicators.carbonEmissions,
  ];
  return <ExpandableAnalysisPanel title="Policy transmission map" modelLabel={modelLabel} subtitle="Causal links are generated from the active deterministic contribution rules.">
    <div className="grid gap-3 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-stretch">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4"><h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--accent)]">Active policy tools</h3><ul className="mt-3 space-y-2">{direct.length ? direct.map((item) => <li key={item.label} className="text-sm leading-6 text-[var(--ink-muted)]">• {item.label}</li>) : <li className="text-sm leading-6 text-[var(--ink-muted)]">Baseline: no material policy contribution.</li>}</ul></section>
      <ArrowRight className="mx-auto hidden self-center text-[var(--accent)] xl:block" />
      <section className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4"><h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--accent)]">Direct & interaction channels</h3><ul className="mt-3 space-y-2">{[...direct, ...interactions].slice(0, 6).map((item) => <li key={item.label} className="text-sm leading-6 text-[var(--ink-muted)]">• {item.rule ?? item.label}</li>)}</ul></section>
      <ArrowRight className="mx-auto hidden self-center text-[var(--accent)] xl:block" />
      <section className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4"><h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--accent)]">Calculated indicators</h3><ul className="mt-3 space-y-2">{outcomes.map((item) => <li key={item} className="text-sm font-semibold leading-6 text-[var(--ink)]">• {item}</li>)}</ul><p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">Interpret effects as standardized teaching relationships, not empirical causal estimates.</p></section>
    </div>
  </ExpandableAnalysisPanel>;
}
