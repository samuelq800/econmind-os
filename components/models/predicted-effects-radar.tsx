"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartContainer } from "@/components/models/chart-container";
import { getExtendedModelDefinition, type ExtendedModelSlug } from "@/lib/economics/extended-models";

type ScoreKey = "activity" | "employment" | "price" | "fiscal" | "welfare" | "resilience";
type ScoreSet = Record<ScoreKey, number>;

export type PredictedEffectMapping = Partial<Record<ScoreKey, { key: string; direction?: 1 | -1 }>>;

const clamp = (value: number) => Math.max(70, Math.min(130, value));
const relativeIndex = (current: number, baseline: number, direction = 1) => clamp(100 + direction * ((current - baseline) / Math.max(Math.abs(baseline), 1)) * 25);
const unchanged = (): ScoreSet => ({ activity: 100, employment: 100, price: 100, fiscal: 100, welfare: 100, resilience: 100 });

function scoresFor(model: ExtendedModelSlug, results: Record<string, number>): ScoreSet {
  const definition = getExtendedModelDefinition(model);
  if (!definition) return unchanged();
  const baselineParameters = Object.fromEntries(definition.controls.map((control) => [control.id, control.defaultValue]));
  const baseline = definition.calculate(baselineParameters).results;
  const score = unchanged();
  const by = (key: string, direction = 1) => relativeIndex(results[key] ?? baseline[key] ?? 0, baseline[key] ?? 0, direction);

  switch (model) {
    case "comparative-advantage": score.activity = by("gap"); score.welfare = by("gap"); break;
    case "labour-market": score.activity = by("employment"); score.employment = by("employment"); score.welfare = by("wage"); break;
    case "monopsony": score.activity = by("employment"); score.employment = by("employment"); score.welfare = by("wage"); break;
    case "public-goods": score.welfare = by("payoffEach"); score.resilience = by("groupPayoff"); break;
    case "common-pool-resources": score.activity = by("harvest"); score.resilience = by("nextStock"); score.welfare = by("nextStock"); break;
    case "information-asymmetry": score.welfare = by("expectedValue"); score.resilience = by("valueSpread", -1); break;
    case "adverse-selection": score.welfare = by("fairPremium", -1); score.resilience = by("averageRisk", -1); break;
    case "moral-hazard": score.welfare = by("preventionNetValue"); score.resilience = by("probabilityReduction"); break;
    case "signalling": score.welfare = by("signalCostGap"); score.resilience = by("separatingSignalExists"); break;
    case "keynesian-multiplier": score.activity = by("outputChange"); score.employment = by("outputChange"); break;
    case "monetary-policy": score.activity = by("outputContribution"); score.price = by("inflationGap", -1); break;
    case "fiscal-policy": score.activity = by("outputChange"); score.employment = by("outputChange"); score.fiscal = by("taxContribution"); break;
    case "public-debt": score.fiscal = by("nextDebtRatio", -1); score.resilience = by("debtChange", -1); break;
    case "business-cycle": score.activity = by("outputGap"); score.employment = by("unemploymentChange", -1); break;
    case "money-market": score.activity = by("incomeComponent"); score.price = by("interestRate", -1); break;
    case "loanable-funds": score.activity = by("investment"); score.fiscal = by("deficit", -1); score.price = by("clearingRate", -1); break;
    case "bank-credit-creation": score.activity = by("maxDepositChange"); score.resilience = by("reserveRatioPercent"); break;
    case "tariffs": score.activity = by("imports", -1); score.price = by("domesticPrice", -1); score.fiscal = by("tariffRevenue"); break;
  }
  return score;
}

export function PredictedEffectsRadar({ model, results, modelLabel }: { model: ExtendedModelSlug; results: Record<string, number>; modelLabel: string }) {
  const scores = scoresFor(model, results);
  const data = [
    ["Activity & trade", scores.activity],
    ["Employment", scores.employment],
    ["Price stability", scores.price],
    ["Fiscal space", scores.fiscal],
    ["Household welfare", scores.welfare],
    ["Resilience / risk", scores.resilience],
  ].map(([dimension, current]) => ({ dimension, baseline: 100, current }));

  return <ChartContainer title="Predicted effects" subtitle="A directional teaching index. 100 is this model’s baseline; dimensions outside the model remain neutral rather than being guessed." modelLabel={modelLabel}>
    <div className="h-[330px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: "var(--ink-muted)", fontSize: 9 }} />
          <Radar name="Baseline" dataKey="baseline" stroke="var(--ink-faint)" fill="var(--ink-faint)" fillOpacity={0.05} strokeDasharray="4 4" />
          <Radar name="Current mechanism" dataKey="current" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.17} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 10 }} formatter={(value) => [value, "Directional index"]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
    <p className="mt-2 text-[10px] leading-5 text-[var(--ink-faint)]">This visual translates only the mechanism calculated on this page into comparable directional signals. It is not an empirical forecast or a cross-model welfare ranking.</p>
  </ChartContainer>;
}

/** Reuses the Sandbox-style six-axis visual for models that already expose a result vector. */
export function OutcomePredictedEffectsRadar({ modelLabel, results, baseline, mapping }: { modelLabel: string; results: Record<string, number>; baseline: Record<string, number>; mapping: PredictedEffectMapping }) {
  const scores = unchanged();
  for (const [dimension, source] of Object.entries(mapping) as Array<[ScoreKey, { key: string; direction?: 1 | -1 }]>) {
    scores[dimension] = relativeIndex(results[source.key] ?? baseline[source.key] ?? 0, baseline[source.key] ?? 0, source.direction ?? 1);
  }
  const data = [
    ["Activity & trade", scores.activity], ["Employment", scores.employment], ["Price stability", scores.price], ["Fiscal space", scores.fiscal], ["Household welfare", scores.welfare], ["Resilience / risk", scores.resilience],
  ].map(([dimension, current]) => ({ dimension, baseline: 100, current }));
  return <ChartContainer title="Predicted effects" subtitle="A directional teaching index. 100 is the current model's declared default setting; dimensions outside its scope stay neutral." modelLabel={modelLabel}>
    <div className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><RadarChart data={data} outerRadius="70%"><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="dimension" tick={{ fill: "var(--ink-muted)", fontSize: 9 }} /><Radar name="Baseline" dataKey="baseline" stroke="var(--ink-faint)" fill="var(--ink-faint)" fillOpacity={0.05} strokeDasharray="4 4" /><Radar name="Current mechanism" dataKey="current" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.17} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 10 }} formatter={(value) => [value, "Directional index"]} /></RadarChart></ResponsiveContainer></div>
    <p className="mt-2 text-[10px] leading-5 text-[var(--ink-faint)]">This visual is a mechanism summary, not an empirical forecast or a ranking across models.</p>
  </ChartContainer>;
}

const coreMappings: Record<string, PredictedEffectMapping> = {
  "supply-demand": { activity: { key: "quantity" }, price: { key: "price", direction: -1 }, welfare: { key: "totalSurplus" } },
  policy: { activity: { key: "quantity" }, price: { key: "consumerPrice", direction: -1 }, fiscal: { key: "governmentBalance" }, welfare: { key: "deadweightLoss", direction: -1 } },
  "price-controls": { activity: { key: "quantityTraded" }, price: { key: "price", direction: -1 }, welfare: { key: "totalSurplus" }, resilience: { key: "shortage", direction: -1 } },
  elasticity: { activity: { key: "quantity" }, price: { key: "price", direction: -1 }, welfare: { key: "totalRevenue" } },
  externalities: { activity: { key: "efficientQuantity" }, fiscal: { key: "correctivePolicy", direction: -1 }, welfare: { key: "socialWelfare" }, resilience: { key: "externalImpact", direction: -1 } },
  monopoly: { activity: { key: "monopolyQuantity" }, price: { key: "monopolyPrice", direction: -1 }, welfare: { key: "profit" }, resilience: { key: "deadweightLoss", direction: -1 } },
  ppf: { activity: { key: "outputX" }, welfare: { key: "outputY" }, resilience: { key: "capacityGap" } },
  "ad-as": { activity: { key: "output" }, employment: { key: "unemploymentGap", direction: -1 }, price: { key: "priceLevel", direction: -1 }, resilience: { key: "outputGap" } },
};

/** Covers the original standalone models whose results are already passed to ScenarioComparison. */
export function CorePredictedEffectsRadar({ modelKey, results, baseline, modelLabel }: { modelKey: string; results: Record<string, number>; baseline: Record<string, number>; modelLabel?: string }) {
  const mapping = coreMappings[modelKey];
  if (!mapping) return null;
  return <OutcomePredictedEffectsRadar modelLabel={modelLabel ?? "EconMind model"} results={results} baseline={baseline} mapping={mapping} />;
}
