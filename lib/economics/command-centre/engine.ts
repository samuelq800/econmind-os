import { COEFFICIENTS, MACRO_BOUNDS, RESOURCE_BOUNDS, SECTOR_BOUNDS } from "./config.ts";
import { assertPolicyPackage, calculateFiscalConstraint, clamp, policyCapitalCost, round } from "./constraints.ts";
import { generateDeterministicExplanation } from "./explanations.ts";
import { applyPolicyInteractions } from "./interactions.ts";
import { calculateScores } from "./scoring.ts";
import { applyShock, shockForQuarter } from "./shocks.ts";
import type { AdvanceQuarterResult, CommandCentreState, FiscalAllocation, PendingEffect, PendingTarget, PolicyPackage, Quarter, SectorKey, ShockRecord } from "./types.ts";

function addTarget(state: CommandCentreState, target: PendingTarget, magnitude: number) {
  const [group, firstKey, secondKey] = target.split(".");
  if (group === "macro") state.macro[firstKey as keyof CommandCentreState["macro"]] += magnitude;
  if (group === "resource") state.resources[firstKey as keyof CommandCentreState["resources"]] += magnitude;
  if (group === "sector" && secondKey) state.sectors[firstKey as SectorKey][secondKey as keyof CommandCentreState["sectors"][SectorKey]] += magnitude;
}

function normaliseState(state: CommandCentreState): CommandCentreState {
  const next = structuredClone(state);
  for (const [key, bounds] of Object.entries(MACRO_BOUNDS)) next.macro[key as keyof typeof next.macro] = round(clamp(next.macro[key as keyof typeof next.macro], bounds), key === "inequality" ? 3 : 1);
  next.resources.fiscalSpace = round(clamp(calculateFiscalConstraint(next.macro.debt), RESOURCE_BOUNDS.fiscalSpace));
  next.resources.politicalCapital = round(clamp(next.resources.politicalCapital, RESOURCE_BOUNDS.politicalCapital));
  next.resources.foreignReserves = round(clamp(next.resources.foreignReserves, RESOURCE_BOUNDS.foreignReserves));
  for (const sector of Object.values(next.sectors)) for (const [key, bounds] of Object.entries(SECTOR_BOUNDS)) sector[key as keyof typeof sector] = round(clamp(sector[key as keyof typeof sector], bounds));
  for (const stakeholder of Object.values(next.stakeholders) as Array<Record<string, number>>) for (const key of Object.keys(stakeholder)) stakeholder[key] = round(clamp(stakeholder[key], [0, 100]));
  return next;
}

/** Effects are queued when a policy is submitted and only reach their target in later quarters. */
export function applyPendingEffects(state: CommandCentreState): { state: CommandCentreState; applied: PendingEffect[] } {
  const next = structuredClone(state); const remaining: PendingEffect[] = []; const applied: PendingEffect[] = [];
  for (const effect of next.pendingEffects) {
    if (effect.rounds_remaining > 1) remaining.push({ ...effect, rounds_remaining: effect.rounds_remaining - 1 });
    else {
      addTarget(next, effect.target_metric, effect.magnitude); applied.push(effect);
      if (effect.duration > 1) remaining.push({ ...effect, id: `${effect.id}-continued`, rounds_remaining: 1, duration: effect.duration - 1 });
    }
  }
  next.pendingEffects = remaining;
  return { state: normaliseState(next), applied };
}

function queued(source: string, target: PendingTarget, magnitude: number, explanation: string, duration = 1): PendingEffect {
  return { id: `${source}-${target}-${Math.abs(magnitude)}-${duration}`, source_policy: source, target_metric: target, magnitude: round(magnitude, 3), rounds_remaining: 1, duration, explanation };
}

function sectorDelta(state: CommandCentreState, key: SectorKey, values: Partial<CommandCentreState["sectors"][SectorKey]>) {
  for (const [metric, amount] of Object.entries(values)) state.sectors[key][metric as keyof CommandCentreState["sectors"][SectorKey]] += amount ?? 0;
}

function applyPolicyPackage(state: CommandCentreState, policy: PolicyPackage): { state: CommandCentreState; scheduled: PendingEffect[]; mechanisms: string[] } {
  const next = structuredClone(state); const scheduled: PendingEffect[] = []; const mechanisms: string[] = [];
  const allocation = policy.allocation;
  const execution = 0.58 + next.resources.politicalCapital / 250;
  const capacity = next.resources.fiscalSpace / 100;
  const rateMove = policy.interestRate - next.lastPolicy.interestRate;
  const taxMove = policy.businessTaxRate - next.lastPolicy.businessTaxRate;
  const fiscalSpend = allocation.infrastructure + allocation.welfare + allocation.energySupport + allocation.greenTransition;
  const politicalCost = policyCapitalCost(policy, next.lastPolicy);

  next.resources.politicalCapital -= politicalCost;
  next.macro.debt += fiscalSpend * 0.026 * capacity - allocation.fiscalReserve * 0.012;
  next.resources.foreignReserves += allocation.fiscalReserve * 0.08;

  // Interest-rate changes begin through finance and confidence now, then work through demand next quarter.
  next.stakeholders.firms.investment_intention -= rateMove * 3.2 * execution;
  next.sectors.technology.investment_index -= rateMove * 2.5 * execution;
  next.stakeholders.investors.confidence += rateMove * 1.4 * execution - Math.max(0, rateMove - 1) * 0.5;
  scheduled.push(queued("Interest-rate policy", "macro.inflation", rateMove * COEFFICIENTS.rateInflationDelayed * execution, "Demand and inflation effects from the interest-rate decision arrive with a one-quarter lag."));
  scheduled.push(queued("Interest-rate policy", "macro.growth", rateMove * COEFFICIENTS.rateGrowthDelayed * execution, "Borrowing-cost effects continue to influence activity after the decision quarter."));
  scheduled.push(queued("Interest-rate policy", "macro.unemployment", rateMove * 0.16 * execution, "Slower credit-sensitive activity affects labour demand with a lag."));
  mechanisms.push(`The ${policy.interestRate.toFixed(1)}% policy rate changes financing conditions immediately and schedules demand effects for next quarter.`);

  // Infrastructure supports current demand but its productivity dividend arrives later.
  next.macro.growth += allocation.infrastructure * COEFFICIENTS.infrastructureGrowthImmediate * execution * capacity;
  next.macro.unemployment -= allocation.infrastructure * 0.006 * execution * capacity;
  sectorDelta(next, "manufacturing", { output_index: allocation.infrastructure * 0.09 * execution * capacity, employment_index: allocation.infrastructure * 0.06 * execution });
  sectorDelta(next, "services", { output_index: allocation.infrastructure * 0.045 * execution });
  scheduled.push(queued("Infrastructure allocation", "macro.productivity", allocation.infrastructure * 0.1 * execution * capacity, "Infrastructure improves productive capacity after project delivery.", 2));
  scheduled.push(queued("Infrastructure allocation", "sector.manufacturing.output_index", allocation.infrastructure * 0.16 * execution * capacity, "Completed infrastructure supports manufacturing output in later quarters."));

  // Welfare protects current household welfare but intentionally has no direct long-run productivity effect.
  next.stakeholders.households.purchasing_power += allocation.welfare * COEFFICIENTS.welfarePurchasingPower * execution;
  next.stakeholders.households.confidence += allocation.welfare * 0.075 * execution;
  next.macro.inequality += allocation.welfare * COEFFICIENTS.welfareInequality * execution;
  next.macro.approval += allocation.welfare * 0.055 * execution;
  next.macro.growth += allocation.welfare * 0.007 * execution * capacity;

  // Energy support is stronger during the shock, but broad support worsens emissions and dependency pressure.
  const energyMultiplier = next.activeShockIds.includes("global-energy-shock") ? 1.45 : 1;
  next.macro.inflation -= allocation.energySupport * COEFFICIENTS.energySupportInflation * energyMultiplier * execution;
  next.stakeholders.households.cost_of_living_pressure -= allocation.energySupport * 0.13 * energyMultiplier * execution;
  next.stakeholders.firms.cost_pressure -= allocation.energySupport * 0.1 * energyMultiplier * execution;
  next.macro.approval += allocation.energySupport * 0.065 * execution;
  next.macro.emissions += allocation.energySupport * 0.032 * execution;
  next.sectors.energy.energy_dependency += allocation.energySupport * 0.045;

  // Green investment is costly today and deliberately cannot fully neutralise the current shock.
  sectorDelta(next, "energy", { investment_index: allocation.greenTransition * 0.12 * execution, confidence: allocation.greenTransition * 0.035 * execution });
  next.macro.emissions -= allocation.greenTransition * 0.018 * execution;
  scheduled.push(queued("Green transition", "macro.emissions", allocation.greenTransition * COEFFICIENTS.greenEmissionsDelayed * execution * capacity, "Green capital reduces emissions after projects are operational.", 2));
  scheduled.push(queued("Green transition", "sector.energy.energy_dependency", allocation.greenTransition * COEFFICIENTS.greenDependencyDelayed * execution * capacity, "Diversified energy capacity lowers imported-energy dependence next quarter.", 2));
  scheduled.push(queued("Green transition", "macro.productivity", allocation.greenTransition * 0.065 * execution, "Green technology spillovers gradually lift productivity."));

  // Business-tax changes trade revenue against retained earnings, hiring and investment.
  next.macro.debt -= taxMove * COEFFICIENTS.taxDebt * execution;
  next.stakeholders.firms.investment_intention -= taxMove * COEFFICIENTS.taxInvestment * execution;
  next.stakeholders.firms.business_confidence -= taxMove * 0.48 * execution;
  next.sectors.manufacturing.investment_index -= taxMove * 0.55 * execution;
  next.sectors.technology.investment_index -= taxMove * 0.68 * execution;
  next.macro.inequality -= taxMove * 0.00028 * execution;
  mechanisms.push(`The ${policy.businessTaxRate}% business-tax setting changes fiscal revenue and retained earnings for investment.`);

  next.pendingEffects = [...next.pendingEffects, ...scheduled];
  next.lastPolicy = structuredClone(policy);
  return { state: normaliseState(next), scheduled, mechanisms };
}

function reconcileEconomy(state: CommandCentreState): CommandCentreState {
  const next = structuredClone(state);
  const { macro } = next;
  sectorDelta(next, "manufacturing", { output_index: macro.growth * 0.18 - macro.inflation * 0.05, employment_index: macro.growth * 0.1 - macro.unemployment * 0.04 });
  sectorDelta(next, "technology", { output_index: macro.productivity * 0.035 - macro.inflation * 0.03, confidence: next.stakeholders.investors.confidence * 0.025 - 1.5 });
  sectorDelta(next, "services", { output_index: next.stakeholders.households.purchasing_power * 0.025 + macro.growth * 0.1 - 2.5, employment_index: next.stakeholders.households.employment_security * 0.02 - 1.2 });
  next.stakeholders.households.confidence += (macro.growth - 1.4) * 1.1 - (macro.inflation - 5.2) * 0.8 - (macro.unemployment - 6.8) * 1.0;
  next.stakeholders.households.employment_security += (6.8 - macro.unemployment) * 1.7;
  next.stakeholders.firms.business_confidence += (macro.growth - 1.4) * 1.4 - (next.stakeholders.firms.cost_pressure - 60) * 0.12 + (next.resources.foreignReserves - 100) * 0.04;
  next.stakeholders.firms.hiring_intention += (macro.growth - 1.4) * 1.3 - (macro.unemployment - 6.8) * 0.45;
  next.stakeholders.investors.confidence += (next.resources.foreignReserves - 100) * 0.08 - (macro.debt - 72) * 0.09 - (macro.inflation - 5.2) * 0.24;
  next.stakeholders.investors.debt_concern += (macro.debt - 72) * 0.18;
  next.stakeholders.investors.inflation_expectation += (macro.inflation - 5.2) * 0.3;
  return normaliseState(next);
}

/**
 * Advances the reusable domestic engine. League world clearing passes
 * `scheduledShock: null` because its globally coordinated shock is applied
 * once before all countries are processed; standalone Command Centre keeps
 * its existing deterministic quarterly shocks by default.
 */
export function advanceQuarter(state: CommandCentreState, policy: PolicyPackage, options?: { scheduledShock?: ShockRecord | null }): AdvanceQuarterResult {
  if (state.completed) throw new Error("Completed runs cannot advance further.");
  assertPolicyPackage(policy);
  const stateBefore = structuredClone(state); const roundNumber = state.quarter;
  const pending = applyPendingEffects(state); const shock = options?.scheduledShock === undefined ? shockForQuarter(roundNumber) : options.scheduledShock;
  const shocked = applyShock(pending.state, shock); const appliedPolicy = applyPolicyPackage(shocked, policy);
  const interaction = applyPolicyInteractions(appliedPolicy.state, policy, stateBefore.lastPolicy);
  const withInteractions = structuredClone(appliedPolicy.state);
  for (const [key, value] of Object.entries(interaction.macro)) withInteractions.macro[key as keyof typeof withInteractions.macro] += value ?? 0;
  for (const [key, value] of Object.entries(interaction.resource)) withInteractions.resources[key as keyof typeof withInteractions.resources] += value ?? 0;
  withInteractions.coherencePenalty += interaction.coherencePenalty;
  const reconciled = reconcileEconomy(normaliseState(withInteractions));
  reconciled.quarter = (roundNumber < 3 ? roundNumber + 1 : 3) as Quarter;
  reconciled.completed = roundNumber === 3;
  const scoreSnapshot = calculateScores(reconciled);
  const explanation = generateDeterministicExplanation({ before: stateBefore, after: reconciled, policy, shock, appliedPending: pending.applied, interactions: [...appliedPolicy.mechanisms, ...interaction.mechanisms, ...interaction.sectorNotes] });
  return { roundNumber, stateBefore, stateAfter: reconciled, policy, shock, appliedPendingEffects: pending.applied, scheduledEffects: appliedPolicy.scheduled, explanation, scoreSnapshot };
}

export function recommendedPolicyForState(state: CommandCentreState): PolicyPackage {
  const allocation: FiscalAllocation = state.macro.inflation > 6 ? { infrastructure: 22, welfare: 28, energySupport: 22, greenTransition: 18, fiscalReserve: 10 } : { infrastructure: 28, welfare: 24, energySupport: 16, greenTransition: 22, fiscalReserve: 10 };
  return { interestRate: state.macro.inflation > 6 ? 5.5 : 4.5, businessTaxRate: state.macro.debt > 85 ? 26 : 25, allocation };
}
