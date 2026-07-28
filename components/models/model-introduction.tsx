import type { ModelKey } from "@/lib/supabase/data";
import { MODEL_INTRODUCTIONS } from "@/lib/models/intros";
import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";

export function ModelIntroduction({ modelKey, modelLabel }: { modelKey: ModelKey; modelLabel?: string }) {
  const introduction = MODEL_INTRODUCTIONS[modelKey];
  if (!introduction) return null;
  return <ExpandableAnalysisPanel title="Detailed model introduction" modelLabel={modelLabel}>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-lg bg-[var(--surface-subtle)] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">Economic question</p><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{introduction.question}</p></section>
      <section className="rounded-lg bg-[var(--surface-subtle)] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">How to use this lab</p><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{introduction.method}</p></section>
      <section className="rounded-lg bg-[var(--surface-subtle)] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">How to read the result</p><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{introduction.reading}</p></section>
    </div>
  </ExpandableAnalysisPanel>;
}
