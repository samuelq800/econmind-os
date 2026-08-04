"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  LockKeyhole,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  WORLD_POLICY_DEFINITIONS,
  WORLD_ROLE_META,
} from "@/lib/world-governance/config";
import {
  buildPolicyForecast,
  policyCosts,
  requiredApprovals,
  rolePolicies,
} from "@/lib/world-governance/simulation";
import type {
  PolicyDefinition,
  WorldGovernanceRole,
} from "@/lib/world-governance/types";

const horizonLabels = {
  immediate: "Immediate pressure",
  medium: "Medium-term transmission",
  long: "Longer-run capacity",
  distributional: "Distribution & legitimacy",
} as const;

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(Math.abs(value) < 1 ? 2 : 1)}`;
}

function LifecycleStrip({ definition }: { definition: PolicyDefinition }) {
  const cells = [
    ["Wait", definition.lifecycle.delayDays],
    ["Ramp", definition.lifecycle.rampDays],
    ["Peak", definition.lifecycle.peakDays],
    ["Fade", definition.lifecycle.decayDays],
  ] as const;
  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)]">
      {cells.map(([label, days], index) => (
        <div
          key={label}
          className={`px-2 py-2 text-center ${index ? "border-l border-[var(--line)]" : ""}`}
        >
          <p className="text-[9px] font-bold uppercase tracking-[.11em] text-[var(--ink-faint)]">
            {label}
          </p>
          <p className="mt-0.5 text-xs font-bold">{days}d</p>
        </div>
      ))}
    </div>
  );
}

function ForecastGroup({
  title,
  effects,
}: {
  title: string;
  effects: Array<{ label: string; low: number; high: number; unit: string }>;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[var(--ink-faint)]">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {effects.length ? (
          effects.map((effect) => (
            <div
              key={effect.label}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-[var(--ink-muted)]">{effect.label}</span>
              <span className="shrink-0 font-mono font-bold text-[var(--ink)]">
                {signed(effect.low)} to {signed(effect.high)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs leading-5 text-[var(--ink-muted)]">
            No material direct movement is calibrated at this intensity.
          </p>
        )}
      </div>
    </div>
  );
}

export function SixDimensionPreview({
  definition,
  value,
}: {
  definition: PolicyDefinition;
  value: number;
}) {
  const scale = Math.min(
    1,
    Math.abs(value - definition.defaultValue) /
      Math.max(Math.abs(definition.min), Math.abs(definition.max), 1),
  );
  const dimensions = [
    ["Activity", definition.impacts.immediate.Growth ?? [0, 0]],
    ["Prices", definition.impacts.immediate.Inflation ?? [0, 0]],
    ["Livelihoods", definition.impacts.medium.Poverty ?? [0, 0]],
    ["Fiscal", definition.impacts.medium["Fiscal balance"] ?? [0, 0]],
    ["Financial", definition.impacts.long["Reserve cover"] ?? [0, 0]],
    [
      "Stability",
      definition.impacts.distributional["National stability"] ?? [0, 0],
    ],
  ] as const;
  const points = dimensions
    .map(([, range], index) => {
      const direction = (range[0] + range[1]) / 2;
      const radius = Math.max(18, Math.min(42, 28 + direction * scale * 7));
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
      return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
    })
    .join(" ");
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          Live local preview
        </p>
        <h3 className="mt-1 text-sm font-bold">Predicted effects</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          The six-axis view updates with the slider. It remains a local forecast
          until publication.
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
        <svg
          viewBox="0 0 100 100"
          className="mx-auto aspect-square w-full max-w-[230px] overflow-visible"
          aria-label="Six dimension predicted effect radar"
        >
          {[18, 30, 42].map((radius) => (
            <circle
              key={radius}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--line)"
              strokeWidth=".6"
            />
          ))}
          {dimensions.map(([label], index) => {
            const angle =
              -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
            return (
              <line
                key={label}
                x1="50"
                y1="50"
                x2={50 + Math.cos(angle) * 42}
                y2={50 + Math.sin(angle) * 42}
                stroke="var(--line)"
                strokeWidth=".5"
              />
            );
          })}
          <polygon
            points={points}
            fill="var(--accent)"
            fillOpacity=".2"
            stroke="var(--accent)"
            strokeWidth="1.2"
          />
          {dimensions.map(([label], index) => {
            const angle =
              -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
            return (
              <text
                key={label}
                x={50 + Math.cos(angle) * 50}
                y={50 + Math.sin(angle) * 50}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--ink-muted)"
                fontSize="5"
                fontWeight="600"
              >
                {label}
              </text>
            );
          })}
        </svg>
        <div className="space-y-2">
          {dimensions.map(([label, range]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2 text-xs last:border-0"
            >
              <span className="text-[var(--ink-muted)]">{label}</span>
              <span className="font-mono font-bold">
                {signed(range[0] * scale)} to {signed(range[1] * scale)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="border-t border-[var(--line)] px-4 py-3 text-[10px] leading-5 text-[var(--ink-faint)]">
        Relative directional index. It aggregates the supplied transparent
        calibration, policy lifecycle and the chosen scale; it does not claim a
        certain real-world outcome.
      </p>
    </Card>
  );
}

export function PolicyStudio({
  role,
  canPublish = false,
  onPublish,
}: {
  role: WorldGovernanceRole;
  canPublish?: boolean;
  onPublish?: (policyId: string, value: number) => Promise<void> | void;
}) {
  const policies = rolePolicies(role);
  const [policyId, setPolicyId] = useState(
    policies[0]?.id ?? WORLD_POLICY_DEFINITIONS[0].id,
  );
  const definition =
    policies.find((item) => item.id === policyId) ??
    policies[0] ??
    WORLD_POLICY_DEFINITIONS[0];
  const [value, setValue] = useState(definition.defaultValue);
  const [published, setPublished] = useState(false);
  const [isPublishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const forecast = buildPolicyForecast(definition, value);
  const costs = policyCosts(definition, value);
  const approvals = requiredApprovals(definition, value);
  const switchPolicy = (nextId: string) => {
    const next = policies.find((item) => item.id === nextId);
    setPolicyId(nextId);
    setValue(next?.defaultValue ?? 0);
    setPublished(false);
    setPublishError(null);
  };
  const publish = async () => {
    if (!canPublish || !onPublish) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish(definition.id, value);
      setPublished(true);
    } catch (error) {
      setPublishError(
        error instanceof Error
          ? error.message
          : "The policy could not be published. Try again after checking the approval and country state.",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,.84fr)]">
      <div className="space-y-5">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
                {WORLD_ROLE_META[role].shortTitle} policy desk
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-.03em]">
                Draft before the world changes
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                Slider movements update the forecast in this browser.
                Publication creates a governed policy record and begins the
                continuous lifecycle.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[10px] font-bold text-[var(--ink-muted)]">
              <Clock3 size={12} /> No round lock
            </span>
          </div>
          <label
            className="mt-5 block text-xs font-bold"
            htmlFor="world-policy"
          >
            Instrument
          </label>
          <select
            id="world-policy"
            value={policyId}
            onChange={(event) => switchPolicy(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold outline-none focus:border-[var(--accent)]"
          >
            {policies.map((policy) => (
              <option value={policy.id} key={policy.id}>
                {policy.title}
              </option>
            ))}
          </select>
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">{definition.title}</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--ink-muted)]">
                  {definition.description}
                </p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent)]">
                {definition.confidence} confidence
              </span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <label htmlFor="world-policy-value" className="text-xs font-bold">
                Proposed setting{" "}
                <span className="block pt-1 font-normal text-[var(--ink-muted)]">
                  {definition.unit}
                </span>
              </label>
              <output className="rounded-lg bg-[var(--surface)] px-3 py-2 font-mono text-base font-bold text-[var(--accent)]">
                {value}
              </output>
            </div>
            <input
              id="world-policy-value"
              type="range"
              min={definition.min}
              max={definition.max}
              step={definition.step}
              value={value}
              onChange={(event) => {
                setValue(Number(event.target.value));
                setPublished(false);
              }}
              className="mt-4 w-full accent-[var(--accent)]"
            />
            <div className="mt-1 flex justify-between text-[10px] font-medium text-[var(--ink-faint)]">
              <span>{definition.min}</span>
              <span>
                Safe zone {definition.safeRange[0].toFixed(1)}–
                {definition.safeRange[1].toFixed(1)}
              </span>
              <span>{definition.max}</span>
            </div>
          </div>
          <div className="mt-4">
            <LifecycleStrip definition={definition} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Fiscal cost", costs.fiscalCost, "% GDP"],
              ["Reserve use", costs.reserveCost, "%"],
              ["Political cost", costs.politicalCost, "%"],
            ].map(([label, amount, unit]) => (
              <div
                key={label as string}
                className="rounded-lg border border-[var(--line)] px-3 py-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
                  {label}
                </p>
                <p className="mt-1 text-lg font-bold">
                  {Number(amount).toFixed(2)}
                  <span className="ml-1 text-xs font-medium text-[var(--ink-muted)]">
                    {unit}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-[var(--accent)]" />
            <h3 className="text-base font-bold">
              Forecast, dependencies and uncertainty
            </h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
            {forecast.directEffect}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(
              Object.keys(horizonLabels) as Array<keyof typeof horizonLabels>
            ).map((horizon) => (
              <ForecastGroup
                key={horizon}
                title={horizonLabels[horizon]}
                effects={forecast[horizon]}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
                Dependencies
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-[var(--ink-muted)]">
                {forecast.dependencies.map((dependency) => (
                  <li className="flex gap-2" key={dependency}>
                    <CheckCircle2
                      size={13}
                      className="mt-0.5 shrink-0 text-[var(--accent)]"
                    />
                    {dependency}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--amber)] bg-[var(--amber-soft)] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--amber)]">
                <AlertTriangle size={12} /> Uncertainty
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                {forecast.uncertainty}
              </p>
            </div>
          </div>
        </Card>
      </div>
      <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
        <SixDimensionPreview definition={definition} value={value} />
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
            Governance gate
          </p>
          <h3 className="mt-1 text-base font-bold">Publish decision</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
            {approvals.length
              ? `This draft also requires: ${approvals.map((approval) => WORLD_ROLE_META[approval].shortTitle).join(", ")}.`
              : "This policy is within the delegated approval band."}
          </p>
          {canPublish ? (
            <Button
              onClick={publish}
              disabled={isPublishing || published}
              className="mt-4 w-full"
            >
              {published ? (
                <>
                  <CheckCircle2 size={15} /> Published to lifecycle
                </>
              ) : (
                <>
                  <Send size={15} />{" "}
                  {isPublishing ? "Publishing…" : "Publish policy"}
                </>
              )}
            </Button>
          ) : (
            <div className="mt-4 rounded-lg border border-[var(--amber)] bg-[var(--amber-soft)] px-3 py-3 text-xs leading-5 text-[var(--ink-muted)]">
              <p className="flex items-center gap-1.5 font-bold text-[var(--amber)]">
                <LockKeyhole size={13} /> Office authority required
              </p>
              <p className="mt-1">
                You can explore the local forecast, but only an assigned
                officeholder can publish to this country.
              </p>
            </div>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-[var(--ink-faint)]">
            <Sparkles size={12} className="mt-0.5 shrink-0" />
            Publication is append-only. A later change creates a reversal
            record, applies its credibility cost and starts a new lifecycle.
          </p>
          {publishError ? (
            <p className="mt-3 rounded-lg border border-[var(--red)] bg-[var(--red-soft)] px-3 py-2 text-xs leading-5 text-[var(--red)]">
              {publishError}
            </p>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}
