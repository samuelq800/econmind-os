import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { PolicyContribution, SandboxParameters } from "@/lib/economics/sandbox/types";

export function fiscalContributions(parameters: SandboxParameters): PolicyContribution[] {
  const incomeTax = parameters.incomeTaxRate - BASELINE_PARAMETERS.incomeTaxRate;
  const corporateTax = parameters.corporateTaxRate - BASELINE_PARAMETERS.corporateTaxRate;
  const spending = parameters.governmentSpending - BASELINE_PARAMETERS.governmentSpending;
  const subsidy = parameters.subsidyRate - BASELINE_PARAMETERS.subsidyRate;
  return [
    // Higher household taxation raises revenue but reduces disposable income, demand, and welfare.
    { policy: "incomeTaxRate", label: "Income tax", values: { gdpIndex: -0.12 * incomeTax, governmentRevenue: 0.6 * incomeTax, consumerWelfare: -0.15 * incomeTax, marketOutput: -0.08 * incomeTax } },
    // Higher corporate taxation reduces retained profit and simplified investment incentives.
    { policy: "corporateTaxRate", label: "Corporate tax", values: { gdpIndex: -0.1 * corporateTax, governmentRevenue: 0.45 * corporateTax, firmProfit: -0.35 * corporateTax, marketOutput: -0.1 * corporateTax } },
    // Expansionary spending raises output, may lower unemployment, and can add inflation pressure.
    { policy: "governmentSpending", label: "Government spending", values: { gdpIndex: 0.25 * spending, inflationRate: 0.025 * spending, unemploymentRate: -0.015 * spending, consumerWelfare: 0.08 * spending, marketOutput: 0.18 * spending } },
    // Broad subsidies support output and profit but reduce the net public-revenue index.
    { policy: "subsidyRate", label: "Subsidy", values: { gdpIndex: 0.18 * subsidy, governmentRevenue: -0.35 * subsidy, consumerWelfare: 0.08 * subsidy, firmProfit: 0.28 * subsidy, marketOutput: 0.22 * subsidy } },
  ];
}
