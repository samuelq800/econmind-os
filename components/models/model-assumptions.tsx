import { ListChecks } from "lucide-react";
import type { AssumptionSections } from "@/lib/models/assumptions";

const sections: Array<{ key: keyof AssumptionSections; label: string }> = [
  { key: "structural", label: "Structural assumptions" },
  { key: "parameters", label: "Parameter assumptions" },
  { key: "limitations", label: "What the model cannot conclude" },
];

export function ModelAssumptions({ assumptions }: { assumptions: AssumptionSections }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]">
        <ListChecks size={16} />
        <h2>Model assumptions</h2>
      </div>
      <p className="mt-3 max-w-4xl text-xs leading-5 text-[var(--ink-muted)]">Interpret the outputs within these simplifying conditions.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">{sections.map((section) => <section key={section.key} className="rounded-lg bg-[var(--surface-subtle)] p-4"><h3 className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-faint)]">{section.label}</h3><ul className="mt-3 space-y-2.5">{assumptions[section.key].map((assumption) => <li key={assumption} className="flex gap-2.5 text-xs leading-5 text-[var(--ink-muted)]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" /><span>{assumption}</span></li>)}</ul></section>)}</div>
    </section>
  );
}
