"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BadgeDollarSign,
  CircleDollarSign,
  ShoppingBasket,
} from "lucide-react";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { MetricCard } from "@/components/models/metric-card";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import {
  calculateElasticity,
  demandCurveData,
  elasticityExplanation,
  type ElasticityParameters,
} from "@/lib/economics/elasticity";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
const DEFAULT: ElasticityParameters = {
  demandIntercept: 100,
  demandSlope: 2,
  price: 25,
};
const controls: ModelParameter[] = [
  {
    id: "demandIntercept",
    label: "Demand intercept",
    symbol: "a",
    description: "Quantity demanded when price is zero.",
    min: 60,
    max: 160,
    step: 5,
    defaultValue: 100,
  },
  {
    id: "demandSlope",
    label: "Demand slope",
    symbol: "b",
    description: "Absolute quantity change per unit of price.",
    min: 0.5,
    max: 5,
    step: 0.5,
    defaultValue: 2,
  },
  {
    id: "price",
    label: "Current price",
    symbol: "P",
    description: "Operating point for elasticity and revenue.",
    min: 1,
    max: 45,
    step: 1,
    defaultValue: 25,
  },
];
export default function ElasticityPage() {
  const [params, setParams] = usePersistentState<ElasticityParameters>(
      "econmind:parameters:elasticity",
      DEFAULT,
    ),
    outcome = calculateElasticity(params),
    data = demandCurveData(params),
    update = (key: keyof ElasticityParameters, value: number) =>
      setParams((c) => ({ ...c, [key]: value }));
  return (
    <>
      <ModelHeader
        modelKey="elasticity"
        eyebrow="Model 03 · Buyer responsiveness"
        title="Elasticity & Total Revenue"
        description="Move along a linear demand curve to see why the same curve can be elastic at high prices and inelastic at low prices."
        tags={["Demand", "Point elasticity", "Revenue"]}
      />
      <ModelWorkspace
        onReset={() => setParams(DEFAULT)}
        controls={
          <>
            {controls.map((c) => (
              <ParameterControl
                key={c.id}
                parameter={c}
                value={params[c.id as keyof ElasticityParameters]}
                onChange={(v) => update(c.id as keyof ElasticityParameters, v)}
              />
            ))}
            <div className="mt-4 rounded-lg bg-[var(--surface-subtle)] p-3 text-[11px] leading-5 text-[var(--ink-muted)]">
              <b className="text-[var(--ink)]">Formula</b>
              <br />ε = |−b × P / Q|
              <br />
              TR = P × Q
            </div>
          </>
        }
        chart={
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartContainer
              title="Demand curve & operating point"
              subtitle="The shaded rectangle represents total revenue"
            >
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data}
                    margin={{ top: 14, right: 20, left: -10, bottom: 8 }}
                  >
                    <CartesianGrid
                      stroke="var(--line)"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="quantity"
                      type="number"
                      reversed
                      domain={[0, "dataMax"]}
                      tick={{ fill: "var(--ink-muted)", fontSize: 9 }}
                    />
                    <YAxis
                      dataKey="price"
                      type="number"
                      tick={{ fill: "var(--ink-muted)", fontSize: 9 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      name="Demand"
                      stroke="var(--blue)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    {outcome.valid && (
                      <>
                        <ReferenceArea
                          x1={0}
                          x2={outcome.quantity}
                          y1={0}
                          y2={params.price}
                          fill="var(--blue)"
                          fillOpacity={0.1}
                        />
                        <ReferenceLine
                          x={outcome.quantity}
                          stroke="var(--line-strong)"
                          strokeDasharray="4 4"
                        />
                        <ReferenceLine
                          y={params.price}
                          stroke="var(--line-strong)"
                          strokeDasharray="4 4"
                        />
                        <ReferenceDot
                          x={outcome.quantity}
                          y={params.price}
                          r={6}
                          fill="var(--surface)"
                          stroke="var(--blue)"
                          strokeWidth={3}
                        />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartContainer>
            <ChartContainer
              title="Price–revenue relationship"
              subtitle="Revenue peaks where point elasticity is approximately one"
            >
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data}
                    margin={{ top: 14, right: 20, left: -10, bottom: 8 }}
                  >
                    <CartesianGrid
                      stroke="var(--line)"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="price"
                      type="number"
                      domain={[0, "dataMax"]}
                      tick={{ fill: "var(--ink-muted)", fontSize: 9 }}
                    />
                    <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                    />
                    <defs>
                      <linearGradient
                        id="revenueFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--accent)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--accent)"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Total revenue"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      fill="url(#revenueFill)"
                    />
                    <ReferenceLine
                      x={outcome.revenueMaximizingPrice}
                      stroke="var(--amber)"
                      strokeDasharray="5 4"
                    />
                    <ReferenceDot
                      x={params.price}
                      y={outcome.totalRevenue}
                      r={5}
                      fill="var(--surface)"
                      stroke="var(--ink)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartContainer>
          </div>
        }
        metrics={
          <>
            <MetricCard
              label="Current price"
              value={params.price}
              note="Selected point"
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Quantity demanded"
              value={outcome.valid ? outcome.quantity : 0}
              note="Q = a − bP"
              icon={ShoppingBasket}
              tone="blue"
            />
            <MetricCard
              label="Point elasticity"
              value={outcome.valid ? outcome.elasticity : "—"}
              note={outcome.classification}
              icon={Activity}
              tone={outcome.classification === "Elastic" ? "amber" : "green"}
            />
            <MetricCard
              label="Total revenue"
              value={outcome.valid ? outcome.totalRevenue : 0}
              note={`Maximum near P = ${outcome.revenueMaximizingPrice}`}
              icon={BadgeDollarSign}
              tone="green"
            />
          </>
        }
        explanation={
          <EconomicExplanation principle="On a linear demand curve, elasticity varies by location even though slope is constant.">
            {elasticityExplanation(params)}
          </EconomicExplanation>
        }
        comparison={
          <ScenarioComparison
            modelKey="elasticity"
            storageKey="econmind:scenarios:elasticity"
            parameters={{ ...params }}
            results={{
              price: params.price,
              quantity: outcome.quantity,
              elasticity: outcome.elasticity,
              totalRevenue: outcome.totalRevenue,
            }}
            metrics={["price", "quantity", "elasticity", "totalRevenue"]}
          />
        }
      />
    </>
  );
}
