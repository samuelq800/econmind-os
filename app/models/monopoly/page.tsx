"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeDollarSign, Boxes, CircleDollarSign, Percent, Scale, TriangleAlert } from "lucide-react";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { EquationView } from "@/components/models/equation-view";
import { MechanismChain } from "@/components/models/mechanism-chain";
import { MetricCard } from "@/components/models/metric-card";
import { ModelAssumptions } from "@/components/models/model-assumptions";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { calculateMonopoly, DEFAULT_MONOPOLY, monopolyChartData, monopolyExplanation, type MonopolyParameters } from "@/lib/economics/monopoly";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { MODEL_ASSUMPTIONS } from "@/lib/models/assumptions";

const controls: ModelParameter[] = [
  { id: "demandIntercept", label: "Demand intercept", symbol: "a", description: "Quantity demanded when price is zero.", min: 60, max: 180, step: 5, defaultValue: 100 },
  { id: "demandSlope", label: "Demand slope", symbol: "b", description: "Price sensitivity of market demand.", min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
  { id: "marginalCost", label: "Marginal cost", symbol: "MC", description: "Constant cost of producing one more unit.", min: 0, max: 40, step: 1, defaultValue: 10 },
  { id: "fixedCost", label: "Fixed cost", symbol: "F", description: "Cost paid regardless of output; it affects profit but not MR = MC quantity.", min: 0, max: 500, step: 10, defaultValue: 100 },
];

export default function MonopolyPage() {
  const [parameters, setParameters] = usePersistentState<MonopolyParameters>("econmind:parameters:monopoly", DEFAULT_MONOPOLY);
  const outcome = calculateMonopoly(parameters);
  const data = monopolyChartData(parameters);
  const update = (key: keyof MonopolyParameters, value: number) => setParameters((current) => ({ ...current, [key]: value }));

  return <>
    <ModelHeader modelKey="monopoly" eyebrow="Model 06 · Firm behavior" title="Monopoly" description="Use marginal revenue and marginal cost to compare a profit-maximizing firm with a competitive benchmark." difficulty="Intermediate" tags={["MR = MC", "Markup", "Deadweight loss"]} />
    <ModelWorkspace
      onReset={() => setParameters(DEFAULT_MONOPOLY)}
      controls={<>{controls.map((control) => <ParameterControl key={control.id} parameter={control} value={parameters[control.id as keyof MonopolyParameters]} onChange={(value) => update(control.id as keyof MonopolyParameters, value)} />)}</>}
      chart={<ChartContainer title="Monopoly choice and competitive benchmark" subtitle="The monopoly quantity occurs where MR meets MC; price is then read from demand.">
        <div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="quantity" type="number" tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} />
          <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          <Line type="monotone" dataKey="demand" name="Demand / AR" stroke="var(--blue)" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="marginalRevenue" name="Marginal revenue" stroke="var(--amber)" strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
          <Line type="monotone" dataKey="marginalCost" name="Marginal cost" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
          {outcome.valid && <><ReferenceLine x={outcome.monopolyQuantity} stroke="var(--line-strong)" strokeDasharray="3 4" /><ReferenceDot x={outcome.monopolyQuantity} y={outcome.monopolyPrice} r={6} fill="var(--amber)" stroke="var(--surface)" strokeWidth={2} /><ReferenceDot x={outcome.competitiveQuantity} y={outcome.competitivePrice} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} /></>}
        </LineChart></ResponsiveContainer></div>
      </ChartContainer>}
      metrics={<>
        <MetricCard label="Monopoly price" value={outcome.valid ? outcome.monopolyPrice : "—"} note={`Markup ${outcome.markup}`} icon={CircleDollarSign} tone="amber" />
        <MetricCard label="Monopoly output" value={outcome.valid ? outcome.monopolyQuantity : "—"} note={`Competitive ${outcome.competitiveQuantity}`} icon={Boxes} tone="blue" />
        <MetricCard label="Economic profit" value={outcome.profit} note="After fixed cost" icon={BadgeDollarSign} tone={outcome.profit >= 0 ? "green" : "red"} />
        <MetricCard label="Lerner index" value={outcome.lernerIndex} note="Markup as share of price" icon={Percent} tone="amber" />
        <MetricCard label="Consumer surplus" value={outcome.consumerSurplus} note="Under monopoly pricing" icon={Scale} tone="blue" />
        <MetricCard label="Deadweight loss" value={outcome.deadweightLoss} note="Lost gains from restricted output" icon={TriangleAlert} tone="red" />
      </>}
      explanation={<><EconomicExplanation principle="A single-price monopoly chooses output where marginal revenue equals marginal cost, then charges the demand price for that quantity.">{monopolyExplanation(parameters, outcome)}</EconomicExplanation><MechanismChain modelKey="monopoly" parameters={parameters} /><EquationView modelKey="monopoly" parameters={parameters} /><ModelAssumptions assumptions={MODEL_ASSUMPTIONS.monopoly} /></>}
      comparison={<ScenarioComparison storageKey="econmind:scenarios:monopoly" modelKey="monopoly" parameters={parameters} results={{ monopolyPrice: outcome.monopolyPrice, monopolyQuantity: outcome.monopolyQuantity, competitiveQuantity: outcome.competitiveQuantity, profit: outcome.profit, markup: outcome.markup, lernerIndex: outcome.lernerIndex, deadweightLoss: outcome.deadweightLoss }} metrics={["monopolyPrice", "monopolyQuantity", "competitiveQuantity", "profit", "markup", "deadweightLoss"]} onLoadParameters={(saved) => setParameters((current) => ({ ...current, ...saved }))} />}
    />
  </>;
}
