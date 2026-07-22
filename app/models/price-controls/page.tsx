"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleDollarSign, PackageOpen, Scale, ShoppingBasket, TriangleAlert } from "lucide-react";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { MetricCard } from "@/components/models/metric-card";
import { ModelAssumptions } from "@/components/models/model-assumptions";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { Button } from "@/components/ui/button";
import { calculatePriceControl, DEFAULT_PRICE_CONTROLS, priceControlChartData, priceControlExplanation, type PriceControlParameters } from "@/lib/economics/price-controls";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { MODEL_ASSUMPTIONS } from "@/lib/models/assumptions";

const controls: ModelParameter[] = [
  { id: "demandIntercept", label: "Demand intercept", symbol: "a", description: "Market size on the buyer side.", min: 60, max: 160, step: 5, defaultValue: 100 },
  { id: "demandSlope", label: "Demand slope", symbol: "b", description: "How demand falls as price rises.", min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
  { id: "supplyIntercept", label: "Supply intercept", symbol: "c", description: "Baseline quantity supplied.", min: 0, max: 60, step: 5, defaultValue: 20 },
  { id: "supplySlope", label: "Supply slope", symbol: "d", description: "How supply rises as price rises.", min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
  { id: "controlPrice", label: "Controlled price", symbol: "Pc", description: "Legal maximum or minimum price.", min: 0, max: 60, step: 1, defaultValue: 15 },
];

export default function PriceControlsPage() {
  const [parameters, setParameters] = usePersistentState<PriceControlParameters>("econmind:parameters:price-controls", DEFAULT_PRICE_CONTROLS);
  const outcome = calculatePriceControl(parameters);
  const data = priceControlChartData(parameters);
  const update = (key: keyof PriceControlParameters, value: number | string) => setParameters((current) => ({ ...current, [key]: value }));

  return (
    <>
      <ModelHeader modelKey="price-controls" eyebrow="Model 03 · Market regulation" title="Price Controls" description="See when a legal price ceiling or floor becomes binding, then measure rationing, unplanned inventory, and lost gains from trade." difficulty="Intermediate" tags={["Price ceiling", "Price floor", "Welfare"]} />
      <ModelWorkspace
        onReset={() => setParameters(DEFAULT_PRICE_CONTROLS)}
        controls={<>
          <div className="grid grid-cols-2 gap-2 border-b border-[var(--line)] py-4">
            <Button size="sm" variant={parameters.controlType === "ceiling" ? "primary" : "secondary"} onClick={() => update("controlType", "ceiling")}>Price ceiling</Button>
            <Button size="sm" variant={parameters.controlType === "floor" ? "primary" : "secondary"} onClick={() => update("controlType", "floor")}>Price floor</Button>
          </div>
          {controls.map((control) => <ParameterControl key={control.id} parameter={control} value={parameters[control.id as keyof PriceControlParameters] as number} onChange={(value) => update(control.id as keyof PriceControlParameters, value)} />)}
        </>}
        chart={<ChartContainer title={`${parameters.controlType === "ceiling" ? "Price ceiling" : "Price floor"} market`} subtitle="The horizontal rule is the selected legal price; the dotted point is the unconstrained equilibrium.">
          <div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 16, right: 24, left: -8, bottom: 8 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="quantity" type="number" tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} />
            <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Line type="monotone" dataKey="demand" name="Demand" stroke="var(--blue)" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="supply" name="Supply" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
            {outcome.valid && <><ReferenceLine y={parameters.controlPrice} stroke="var(--amber)" strokeWidth={2} strokeDasharray="6 4" label={{ value: `${parameters.controlType === "ceiling" ? "Ceiling" : "Floor"} ${parameters.controlPrice}`, fill: "var(--amber)", fontSize: 10, position: "insideTopRight" }} /><ReferenceDot x={outcome.equilibriumQuantity} y={outcome.equilibriumPrice} r={5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} /></>}
          </LineChart></ResponsiveContainer></div>
        </ChartContainer>}
        metrics={<>
          <MetricCard label="Effective price" value={outcome.valid ? outcome.controlledPrice : "—"} note={outcome.binding ? "Binding control" : "Market equilibrium"} icon={CircleDollarSign} tone={outcome.binding ? "amber" : "green"} />
          <MetricCard label="Quantity traded" value={outcome.valid ? outcome.quantityTraded : "—"} note={`Baseline ${outcome.equilibriumQuantity}`} icon={ShoppingBasket} tone="blue" />
          <MetricCard label={parameters.controlType === "ceiling" ? "Shortage" : "Surplus"} value={parameters.controlType === "ceiling" ? outcome.shortage : outcome.surplus} note={outcome.binding ? "Control imbalance" : "No imbalance"} icon={PackageOpen} tone="amber" />
          <MetricCard label="Deadweight loss" value={outcome.deadweightLoss} note="Lost gains from trade" icon={TriangleAlert} tone="red" />
          <MetricCard label="Consumer surplus" value={outcome.consumerSurplus} note="Efficient rationing assumption" icon={Scale} tone="blue" />
          <MetricCard label="Producer surplus" value={outcome.producerSurplus} note="On units actually sold" icon={Scale} tone="green" />
        </>}
        explanation={<><EconomicExplanation principle="A price control changes outcomes only when it prevents the market from reaching its equilibrium price.">{priceControlExplanation(parameters, outcome)}</EconomicExplanation><ModelAssumptions assumptions={MODEL_ASSUMPTIONS["price-controls"]} /></>}
        comparison={<ScenarioComparison storageKey="econmind:scenarios:price-controls" modelKey="price-controls" parameters={{ demandIntercept: parameters.demandIntercept, demandSlope: parameters.demandSlope, supplyIntercept: parameters.supplyIntercept, supplySlope: parameters.supplySlope, controlPrice: parameters.controlPrice, controlType: parameters.controlType === "ceiling" ? 0 : 1 }} results={{ price: outcome.controlledPrice, quantityTraded: outcome.quantityTraded, shortage: outcome.shortage, surplus: outcome.surplus, deadweightLoss: outcome.deadweightLoss, totalSurplus: outcome.totalSurplus }} metrics={["price", "quantityTraded", "shortage", "surplus", "deadweightLoss", "totalSurplus"]} onLoadParameters={(saved) => setParameters((current) => ({ ...current, ...saved, controlType: saved.controlType === 1 ? "floor" : "ceiling" }))} />}
      />
    </>
  );
}
