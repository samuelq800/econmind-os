import type { CommandCentreState, Quarter, ShockRecord } from "./types.ts";

export function shockForQuarter(quarter: Quarter): ShockRecord | null {
  if (quarter === 2) return { id: "global-energy-shock", title: "Global Energy Shock", description: "Global oil prices rise by 40% following a major supply disruption.", mechanisms: ["Imported energy costs raise production and transport prices.", "Household purchasing power falls as energy bills increase.", "Manufacturing and energy sectors face the strongest cost and confidence pressure."] };
  if (quarter === 3) return { id: "capital-outflow", title: "Capital Outflow", description: "Foreign investors begin withdrawing capital amid concerns about inflation and public debt.", mechanisms: ["Capital withdrawal weakens foreign reserves and exchange-rate resilience.", "Higher borrowing risk reduces technology and business investment.", "Currency pressure adds to imported inflation and debt-service concerns."] };
  return null;
}

export function applyShock(state: CommandCentreState, shock: ShockRecord | null): CommandCentreState {
  if (!shock) return state;
  const next = structuredClone(state);
  next.activeShockIds = [...next.activeShockIds, shock.id];
  if (shock.id === "global-energy-shock") {
    next.macro.inflation += 1.7; next.macro.growth -= 1.05; next.macro.unemployment += 0.35; next.macro.approval -= 3.6; next.macro.emissions += 0.8;
    next.resources.foreignReserves -= 5.2;
    next.sectors.manufacturing.confidence -= 9; next.sectors.manufacturing.investment_index -= 8; next.sectors.manufacturing.output_index -= 5;
    next.sectors.energy.confidence -= 10; next.sectors.energy.energy_dependency += 8; next.sectors.energy.emissions_index += 7;
    next.stakeholders.households.purchasing_power -= 8; next.stakeholders.households.cost_of_living_pressure += 11;
    next.stakeholders.firms.cost_pressure += 12; next.stakeholders.firms.business_confidence -= 7;
    next.stakeholders.investors.confidence -= 4; next.stakeholders.investors.inflation_expectation += 7;
  } else {
    next.macro.inflation += 0.75; next.macro.growth -= 0.65; next.macro.debt += 1.3;
    next.resources.foreignReserves -= 10;
    next.sectors.technology.investment_index -= 11; next.sectors.technology.confidence -= 9; next.sectors.manufacturing.investment_index -= 4;
    next.stakeholders.investors.confidence -= 15; next.stakeholders.investors.capital_flow_pressure += 18; next.stakeholders.investors.debt_concern += 11;
    next.stakeholders.firms.investment_intention -= 7; next.stakeholders.firms.business_confidence -= 5;
  }
  return next;
}
