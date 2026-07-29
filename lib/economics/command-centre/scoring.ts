import { clamp, round } from "./constraints.ts";
import type { CommandCentreResultType, CommandCentreScores, CommandCentreState, ScoreKey } from "./types.ts";

export const SCORE_WEIGHTS: Record<ScoreKey, number> = { macroeconomicStability: 0.18, growthProductivity: 0.15, employment: 0.12, fiscalSustainability: 0.15, socialWelfare: 0.15, environmentalTransition: 0.1, crisisResilience: 0.1, policyCoherence: 0.05 };
const bounded = (value: number) => round(clamp(value, [0, 100]));

export function calculateScores(state: CommandCentreState, coherencePenalty = state.coherencePenalty): { scores: CommandCentreScores; totalScore: number; resultType: CommandCentreResultType } {
  const { macro, resources, stakeholders, sectors } = state;
  const scores: CommandCentreScores = {
    macroeconomicStability: bounded(100 - Math.abs(macro.inflation - 2.5) * 7.8 - Math.abs(macro.growth - 2.5) * 6.4),
    growthProductivity: bounded(58 + macro.growth * 9 + (macro.productivity - 100) * 1.1 + (sectors.technology.investment_index - 100) * 0.22),
    employment: bounded(100 - Math.max(0, macro.unemployment - 4) * 8.2 + (sectors.services.employment_index - 100) * 0.12),
    fiscalSustainability: bounded(100 - Math.max(0, macro.debt - 55) * 0.72 + resources.fiscalSpace * 0.18 + resources.foreignReserves * 0.08 - 8),
    socialWelfare: bounded(stakeholders.households.confidence * 0.28 + stakeholders.households.purchasing_power * 0.28 + (100 - stakeholders.households.cost_of_living_pressure) * 0.18 + macro.approval * 0.26),
    environmentalTransition: bounded(100 - Math.max(0, macro.emissions - 70) * 0.75 + (100 - sectors.energy.energy_dependency) * 0.3),
    crisisResilience: bounded(resources.foreignReserves * 0.3 + resources.politicalCapital * 0.18 + (100 - Math.max(0, macro.debt - 45)) * 0.18 + (100 - sectors.energy.energy_dependency) * 0.16 + stakeholders.investors.confidence * 0.18),
    policyCoherence: bounded(86 - coherencePenalty - Math.max(0, 35 - resources.politicalCapital) * 0.55),
  };
  const totalScore = round(Object.entries(SCORE_WEIGHTS).reduce((total, [key, weight]) => total + scores[key as ScoreKey] * weight, 0));
  const resultType: CommandCentreResultType = totalScore < 36 ? "Crisis Mismanagement"
    : scores.environmentalTransition >= 78 && scores.crisisResilience >= 65 ? "Green Transition Leader"
    : scores.macroeconomicStability >= 78 && scores.growthProductivity < 58 ? "Inflation Fighter"
    : scores.growthProductivity >= 78 && scores.fiscalSustainability < 52 ? "Growth at All Costs"
    : scores.socialWelfare >= 78 && scores.fiscalSustainability < 55 ? "Socially Protective"
    : scores.fiscalSustainability >= 80 && scores.growthProductivity < 58 ? "Fiscal Conservative"
    : macro.approval >= 72 && scores.crisisResilience < 52 ? "Politically Popular but Fragile"
    : scores.macroeconomicStability >= 68 && scores.growthProductivity < 60 ? "Stable but Stagnant"
    : "Balanced and Resilient";
  return { scores, totalScore, resultType };
}
