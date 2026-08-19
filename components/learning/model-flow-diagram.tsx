import { ArrowRight, CheckCircle2, CircleDot, Sparkles } from "lucide-react";

export type ModelFlowStage = {
  label: string;
  title: string;
  description: string;
  active?: boolean;
};

/**
 * A shared, data-led mechanism visual. It deliberately shows the causal path
 * disclosed by a preset rather than inventing an unobservable simulation.
 */
export function ModelFlowDiagram({
  eyebrow = "Model view",
  title,
  stages,
}: {
  eyebrow?: string;
  title: string;
  stages: readonly ModelFlowStage[];
}) {
  return <figure className="mt-7 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4 sm:p-5">
    <figcaption className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">{eyebrow}</p>
        <h3 className="mt-1 text-sm font-bold">{title}</h3>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent)]"><Sparkles size={12} /> Updates from your choices</span>
    </figcaption>
    <div className="scroll-slim mt-5 overflow-x-auto pb-1">
      <ol className="flex min-w-[720px] items-stretch gap-2 sm:min-w-0">
        {stages.map((stage, index) => <li key={`${stage.label}-${stage.title}`} className="flex min-w-0 flex-1 items-center gap-2">
          <div className={`min-h-32 flex-1 rounded-xl border p-3 ${stage.active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">{stage.label}</span>{stage.active ? <CheckCircle2 size={14} className="shrink-0 text-[var(--accent)]" /> : <CircleDot size={14} className="shrink-0 text-[var(--ink-faint)]" />}</div>
            <p className="mt-4 text-xs font-bold leading-5">{stage.title}</p>
            <p className="mt-1 text-[10px] leading-4 text-[var(--ink-muted)]">{stage.description}</p>
          </div>
          {index < stages.length - 1 && <ArrowRight aria-hidden="true" size={16} className="shrink-0 text-[var(--accent)]" />}
        </li>)}
      </ol>
    </div>
  </figure>;
}
