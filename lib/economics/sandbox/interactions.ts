import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { PolicyContribution, SandboxParameters } from "@/lib/economics/sandbox/types";

export function interactionContributions(parameters: SandboxParameters): PolicyContribution[] {
  const spending = parameters.governmentSpending - BASELINE_PARAMETERS.governmentSpending;
  const interest = parameters.interestRate - BASELINE_PARAMETERS.interestRate;
  const tariff = Math.max(0, parameters.tariffRate - BASELINE_PARAMETERS.tariffRate);
  return [
    { policy: "governmentSpending", policies: ["governmentSpending", "interestRate"], label: "Spending × interest rate", kind: "interaction", formula: "ΔGDP interaction = −0.012 × Δspending × Δinterest rate", rule: "Higher interest rates dampen an expansionary spending multiplier; lower rates amplify it.", values: { gdpIndex: -0.012 * spending * interest, marketOutput: -0.006 * spending * interest, inflationRate: -0.001 * spending * interest } },
    { policy: "carbonTax", policies: ["carbonTax", "greenSubsidy"], label: "Carbon tax × green subsidy", kind: "interaction", formula: "Δemissions interaction = −0.0025 × carbon tax × green subsidy", rule: "Pricing emissions and supporting clean investment are modeled as complementary instruments.", values: { carbonEmissions: -0.0025 * parameters.carbonTax * parameters.greenSubsidy, gdpIndex: 0.0008 * parameters.carbonTax * parameters.greenSubsidy, firmProfit: 0.001 * parameters.carbonTax * parameters.greenSubsidy } },
    { policy: "tariffRate", policies: ["tariffRate", "domesticProductionSubsidy"], label: "Tariff × domestic subsidy", kind: "interaction", formula: "Δoutput interaction = 0.003 × Δtariff × domestic subsidy", rule: "Domestic capacity support partly offsets the tariff's modeled output loss, while increasing fiscal cost.", values: { marketOutput: 0.003 * tariff * parameters.domesticProductionSubsidy, firmProfit: 0.004 * tariff * parameters.domesticProductionSubsidy, governmentRevenue: -0.0015 * tariff * parameters.domesticProductionSubsidy } },
    { policy: "priceCeiling", policies: ["priceCeiling", "demandStimulus"], label: "Price ceiling × demand stimulus", kind: "interaction", formula: "Δoutput interaction = −0.004 × ceiling × stimulus", rule: "Stimulating demand under a binding ceiling deepens the modeled shortage and rationing loss.", values: { marketOutput: -0.004 * parameters.priceCeiling * parameters.demandStimulus, consumerWelfare: -0.003 * parameters.priceCeiling * parameters.demandStimulus, inflationRate: -0.0005 * parameters.priceCeiling * parameters.demandStimulus } },
  ];
}
