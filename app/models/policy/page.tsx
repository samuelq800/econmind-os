"use client";
import {
  CartesianGrid,
  Legend,
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
  BadgeDollarSign,
  CircleDollarSign,
  Scale,
  ShoppingBasket,
  Split,
  TrendingDown,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  calculatePolicyOutcome,
  policyChartData,
  policyExplanation,
  type PolicyParameters,
} from "@/lib/economics/policy";
import { DEFAULT_MARKET } from "@/lib/economics/supply-demand";
import type { ModelParameter } from "@/lib/economics/types";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { MODEL_ASSUMPTIONS } from "@/lib/models/assumptions";
const DEFAULT_POLICY: PolicyParameters = { ...DEFAULT_MARKET, wedge: 10 };
const controls: ModelParameter[] = [
  {
    id: "demandIntercept",
    label: "Demand intercept",
    symbol: "a",
    description: "Market size on the demand side.",
    min: 70,
    max: 150,
    step: 5,
    defaultValue: 100,
  },
  {
    id: "demandSlope",
    label: "Demand slope",
    symbol: "b",
    description: "Buyer responsiveness to price.",
    min: 0.5,
    max: 5,
    step: 0.5,
    defaultValue: 2,
  },
  {
    id: "supplyIntercept",
    label: "Supply intercept",
    symbol: "c",
    description: "Baseline supply-side capacity.",
    min: 0,
    max: 50,
    step: 5,
    defaultValue: 20,
  },
  {
    id: "supplySlope",
    label: "Supply slope",
    symbol: "d",
    description: "Seller responsiveness to price.",
    min: 0.5,
    max: 5,
    step: 0.5,
    defaultValue: 2,
  },
  {
    id: "wedge",
    label: "Policy per unit",
    symbol: "t / s",
    description: "Positive is a tax; negative is a subsidy.",
    min: -20,
    max: 30,
    step: 1,
    defaultValue: 10,
  },
];
export default function PolicyPage() {
  const [params, setParams] = usePersistentState<PolicyParameters>(
      "econmind:parameters:policy",
      DEFAULT_POLICY,
    ),
    outcome = calculatePolicyOutcome(params),
    data = policyChartData(params),
    update = (key: keyof PolicyParameters, value: number) =>
      setParams((c) => ({ ...c, [key]: value })),
    label =
      params.wedge > 0 ? "Tax" : params.wedge < 0 ? "Subsidy" : "No policy";
  return (
    <>
      <ModelHeader
        modelKey="policy"
        eyebrow="Model 02 · Policy analysis"
        title="Indirect Tax & Subsidy"
        description="Examine how a per-unit policy wedge changes prices on each side of the market, trade volume, incidence, and welfare."
        difficulty="Intermediate"
        tags={["Public economics", "Incidence", "Deadweight loss"]}
      />
      <ModelWorkspace
        onReset={() => setParams(DEFAULT_POLICY)}
        controls={
          <>
            {controls.map((c) => (
              <ParameterControl
                key={c.id}
                parameter={c}
                value={params[c.id as keyof PolicyParameters]}
                onChange={(v) => update(c.id as keyof PolicyParameters, v)}
              />
            ))}
            <div className="grid grid-cols-3 gap-2 pt-4">
              <Button
                variant={params.wedge === 10 ? "primary" : "secondary"}
                size="sm"
                onClick={() => update("wedge", 10)}
              >
                Tax
              </Button>
              <Button
                variant={params.wedge === 0 ? "primary" : "secondary"}
                size="sm"
                onClick={() => update("wedge", 0)}
              >
                None
              </Button>
              <Button
                variant={params.wedge === -10 ? "primary" : "secondary"}
                size="sm"
                onClick={() => update("wedge", -10)}
              >
                Subsidy
              </Button>
            </div>
          </>
        }
        chart={
          <ChartContainer
            title={`${label} equilibrium`}
            subtitle="The dashed curve is supply as faced by buyers after the policy wedge"
          >
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 14, right: 26, left: -8, bottom: 8 }}
                >
                  <CartesianGrid
                    stroke="var(--line)"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="quantity"
                    type="number"
                    tick={{ fill: "var(--ink-muted)", fontSize: 10 }}
                    axisLine={{ stroke: "var(--line-strong)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--ink-muted)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="demand"
                    name="Demand"
                    stroke="var(--blue)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="supply"
                    name="Original supply"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="policySupply"
                    name="Supply + policy"
                    stroke="var(--amber)"
                    strokeWidth={2.5}
                    strokeDasharray="6 5"
                    dot={false}
                  />
                  {outcome.valid && (
                    <>
                      <ReferenceArea
                        x1={0}
                        x2={outcome.quantity}
                        y1={Math.min(
                          outcome.consumerPrice,
                          outcome.producerPrice,
                        )}
                        y2={Math.max(
                          outcome.consumerPrice,
                          outcome.producerPrice,
                        )}
                        fill="var(--amber)"
                        fillOpacity={0.09}
                      />
                      <ReferenceLine
                        x={outcome.quantity}
                        stroke="var(--ink)"
                        strokeWidth={2}
                      />
                      <ReferenceDot
                        x={outcome.baselineQuantity}
                        y={outcome.baselinePrice}
                        r={4}
                        fill="var(--surface)"
                        stroke="var(--ink-muted)"
                      />
                      <ReferenceDot
                        x={outcome.quantity}
                        y={outcome.consumerPrice}
                        r={5}
                        fill="var(--surface)"
                        stroke="var(--amber)"
                        strokeWidth={3}
                        label={{
                          value: `Buyer ${outcome.consumerPrice}`,
                          position: "top",
                          fill: "var(--amber)",
                          fontSize: 9,
                        }}
                      />
                      <ReferenceDot
                        x={outcome.quantity}
                        y={outcome.producerPrice}
                        r={5}
                        fill="var(--surface)"
                        stroke="var(--accent)"
                        strokeWidth={3}
                        label={{
                          value: `Seller ${outcome.producerPrice}`,
                          position: "bottom",
                          fill: "var(--accent)",
                          fontSize: 9,
                        }}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartContainer>
        }
        metrics={
          <>
            <MetricCard
              label="Buyer price"
              value={outcome.valid ? outcome.consumerPrice : "—"}
              note={`Before: ${outcome.baselinePrice}`}
              icon={CircleDollarSign}
              tone="blue"
            />
            <MetricCard
              label="Seller price"
              value={outcome.valid ? outcome.producerPrice : "—"}
              note={`Before: ${outcome.baselinePrice}`}
              icon={BadgeDollarSign}
              tone="green"
            />
            <MetricCard
              label="Quantity traded"
              value={outcome.valid ? outcome.quantity : "—"}
              note={`Before: ${outcome.baselineQuantity}`}
              icon={ShoppingBasket}
            />
            <MetricCard
              label={
                params.wedge >= 0 ? "Government revenue" : "Government spending"
              }
              value={outcome.valid ? Math.abs(outcome.governmentBalance) : "—"}
              note="Policy × quantity"
              icon={Scale}
              tone="amber"
            />
            <MetricCard
              label="Consumer share"
              value={outcome.valid ? `${outcome.consumerShare}%` : "—"}
              note={`${outcome.consumerIncidence} per unit`}
              icon={Split}
              tone="blue"
            />
            <MetricCard
              label="Producer share"
              value={outcome.valid ? `${outcome.producerShare}%` : "—"}
              note={`${outcome.producerIncidence} per unit`}
              icon={Split}
              tone="green"
            />
            <MetricCard
              label="Deadweight loss"
              value={outcome.valid ? outcome.deadweightLoss : "—"}
              note="Lost total surplus"
              icon={TrendingDown}
              tone="red"
            />
          </>
        }
        explanation={
          <>
            <EconomicExplanation principle="The less price-responsive side bears more of a tax burden or receives more of a subsidy benefit.">
              {policyExplanation(params)}
            </EconomicExplanation>
            <MechanismChain modelKey="policy" parameters={params} />
            <EquationView modelKey="policy" parameters={params} />
            <ModelAssumptions assumptions={MODEL_ASSUMPTIONS.policy} />
          </>
        }
        comparison={
          <ScenarioComparison
            modelKey="policy"
            storageKey="econmind:scenarios:policy"
            parameters={{ ...params }}
            results={{
              consumerPrice: outcome.consumerPrice,
              producerPrice: outcome.producerPrice,
              quantity: outcome.quantity,
              governmentBalance: outcome.governmentBalance,
              deadweightLoss: outcome.deadweightLoss,
            }}
            metrics={[
              "consumerPrice",
              "producerPrice",
              "quantity",
              "governmentBalance",
              "deadweightLoss",
            ]}
            onLoadParameters={(saved) => setParams((current) => ({ ...current, ...saved }))}
          />
        }
      />
    </>
  );
}
