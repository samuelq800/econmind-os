import type { CommandCentreState, FiscalAllocation, MacroKey, PolicyPackage, SectorKey } from "./types";

export const COMMAND_CENTRE_SCENARIO = {
  id: "energy-inflation-dilemma",
  title: "The Energy-Inflation Dilemma",
  description: "A stylised educational model of weak growth, persistent inflation and imported-energy exposure. It illustrates mechanisms and trade-offs; it is not a forecasting tool.",
  roundLabels: ["Fragile Recovery", "Global Energy Shock", "Secondary Crisis"],
} as const;

export const MACRO_BOUNDS: Record<MacroKey, readonly [number, number]> = {
  growth: [-8, 10], inflation: [-3, 25], unemployment: [2, 25], debt: [0, 220], approval: [0, 100], emissions: [40, 180], productivity: [60, 180], inequality: [0.2, 0.65],
};
export const SECTOR_BOUNDS: Record<string, readonly [number, number]> = {
  output_index: [40, 180], employment_index: [40, 180], investment_index: [30, 190], confidence: [0, 100], energy_dependency: [20, 160], emissions_index: [30, 200],
};
export const RESOURCE_BOUNDS = { fiscalSpace: [65, 100], politicalCapital: [0, 100], foreignReserves: [20, 180] } as const;
export const DEFAULT_ALLOCATION: FiscalAllocation = { infrastructure: 25, welfare: 25, energySupport: 20, greenTransition: 20, fiscalReserve: 10 };
export const DEFAULT_POLICY: PolicyPackage = { interestRate: 4.5, businessTaxRate: 25, allocation: DEFAULT_ALLOCATION };

/** Teaching coefficients: signs encode conventional macro channels, not forecasts. */
export const COEFFICIENTS = {
  infrastructureGrowthImmediate: 0.012, // Public works raise current demand.
  infrastructureDebt: 0.018, // Infrastructure consumes fiscal capacity now.
  welfarePurchasingPower: 0.11, // Transfers cushion real-income pressure.
  welfareInequality: -0.00032, // Targeted support narrows the inequality index modestly.
  energySupportInflation: -0.021, // Support temporarily lowers observed energy-price pass-through.
  greenEmissionsDelayed: -0.14, // Transition investment lowers future emissions.
  greenDependencyDelayed: -0.16, // Transition investment reduces imported-energy reliance.
  rateInflationDelayed: -0.42, // Tighter policy cools demand with a lag.
  rateGrowthDelayed: -0.28, // Higher borrowing costs weaken future activity.
  taxInvestment: 1.5, // Higher business taxation reduces retained earnings for investment.
  taxDebt: -0.16, // Higher tax rates improve the debt path modestly.
} as const;

const sector = (output: number, employment: number, investment: number, confidence: number, energy: number, emissions: number) => ({ output_index: output, employment_index: employment, investment_index: investment, confidence, energy_dependency: energy, emissions_index: emissions });

export function createInitialCommandCentreState(): CommandCentreState {
  return {
    scenarioId: COMMAND_CENTRE_SCENARIO.id,
    quarter: 1,
    completed: false,
    macro: { growth: 1.4, inflation: 5.2, unemployment: 6.8, debt: 72, approval: 55, emissions: 100, productivity: 100, inequality: 0.34 },
    sectors: {
      manufacturing: sector(96, 98, 92, 52, 132, 116),
      technology: sector(106, 101, 112, 66, 58, 72),
      services: sector(101, 103, 98, 59, 48, 84),
      energy: sector(94, 97, 91, 48, 145, 124),
    },
    resources: { nominalBudget: 100, fiscalSpace: 100, politicalCapital: 100, foreignReserves: 100 },
    stakeholders: {
      households: { confidence: 54, purchasing_power: 89, cost_of_living_pressure: 67, employment_security: 61 },
      firms: { business_confidence: 53, hiring_intention: 51, investment_intention: 49, cost_pressure: 65 },
      investors: { confidence: 57, capital_flow_pressure: 38, debt_concern: 49, inflation_expectation: 64 },
    },
    pendingEffects: [], activeShockIds: [], coherencePenalty: 0, lastPolicy: { interestRate: 4.5, businessTaxRate: 25, allocation: { ...DEFAULT_ALLOCATION } },
  };
}

export const SECTOR_LABELS: Record<SectorKey, string> = { manufacturing: "Manufacturing", technology: "Technology", services: "Services", energy: "Energy" };
