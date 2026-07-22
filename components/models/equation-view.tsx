"use client";

import { useState } from "react";
import { ChevronDown, Sigma } from "lucide-react";
import type { EquationStep } from "@/lib/economics/types";

export function EquationView({ steps }: { steps: readonly EquationStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
        <span>
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--accent)]"><Sigma size={16} />Equation view</span>
          <span className="mt-2 block text-xs leading-5 text-[var(--ink-muted)]">{open ? "Hide the algebraic derivation." : "Show equations, substituted values, and the equilibrium derivation."}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-[var(--ink-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--line)] bg-[var(--canvas)] p-5 sm:p-6">
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={`${step.label}-${index}`} className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-[150px_1fr]">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-faint)]">{index + 1}. {step.label}</span>
                <span>
                  <code className="block overflow-x-auto whitespace-nowrap font-mono text-xs font-semibold text-[var(--ink)]">{step.expression}</code>
                  {step.detail && <span className="mt-2 block text-[11px] leading-5 text-[var(--ink-muted)]">{step.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
