"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, CircleGauge, Flame, Gauge, Target, Users } from "lucide-react";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { MetricCard } from "@/components/models/metric-card";
import { ModelAssumptions } from "@/components/models/model-assumptions";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { adAsChartData, adAsExplanation, calculateAdAs, DEFAULT_AD_AS, type AdAsParameters } from "@/lib/economics/ad-as";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { MODEL_ASSUMPTIONS } from "@/lib/models/assumptions";

const controls: ModelParameter[] = [
  { id: "potentialOutput", label: "Potential output", symbol: "Y*", description: "Simplified long-run productive benchmark, indexed to 100 by default.", min: 80, max: 140, step: 1, defaultValue: 100 },
  { id: "demandShock", label: "Aggregate demand shock", symbol: "ΔAD", description: "Positive values shift aggregate demand right; negative values shift it left.", min: -25, max: 25, step: 1, defaultValue: 0 },
  { id: "supplyShock", label: "Short-run supply shock", symbol: "ΔSRAS", description: "Positive values expand short-run supply; negative values represent adverse cost pressure.", min: -25, max: 25, step: 1, defaultValue: 0 },
  { id: "demandSensitivity", label: "Demand sensitivity", symbol: "a", description: "How strongly real spending responds to the price level.", min: 0.3, max: 1.5, step: 0.1, defaultValue: 0.8 },
  { id: "supplySensitivity", label: "Supply sensitivity", symbol: "b", description: "How strongly short-run production responds to the price level.", min: 0.3, max: 1.5, step: 0.1, defaultValue: 0.8 },
];

export default function AdAsPage() {
  const [parameters, setParameters] = usePersistentState<AdAsParameters>("econmind:parameters:ad-as", DEFAULT_AD_AS);
  const outcome = calculateAdAs(parameters);
  const data = adAsChartData(parameters);
  const update = (key: keyof AdAsParameters, value: number) => setParameters((current) => ({ ...current, [key]: value }));
  const gapTone = outcome.outputGap > 1 ? "amber" : outcome.outputGap < -1 ? "red" : "green";

  return <>
    <ModelHeader modelKey="ad-as" eyebrow="Model 08 · Macroeconomic equilibrium" title="Aggregate Demand & Supply" description="Explore stylized demand and supply shocks, output gaps, and price pressure without treating the result as a forecast." difficulty="Intermediate" tags={["AD", "SRAS", "Output gap"]} />
    <ModelWorkspace
      onReset={() => setParameters(DEFAULT_AD_AS)}
      controls={<>{controls.map((control) => <ParameterControl key={control.id} parameter={control} value={parameters[control.id as keyof AdAsParameters]} onChange={(value) => update(control.id as keyof AdAsParameters, value)} />)}</>}
      chart={<ChartContainer title="Short-run AD–AS equilibrium" subtitle="LRAS marks potential output. All values are simplified teaching indices, not measured forecasts.">
        <div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="output" type="number" tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} label={{ value: "Real output index", position: "insideBottomRight", offset: -4, fontSize: 10 }} />
          <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "Price index", angle: -90, position: "insideLeft", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          <Line type="monotone" dataKey="aggregateDemand" name="Aggregate demand" stroke="var(--blue)" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="shortRunSupply" name="Short-run aggregate supply" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
          <ReferenceLine x={parameters.potentialOutput} stroke="var(--amber)" strokeWidth={2} strokeDasharray="6 4" label={{ value: "LRAS", fill: "var(--amber)", fontSize: 10, position: "insideTopRight" }} />
          {outcome.valid && <ReferenceDot x={outcome.output} y={outcome.priceLevel} r={7} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />}
        </LineChart></ResponsiveContainer></div>
      </ChartContainer>}
      metrics={<>
        <MetricCard label="Real output" value={outcome.valid ? outcome.output : "—"} note={`Potential ${parameters.potentialOutput}`} icon={Activity} tone="blue" />
        <MetricCard label="Price level" value={outcome.valid ? outcome.priceLevel : "—"} note="Baseline index 100" icon={Gauge} tone="amber" />
        <MetricCard label="Output gap" value={`${outcome.outputGap > 0 ? "+" : ""}${outcome.outputGap}%`} note={outcome.condition} icon={Target} tone={gapTone} />
        <MetricCard label="Price pressure" value={`${outcome.inflationPressure > 0 ? "+" : ""}${outcome.inflationPressure}`} note="Index points from baseline" icon={Flame} tone={outcome.inflationPressure > 0 ? "red" : outcome.inflationPressure < 0 ? "blue" : "green"} />
        <MetricCard label="Unemployment gap" value={`${outcome.unemploymentGap > 0 ? "+" : ""}${outcome.unemploymentGap}pp`} note="Simplified Okun-style estimate" icon={Users} tone={outcome.unemploymentGap > 0 ? "red" : "green"} />
        <MetricCard label="Shock balance" value={outcome.demandBase - outcome.supplyBase} note="AD base minus SRAS base" icon={CircleGauge} tone="neutral" />
      </>}
      explanation={<><EconomicExplanation principle="In the short run, aggregate demand and aggregate supply jointly determine output and the price level; LRAS provides the potential-output benchmark.">{adAsExplanation(parameters, outcome)}</EconomicExplanation><ModelAssumptions assumptions={MODEL_ASSUMPTIONS["ad-as"]} /></>}
      comparison={<ScenarioComparison storageKey="econmind:scenarios:ad-as" modelKey="ad-as" parameters={parameters} results={{ output: outcome.output, priceLevel: outcome.priceLevel, outputGap: outcome.outputGap, inflationPressure: outcome.inflationPressure, unemploymentGap: outcome.unemploymentGap }} metrics={["output", "priceLevel", "outputGap", "inflationPressure", "unemploymentGap"]} onLoadParameters={(saved) => setParameters((current) => ({ ...current, ...saved }))} />}
    />
  </>;
}
