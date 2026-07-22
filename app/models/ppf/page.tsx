"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CircleGauge, Factory, Scale, Target, TrendingUp } from "lucide-react";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { MetricCard } from "@/components/models/metric-card";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { calculatePpf, DEFAULT_PPF, ppfChartData, ppfExplanation, type PpfParameters } from "@/lib/economics/ppf";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";

const controls: ModelParameter[] = [
  { id: "capacityX", label: "Maximum Good X", symbol: "Xmax", description: "Output of Good X if all resources specialize in X.", min: 50, max: 200, step: 5, defaultValue: 100 },
  { id: "capacityY", label: "Maximum Good Y", symbol: "Ymax", description: "Output of Good Y if all resources specialize in Y.", min: 50, max: 200, step: 5, defaultValue: 100 },
  { id: "curvature", label: "Opportunity-cost curvature", symbol: "α", description: "Higher values make marginal opportunity cost rise more sharply.", min: 1, max: 3, step: 0.1, defaultValue: 2 },
  { id: "allocation", label: "Resources allocated toward X", symbol: "s", description: "Selects a location along the current frontier.", min: 0, max: 100, step: 1, defaultValue: 50 },
  { id: "capacityUse", label: "Capacity use", symbol: "u", description: "Below 100% is inefficient; above 100% attempts an unattainable output bundle.", min: 50, max: 120, step: 1, defaultValue: 100 },
  { id: "growthRate", label: "Capacity shift", symbol: "g", description: "Technology or resource change that shifts both axes.", min: -25, max: 40, step: 1, defaultValue: 0 },
];

export default function PpfPage() {
  const [parameters, setParameters] = usePersistentState<PpfParameters>("econmind:parameters:ppf", DEFAULT_PPF);
  const outcome = calculatePpf(parameters);
  const data = ppfChartData(parameters);
  const update = (key: keyof PpfParameters, value: number) => setParameters((current) => ({ ...current, [key]: value }));
  const statusTone = outcome.status === "Efficient" ? "green" : outcome.status === "Unattainable" ? "red" : "amber";

  return <>
    <ModelHeader modelKey="ppf" eyebrow="Model 07 · Scarcity and choice" title="Production Possibility Frontier" description="Allocate scarce productive capacity, observe rising opportunity cost, and classify output bundles." difficulty="Beginner" tags={["Scarcity", "Efficiency", "Growth"]} />
    <ModelWorkspace
      onReset={() => setParameters(DEFAULT_PPF)}
      controls={<>{controls.map((control) => <ParameterControl key={control.id} parameter={control} value={parameters[control.id as keyof PpfParameters]} onChange={(value) => update(control.id as keyof PpfParameters, value)} />)}</>}
      chart={<ChartContainer title="Production possibility frontier" subtitle="The solid curve is current capacity; the muted dashed curve is the pre-shift baseline.">
        <div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis dataKey="outputX" type="number" tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} label={{ value: "Good X", position: "insideBottomRight", offset: -4, fontSize: 10 }} />
          <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "Good Y", angle: -90, position: "insideLeft", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          <Line type="monotone" dataKey="baseline" name="Baseline frontier" stroke="var(--ink-faint)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="current" name="Current frontier" stroke="var(--accent)" strokeWidth={2.75} dot={false} connectNulls={false} />
          {outcome.valid && <ReferenceDot x={outcome.outputX} y={outcome.outputY} r={7} fill={outcome.status === "Efficient" ? "var(--accent)" : outcome.status === "Unattainable" ? "var(--red)" : "var(--amber)"} stroke="var(--surface)" strokeWidth={2} />}
        </LineChart></ResponsiveContainer></div>
      </ChartContainer>}
      metrics={<>
        <MetricCard label="Bundle status" value={outcome.status} note={`${parameters.capacityUse}% capacity use`} icon={Target} tone={statusTone} />
        <MetricCard label="Good X output" value={outcome.valid ? outcome.outputX : "—"} note={`Capacity ${outcome.shiftedCapacityX}`} icon={Factory} tone="blue" />
        <MetricCard label="Good Y output" value={outcome.valid ? outcome.outputY : "—"} note={`Capacity ${outcome.shiftedCapacityY}`} icon={Factory} tone="green" />
        <MetricCard label="Opportunity cost" value={outcome.opportunityCost} note="Units of Y per next X" icon={Scale} tone="amber" />
        <MetricCard label="Capacity gap" value={outcome.capacityGap} note="Positive means spare capacity" icon={CircleGauge} tone={outcome.capacityGap >= 0 ? "blue" : "red"} />
        <MetricCard label="Capacity shift" value={`${parameters.growthRate > 0 ? "+" : ""}${parameters.growthRate}%`} note="Technology/resources" icon={parameters.growthRate >= 0 ? TrendingUp : ArrowUpRight} tone={parameters.growthRate >= 0 ? "green" : "red"} />
      </>}
      explanation={<EconomicExplanation principle="Moving along a bowed-out PPF reallocates scarce resources, while shifts of the frontier change the economy's productive capacity.">{ppfExplanation(parameters, outcome)}</EconomicExplanation>}
      comparison={<ScenarioComparison storageKey="econmind:scenarios:ppf" modelKey="ppf" parameters={parameters} results={{ outputX: outcome.outputX, outputY: outcome.outputY, opportunityCost: outcome.opportunityCost, capacityGap: outcome.capacityGap, capacityX: outcome.shiftedCapacityX, capacityY: outcome.shiftedCapacityY }} metrics={["outputX", "outputY", "opportunityCost", "capacityGap", "capacityX", "capacityY"]} onLoadParameters={(saved) => setParameters((current) => ({ ...current, ...saved }))} />}
    />
  </>;
}
