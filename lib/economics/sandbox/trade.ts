import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { PolicyContribution, SandboxParameters } from "@/lib/economics/sandbox/types";

export function tradeContributions(parameters: SandboxParameters): PolicyContribution[] {
  const tariff = parameters.tariffRate - BASELINE_PARAMETERS.tariffRate;
  const domesticSubsidy = parameters.domesticProductionSubsidy;
  const quota = parameters.importQuotaIntensity;
  return [
    // Tariffs raise public revenue and protect some firms, but reduce consumer choice and output.
    { policy: "tariffRate", label: "Tariff", kind: "direct", formula: "Δconsumer welfare = −0.22 × Δtariff", rule: "Tariffs protect some firms and raise revenue while increasing prices and reducing choice.", values: { gdpIndex: -0.04 * Math.max(0, tariff), inflationRate: 0.05 * tariff, governmentRevenue: 0.2 * tariff, consumerWelfare: -0.22 * tariff, firmProfit: 0.08 * tariff, marketOutput: -0.08 * Math.max(0, tariff) } },
    { policy: "domesticProductionSubsidy", label: "Domestic production subsidy", kind: "direct", formula: "Δdomestic output = 0.24 × subsidy", rule: "Targeted domestic support expands capacity and profit at a fiscal cost.", values: { gdpIndex: 0.12 * domesticSubsidy, governmentRevenue: -0.3 * domesticSubsidy, consumerWelfare: 0.05 * domesticSubsidy, firmProfit: 0.32 * domesticSubsidy, marketOutput: 0.24 * domesticSubsidy } },
    // Quotas create scarcity without the public-revenue effect of a tariff in this simplified model.
    { policy: "importQuotaIntensity", label: "Import quota", kind: "direct", formula: "Δoutput = −0.18 × quota intensity", rule: "Quotas create scarcity without automatic public tariff revenue.", values: { gdpIndex: -0.05 * quota, inflationRate: 0.06 * quota, consumerWelfare: -0.25 * quota, firmProfit: 0.1 * quota - 0.001 * quota ** 2, marketOutput: -0.18 * quota } },
  ];
}
