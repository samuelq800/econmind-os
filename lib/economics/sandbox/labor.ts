import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { PolicyContribution, SandboxParameters } from "@/lib/economics/sandbox/types";

export function laborContributions(parameters: SandboxParameters): PolicyContribution[] {
  const wage = parameters.minimumWage - BASELINE_PARAMETERS.minimumWage;
  const ceiling = parameters.priceCeiling;
  const floor = parameters.priceFloor;
  return [
    // A moderate wage floor can support worker welfare; very high settings reduce hiring and output.
    { policy: "minimumWage", label: "Minimum wage", values: { unemploymentRate: 0.03 * Math.max(0, wage), consumerWelfare: 0.06 * wage - 0.001 * Math.max(0, wage) ** 2, firmProfit: -0.12 * wage, marketOutput: -0.08 * Math.max(0, wage) } },
    // A more binding ceiling lowers the measured price pressure but causes shortage and lost output.
    { policy: "priceCeiling", label: "Price ceiling", values: { inflationRate: -0.03 * ceiling, consumerWelfare: 0.06 * ceiling - 0.002 * ceiling ** 2, firmProfit: -0.2 * ceiling, marketOutput: -0.3 * ceiling } },
    // A more binding floor supports seller prices while creating unsold output and consumer loss.
    { policy: "priceFloor", label: "Price floor", values: { inflationRate: 0.025 * floor, consumerWelfare: -0.08 * floor, firmProfit: 0.05 * floor - 0.0015 * floor ** 2, marketOutput: -0.1 * floor } },
  ];
}
