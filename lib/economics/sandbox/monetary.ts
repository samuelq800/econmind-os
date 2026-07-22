import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { PolicyContribution, SandboxParameters } from "@/lib/economics/sandbox/types";

export function monetaryContributions(parameters: SandboxParameters): PolicyContribution[] {
  const interest = parameters.interestRate - BASELINE_PARAMETERS.interestRate;
  const money = parameters.moneySupplyGrowth - BASELINE_PARAMETERS.moneySupplyGrowth;
  return [
    // Higher rates restrain investment and inflation, while unemployment can rise in the short run.
    { policy: "interestRate", label: "Interest rate", values: { gdpIndex: -0.8 * interest, inflationRate: -0.25 * interest, unemploymentRate: 0.15 * interest, firmProfit: -0.6 * interest, marketOutput: -0.5 * interest } },
    // Faster money growth supports nominal demand but creates increasing inflation pressure.
    { policy: "moneySupplyGrowth", label: "Money growth", values: { gdpIndex: 0.35 * money, inflationRate: 0.3 * money, unemploymentRate: -0.08 * money, consumerWelfare: -0.08 * Math.max(0, money), firmProfit: 0.2 * money, marketOutput: 0.25 * money } },
  ];
}
