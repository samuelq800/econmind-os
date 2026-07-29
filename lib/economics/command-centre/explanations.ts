import { SECTOR_LABELS } from "./config.ts";
import type { CommandCentreState, PendingEffect, PolicyPackage, QuarterExplanation, ShockRecord } from "./types.ts";

const change = (after: number, before: number, digits = 1) => `${after - before >= 0 ? "+" : ""}${(after - before).toFixed(digits)}`;

export function generateDeterministicExplanation(input: { before: CommandCentreState; after: CommandCentreState; policy: PolicyPackage; shock: ShockRecord | null; appliedPending: PendingEffect[]; interactions: string[] }): QuarterExplanation {
  const { before, after, policy, shock, appliedPending, interactions } = input;
  const sectorMovement = (key: keyof CommandCentreState["sectors"]) => after.sectors[key].output_index - before.sectors[key].output_index + (after.sectors[key].investment_index - before.sectors[key].investment_index) * 0.35;
  const ranked = (Object.keys(after.sectors) as Array<keyof CommandCentreState["sectors"]>).sort((left, right) => sectorMovement(right) - sectorMovement(left));
  const winner = ranked[0]; const loser = ranked.at(-1)!;
  const rateDirection = policy.interestRate > before.lastPolicy.interestRate ? "raised" : policy.interestRate < before.lastPolicy.interestRate ? "cut" : "held";
  const policySummary = `The policy rate was ${rateDirection} to ${policy.interestRate.toFixed(1)}%, business tax was set at ${policy.businessTaxRate}%, and the 100-point fiscal package prioritised ${Object.entries(policy.allocation).sort(([, a], [, b]) => b - a).slice(0, 2).map(([key]) => key.replace(/([A-Z])/g, " $1")).join(" and ")}.`;
  const transmission = [
    `GDP growth moved ${change(after.macro.growth, before.macro.growth)} points to ${after.macro.growth.toFixed(1)}%, while inflation moved ${change(after.macro.inflation, before.macro.inflation)} points to ${after.macro.inflation.toFixed(1)}%.`,
    ...interactions,
    ...appliedPending.map((effect) => `${effect.source_policy}: ${effect.explanation}`),
    ...(shock ? shock.mechanisms : []),
  ];
  const stakeholderReaction = [
    `Household confidence is ${after.stakeholders.households.confidence.toFixed(0)} because purchasing power is ${after.stakeholders.households.purchasing_power.toFixed(0)} and cost-of-living pressure is ${after.stakeholders.households.cost_of_living_pressure.toFixed(0)}.`,
    `Firm investment intention is ${after.stakeholders.firms.investment_intention.toFixed(0)} as business confidence is ${after.stakeholders.firms.business_confidence.toFixed(0)} and cost pressure is ${after.stakeholders.firms.cost_pressure.toFixed(0)}.`,
    `Investor confidence is ${after.stakeholders.investors.confidence.toFixed(0)} while foreign reserves stand at ${after.resources.foreignReserves.toFixed(0)} and debt concern is ${after.stakeholders.investors.debt_concern.toFixed(0)}.`,
  ];
  const tradeOff = after.macro.debt > before.macro.debt + 1 ? `Demand protection raised debt from ${before.macro.debt.toFixed(1)}% to ${after.macro.debt.toFixed(1)}% of GDP, reducing room for later shocks.` : after.macro.unemployment > before.macro.unemployment + 0.2 ? `Improved price credibility came with weaker labour-market conditions: unemployment rose to ${after.macro.unemployment.toFixed(1)}%.` : `The package preserved fiscal space, but its support for current activity remained limited.`;
  const unintendedConsequence = after.macro.emissions > before.macro.emissions + 0.5 ? `Emissions rose to ${after.macro.emissions.toFixed(1)} as short-run energy relief weakened price signals.` : after.sectors.technology.investment_index < before.sectors.technology.investment_index - 2 ? `Technology investment fell to ${after.sectors.technology.investment_index.toFixed(0)} as financing and confidence conditions tightened.` : `The policy mix left ${SECTOR_LABELS[loser]} relatively exposed even as aggregate indicators improved.`;
  const forwardRisk = after.quarter === 2 ? "Global energy disruption is next: imported costs and household bills will test the resilience of today’s package." : after.quarter === 3 ? "Capital outflow risk is next: high debt, inflation and weak reserves can make borrowing conditions deteriorate quickly." : after.resources.foreignReserves < 75 ? "Low foreign reserves remain the largest risk because they amplify exchange-rate and imported-inflation pressure." : "Maintain implementation credibility: political capital and delayed effects will shape the final outcome.";
  return { policySummary, transmission, stakeholderReaction, sectorWinners: [`${SECTOR_LABELS[winner]} leads this quarter, with output/investment movement of ${change(sectorMovement(winner), 0)} index points.`], sectorLosers: [`${SECTOR_LABELS[loser]} is under the greatest pressure, with output/investment movement of ${change(sectorMovement(loser), 0)} index points.`], tradeOff, unintendedConsequence, forwardRisk };
}
