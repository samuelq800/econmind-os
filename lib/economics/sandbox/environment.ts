import type { PolicyContribution, SandboxParameters } from "@/lib/economics/sandbox/types";

export function environmentalContributions(parameters: SandboxParameters): PolicyContribution[] {
  return [
    // A carbon price reduces emissions and raises revenue, with a short-run cost to output and profit.
    { policy: "carbonTax", label: "Carbon tax", values: { gdpIndex: -0.04 * parameters.carbonTax, governmentRevenue: 0.25 * parameters.carbonTax, consumerWelfare: 0.08 * parameters.carbonTax, firmProfit: -0.12 * parameters.carbonTax, carbonEmissions: -0.45 * parameters.carbonTax, marketOutput: -0.04 * parameters.carbonTax } },
    // Green support accelerates cleaner investment but uses public resources.
    { policy: "greenSubsidy", label: "Green subsidy", values: { gdpIndex: 0.1 * parameters.greenSubsidy, governmentRevenue: -0.18 * parameters.greenSubsidy, consumerWelfare: 0.08 * parameters.greenSubsidy, firmProfit: 0.12 * parameters.greenSubsidy, carbonEmissions: -0.25 * parameters.greenSubsidy, marketOutput: 0.08 * parameters.greenSubsidy } },
  ];
}
