export type PolicyCategory = "Fiscal Policy" | "Monetary Policy" | "Market Regulation" | "Environmental Policy" | "Trade Policy";

export type SandboxParameters = {
  incomeTaxRate: number;
  corporateTaxRate: number;
  governmentSpending: number;
  subsidyRate: number;
  interestRate: number;
  moneySupplyGrowth: number;
  minimumWage: number;
  priceCeiling: number;
  priceFloor: number;
  carbonTax: number;
  greenSubsidy: number;
  tariffRate: number;
  importQuotaIntensity: number;
};

export type SandboxIndicators = {
  gdpIndex: number;
  inflationRate: number;
  unemploymentRate: number;
  governmentRevenue: number;
  consumerWelfare: number;
  firmProfit: number;
  carbonEmissions: number;
  marketOutput: number;
};

export type IndicatorKey = keyof SandboxIndicators;
export type PolicyKey = keyof SandboxParameters;

export type PolicyDefinition = {
  key: PolicyKey;
  label: string;
  category: PolicyCategory;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
};

export type PolicyContribution = {
  policy: PolicyKey;
  label: string;
  values: Partial<SandboxIndicators>;
};

export type RadarScores = {
  growth: number;
  employment: number;
  priceStability: number;
  consumerWelfare: number;
  firmProfit: number;
  environmentalPerformance: number;
};

export type SandboxResult = {
  parameters: SandboxParameters;
  baseline: SandboxIndicators;
  indicators: SandboxIndicators;
  contributions: PolicyContribution[];
  radar: RadarScores;
};

export type SandboxInterpretation = {
  mainEffects: string[];
  tradeOffs: string[];
  warnings: string[];
  summary: string;
};

export type SandboxPreset = {
  id: string;
  name: string;
  description: string;
  parameters: SandboxParameters;
};

export type SandboxTimelineEntry = {
  id: string;
  label: string;
  runAt: string;
  parameters: SandboxParameters;
  indicators: SandboxIndicators;
};
