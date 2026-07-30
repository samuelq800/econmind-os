"use client";

import { useMemo } from "react";
import { Activity, Calculator, ChartNoAxesCombined, Gauge } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { EquationView } from "@/components/models/equation-view";
import { MetricCard } from "@/components/models/metric-card";
import { ModelAssumptions } from "@/components/models/model-assumptions";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { PredictedEffectsRadar } from "@/components/models/predicted-effects-radar";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { ModelFlowDiagram } from "@/components/learning/model-flow-diagram";
import { extendedModelSensitivity, getExtendedModelDefinition, type ExtendedModelSlug } from "@/lib/economics/extended-models";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { getModel } from "@/lib/models/registry";

type NumericValues = Record<string, number>;

function defaultValues(model: ExtendedModelSlug): NumericValues {
  const definition = getExtendedModelDefinition(model);
  return Object.fromEntries(definition?.controls.map((control) => [control.id, control.defaultValue]) ?? []);
}

function formatValue(value: number, key: string) {
  if (key === "aHasXAdvantage" || key === "freeRiderIncentive" || key === "exhausted" || key === "chooseEffort" || key === "separatingSignalExists") return value === 1 ? "Yes" : "No";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

function metricTone(value: number, key: string): "neutral" | "green" | "amber" | "red" | "blue" {
  if (key === "exhausted" && value === 1) return "red";
  if (key === "aHasXAdvantage" || key === "chooseEffort" || key === "separatingSignalExists") return value === 1 ? "green" : "amber";
  return value < 0 ? "red" : "blue";
}

export function ExtendedModelLab({ model }: { model: ExtendedModelSlug }) {
  const definition = getExtendedModelDefinition(model);
  const catalog = getModel(model);
  const [parameters, setParameters] = usePersistentState<NumericValues>(`econmind:parameters:${model}`, defaultValues(model));

  const calculation = useMemo(() => definition?.calculate(parameters), [definition, parameters]);
  const sensitivity = useMemo(() => definition && extendedModelSensitivity(definition, parameters), [definition, parameters]);

  if (!definition || !catalog || !calculation || !sensitivity) return null;

  const metrics = Object.entries(calculation.results).slice(0, 4);
  const sensitivityControl = definition.controls.find((control) => control.id === definition.sensitivityKey) ?? definition.controls[0];
  const primaryLabel = calculation.labels[calculation.primaryKey] ?? "Primary outcome";

  const update = (id: string, value: number) => setParameters((current) => ({ ...current, [id]: value }));
  const load = (saved: NumericValues) => setParameters((current) => ({ ...current, ...saved }));

  return <>
    <ModelHeader
      modelKey={model}
      eyebrow={`Model ${catalog.number} · Data-backed interactive lab`}
      title={catalog.title}
      description={catalog.description}
      difficulty={catalog.difficulty}
      tags={catalog.concepts}
    />
    <ModelWorkspace
      onReset={() => setParameters(defaultValues(model))}
      controls={<>
        {definition.controls.map((control) => <ParameterControl key={control.id} parameter={control} value={parameters[control.id] ?? control.defaultValue} onChange={(value) => update(control.id, value)} />)}
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3 text-[11px] leading-5 text-[var(--ink-muted)]">
          <span className="font-bold text-[var(--ink)]">Calibration case:</span> {definition.sourceId}. This lab calculates locally in your browser from the supplied teaching formula and does not make requests while parameters move.
        </div>
      </>}
      chart={<div className="grid gap-5 2xl:grid-cols-2">
        <ChartContainer title="Live response curve" subtitle={`${primaryLabel} as ${sensitivityControl.label.toLowerCase()} moves across its teaching range.`} modelLabel={catalog.title}>
          <div className="h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sensitivity} margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" />
              <XAxis dataKey="x" type="number" tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} label={{ value: sensitivityControl.symbol, position: "insideBottomRight", offset: -4, fontSize: 10 }} />
              <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11 }} formatter={(value) => [formatValue(typeof value === "number" ? value : Number(value ?? 0), calculation.primaryKey), primaryLabel]} labelFormatter={(value) => `${sensitivityControl.label}: ${value}`} />
              <Line type="monotone" dataKey="y" name={primaryLabel} stroke="var(--accent)" strokeWidth={2.75} dot={{ r: 3, fill: "var(--accent)" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </ChartContainer>
        <PredictedEffectsRadar model={model} results={calculation.results} modelLabel={catalog.title} />
      </div>}
      metrics={<>{metrics.map(([key, value], index) => <MetricCard key={key} label={calculation.labels[key] ?? key} value={formatValue(value, key)} note={index === 0 ? "Live result" : "Derived from current inputs"} icon={index === 0 ? Gauge : index === 1 ? Calculator : index === 2 ? ChartNoAxesCombined : Activity} tone={metricTone(value, key)} />)}</>}
      explanation={<>
        <EconomicExplanation principle={definition.principle} modelLabel={catalog.title}>{calculation.interpretation}</EconomicExplanation>
        <ModelFlowDiagram
          eyebrow="Mechanism diagram"
          title={`${catalog.title}: from inputs to outcome`}
          stages={[
            { label: "1. Inputs", title: definition.controls.slice(0, 2).map((control) => control.symbol).join(" · "), description: "Change a stated teaching parameter with the controls." },
            { label: "2. Rule", title: definition.formula, description: "The transparent model relationship is recalculated instantly.", active: true },
            { label: "3. Result", title: primaryLabel, description: calculation.interpretation },
          ]}
        />
        <div className="mt-5"><EquationView steps={calculation.equations} parameters={parameters} modelLabel={catalog.title} /></div>
        <div className="mt-5"><ModelAssumptions modelLabel={catalog.title} assumptions={{ structural: definition.assumptions, parameters: [`Formula source: ${definition.sourceId} in the supplied extended-model test suite.`, "All displayed values are editable teaching inputs, not estimates of a real economy."], limitations: definition.limitations }} /></div>
      </>}
      comparison={<ScenarioComparison storageKey={`econmind:scenarios:${model}`} modelKey={model} parameters={parameters} results={calculation.results} metrics={metrics.map(([key]) => key)} onLoadParameters={load} />}
    />
  </>;
}
