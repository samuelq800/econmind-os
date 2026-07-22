import { ListChecks } from "lucide-react";

export function ModelAssumptions({ assumptions }: { assumptions: readonly string[] }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]">
        <ListChecks size={16} />
        <h2>Model assumptions</h2>
      </div>
      <p className="mt-3 max-w-4xl text-xs leading-5 text-[var(--ink-muted)]">Interpret the outputs within these simplifying conditions.</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {assumptions.map((assumption) => (
          <li key={assumption} className="flex gap-2.5 rounded-lg bg-[var(--surface-subtle)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <span>{assumption}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
