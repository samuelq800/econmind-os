"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeDollarSign, CircleDollarSign, Factory, Leaf, Scale, Target } from "lucide-react";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { MetricCard } from "@/components/models/metric-card";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { calculateExternality, DEFAULT_EXTERNALITY, externalityChartData, externalityExplanation, type ExternalityParameters } from "@/lib/economics/externalities";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";

const controls: ModelParameter[] = [
  { id: "demandIntercept", label: "Demand intercept", symbol: "a", description: "Market size on the buyer side.", min: 60, max: 160, step: 5, defaultValue: 100 },
  { id: "demandSlope", label: "Demand slope", symbol: "b", description: "How quickly demand falls as price rises.", min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
  { id: "supplyIntercept", label: "Supply intercept", symbol: "c", description: "Baseline private quantity supplied.", min: 0, max: 60, step: 5, defaultValue: 20 },
  { id: "supplySlope", label: "Supply slope", symbol: "d", description: "How quickly private supply rises with price.", min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
  { id: "externalCost", label: "External cost per unit", symbol: "e", description: "Positive values are external costs; negative values represent external benefits.", min: -20, max: 30, step: 1, defaultValue: 10 },
];

export default function ExternalitiesPage() {
  const [parameters, setParameters] = usePersistentState<ExternalityParameters>("econmind:parameters:externalities", DEFAULT_EXTERNALITY);
  const outcome = calculateExternality(parameters);
  const data = externalityChartData(parameters);
  const update = (key: keyof ExternalityParameters, value: number) => setParameters((current) => ({ ...current, [key]: value }));
  const policyLabel = outcome.correctivePolicy > 0 ? "Corrective tax" : outcome.correctivePolicy < 0 ? "Corrective subsidy" : "Corrective policy";

  return <>
    <ModelHeader modelKey="externalities" eyebrow="Model 05 · Social welfare" title="Externalities" description="Separate private incentives from social costs or benefits, then find the efficient quantity and corrective policy." difficulty="Intermediate" tags={["Social cost", "Pigouvian policy", "Welfare"]} />
    <ModelWorkspace
      onReset={() => setParameters(DEFAULT_EXTERNALITY)}
      controls={<>{controls.map((control) => <ParameterControl key={control.id} parameter={control} value={parameters[control.id as keyof ExternalityParameters]} onChange={(value) => update(control.id as keyof ExternalityParameters, value)} />)}</>}
      chart={<ChartContainer title="Private market and social cost" subtitle="A positive external cost shifts marginal social cost above private supply; a benefit shifts it below.">
        <div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="quantity" type="number" tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} />
          <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          <Line type="monotone" dataKey="demand" name="Marginal benefit" stroke="var(--blue)" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="privateCost" name="Private supply / MPC" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="socialCost" name="Social cost / MSC" stroke="var(--amber)" strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
          {outcome.valid && <><ReferenceDot x={outcome.marketQuantity} y={outcome.marketPrice} r={5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} /><ReferenceDot x={outcome.efficientQuantity} y={outcome.efficientConsumerPrice} r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} /></>}
        </LineChart></ResponsiveContainer></div>
      </ChartContainer>}
      metrics={<>
        <MetricCard label="Market quantity" value={outcome.valid ? outcome.marketQuantity : "—"} note={`Private price ${outcome.marketPrice}`} icon={Factory} tone="blue" />
        <MetricCard label="Efficient quantity" value={outcome.valid ? outcome.efficientQuantity : "—"} note="Where social margin is zero" icon={Target} tone="green" />
        <MetricCard label={policyLabel} value={Math.abs(outcome.correctivePolicy)} note="Per unit" icon={BadgeDollarSign} tone="amber" />
        <MetricCard label="Welfare recovered" value={outcome.welfareGain} note="By correcting the quantity gap" icon={Scale} tone="green" />
        <MetricCard label="External impact" value={outcome.externalImpactAtMarket} note="At unregulated output" icon={Leaf} tone={outcome.externalImpactAtMarket > 0 ? "red" : "green"} />
        <MetricCard label="Efficient welfare" value={outcome.socialWelfareEfficient} note="Net of external effects" icon={CircleDollarSign} tone="blue" />
      </>}
      explanation={<EconomicExplanation principle="Efficiency requires marginal social benefit to equal marginal social cost, even when private decision-makers ignore spillovers.">{externalityExplanation(parameters, outcome)}</EconomicExplanation>}
      comparison={<ScenarioComparison storageKey="econmind:scenarios:externalities" modelKey="externalities" parameters={parameters} results={{ marketPrice: outcome.marketPrice, marketQuantity: outcome.marketQuantity, efficientQuantity: outcome.efficientQuantity, correctivePolicy: outcome.correctivePolicy, externalImpact: outcome.externalImpactAtMarket, welfareGain: outcome.welfareGain, socialWelfare: outcome.socialWelfareEfficient }} metrics={["marketQuantity", "efficientQuantity", "correctivePolicy", "externalImpact", "welfareGain", "socialWelfare"]} onLoadParameters={(saved) => setParameters((current) => ({ ...current, ...saved }))} />}
    />
  </>;
}
