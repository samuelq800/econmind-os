import type {
  ChallengeControl,
  LeagueChallengeDefinition,
  LeagueGhostVisibility,
} from "@/lib/league/async-challenge-types";

export type PolicyValues = Record<string, number>;

export const WORLD_SCORING_FORMULA = {
  growthTarget: 2,
  inflationTarget: 2,
  unemploymentTarget: 4,
  fiscalDebtTarget: 60,
  maximumPenaltyPerCategory: 25,
} as const;

export type WorldChallengeMetrics = {
  growth: number;
  inflation: number;
  unemployment: number;
  debtToGdp: number;
};

export type ScoreBreakdown = {
  score: number;
  components: Array<{ label: string; points: number; detail: string }>;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const round = (value: number, digits = 1) =>
  Number(value.toFixed(digits));

/** The published 100-point score for the asynchronous World Economy Challenge. */
export function scoreWorldChallenge(metrics: WorldChallengeMetrics): ScoreBreakdown {
  const max = WORLD_SCORING_FORMULA.maximumPenaltyPerCategory;
  const growthPenalty = clamp((WORLD_SCORING_FORMULA.growthTarget - metrics.growth) * 6.25, 0, max);
  const inflationPenalty = clamp(Math.abs(metrics.inflation - WORLD_SCORING_FORMULA.inflationTarget) * 4.2, 0, max);
  const unemploymentPenalty = clamp((metrics.unemployment - WORLD_SCORING_FORMULA.unemploymentTarget) * 4.2, 0, max);
  const fiscalPenalty = clamp((metrics.debtToGdp - WORLD_SCORING_FORMULA.fiscalDebtTarget) * 0.55, 0, max);
  const penalties = growthPenalty + inflationPenalty + unemploymentPenalty + fiscalPenalty;
  return {
    score: round(clamp(100 - penalties, 0, 100)),
    components: [
      { label: "Growth penalty", points: -round(growthPenalty), detail: "Below 2% growth increases the penalty, capped at 25 points." },
      { label: "Inflation penalty", points: -round(inflationPenalty), detail: "Distance from the 2% price-stability target, capped at 25 points." },
      { label: "Unemployment penalty", points: -round(unemploymentPenalty), detail: "Unemployment above 4% increases the penalty, capped at 25 points." },
      { label: "Fiscal sustainability penalty", points: -round(fiscalPenalty), detail: "Debt above 60% of GDP increases the penalty, capped at 25 points." },
    ],
  };
}

export type WorldArenaState = WorldChallengeMetrics & {
  domesticProduction: number;
  policyInteractions: string[];
};

export function createWorldArenaState(): WorldArenaState {
  return { growth: 2.1, inflation: 2.4, unemployment: 4.4, debtToGdp: 63, domesticProduction: 100, policyInteractions: [] };
}

/**
 * Six default policy levers persist until changed. Only the documented,
 * visible interactions below modify an otherwise additive response.
 */
export function advanceWorldArenaState(state: WorldArenaState, policy: PolicyValues): WorldArenaState {
  const interestRate = policy.interestRate ?? 3;
  const governmentSpending = policy.governmentSpending ?? 20;
  const taxRate = policy.generalTaxRate ?? 24;
  const tariff = policy.tariff ?? 8;
  const investment = policy.publicInvestment ?? 12;
  const subsidy = policy.strategicSubsidy ?? 6;
  const interactions: string[] = [];
  let growth = state.growth + (governmentSpending - 20) * 0.12 - (interestRate - 3) * 0.22 - (taxRate - 24) * 0.045 + investment * 0.035 + subsidy * 0.025;
  let inflation = state.inflation + (governmentSpending - 20) * 0.075 - (interestRate - 3) * 0.19 + tariff * 0.018;
  const unemployment = state.unemployment - (governmentSpending - 20) * 0.07 + (interestRate - 3) * 0.08 - investment * 0.02;
  let domesticProduction = state.domesticProduction + tariff * 0.12 + investment * 0.17 + subsidy * 0.12;
  const debtToGdp = state.debtToGdp + (governmentSpending - 20) * 0.85 + investment * 0.22 + subsidy * 0.15 - (taxRate - 24) * 0.48;

  if (governmentSpending > 23 && interestRate > 4.5) {
    growth -= 0.55;
    interactions.push("Government spending plus a high interest rate creates partial crowding out: demand support is offset by tighter credit.");
  }
  if (tariff > 12 && investment > 14) {
    domesticProduction += 2.2;
    inflation += 0.18;
    interactions.push("A tariff plus domestic investment strengthens near-term domestic production, while raising some price pressure.");
  }

  return {
    growth: round(clamp(growth, -5, 8)),
    inflation: round(clamp(inflation, 0, 18)),
    unemployment: round(clamp(unemployment, 1.5, 20)),
    debtToGdp: round(clamp(debtToGdp, 20, 180)),
    domesticProduction: round(clamp(domesticProduction, 40, 180)),
    policyInteractions: interactions,
  };
}

export const TIME_MACHINE_STAGES = [
  { date: "1973-08-01", title: "Pre-shock conditions", briefing: "Energy dependence is high. Inflation is already elevated, but the scale of the coming oil disruption is not known." },
  { date: "1973-10-20", title: "Oil supply disruption", briefing: "Oil supply conditions deteriorate. Teams can see the disruption, not its full duration or eventual price path." },
  { date: "1974-06-01", title: "Inflation acceleration", briefing: "Inflation spreads beyond fuel. Output and employment pressures are becoming visible." },
  { date: "1975-02-01", title: "Growth slowdown", briefing: "The trade-off is sharper: recession risk and inflation coexist. Earlier decisions remain locked." },
  { date: "1976-03-01", title: "Recovery environment", briefing: "The immediate shock has eased, but fiscal condition and productive capacity shape the recovery." },
] as const;

export type TimeMachineState = {
  inflation: number;
  realOutput: number;
  unemployment: number;
  fiscalBalance: number;
  debtToGdp: number;
  recovery: number;
  energySecurity: number;
  interactions: string[];
};

export function createTimeMachineState(): TimeMachineState {
  return { inflation: 5.9, realOutput: 101, unemployment: 4.3, fiscalBalance: -1.5, debtToGdp: 38, recovery: 52, energySecurity: 44, interactions: [] };
}

export function advanceTimeMachineStage(state: TimeMachineState, policy: PolicyValues, stage: number): TimeMachineState {
  const shock = [0.6, 3.7, 2.2, 0.6, -0.8][stage - 1] ?? 0;
  const growthShock = [0.2, -1.6, -1.9, -1.2, 0.7][stage - 1] ?? 0;
  const interestRate = policy.interestRate ?? 4;
  const spending = policy.governmentSpending ?? 18;
  const taxRelief = policy.taxRelief ?? 4;
  const energySubsidy = policy.energySubsidy ?? 5;
  const investment = policy.publicInvestment ?? 10;
  const reserve = policy.strategicReserve ?? 5;
  const interactions: string[] = [];
  let inflation = state.inflation + shock - (interestRate - 4) * 0.22 + spending * 0.026 + energySubsidy * 0.045;
  let realOutput = state.realOutput + growthShock - (interestRate - 4) * 0.17 + (spending - 18) * 0.15 + taxRelief * 0.07 + investment * 0.06 + reserve * 0.035;
  const unemployment = state.unemployment - (realOutput - state.realOutput) * 0.34;
  const fiscalBalance = state.fiscalBalance - (spending - 18) * 0.13 - taxRelief * 0.09 - energySubsidy * 0.07 - investment * 0.08 - reserve * 0.04;
  let energySecurity = state.energySecurity + reserve * 0.65 + investment * 0.22 + energySubsidy * 0.12 - shock * 1.2;
  const recovery = state.recovery + investment * 0.28 + reserve * 0.15 + (spending - 18) * 0.12 - Math.max(0, interestRate - 6) * 0.6;

  if (spending > 22 && interestRate > 6) {
    realOutput -= 0.55;
    interactions.push("Government spending plus a high interest rate produces partial crowding out: fiscal support is partly offset by tighter credit.");
  }
  if (energySubsidy > 8 && investment > 14) {
    energySecurity += 2;
    inflation -= 0.28;
    interactions.push("Energy support plus public investment eases the energy-cost pass-through while strengthening future supply capacity.");
  }
  const debtToGdp = state.debtToGdp + Math.max(0, -fiscalBalance) * 0.46 - Math.max(0, realOutput - state.realOutput) * 0.18;
  return {
    inflation: round(clamp(inflation, 0, 25)),
    realOutput: round(clamp(realOutput, 70, 135)),
    unemployment: round(clamp(unemployment, 2, 24)),
    fiscalBalance: round(clamp(fiscalBalance, -20, 8)),
    debtToGdp: round(clamp(debtToGdp, 10, 160)),
    recovery: round(clamp(recovery, 0, 100)),
    energySecurity: round(clamp(energySecurity, 0, 100)),
    interactions,
  };
}

export function scoreTimeMachine(state: TimeMachineState): ScoreBreakdown {
  const stability = clamp(40 - Math.abs(state.inflation - 3) * 2.3 - Math.max(0, state.unemployment - 5) * 1.9, 0, 40);
  const effectiveness = clamp(30 * ((state.realOutput - 70) / 65) + state.recovery * 0.12, 0, 30);
  const fiscal = clamp(30 - Math.max(0, state.debtToGdp - 45) * 0.32 - Math.max(0, -state.fiscalBalance - 2) * 0.9, 0, 30);
  return {
    score: round(stability + effectiveness + fiscal),
    components: [
      { label: "Economic stability", points: round(stability), detail: "Up to 40 points from inflation and unemployment stability." },
      { label: "Policy effectiveness", points: round(effectiveness), detail: "Up to 30 points from output resilience and recovery capacity." },
      { label: "Fiscal sustainability", points: round(fiscal), detail: "Up to 30 points from debt and fiscal balance." },
    ],
  };
}

export type IndustryArenaState = {
  unitsSold: number;
  marketShare: number;
  revenue: number;
  profit: number;
  firmValue: number;
  inventory: number;
  brandStrength: number;
  technologyLevel: number;
  competitorActions: string[];
};

export type GhostBehaviour = {
  type: "historical_sequence" | "conditional";
  actions?: Array<Partial<PolicyValues>>;
  conditions?: Array<{ when: "price_gap" | "inventory_high" | "market_share_low"; threshold: number; action: Partial<PolicyValues> }>;
};

export function createIndustryArenaState(): IndustryArenaState {
  return { unitsSold: 180, marketShare: 18, revenue: 7.56, profit: 0.82, firmValue: 12.4, inventory: 40, brandStrength: 48, technologyLevel: 45, competitorActions: [] };
}

export function replayGhostBehaviour(behaviour: GhostBehaviour, state: IndustryArenaState, stage: number): Partial<PolicyValues> {
  if (behaviour.type === "historical_sequence") return behaviour.actions?.[stage - 1] ?? {};
  for (const rule of behaviour.conditions ?? []) {
    const observed = rule.when === "inventory_high" ? state.inventory : rule.when === "market_share_low" ? state.marketShare : 0;
    if (rule.when === "price_gap" || observed >= rule.threshold) return rule.action;
  }
  return {};
}

export function advanceIndustryArenaState(state: IndustryArenaState, controls: PolicyValues, ghost?: GhostBehaviour, stage = 1): IndustryArenaState {
  const price = controls.price ?? 42;
  const production = controls.production ?? 220;
  const research = controls.research ?? 10;
  const marketing = controls.marketing ?? 9;
  const capacity = controls.capacity ?? 240;
  const ghostAction = ghost ? replayGhostBehaviour(ghost, state, stage) : {};
  const competitorPricePressure = (ghostAction.price ?? 42) < price ? 0.9 : 0.25;
  const competitorActions = [
    `Standard Agent Alpha protects margin with a cost-leadership price response of ${round(Math.max(30, 40 - (price - 40) * 0.2))}.`,
    `Standard Agent Beta raises R&D when your technology level approaches its innovation threshold.`,
    ghost ? `Anonymous League Ghost applies a ${ghost.type === "conditional" ? "conditional" : "historical"} strategy.` : "Standard Agent Gamma maintains a defensive market-share strategy.",
  ];
  const demand = clamp(265 + marketing * 7 + research * 2.3 - (price - 40) * 5.4 - competitorPricePressure * 18 + state.brandStrength * 0.65, 30, 520);
  const unitsSold = round(Math.min(demand, production, capacity, state.inventory + production));
  const inventory = round(clamp(state.inventory + production - unitsSold, 0, 900));
  const revenue = round((unitsSold * price) / 1000, 2);
  const variableCost = unitsSold * (22 - research * 0.04) / 1000;
  const fixedCost = (research * 0.12 + marketing * 0.09 + capacity * 0.013) / 10;
  const profit = round(revenue - variableCost - fixedCost, 2);
  const brandStrength = round(clamp(state.brandStrength + marketing * 0.45 + Math.max(0, unitsSold - 220) * 0.03, 0, 100));
  const technologyLevel = round(clamp(state.technologyLevel + research * 0.65, 0, 100));
  const marketShare = round(clamp(12 + unitsSold / 20 + marketing * 0.2 + technologyLevel * 0.06 - competitorPricePressure * 2.4, 1, 70));
  const firmValue = round(clamp(state.firmValue + profit * 2.1 + technologyLevel * 0.055 + brandStrength * 0.025 - inventory * 0.006, 0, 100));
  return { unitsSold, marketShare, revenue, profit, firmValue, inventory, brandStrength, technologyLevel, competitorActions };
}

export function scoreIndustryArena(state: IndustryArenaState): ScoreBreakdown {
  const profitability = clamp(20 + state.profit * 8 + state.revenue * 0.7, 0, 40);
  const marketPosition = clamp(state.marketShare * 1.15 + state.brandStrength * 0.09, 0, 30);
  const sustainability = clamp(state.technologyLevel * 0.18 + Math.max(0, 18 - state.inventory * 0.03) + state.firmValue * 0.04, 0, 30);
  return {
    score: round(profitability + marketPosition + sustainability),
    components: [
      { label: "Profitability", points: round(profitability), detail: "40 points: profit and revenue after production, R&D, marketing and capacity costs." },
      { label: "Market position", points: round(marketPosition), detail: "30 points: market share and brand strength." },
      { label: "Firm sustainability", points: round(sustainability), detail: "30 points: technology, inventory discipline and firm value." },
    ],
  };
}

export const FINANCIAL_NETWORK_STAGES = [
  { title: "Normal conditions", briefing: "Funding is stable. Choose the balance between lending, liquidity and resilient capital before the system is under pressure." },
  { title: "Credit expansion", briefing: "Loan opportunities rise. Faster growth can improve near-term profit, but it also changes the loss exposure carried into the shock." },
  { title: "Asset shock", briefing: "Risk-asset prices fall and loan defaults rise. The network begins to transmit losses through common exposures." },
  { title: "Liquidity stress", briefing: "Depositors and counterparties become cautious. Interbank funding is less reliable and fire-sale pressure becomes visible." },
  { title: "System recovery", briefing: "The immediate shock eases. Decide how much to rebuild lending while preserving a sustainable liquidity and capital position." },
] as const;

export type FinancialStressState = "stable" | "pressure" | "high_stress" | "critical" | "default";

export type FinancialNetworkBank = {
  id: string;
  label: string;
  kind: "your_bank" | "standard_bank" | "ghost_bank";
  stress: FinancialStressState;
  capitalRatio: number;
  liquidityRatio: number;
};

/**
 * This is deliberately a small educational balance sheet, not a bank-risk or
 * regulatory model. Every value is in fictional credits and the capital value
 * is always reconciled from the balance-sheet identity.
 */
export type FinancialNetworkState = {
  cash: number;
  customerLoans: number;
  safeSecurities: number;
  riskAssets: number;
  interbankAssets: number;
  deposits: number;
  interbankBorrowing: number;
  otherDebt: number;
  capital: number;
  profit: number;
  cumulativeProfit: number;
  capitalRatio: number;
  liquidityRatio: number;
  defaultRisk: number;
  interbankExposure: number;
  systemicImpact: number;
  stress: FinancialStressState;
  bankStates: FinancialNetworkBank[];
  contagionPath: string[];
  interactions: string[];
};

export function financialAssets(state: Pick<FinancialNetworkState, "cash" | "customerLoans" | "safeSecurities" | "riskAssets" | "interbankAssets">) {
  return round(state.cash + state.customerLoans + state.safeSecurities + state.riskAssets + state.interbankAssets, 2);
}

export function financialLiabilities(state: Pick<FinancialNetworkState, "deposits" | "interbankBorrowing" | "otherDebt">) {
  return round(state.deposits + state.interbankBorrowing + state.otherDebt, 2);
}

function financialStressLabel(capitalRatio: number, liquidityRatio: number, defaultRisk: number): FinancialStressState {
  if (capitalRatio <= 0 || defaultRisk >= 96) return "default";
  if (capitalRatio < 5 || liquidityRatio < 7 || defaultRisk >= 72) return "critical";
  if (capitalRatio < 8 || liquidityRatio < 12 || defaultRisk >= 45) return "high_stress";
  if (capitalRatio < 11 || liquidityRatio < 18 || defaultRisk >= 22) return "pressure";
  return "stable";
}

function standardBanks(systemicImpact: number, stage: number): FinancialNetworkBank[] {
  const pressure = systemicImpact + (stage === 4 ? 12 : 0);
  const bank = (id: string, label: string, kind: "standard_bank" | "ghost_bank", sensitivity: number): FinancialNetworkBank => {
    const capitalRatio = round(clamp(15 - pressure * sensitivity * 0.1, 2, 18));
    const liquidityRatio = round(clamp(28 - pressure * sensitivity * 0.16, 4, 34));
    const defaultRisk = round(clamp(100 - capitalRatio * 4 - liquidityRatio * 1.1, 2, 95));
    return { id, label, kind, capitalRatio, liquidityRatio, stress: financialStressLabel(capitalRatio, liquidityRatio, defaultRisk) };
  };
  return [
    bank("northstar", "Northstar Bank · standard", "standard_bank", 0.7),
    bank("meridian", "Meridian Bank · standard", "standard_bank", 1.1),
    bank("ghost-07", "League Ghost 07 · identity hidden", "ghost_bank", 1.4),
    bank("harbour", "Harbour Bank · standard", "standard_bank", 0.85),
  ];
}

export function createFinancialNetworkState(): FinancialNetworkState {
  const base = {
    cash: 18,
    customerLoans: 72,
    safeSecurities: 30,
    riskAssets: 18,
    interbankAssets: 12,
    deposits: 106,
    interbankBorrowing: 16,
    otherDebt: 8,
  };
  const assets = financialAssets(base);
  const capital = round(assets - financialLiabilities(base), 2);
  const capitalRatio = round((capital / assets) * 100, 1);
  const liquidityRatio = round((base.cash / (base.deposits + base.interbankBorrowing)) * 100, 1);
  const defaultRisk = round(clamp(100 - capitalRatio * 4 - liquidityRatio * 1.1, 2, 95));
  return {
    ...base,
    capital,
    profit: 1.6,
    cumulativeProfit: 1.6,
    capitalRatio,
    liquidityRatio,
    defaultRisk,
    interbankExposure: 8,
    systemicImpact: 24,
    stress: financialStressLabel(capitalRatio, liquidityRatio, defaultRisk),
    bankStates: standardBanks(24, 1),
    contagionPath: [],
    interactions: [],
  };
}

/**
 * Advance a deterministic, five-stage financial-network challenge. Cash is
 * the balancing item; if a severe loss would make equity negative, unsecured
 * debt is written down to the remaining asset value and the bank enters the
 * explicit default state. Thus the displayed balance sheet always reconciles.
 */
export function advanceFinancialNetworkState(state: FinancialNetworkState, policy: PolicyValues, stage: number): FinancialNetworkState {
  const lendingGrowth = policy.lendingGrowth ?? 6;
  const liquidityReserve = policy.liquidityReserve ?? 14;
  const riskExposure = policy.riskExposure ?? 22;
  const capitalBuffer = policy.capitalBuffer ?? 12;
  const interbankLending = policy.interbankLending ?? 8;
  const conditions = [
    { defaultRate: 0.006, riskLoss: 0, withdrawal: 0.018, interbankHaircut: 0, recovery: 0.2 },
    { defaultRate: 0.009, riskLoss: 0.01, withdrawal: 0.025, interbankHaircut: 0, recovery: 0.32 },
    { defaultRate: 0.035, riskLoss: 0.18, withdrawal: 0.055, interbankHaircut: 0.08, recovery: -0.15 },
    { defaultRate: 0.022, riskLoss: 0.07, withdrawal: 0.13, interbankHaircut: 0.26, recovery: -0.26 },
    { defaultRate: 0.01, riskLoss: 0.02, withdrawal: 0.035, interbankHaircut: 0.04, recovery: 0.44 },
  ][stage - 1] ?? { defaultRate: 0.01, riskLoss: 0, withdrawal: 0.02, interbankHaircut: 0, recovery: 0 };
  const interactions: string[] = [];
  const previousAssets = financialAssets(state);
  const desiredLoans = previousAssets * (0.44 + lendingGrowth * 0.013);
  const creditGrowth = (desiredLoans - state.customerLoans) * 0.34 + conditions.recovery;
  const loanDefaults = Math.max(0, state.customerLoans + creditGrowth) * conditions.defaultRate * (0.75 + riskExposure / 100);
  const customerLoans = round(clamp(state.customerLoans + creditGrowth - loanDefaults, 0, 180), 2);
  const desiredRiskAssets = previousAssets * (riskExposure / 100);
  const preShockRiskAssets = state.riskAssets + (desiredRiskAssets - state.riskAssets) * 0.42;
  const assetLoss = Math.max(0, preShockRiskAssets) * conditions.riskLoss * (0.55 + riskExposure / 100);
  const riskAssets = round(clamp(preShockRiskAssets - assetLoss, 0, 80), 2);
  const desiredInterbankAssets = previousAssets * (interbankLending / 100);
  const interbankLoss = Math.max(0, state.interbankAssets) * conditions.interbankHaircut * (0.55 + interbankLending / 100);
  const interbankAssets = round(clamp(state.interbankAssets + (desiredInterbankAssets - state.interbankAssets) * 0.4 - interbankLoss, 0, 48), 2);
  const deposits = round(clamp(state.deposits * (1 - conditions.withdrawal * (1 + Math.max(0, 14 - liquidityReserve) / 40)), 35, 140), 2);
  const interbankBorrowing = round(clamp(state.interbankBorrowing * (1 + (stage === 4 ? 0.11 : -0.015)), 4, 48), 2);
  let otherDebt = round(clamp(state.otherDebt, 0, 30), 2);
  const fundingBase = deposits + interbankBorrowing + otherDebt;
  const safeSecurities = round(clamp(state.safeSecurities + (previousAssets * (liquidityReserve / 100) - state.cash) * 0.18, 0, 80), 2);
  const interestIncome = customerLoans * 0.026 + riskAssets * 0.037 + interbankAssets * 0.011;
  const fundingCost = deposits * 0.011 + interbankBorrowing * 0.021 + otherDebt * 0.027;
  const operatingCost = 1.25 + lendingGrowth * 0.025 + interbankLending * 0.012;
  const capitalRaise = Math.max(0, (capitalBuffer / 100) * previousAssets - state.capital) * 0.38;
  const profit = round(interestIncome - fundingCost - loanDefaults - assetLoss - interbankLoss - operatingCost, 2);
  const cashBeforeReconciliation = state.cash + profit + capitalRaise + (state.deposits - deposits) - (customerLoans - state.customerLoans) - (riskAssets - state.riskAssets) - (interbankAssets - state.interbankAssets) - (safeSecurities - state.safeSecurities);
  let cash = round(Math.max(0, cashBeforeReconciliation), 2);
  let assets = round(cash + customerLoans + safeSecurities + riskAssets + interbankAssets, 2);
  let liabilities = round(fundingBase, 2);
  if (assets < liabilities) {
    // Resolution writes down unsecured other debt before presenting the explicit default state.
    otherDebt = round(Math.max(0, otherDebt - (liabilities - assets)), 2);
    liabilities = round(deposits + interbankBorrowing + otherDebt, 2);
  }
  let capital = round(Math.max(0, assets - liabilities), 2);
  const targetCash = Math.max(0, assets * (liquidityReserve / 100));
  if (cash < targetCash && safeSecurities > 0) {
    const rebalance = round(Math.min(targetCash - cash, safeSecurities * 0.34), 2);
    cash += rebalance;
    assets = assets; // a sale changes composition, not total assets.
  }
  const finalSafeSecurities = round(Math.max(0, assets - cash - customerLoans - riskAssets - interbankAssets), 2);
  assets = round(cash + customerLoans + finalSafeSecurities + riskAssets + interbankAssets, 2);
  capital = round(Math.max(0, assets - liabilities), 2);
  const capitalRatio = round(assets > 0 ? (capital / assets) * 100 : 0, 1);
  const liquidityRatio = round(fundingBase > 0 ? (cash / fundingBase) * 100 : 0, 1);
  const defaultRisk = round(clamp(100 - capitalRatio * 4.1 - liquidityRatio * 1.15 + riskExposure * 0.25 + interbankLending * 0.16 + conditions.withdrawal * 90, 1, 100));
  const systemicImpact = round(clamp(riskExposure * 0.48 + interbankLending * 0.62 + Math.max(0, 12 - capitalRatio) * 2.8 + conditions.interbankHaircut * 55, 0, 100));
  const stress = financialStressLabel(capitalRatio, liquidityRatio, defaultRisk);
  const contagionPath = [...state.contagionPath];
  if (stage === 3) contagionPath.push("Asset shock → risk-asset losses → capital pressure across exposed banks.");
  if (stage === 4) contagionPath.push("Interbank confidence weakens → funding withdrawal → liquidity pressure reaches connected banks.");
  if (conditions.interbankHaircut > 0 && interbankLending > 10) {
    interactions.push("Higher interbank lending transmits the liquidity shock more strongly: counterparties reduce funding at the same time as asset values fall.");
  }
  if (liquidityReserve >= 20 && stage >= 4) {
    interactions.push("A larger liquidity reserve absorbs part of the withdrawal shock, reducing forced asset sales even though it lowered earlier lending capacity.");
  }
  if (lendingGrowth >= 11 && riskExposure >= 30 && stage >= 3) {
    interactions.push("Fast loan growth combined with high risk exposure raises credit losses after the asset shock; early profit is exchanged for a more fragile capital position.");
  }
  if (capitalBuffer >= 16 && capitalRatio >= 10) {
    interactions.push("A stronger capital buffer makes losses easier to absorb, although raising capital constrains short-term return on equity in this stylised model.");
  }
  if (stress === "default") interactions.push("The bank is in explicit resolution: remaining assets are matched against written-down liabilities, so no negative balance-sheet account is hidden.");
  return {
    cash: round(cash, 2), customerLoans, safeSecurities: finalSafeSecurities, riskAssets, interbankAssets,
    deposits, interbankBorrowing, otherDebt, capital, profit, cumulativeProfit: round(state.cumulativeProfit + profit, 2),
    capitalRatio, liquidityRatio, defaultRisk, interbankExposure: round((interbankAssets / Math.max(assets, 1)) * 100, 1),
    systemicImpact, stress, bankStates: standardBanks(systemicImpact, stage), contagionPath, interactions,
  };
}

export function scoreFinancialNetwork(state: FinancialNetworkState): ScoreBreakdown {
  const solvency = clamp((state.capitalRatio / 12) * 40 - (state.stress === "default" ? 40 : 0), 0, 40);
  const profitability = clamp(15 + state.cumulativeProfit * 3.2 - Math.max(0, state.defaultRisk - 28) * 0.15, 0, 30);
  const liquidity = clamp((state.liquidityRatio / 24) * 30 - Math.max(0, state.defaultRisk - 40) * 0.08, 0, 30);
  return {
    score: round(clamp(solvency + profitability + liquidity, 0, 100)),
    components: [
      { label: "Solvency", points: round(solvency), detail: "40 points: positive capital and a resilient capital ratio." },
      { label: "Profitability", points: round(profitability), detail: "30 points: cumulative, risk-adjusted profit in the simplified balance-sheet model." },
      { label: "Liquidity", points: round(liquidity), detail: "30 points: liquid reserve capacity relative to deposits and interbank obligations." },
    ],
  };
}

export function ghostDisplayName(visibility: LeagueGhostVisibility, challengeOpen: boolean, sourceName?: string | null) {
  if (visibility === "private") return "Private strategy";
  if (challengeOpen || visibility === "anonymous_league") return "Anonymous League Ghost";
  return sourceName ? `${sourceName} Ghost Strategy` : "League Ghost Strategy";
}

const worldControls: ChallengeControl[] = [
  { key: "interestRate", label: "Policy interest rate", role: "central_bank", min: 1, max: 10, step: 0.25, defaultValue: 3, unit: "%", timing: "immediate", description: "Changes credit conditions immediately and affects demand over time." },
  { key: "governmentSpending", label: "Government spending", role: "economic_policy", min: 12, max: 32, step: 1, defaultValue: 20, unit: "% GDP", timing: "immediate", description: "Supports demand and public services; higher spending adds fiscal pressure." },
  { key: "generalTaxRate", label: "General tax rate", role: "economic_policy", min: 12, max: 40, step: 1, defaultValue: 24, unit: "%", timing: "immediate", description: "Changes fiscal capacity and household/business disposable income." },
  { key: "tariff", label: "Tariff", role: "trade", min: 0, max: 25, step: 1, defaultValue: 8, unit: "%", timing: "immediate", description: "Protects some domestic production while adding import-price pressure." },
  { key: "publicInvestment", label: "Public investment", role: "investment_resources", min: 0, max: 24, step: 1, defaultValue: 12, unit: "% GDP", timing: "delayed", description: "Builds productive capacity with a delayed payoff and fiscal cost." },
  { key: "strategicSubsidy", label: "Strategic industry subsidy", role: "investment_resources", min: 0, max: 16, step: 1, defaultValue: 6, unit: "% GDP", timing: "delayed", description: "Supports selected sectors with a delayed production effect." },
];

const timeMachineControls: ChallengeControl[] = [
  { key: "interestRate", label: "Policy interest rate", role: "central_bank", min: 2, max: 10, step: 0.25, defaultValue: 4, unit: "%", timing: "immediate", description: "Restrains inflation but can weaken output and employment." },
  { key: "governmentSpending", label: "Government spending", role: "economic_policy", min: 10, max: 30, step: 1, defaultValue: 18, unit: "% GDP", timing: "immediate", description: "Supports demand and employment with a fiscal cost." },
  { key: "taxRelief", label: "Tax relief", role: "economic_policy", min: 0, max: 14, step: 1, defaultValue: 4, unit: "% GDP", timing: "immediate", description: "Supports household and business income with a fiscal cost." },
  { key: "energySubsidy", label: "Energy subsidy", role: "trade", min: 0, max: 16, step: 1, defaultValue: 5, unit: "% GDP", timing: "immediate", description: "Moderates energy-cost pass-through but needs fiscal funding." },
  { key: "publicInvestment", label: "Public investment", role: "investment_resources", min: 0, max: 24, step: 1, defaultValue: 10, unit: "% GDP", timing: "delayed", description: "Strengthens recovery and energy capacity over time." },
  { key: "strategicReserve", label: "Strategic reserve", role: "investment_resources", min: 0, max: 16, step: 1, defaultValue: 5, unit: "% GDP", timing: "delayed", description: "Improves resilience against supply disruption." },
];

const industryControls: ChallengeControl[] = [
  { key: "price", label: "Vehicle price", role: "central_bank", min: 28, max: 62, step: 1, defaultValue: 42, unit: "k credits", timing: "immediate", description: "Affects demand, margin and competitors’ pricing response." },
  { key: "production", label: "Production", role: "economic_policy", min: 80, max: 420, step: 10, defaultValue: 220, unit: "units", timing: "immediate", description: "Raises available supply but can create costly inventory." },
  { key: "marketing", label: "Marketing", role: "trade", min: 0, max: 24, step: 1, defaultValue: 9, unit: "credits", timing: "immediate", description: "Builds brand strength and supports sales." },
  { key: "research", label: "R&D", role: "investment_resources", min: 0, max: 24, step: 1, defaultValue: 10, unit: "credits", timing: "delayed", description: "Raises technology and lowers future unit cost." },
  { key: "capacity", label: "Capacity", role: "investment_resources", min: 120, max: 520, step: 20, defaultValue: 240, unit: "units", timing: "delayed", description: "Sets the production ceiling and requires investment." },
];

const financialControls: ChallengeControl[] = [
  { key: "lendingGrowth", label: "Lending growth", role: "central_bank", min: 0, max: 16, step: 1, defaultValue: 6, unit: "%", timing: "immediate", description: "Expands customer credit and near-term interest income, while increasing losses carried into later stress." },
  { key: "liquidityReserve", label: "Liquidity reserve", role: "economic_policy", min: 6, max: 32, step: 1, defaultValue: 14, unit: "% assets", timing: "immediate", description: "Keeps more cash and safe securities available for withdrawals, reducing funds available for lending." },
  { key: "riskExposure", label: "Risk exposure", role: "trade", min: 8, max: 46, step: 1, defaultValue: 22, unit: "% assets", timing: "immediate", description: "Allocates more of the balance sheet to risky assets with higher return and larger shock losses." },
  { key: "capitalBuffer", label: "Capital buffer", role: "trade", min: 6, max: 24, step: 1, defaultValue: 12, unit: "% assets", timing: "delayed", description: "Builds loss-absorbing capital over time, with a short-term return trade-off." },
  { key: "interbankLending", label: "Interbank lending", role: "investment_resources", min: 0, max: 24, step: 1, defaultValue: 8, unit: "% assets", timing: "immediate", description: "Earns interbank income but exposes the bank to counterparty stress and funding contagion." },
];

export const LEAGUE_CHALLENGE_CATALOG: LeagueChallengeDefinition[] = [
  { slug: "world-economy-foundations", simulationType: "world", title: "World Economy: Stability under pressure", eyebrow: "World Economy", summary: "Run a country from a fixed starting condition. Policies persist until you change them; the score makes macroeconomic trade-offs visible.", stageCount: 4, officialAttemptLimit: 5, replayVisibility: "after_submit", controls: worldControls, scoringLabels: [{ label: "Growth", detail: "Maximum 25-point penalty" }, { label: "Inflation", detail: "Maximum 25-point penalty" }, { label: "Unemployment", detail: "Maximum 25-point penalty" }, { label: "Fiscal sustainability", detail: "Maximum 25-point penalty" }], stageLabels: ["Initial conditions", "External pressure", "Secondary effects", "Recovery choice"] },
  { slug: "time-machine-1973-oil-shock", simulationType: "time_machine", title: "Economic Time Machine: 1973 Oil Shock", eyebrow: "Economic Time Machine", summary: "Enter economic history with only the information available at each date. The model compares your stylised counterfactual with the historical path.", stageCount: 5, officialAttemptLimit: 5, replayVisibility: "after_challenge_close", controls: timeMachineControls, scoringLabels: [{ label: "Economic stability", weight: 40, detail: "Inflation and unemployment" }, { label: "Policy effectiveness", weight: 30, detail: "Output resilience and recovery" }, { label: "Fiscal sustainability", weight: 30, detail: "Debt and fiscal balance" }], stageLabels: TIME_MACHINE_STAGES.map((stage) => stage.title) },
  { slug: "industry-arena-ev-competition", simulationType: "industry", title: "Industry Arena: EV Competition", eyebrow: "Industry Arena", summary: "Run a fictional electric-vehicle firm against transparent standard agents and anonymous League Ghosts. Five decisions are enough to make strategy visible.", stageCount: 5, officialAttemptLimit: 5, replayVisibility: "after_challenge_close", controls: industryControls, scoringLabels: [{ label: "Profitability", weight: 40, detail: "Profit and revenue" }, { label: "Market position", weight: 30, detail: "Market share and brand" }, { label: "Firm sustainability", weight: 30, detail: "Technology, inventory and value" }], stageLabels: ["Market entry", "Competitive response", "Demand shift", "Capacity decision", "Strategic outcome"] },
  { slug: "financial-network-contagion", simulationType: "financial", title: "Financial Network: Financial Contagion", eyebrow: "Financial Network", summary: "Run a fictional commercial bank through credit expansion, an asset shock and interbank liquidity stress. The simplified balance sheet makes each transmission channel visible.", stageCount: 5, officialAttemptLimit: 5, replayVisibility: "after_challenge_close", controls: financialControls, scoringLabels: [{ label: "Solvency", weight: 40, detail: "Capital and capital ratio" }, { label: "Profitability", weight: 30, detail: "Cumulative risk-adjusted profit" }, { label: "Liquidity", weight: 30, detail: "Cash against funding obligations" }], stageLabels: FINANCIAL_NETWORK_STAGES.map((stage) => stage.title) },
];

export function challengeDefinition(slug: string) {
  return LEAGUE_CHALLENGE_CATALOG.find((challenge) => challenge.slug === slug) ?? null;
}

export function policyDefaults(controls: ChallengeControl[]): PolicyValues {
  return Object.fromEntries(controls.map((control) => [control.key, control.defaultValue]));
}

export function createChallengeInitialState(slug: string) {
  const definition = challengeDefinition(slug);
  if (!definition) throw new Error("Unknown League Challenge.");
  if (definition.simulationType === "time_machine") return createTimeMachineState();
  if (definition.simulationType === "industry") return createIndustryArenaState();
  if (definition.simulationType === "financial") return createFinancialNetworkState();
  return createWorldArenaState();
}

export function advanceChallengeState(slug: string, state: Record<string, unknown>, policies: PolicyValues, stage: number) {
  const definition = challengeDefinition(slug);
  if (!definition) throw new Error("Unknown League Challenge.");
  if (definition.simulationType === "time_machine") return advanceTimeMachineStage(state as TimeMachineState, policies, stage);
  if (definition.simulationType === "industry") return advanceIndustryArenaState(state as IndustryArenaState, policies, { type: "conditional", conditions: [{ when: "inventory_high", threshold: 150, action: { price: 38 } }] }, stage);
  if (definition.simulationType === "financial") return advanceFinancialNetworkState(state as FinancialNetworkState, policies, stage);
  return advanceWorldArenaState(state as WorldArenaState, policies);
}

export function scoreChallengeState(slug: string, state: Record<string, unknown>) {
  const definition = challengeDefinition(slug);
  if (!definition) throw new Error("Unknown League Challenge.");
  if (definition.simulationType === "time_machine") return scoreTimeMachine(state as TimeMachineState);
  if (definition.simulationType === "industry") return scoreIndustryArena(state as IndustryArenaState);
  if (definition.simulationType === "financial") return scoreFinancialNetwork(state as FinancialNetworkState);
  const world = state as WorldArenaState;
  return scoreWorldChallenge(world);
}
