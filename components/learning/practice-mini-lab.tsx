"use client";

import { useMemo, useState } from "react";
import { Gauge, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MathFormula } from "@/components/ui/math-formula";
import {
  getExtendedModelDefinitionBySourceId,
  type ExtendedCalculation,
} from "@/lib/economics/extended-models";
import {
  getPracticeMiniModel,
  miniModelDefaults,
  type MiniCalculation,
  type MiniControl,
} from "@/lib/models/practice-mini-models";
import { practiceFormula } from "@/lib/models/practice-formulas";

type Calculation = ExtendedCalculation | MiniCalculation;
type NumericValues = Record<string, number>;

function format(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) < 1 ? 3 : 2,
  }).format(value);
}

function extendedDefaults(controls: MiniControl[]) {
  return Object.fromEntries(
    controls.map((item) => [item.id, item.defaultValue]),
  );
}

/**
 * A compact, browser-only calculator paired with a practice question. It is
 * deliberately exploratory: changing it never changes the locked answer key.
 */
export function PracticeMiniLab({ modelId }: { modelId: string }) {
  const extended = getExtendedModelDefinitionBySourceId(modelId);
  const fallback = getPracticeMiniModel(modelId);
  const controls = useMemo(
    () => (extended?.controls ?? fallback?.controls ?? []) as MiniControl[],
    [extended, fallback],
  );
  const defaults = useMemo(
    () =>
      extended
        ? extendedDefaults(controls)
        : fallback
          ? miniModelDefaults(fallback)
          : {},
    [extended, fallback, controls],
  );
  const [values, setValues] = useState<NumericValues>(defaults);
  const calculation: Calculation | null = useMemo(() => {
    if (extended) return extended.calculate(values);
    if (fallback) return fallback.calculate(values);
    return null;
  }, [extended, fallback, values]);

  if (!calculation || !controls.length) {
    return (
      <Card className="p-6">
        <p className="text-sm font-bold">Model explorer</p>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          This question keeps its supplied formula visible while its compact
          calculator is being prepared.
        </p>
      </Card>
    );
  }

  const outcomes = Object.entries(calculation.results).slice(0, 4);
  const primary = calculation.results[calculation.primaryKey] ?? 0;
  const update = (id: string, value: number) =>
    setValues((current) => ({ ...current, [id]: value }));

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]">
      <div className="border-b border-[var(--line)] bg-[linear-gradient(115deg,var(--surface-subtle),var(--surface))] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--accent)]">
              <Sparkles size={13} /> Live mini model
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-[-.03em]">
              Explore the mechanism
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--ink-muted)]">
              Change a teaching parameter and see the formula update instantly.
              This preview never alters the fixed assessment scenario.
            </p>
          </div>
          <Button
            variant="ghost"
            className="h-9 px-3 text-xs"
            onClick={() => setValues(defaults)}
          >
            <RotateCcw size={14} /> Reset
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(250px,.8fr)]">
        <div className="min-w-0 border-b border-[var(--line)] p-5 lg:border-b-0 lg:border-r sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold">
            <SlidersHorizontal size={15} className="text-[var(--accent)]" />
            Adjust parameters
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {controls.map((item) => {
              const value = values[item.id] ?? item.defaultValue;
              return (
                <label
                  key={item.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-3"
                >
                  <span className="flex items-start justify-between gap-3 text-xs font-bold">
                    <span>{item.label}</span>
                    <MathFormula
                      expression={item.symbol}
                      className="shrink-0 text-[var(--accent)]"
                    />
                  </span>
                  <input
                    type="range"
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    value={value}
                    aria-label={item.label}
                    onChange={(event) =>
                      update(item.id, Number(event.target.value))
                    }
                    className="mt-4 w-full accent-[var(--accent)]"
                  />
                  <span className="mt-2 block text-right font-mono text-sm font-bold text-[var(--accent)]">
                    {format(value)}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
              Active relationship
            </p>
            <MathFormula
              block
              expression={practiceFormula(modelId)}
              className="mt-3 min-w-max text-left text-base text-[var(--ink)] sm:text-lg"
            />
          </div>
        </div>

        <div className="bg-[var(--canvas)] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Gauge size={15} className="text-[var(--accent)]" /> Live output
          </div>
          <div className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--accent)]">
              Main result
            </p>
            <p className="mt-2 text-3xl font-bold tracking-[-.05em] text-[var(--ink)]">
              {format(primary)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--ink-muted)]">
              {calculation.labels[calculation.primaryKey] ??
                "Current model output"}
            </p>
          </div>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {outcomes.map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
              >
                <dt className="text-[10px] font-bold text-[var(--ink-faint)]">
                  {calculation.labels[key] ?? key}
                </dt>
                <dd className="mt-1 text-base font-bold text-[var(--ink)]">
                  {format(value)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--ink-muted)]">
            {calculation.interpretation}
          </p>
        </div>
      </div>
    </section>
  );
}
