"use client";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CircleDollarSign,
  HandCoins,
  Scale,
  ShoppingBasket,
} from "lucide-react";
import { ChartContainer } from "@/components/models/chart-container";
import { EconomicExplanation } from "@/components/models/economic-explanation";
import { MetricCard } from "@/components/models/metric-card";
import { ModelHeader } from "@/components/models/model-header";
import { ModelWorkspace } from "@/components/models/model-workspace";
import { ParameterControl } from "@/components/models/parameter-control";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import {
  calculateMarketEquilibrium,
  DEFAULT_MARKET,
  marketChartData,
  supplyDemandExplanation,
} from "@/lib/economics/supply-demand";
import type { MarketParameters, ModelParameter } from "@/lib/economics/types";
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
    description: "How strongly demand falls as price rises.",
    min: 0.5,
    max: 5,
    step: 0.5,
    defaultValue: 2,
  },
  {
    id: "supplyIntercept",
    label: "Supply intercept",
    symbol: "c",
    description: "Quantity supplied when price is zero.",
    min: 0,
    max: 60,
    step: 5,
    defaultValue: 20,
  },
  {
    id: "supplySlope",
    label: "Supply slope",
    symbol: "d",
    description: "How strongly supply rises as price rises.",
    min: 0.5,
    max: 5,
    step: 0.5,
    defaultValue: 2,
  },
];
export default function SupplyDemandPage() {
  const [params, setParams] = usePersistentState<MarketParameters>(
      "econmind:parameters:supply-demand",
      DEFAULT_MARKET,
    ),
    outcome = calculateMarketEquilibrium(params),
    data = marketChartData(params),
    update = (key: keyof MarketParameters, value: number) =>
      setParams((c) => ({ ...c, [key]: value })),
    shift = (key: "demandIntercept" | "supplyIntercept", amount: number) =>
      setParams((c) => ({
        ...c,
        [key]: Math.max(0, Math.min(160, c[key] + amount)),
      }));
  return (
    <>
      <ModelHeader
        modelKey="supply-demand"
        eyebrow="Model 01 · Market mechanics"
        title="Supply & Demand"
        description="Change the position and responsiveness of buyers and sellers to see how equilibrium and gains from trade emerge."
        tags={["Microeconomics", "Equilibrium", "Welfare"]}
      />
      <ModelWorkspace
        onReset={() => setParams(DEFAULT_MARKET)}
        controls={
          <>
            {controls.map((c) => (
              <ParameterControl
                key={c.id}
                parameter={c}
                value={params[c.id as keyof MarketParameters]}
                onChange={(v) => update(c.id as keyof MarketParameters, v)}
              />
            ))}
            <div className="grid grid-cols-2 gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => shift("demandIntercept", 10)}
              >
                Demand +
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => shift("demandIntercept", -10)}
              >
                Demand −
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => shift("supplyIntercept", 10)}
              >
                Supply +
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => shift("supplyIntercept", -10)}
              >
                Supply −
              </Button>
            </div>
          </>
        }
        chart={
          <ChartContainer
            title="Market equilibrium"
            subtitle="Inverse demand and supply curves · Quantity on x-axis, price on y-axis"
          >
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 10, right: 22, left: -8, bottom: 8 }}
                >
                  <CartesianGrid
                    stroke="var(--line)"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="quantity"
                    type="number"
                    domain={[0, "dataMax"]}
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
                    name="Supply"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  {outcome.valid && (
                    <ReferenceDot
                      x={outcome.quantity}
                      y={outcome.price}
                      r={6}
                      fill="var(--surface)"
                      stroke="var(--ink)"
                      strokeWidth={3}
                      label={{
                        value: `E (${outcome.quantity}, ${outcome.price})`,
                        position: "top",
                        fill: "var(--ink)",
                        fontSize: 10,
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartContainer>
        }
        metrics={
          <>
            <MetricCard
              label="Equilibrium price"
              value={outcome.valid ? outcome.price : "—"}
              note="Qd = Qs"
              icon={CircleDollarSign}
              tone="green"
            />
            <MetricCard
              label="Equilibrium quantity"
              value={outcome.valid ? outcome.quantity : "—"}
              note="Units traded"
              icon={ShoppingBasket}
              tone="blue"
            />
            <MetricCard
              label="Consumer surplus"
              value={outcome.valid ? outcome.consumerSurplus : "—"}
              note="Buyer gains"
              icon={HandCoins}
              tone="amber"
            />
            <MetricCard
              label="Producer surplus"
              value={outcome.valid ? outcome.producerSurplus : "—"}
              note="Seller gains"
              icon={Scale}
              tone="green"
            />
          </>
        }
        explanation={
          <EconomicExplanation principle="Competitive equilibrium maximizes total surplus without market failures.">
            {supplyDemandExplanation(params)}
          </EconomicExplanation>
        }
        comparison={
          <ScenarioComparison
            modelKey="supply-demand"
            storageKey="econmind:scenarios:supply-demand"
            parameters={{ ...params }}
            results={{
              price: outcome.price,
              quantity: outcome.quantity,
              consumerSurplus: outcome.consumerSurplus,
              producerSurplus: outcome.producerSurplus,
              totalSurplus: outcome.totalSurplus,
            }}
            metrics={[
              "price",
              "quantity",
              "consumerSurplus",
              "producerSurplus",
              "totalSurplus",
            ]}
          />
        }
      />
    </>
  );
}
