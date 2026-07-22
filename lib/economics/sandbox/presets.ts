import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { SandboxPreset } from "@/lib/economics/sandbox/types";

export const SANDBOX_PRESETS: SandboxPreset[] = [
  { id: "recovery", name: "Expansionary Recovery", description: "Higher public spending, easier credit, and moderate production support.", parameters: { ...BASELINE_PARAMETERS, governmentSpending: 125, interestRate: 2, subsidyRate: 10 } },
  { id: "anti-inflation", name: "Anti-Inflation Policy", description: "Tighter monetary policy with lower public spending and slower money growth.", parameters: { ...BASELINE_PARAMETERS, interestRate: 8, governmentSpending: 85, moneySupplyGrowth: 0 } },
  { id: "green-transition", name: "Green Transition", description: "A carbon price paired with green support and moderate public investment.", parameters: { ...BASELINE_PARAMETERS, carbonTax: 45, greenSubsidy: 22, governmentSpending: 112 } },
  { id: "protectionist", name: "Protectionist Economy", description: "Stronger border restrictions plus domestic production support.", parameters: { ...BASELINE_PARAMETERS, tariffRate: 32, importQuotaIntensity: 50, subsidyRate: 12 } },
  { id: "business-friendly", name: "Business-Friendly Policy", description: "Lower corporate taxation, moderate support, and cheaper credit.", parameters: { ...BASELINE_PARAMETERS, corporateTaxRate: 12, subsidyRate: 9, interestRate: 2.5 } },
  { id: "custom", name: "Custom Scenario", description: "Return to the standardized baseline and construct your own policy mix.", parameters: { ...BASELINE_PARAMETERS } },
];
