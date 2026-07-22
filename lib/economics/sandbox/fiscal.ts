import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { PolicyContribution, SandboxParameters } from "@/lib/economics/sandbox/types";

export function fiscalContributions(parameters: SandboxParameters): PolicyContribution[] {
  const incomeTax = parameters.incomeTaxRate - BASELINE_PARAMETERS.incomeTaxRate;
  const corporateTax = parameters.corporateTaxRate - BASELINE_PARAMETERS.corporateTaxRate;
  const spending = parameters.governmentSpending - BASELINE_PARAMETERS.governmentSpending;
  const stimulus = parameters.demandStimulus;
  const subsidy = parameters.subsidyRate - BASELINE_PARAMETERS.subsidyRate;
  return [
    // Higher household taxation raises revenue but reduces disposable income, demand, and welfare.
    { policy: "incomeTaxRate", label: "Income tax", kind: "direct", formula: "ΔGDP = −0.12 × Δincome tax", rule: "Higher household taxation reduces disposable income in this simplified model.", values: { gdpIndex: -0.12 * incomeTax, governmentRevenue: 0.6 * incomeTax, consumerWelfare: -0.15 * incomeTax, marketOutput: -0.08 * incomeTax } },
    // Higher corporate taxation reduces retained profit and simplified investment incentives.
    { policy: "corporateTaxRate", label: "Corporate tax", kind: "direct", formula: "Δprofit = −0.35 × Δcorporate tax", rule: "Higher corporate taxation reduces retained profit and investment incentives.", values: { gdpIndex: -0.1 * corporateTax, governmentRevenue: 0.45 * corporateTax, firmProfit: -0.35 * corporateTax, marketOutput: -0.1 * corporateTax } },
    // Expansionary spending raises output, may lower unemployment, and can add inflation pressure.
    { policy: "governmentSpending", label: "Government spending", kind: "direct", formula: "ΔGDP = 0.25 × Δspending", rule: "Expansionary spending raises demand, output, and price pressure before interactions.", values: { gdpIndex: 0.25 * spending, inflationRate: 0.025 * spending, unemploymentRate: -0.015 * spending, consumerWelfare: 0.08 * spending, marketOutput: 0.18 * spending } },
    { policy: "demandStimulus", label: "Demand stimulus", kind: "direct", formula: "ΔGDP = 0.20 × stimulus", rule: "Temporary demand support raises spending and output but also inflation pressure.", values: { gdpIndex: 0.2 * stimulus, inflationRate: 0.04 * stimulus, unemploymentRate: -0.012 * stimulus, governmentRevenue: -0.1 * stimulus, consumerWelfare: 0.1 * stimulus, marketOutput: 0.15 * stimulus } },
    // Broad subsidies support output and profit but reduce the net public-revenue index.
    { policy: "subsidyRate", label: "Broad subsidy", kind: "direct", formula: "Δoutput = 0.22 × Δsubsidy", rule: "Broad support expands supply and profit while using public resources.", values: { gdpIndex: 0.18 * subsidy, governmentRevenue: -0.35 * subsidy, consumerWelfare: 0.08 * subsidy, firmProfit: 0.28 * subsidy, marketOutput: 0.22 * subsidy } },
  ];
}
