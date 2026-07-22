import type { IndicatorKey, PolicyDefinition, SandboxIndicators, SandboxParameters } from "@/lib/economics/sandbox/types";

export const BASELINE_PARAMETERS: SandboxParameters = {
  incomeTaxRate: 25,
  corporateTaxRate: 21,
  governmentSpending: 100,
  subsidyRate: 5,
  interestRate: 4,
  moneySupplyGrowth: 3,
  minimumWage: 100,
  priceCeiling: 0,
  priceFloor: 0,
  carbonTax: 0,
  greenSubsidy: 0,
  tariffRate: 5,
  importQuotaIntensity: 0,
};

export const BASELINE_INDICATORS: SandboxIndicators = {
  gdpIndex: 100,
  inflationRate: 2,
  unemploymentRate: 5,
  governmentRevenue: 100,
  consumerWelfare: 100,
  firmProfit: 100,
  carbonEmissions: 100,
  marketOutput: 100,
};

export const INDICATOR_LIMITS: Record<IndicatorKey, [number, number]> = {
  gdpIndex: [60, 150],
  inflationRate: [-2, 20],
  unemploymentRate: [1, 25],
  governmentRevenue: [40, 180],
  consumerWelfare: [40, 150],
  firmProfit: [30, 170],
  carbonEmissions: [20, 180],
  marketOutput: [40, 160],
};

export const POLICY_DEFINITIONS: PolicyDefinition[] = [
  { key: "incomeTaxRate", label: "Income Tax Rate", category: "Fiscal Policy", min: 0, max: 60, step: 1, unit: "%", description: "A simplified tax on household income." },
  { key: "corporateTaxRate", label: "Corporate Tax Rate", category: "Fiscal Policy", min: 0, max: 50, step: 1, unit: "%", description: "A simplified tax on firm earnings." },
  { key: "governmentSpending", label: "Government Spending", category: "Fiscal Policy", min: 60, max: 160, step: 2, unit: " index", description: "A standardized public-spending index, not currency." },
  { key: "subsidyRate", label: "Subsidy Rate", category: "Fiscal Policy", min: 0, max: 30, step: 1, unit: "%", description: "Broad production support financed by the public sector." },
  { key: "interestRate", label: "Interest Rate", category: "Monetary Policy", min: 0, max: 15, step: 0.25, unit: "%", description: "A simplified policy interest rate." },
  { key: "moneySupplyGrowth", label: "Money Supply Growth", category: "Monetary Policy", min: -5, max: 20, step: 0.5, unit: "%", description: "A stylized monetary expansion rate." },
  { key: "minimumWage", label: "Minimum Wage", category: "Market Regulation", min: 70, max: 180, step: 2, unit: " index", description: "A standardized wage-floor index; 100 is baseline." },
  { key: "priceCeiling", label: "Price Ceiling Intensity", category: "Market Regulation", min: 0, max: 50, step: 1, unit: "%", description: "Zero is inactive; higher values represent a more restrictive ceiling." },
  { key: "priceFloor", label: "Price Floor Intensity", category: "Market Regulation", min: 0, max: 50, step: 1, unit: "%", description: "Zero is inactive; higher values represent a more restrictive floor." },
  { key: "carbonTax", label: "Carbon Tax", category: "Environmental Policy", min: 0, max: 100, step: 2, unit: " index", description: "A standardized emissions-price index." },
  { key: "greenSubsidy", label: "Green Subsidy", category: "Environmental Policy", min: 0, max: 50, step: 1, unit: "%", description: "Support for cleaner production and investment." },
  { key: "tariffRate", label: "Tariff Rate", category: "Trade Policy", min: 0, max: 60, step: 1, unit: "%", description: "A simplified import tariff." },
  { key: "importQuotaIntensity", label: "Import Quota Intensity", category: "Trade Policy", min: 0, max: 100, step: 2, unit: " index", description: "A standardized measure of quota restrictiveness." },
];
