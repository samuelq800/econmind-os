import { CircleHelp, RotateCcw } from "lucide-react";
import type { ModelParameter } from "@/lib/economics/types";

export function ParameterControl({ parameter, value, onChange }: { parameter: ModelParameter; value: number; onChange: (value: number) => void }) {
  const commit = (next: number) => onChange(Math.min(parameter.max, Math.max(parameter.min, Number.isFinite(next) ? next : parameter.defaultValue)));
  return (
    <div className="border-b border-[var(--line)] py-4 last:border-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <label htmlFor={parameter.id} className="text-xs font-bold">{parameter.label} <span className="font-mono font-normal text-[var(--ink-faint)]">({parameter.symbol})</span></label>
            <span className="group relative inline-flex text-[var(--ink-faint)]">
              <CircleHelp size={12} aria-hidden="true" />
              <span role="tooltip" className="pointer-events-none absolute bottom-5 left-1/2 z-30 w-52 -translate-x-1/2 rounded-md bg-[var(--ink)] p-2 text-[10px] font-normal leading-4 text-[var(--surface)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">{parameter.description}</span>
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-[var(--ink-muted)]">{parameter.description}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label={`Reset ${parameter.label}`} onClick={() => onChange(parameter.defaultValue)} disabled={value === parameter.defaultValue} className="grid size-8 place-items-center rounded-md text-[var(--ink-faint)] hover:bg-[var(--surface-subtle)] disabled:opacity-25"><RotateCcw size={12} /></button>
          <label className="flex h-9 items-center rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] pl-2 text-[8px] font-extrabold uppercase tracking-wider text-[var(--accent)]">
            Live
            <input aria-label={`${parameter.label} live value`} type="number" min={parameter.min} max={parameter.max} step={parameter.step} value={value} onChange={(event) => commit(Number(event.target.value))} className="h-8 w-16 bg-transparent px-2 text-right text-sm font-bold tabular-nums text-[var(--ink)] outline-none" />
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-7 text-[9px] text-[var(--ink-faint)]">{parameter.min}</span>
        <input id={parameter.id} type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={value} onChange={(event) => commit(Number(event.target.value))} className="min-w-0 flex-1" />
        <span className="w-7 text-right text-[9px] text-[var(--ink-faint)]">{parameter.max}</span>
      </div>
    </div>
  );
}
