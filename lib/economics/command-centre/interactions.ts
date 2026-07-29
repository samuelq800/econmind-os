import type { CommandCentreState, PolicyPackage } from "./types.ts";

export type InteractionOutcome = { coherencePenalty: number; macro: Partial<CommandCentreState["macro"]>; resource: Partial<CommandCentreState["resources"]>; sectorNotes: string[]; mechanisms: string[] };

/** Policy-combination rules stay separate from UI controls so every mode uses the same logic. */
export function applyPolicyInteractions(state: CommandCentreState, policy: PolicyPackage, previousPolicy = state.lastPolicy): InteractionOutcome {
  const { allocation } = policy;
  const rateRise = policy.interestRate - previousPolicy.interestRate;
  const taxCut = policy.businessTaxRate < 23;
  const highSpending = allocation.fiscalReserve <= 8 && allocation.infrastructure + allocation.welfare + allocation.energySupport >= 70;
  const lowGreen = allocation.greenTransition < 15;
  const highEnergySupport = allocation.energySupport >= 30;
  const targetedWelfare = allocation.welfare >= 24 && allocation.energySupport <= 28;
  const fiscalReserve = allocation.fiscalReserve >= 20;
  const mechanisms: string[] = [];
  const sectorNotes: string[] = [];
  let coherencePenalty = 0;
  const macro: InteractionOutcome["macro"] = {};
  const resource: InteractionOutcome["resource"] = {};

  if (rateRise >= 1 && highSpending) {
    coherencePenalty += 12; macro.growth = -0.25; macro.inflation = -0.12;
    mechanisms.push("Tighter monetary policy offsets part of the fiscal demand boost while debt pressure still rises.");
    sectorNotes.push("Higher financing costs constrain technology and manufacturing investment despite fiscal expansion.");
  }
  if (rateRise >= 0.5 && targetedWelfare) {
    coherencePenalty += 1; macro.approval = (macro.approval ?? 0) + 1.1;
    mechanisms.push("Targeted welfare cushions vulnerable households while monetary restraint addresses inflation, avoiding a broad demand contradiction.");
  }
  if (highEnergySupport && lowGreen) {
    coherencePenalty += 9; macro.emissions = (macro.emissions ?? 0) + 1.4; resource.foreignReserves = (resource.foreignReserves ?? 0) - 1.4;
    mechanisms.push("High energy support protects current bills but weakens conservation and leaves energy-import dependence exposed.");
  }
  if (highEnergySupport && allocation.greenTransition >= 25) {
    coherencePenalty += 4; macro.approval = (macro.approval ?? 0) + 0.7;
    mechanisms.push("Energy support and transition investment protect households now while building resilience later, at a material fiscal cost.");
  }
  if (taxCut && highSpending) {
    coherencePenalty += 13; macro.debt = (macro.debt ?? 0) + 2.1; resource.foreignReserves = (resource.foreignReserves ?? 0) - 1.2;
    mechanisms.push("A business-tax cut combined with high spending supports confidence but compounds the deficit and investor debt concern.");
  }
  if (rateRise >= 0.5 && fiscalReserve) {
    coherencePenalty += 0; resource.foreignReserves = (resource.foreignReserves ?? 0) + 1.6; macro.inflation = (macro.inflation ?? 0) - 0.18;
    mechanisms.push("Monetary restraint plus a fiscal reserve supports inflation credibility and external resilience, with a growth cost.");
  }
  if (rateRise >= 1 && allocation.infrastructure + allocation.welfare <= 25) {
    coherencePenalty += 10; macro.unemployment = (macro.unemployment ?? 0) + 0.35; macro.approval = (macro.approval ?? 0) - 1.4;
    mechanisms.push("Tight money and spending restraint reinforce recession risk in an already weak economy.");
  }
  return { coherencePenalty, macro, resource, sectorNotes, mechanisms };
}
