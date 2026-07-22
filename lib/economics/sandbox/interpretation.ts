import { BASELINE_INDICATORS, BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { IndicatorKey, PolicyContribution, SandboxInterpretation, SandboxResult } from "@/lib/economics/sandbox/types";

const indicatorNames: Record<IndicatorKey, string> = {
  gdpIndex: "GDP index",
  inflationRate: "inflation",
  unemploymentRate: "unemployment",
  governmentRevenue: "the government revenue index",
  consumerWelfare: "consumer welfare",
  firmProfit: "firm profit",
  carbonEmissions: "carbon emissions",
  marketOutput: "market output",
};

function largestDriver(contributions: PolicyContribution[], indicator: IndicatorKey) {
  return [...contributions].sort((a, b) => Math.abs(b.values[indicator] ?? 0) - Math.abs(a.values[indicator] ?? 0))[0];
}

export function interpretSandbox(result: SandboxResult): SandboxInterpretation {
  const { indicators, contributions, parameters } = result;
  const mainEffects: string[] = [];
  for (const key of ["gdpIndex", "inflationRate", "carbonEmissions"] as IndicatorKey[]) {
    const delta = indicators[key] - BASELINE_INDICATORS[key];
    const driver = largestDriver(contributions, key);
    if (Math.abs(delta) < 0.15 || !driver) continue;
    mainEffects.push(`${indicatorNames[key][0].toUpperCase()}${indicatorNames[key].slice(1)} ${delta > 0 ? "increased" : "decreased"} mainly because of the ${driver.label.toLowerCase()} setting.`);
  }
  if (mainEffects.length === 0) mainEffects.push("The current policy mix stays close to the standardized baseline.");
  const interaction = [...result.interactionContributions].sort((a, b) => Object.values(b.values).reduce((sum, value) => sum + Math.abs(value ?? 0), 0) - Object.values(a.values).reduce((sum, value) => sum + Math.abs(value ?? 0), 0))[0];
  if (interaction) mainEffects.push(`${interaction.label} creates an additional interaction effect beyond the two policies' direct effects.`);

  const tradeOffs: string[] = [];
  if (indicators.unemploymentRate < BASELINE_INDICATORS.unemploymentRate && indicators.inflationRate > BASELINE_INDICATORS.inflationRate) tradeOffs.push("The policy mix improves employment but increases inflation pressure.");
  if (indicators.carbonEmissions < BASELINE_INDICATORS.carbonEmissions && indicators.firmProfit < BASELINE_INDICATORS.firmProfit) tradeOffs.push("Environmental performance improves at the cost of lower short-run firm profit.");
  if (indicators.governmentRevenue > BASELINE_INDICATORS.governmentRevenue && indicators.consumerWelfare < BASELINE_INDICATORS.consumerWelfare) tradeOffs.push("Public revenue rises while the simplified consumer welfare index declines.");
  if (tradeOffs.length === 0) tradeOffs.push("No large two-indicator trade-off is triggered under the current standardized thresholds.");

  const warnings: string[] = [];
  if (parameters.priceCeiling >= 20) warnings.push("A restrictive price ceiling may create a shortage and non-price rationing.");
  if (parameters.priceFloor >= 20) warnings.push("A restrictive price floor may create unsold output.");
  if (parameters.tariffRate >= 30 || parameters.importQuotaIntensity >= 45) warnings.push("Strong trade restrictions may reduce choice, output, and consumer welfare.");
  if (parameters.moneySupplyGrowth >= 10) warnings.push("Strong monetary expansion may increase inflation substantially.");
  if (parameters.interestRate >= 10) warnings.push("A very high interest rate may weaken investment, output, and employment.");
  if (parameters.governmentSpending >= BASELINE_PARAMETERS.governmentSpending + 35) warnings.push("High public spending creates fiscal pressure not fully represented by the revenue index.");
  if (parameters.priceCeiling >= 20 && parameters.demandStimulus >= 15) warnings.push("Demand stimulus under a restrictive price ceiling intensifies the modeled shortage interaction.");
  if (parameters.tariffRate >= 30 && parameters.domesticProductionSubsidy >= 20) warnings.push("Combining border protection and large domestic subsidies creates a high-cost industrial policy mix.");
  if (warnings.length === 0) warnings.push("No extreme policy threshold is active.");

  return { mainEffects, tradeOffs, warnings, summary: [...mainEffects, ...tradeOffs].join(" ") };
}
