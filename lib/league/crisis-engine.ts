export type CrisisMetricKey = "growth" | "inflation" | "unemployment" | "debt" | "approval" | "emissions";
export type CrisisMetrics = Record<CrisisMetricKey, number>;
export type MonetaryPolicy = "cut" | "hold" | "raise";
export type FiscalPolicy = "reduce" | "maintain" | "increase";
export type EnergyPolicy = "none" | "targeted" | "broad";
export type CrisisPolicies = { monetary: MonetaryPolicy; fiscal: FiscalPolicy; energy: EnergyPolicy };
export type ScoreKey = "growth" | "priceStability" | "employment" | "fiscalSustainability" | "socialWelfare" | "environmentalSustainability";
export type CrisisScores = Record<ScoreKey, number>;
export type CrisisResultType = "Balanced Economy" | "Inflation Fighter" | "Growth at All Costs" | "Socially Protective" | "Fiscal Conservative" | "Stable but Slow" | "Crisis Mismanagement";

const commandCentreBaseline = createInitialCommandCentreState().macro;
export const CRISIS_SCENARIO_ID = COMMAND_CENTRE_SCENARIO.id;
export const CRISIS_INITIAL_METRICS: CrisisMetrics = { growth: commandCentreBaseline.growth, inflation: commandCentreBaseline.inflation, unemployment: commandCentreBaseline.unemployment, debt: commandCentreBaseline.debt, approval: commandCentreBaseline.approval, emissions: commandCentreBaseline.emissions };
export const CRISIS_SCORE_WEIGHTS: Record<ScoreKey, number> = { growth: 0.2, priceStability: 0.2, employment: 0.15, fiscalSustainability: 0.15, socialWelfare: 0.2, environmentalSustainability: 0.1 };

type Delta = Partial<CrisisMetrics>;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const rounded = (value: number) => Math.round(value * 10) / 10;

const policyDeltas: { monetary: Record<MonetaryPolicy, Delta>; fiscal: Record<FiscalPolicy, Delta>; energy: Record<EnergyPolicy, Delta> } = {
  monetary: {
    cut: { growth: 0.5, inflation: 0.4, unemployment: -0.2, approval: 0.4, emissions: 0.2 },
    hold: {},
    raise: { growth: -0.4, inflation: -0.6, unemployment: 0.3, approval: -0.5 },
  },
  fiscal: {
    reduce: { growth: -0.5, inflation: -0.2, unemployment: 0.4, debt: -1.8, approval: -0.8, emissions: -0.2 },
    maintain: {},
    increase: { growth: 0.8, inflation: 0.4, unemployment: -0.5, debt: 2.5, approval: 0.7, emissions: 0.5 },
  },
  energy: {
    none: { approval: -0.5 },
    targeted: { growth: 0.2, inflation: -0.4, debt: 1.1, approval: 2, emissions: 0.1 },
    broad: { growth: 0.4, inflation: -0.8, debt: 3.6, approval: 4.2, emissions: 2.2 },
  },
};

const monetaryLabels: Record<MonetaryPolicy, string> = { cut: "Cut interest rates", hold: "Hold interest rates", raise: "Raise interest rates" };
const fiscalLabels: Record<FiscalPolicy, string> = { reduce: "Reduce government spending", maintain: "Maintain government spending", increase: "Increase government spending" };
const energyLabels: Record<EnergyPolicy, string> = { none: "No subsidy", targeted: "Targeted household subsidy", broad: "Broad energy price subsidy" };

export const CRISIS_POLICY_OPTIONS = {
  monetary: [
    { value: "cut", title: monetaryLabels.cut, description: "Supports borrowing, demand and short-run activity.", benefit: "May lift growth and employment.", risk: "Can entrench inflation." },
    { value: "hold", title: monetaryLabels.hold, description: "Keeps the current monetary stance unchanged.", benefit: "Avoids a sudden policy reversal.", risk: "May leave inflation or weakness unresolved." },
    { value: "raise", title: monetaryLabels.raise, description: "Restrains demand to bring inflation down.", benefit: "Strengthens price stability.", risk: "Can weaken growth and employment." },
  ],
  fiscal: [
    { value: "reduce", title: fiscalLabels.reduce, description: "Cuts public demand and improves the budget position.", benefit: "Reduces debt pressure.", risk: "May deepen weak growth." },
    { value: "maintain", title: fiscalLabels.maintain, description: "Keeps the fiscal stance steady.", benefit: "Provides predictability.", risk: "May be too passive during a shock." },
    { value: "increase", title: fiscalLabels.increase, description: "Uses public spending to support activity and jobs.", benefit: "Can cushion unemployment.", risk: "Raises debt and inflation pressure." },
  ],
  energy: [
    { value: "none", title: energyLabels.none, description: "Lets market prices transmit the energy shock.", benefit: "Protects fiscal space and price signals.", risk: "Leaves households exposed." },
    { value: "targeted", title: energyLabels.targeted, description: "Directs energy support to affected households.", benefit: "Protects welfare at a contained fiscal cost.", risk: "Requires accurate targeting." },
    { value: "broad", title: energyLabels.broad, description: "Subsidises energy prices across the economy.", benefit: "Quickly protects purchasing power.", risk: "Weakens conservation incentives and raises debt." },
  ],
} as const;

function mergeDeltas(...deltas: Delta[]) {
  return deltas.reduce<Delta>((combined, delta) => {
    for (const [key, value] of Object.entries(delta) as Array<[CrisisMetricKey, number]>) combined[key] = (combined[key] ?? 0) + value;
    return combined;
  }, {});
}

function applyDelta(metrics: CrisisMetrics, delta: Delta): CrisisMetrics {
  return {
    growth: rounded(clamp(metrics.growth + (delta.growth ?? 0), -8, 8)),
    inflation: rounded(clamp(metrics.inflation + (delta.inflation ?? 0), 0, 18)),
    unemployment: rounded(clamp(metrics.unemployment + (delta.unemployment ?? 0), 2, 22)),
    debt: rounded(clamp(metrics.debt + (delta.debt ?? 0), 25, 180)),
    approval: rounded(clamp(metrics.approval + (delta.approval ?? 0), 0, 100)),
    emissions: rounded(clamp(metrics.emissions + (delta.emissions ?? 0), 50, 180)),
  };
}

export function explainPolicies(policies: CrisisPolicies, hasOilShock: boolean) {
  const mechanisms = [
    `${monetaryLabels[policies.monetary]} changes aggregate demand and the inflation-employment trade-off.`,
    `${fiscalLabels[policies.fiscal]} changes public demand and the debt trajectory.`,
    `${energyLabels[policies.energy]} changes household protection, fiscal costs and energy-price signals.`,
  ];
  if (policies.monetary === "raise" && policies.fiscal === "increase") mechanisms.push("Tighter monetary policy offsets part of the demand boost from higher spending.");
  if (policies.monetary === "raise" && policies.fiscal === "reduce") mechanisms.push("Tight money and fiscal consolidation reinforce downside risk to output and employment.");
  if (hasOilShock && policies.energy === "broad") mechanisms.push("Broad subsidy insulates households after the oil shock, but adds substantial debt and weakens conservation incentives.");
  if (hasOilShock && policies.energy === "targeted") mechanisms.push("Targeted support cushions exposed households with a smaller fiscal cost than a universal subsidy.");
  return mechanisms;
}

export function applyCrisisRound(metrics: CrisisMetrics, policies: CrisisPolicies, hasOilShock: boolean) {
  let interaction: Delta = {};
  if (policies.monetary === "raise" && policies.fiscal === "increase") interaction = mergeDeltas(interaction, { growth: -0.2, inflation: -0.2, unemployment: 0.1 });
  if (policies.monetary === "raise" && policies.fiscal === "reduce") interaction = mergeDeltas(interaction, { growth: -0.5, unemployment: 0.3, inflation: -0.2, debt: -0.6 });
  if (hasOilShock && policies.energy === "broad") interaction = mergeDeltas(interaction, { inflation: -0.4, approval: 1.8, debt: 1.2, emissions: 0.8 });
  if (hasOilShock && policies.energy === "targeted") interaction = mergeDeltas(interaction, { inflation: -0.2, approval: 1, debt: 0.3 });
  const delta = mergeDeltas(policyDeltas.monetary[policies.monetary], policyDeltas.fiscal[policies.fiscal], policyDeltas.energy[policies.energy], interaction);
  return { metrics: applyDelta(metrics, delta), delta, mechanisms: explainPolicies(policies, hasOilShock) };
}

export function applyOilPriceShock(metrics: CrisisMetrics) {
  const delta: Delta = { growth: -1.1, inflation: 1.7, unemployment: 0.5, debt: 0.6, approval: -4.2, emissions: 0.7 };
  return { metrics: applyDelta(metrics, delta), delta, mechanisms: ["Higher oil prices raise production and transport costs.", "Cost-push inflation reduces real household purchasing power.", "Weak activity and pressure for support worsen the public-finance trade-off."] };
}

export function calculateCrisisScores(metrics: CrisisMetrics): { scores: CrisisScores; totalScore: number; resultType: CrisisResultType } {
  const score = (value: number) => rounded(clamp(value, 0, 100));
  const scores: CrisisScores = {
    growth: score(100 - Math.abs(metrics.growth - 2.5) * 16),
    priceStability: score(100 - Math.abs(metrics.inflation - 2) * 14),
    employment: score(100 - Math.abs(metrics.unemployment - 4.5) * 13),
    fiscalSustainability: score(100 - Math.max(0, metrics.debt - 55) * 1.05 - Math.max(0, 55 - metrics.debt) * 0.15),
    socialWelfare: score(metrics.approval * 0.72 + (100 - Math.abs(metrics.inflation - 2) * 10) * 0.18 + (100 - Math.abs(metrics.unemployment - 4.5) * 8) * 0.1),
    environmentalSustainability: score(100 - Math.max(0, metrics.emissions - 78) * 0.9),
  };
  const totalScore = rounded(Object.entries(CRISIS_SCORE_WEIGHTS).reduce((total, [key, weight]) => total + scores[key as ScoreKey] * weight, 0));
  const resultType: CrisisResultType = totalScore < 38 ? "Crisis Mismanagement"
    : scores.priceStability >= 78 && scores.growth < 55 ? "Inflation Fighter"
    : scores.growth >= 75 && scores.fiscalSustainability < 48 ? "Growth at All Costs"
    : scores.socialWelfare >= 78 && scores.fiscalSustainability < 58 ? "Socially Protective"
    : scores.fiscalSustainability >= 80 && scores.growth < 60 ? "Fiscal Conservative"
    : scores.priceStability >= 70 && scores.growth < 62 ? "Stable but Slow"
    : "Balanced Economy";
  return { scores, totalScore, resultType };
}

export function buildCrisisReflection(metrics: CrisisMetrics, policies: CrisisPolicies[]) {
  const final = calculateCrisisScores(metrics);
  const strongest = Object.entries(final.scores).sort(([, left], [, right]) => right - left)[0]?.[0] ?? "growth";
  const weakest = Object.entries(final.scores).sort(([, left], [, right]) => left - right)[0]?.[0] ?? "growth";
  const strongestDecision = policies.some((policy) => policy.energy === "targeted") ? "Targeted household support protected welfare while containing the fiscal cost." : policies.some((policy) => policy.monetary === "raise") ? "Using monetary restraint created a clear channel for reducing inflation." : "Your policy mix kept demand from collapsing during a difficult shock.";
  const unintended = policies.some((policy) => policy.energy === "broad") ? "Broad subsidy improved immediate approval but weakened price signals and raised debt." : policies.some((policy) => policy.fiscal === "increase") ? "Fiscal support improved activity but added to inflation and debt pressure." : "Caution protected one objective but left households and activity more exposed to the shock.";
  return {
    strongestDecision,
    largestTradeOff: `Your largest trade-off was between ${labelScoreKey(strongest)} and ${labelScoreKey(weakest)}.`,
    unintendedConsequence: unintended,
    improvement: metrics.inflation > 3.5 ? "A more credible anti-inflation stance or tighter targeting could reduce persistent price pressure." : metrics.debt > 80 ? "A smaller or more targeted fiscal commitment would improve sustainability." : metrics.unemployment > 6 ? "Add carefully targeted support for demand and employment while protecting price stability." : "Preserve the balance, but monitor the next shock rather than assuming the recovery is complete.",
  };
}

export function labelScoreKey(key: ScoreKey | string) {
  return ({ growth: "Growth", priceStability: "Price Stability", employment: "Employment", fiscalSustainability: "Fiscal Sustainability", socialWelfare: "Social Welfare", environmentalSustainability: "Environmental Sustainability" } as Record<string, string>)[key] ?? key;
}
import { COMMAND_CENTRE_SCENARIO, createInitialCommandCentreState } from "@/lib/economics/command-centre";
