import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";

export type EvaluationItem = { criterion: string; assessment: string; note: string };

export function EconomicEvaluation({ items, modelLabel }: { items: EvaluationItem[]; modelLabel?: string }) {
  return <ExpandableAnalysisPanel title="Economic evaluation" modelLabel={modelLabel} subtitle="A transparent evaluation against economic criteria rather than a single universal policy answer.">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.criterion} className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">{item.criterion}</h3><span className="rounded bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{item.assessment}</span></div><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{item.note}</p></article>)}</div>
  </ExpandableAnalysisPanel>;
}
