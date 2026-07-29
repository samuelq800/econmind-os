import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, advanceQuarter, applyPendingEffects, calculateFiscalConstraint, createInitialCommandCentreState, calculateScores, isValidFiscalAllocation, recommendedPolicyForState } from "@/lib/economics/command-centre";

const policy = (overrides: Partial<typeof DEFAULT_POLICY> = {}) => ({ ...DEFAULT_POLICY, ...overrides, allocation: { ...DEFAULT_POLICY.allocation, ...(overrides.allocation ?? {}) } });

describe("Economic Command Centre engine", () => {
  it("keeps all indicators within declared ranges over the complete deterministic scenario", () => {
    let state = createInitialCommandCentreState();
    for (let round = 0; round < 3; round += 1) state = advanceQuarter(state, recommendedPolicyForState(state)).stateAfter;
    expect(state.completed).toBe(true);
    expect(state.macro.growth).toBeGreaterThanOrEqual(-8); expect(state.macro.growth).toBeLessThanOrEqual(10);
    expect(state.macro.inflation).toBeGreaterThanOrEqual(-3); expect(state.macro.inflation).toBeLessThanOrEqual(25);
    expect(state.resources.foreignReserves).toBeGreaterThanOrEqual(20);
    expect(calculateScores(state).totalScore).toBeGreaterThanOrEqual(0);
  });

  it("rejects fiscal packages that do not sum to 100", () => {
    const state = createInitialCommandCentreState();
    const invalid = policy({ allocation: { ...DEFAULT_POLICY.allocation, welfare: 26 } });
    expect(isValidFiscalAllocation(invalid.allocation)).toBe(false);
    expect(() => advanceQuarter(state, invalid)).toThrow("total exactly 100");
  });

  it("makes a rate increase lower investment immediately and inflation with a lag", () => {
    const initial = createInitialCommandCentreState();
    const raised = advanceQuarter(initial, policy({ interestRate: 6 }));
    expect(raised.stateAfter.sectors.technology.investment_index).toBeLessThan(initial.sectors.technology.investment_index);
    const lagged = applyPendingEffects(raised.stateAfter);
    expect(lagged.state.macro.inflation).toBeLessThan(raised.stateAfter.macro.inflation);
  });

  it("makes welfare improve household confidence without creating a productivity queue", () => {
    const initial = createInitialCommandCentreState();
    const welfare = advanceQuarter(initial, policy({ allocation: { infrastructure: 15, welfare: 40, energySupport: 15, greenTransition: 20, fiscalReserve: 10 } }));
    expect(welfare.stateAfter.stakeholders.households.confidence).toBeGreaterThan(initial.stakeholders.households.confidence);
    expect(welfare.scheduledEffects.some((effect) => effect.source_policy === "Welfare allocation" && effect.target_metric === "macro.productivity")).toBe(false);
  });

  it("makes energy support fiscally and environmentally costly", () => {
    const initial = createInitialCommandCentreState();
    const supported = advanceQuarter(initial, policy({ allocation: { infrastructure: 15, welfare: 15, energySupport: 45, greenTransition: 15, fiscalReserve: 10 } }));
    expect(supported.stateAfter.macro.debt).toBeGreaterThan(initial.macro.debt);
    expect(supported.stateAfter.macro.emissions).toBeGreaterThan(initial.macro.emissions);
  });

  it("queues green investment and lowers energy dependency only next quarter", () => {
    const initial = createInitialCommandCentreState();
    const green = advanceQuarter(initial, policy({ allocation: { infrastructure: 15, welfare: 15, energySupport: 15, greenTransition: 45, fiscalReserve: 10 } }));
    expect(green.scheduledEffects.some((effect) => effect.target_metric === "sector.energy.energy_dependency" && effect.magnitude < 0)).toBe(true);
    const pending = applyPendingEffects(green.stateAfter);
    expect(pending.state.sectors.energy.energy_dependency).toBeLessThanOrEqual(green.stateAfter.sectors.energy.energy_dependency);
  });

  it("makes a business-tax cut improve firm investment while weakening the fiscal path", () => {
    const initial = createInitialCommandCentreState();
    const cut = advanceQuarter(initial, policy({ businessTaxRate: 20 }));
    expect(cut.stateAfter.stakeholders.firms.investment_intention).toBeGreaterThan(initial.stakeholders.firms.investment_intention);
    expect(cut.stateAfter.macro.debt).toBeGreaterThan(initial.macro.debt);
  });

  it("applies the global energy shock exactly in quarter two", () => {
    const first = advanceQuarter(createInitialCommandCentreState(), DEFAULT_POLICY);
    const second = advanceQuarter(first.stateAfter, DEFAULT_POLICY);
    expect(second.shock?.id).toBe("global-energy-shock");
    expect(second.stateAfter.stakeholders.firms.cost_pressure).toBeGreaterThan(first.stateAfter.stakeholders.firms.cost_pressure);
    expect(second.stateAfter.macro.inflation).toBeGreaterThan(first.stateAfter.macro.inflation);
  });

  it("applies capital outflow exactly in quarter three", () => {
    const first = advanceQuarter(createInitialCommandCentreState(), DEFAULT_POLICY);
    const second = advanceQuarter(first.stateAfter, DEFAULT_POLICY);
    const third = advanceQuarter(second.stateAfter, DEFAULT_POLICY);
    expect(third.shock?.id).toBe("capital-outflow");
    expect(third.stateAfter.resources.foreignReserves).toBeLessThan(second.stateAfter.resources.foreignReserves);
    expect(third.stateAfter.stakeholders.investors.confidence).toBeLessThan(second.stateAfter.stakeholders.investors.confidence);
  });

  it("penalises incoherent tight money with high fiscal expansion but not targeted welfare", () => {
    const initial = createInitialCommandCentreState();
    const contradictory = advanceQuarter(initial, policy({ interestRate: 6, allocation: { infrastructure: 30, welfare: 25, energySupport: 20, greenTransition: 20, fiscalReserve: 5 } }));
    const targeted = advanceQuarter(initial, policy({ interestRate: 5.5, allocation: { infrastructure: 18, welfare: 30, energySupport: 18, greenTransition: 20, fiscalReserve: 14 } }));
    expect(contradictory.scoreSnapshot.scores.policyCoherence).toBeLessThan(targeted.scoreSnapshot.scores.policyCoherence);
  });

  it("lets debt reduce effective fiscal space without changing the nominal 100-point allocation", () => {
    expect(calculateFiscalConstraint(72)).toBe(100);
    expect(calculateFiscalConstraint(120)).toBeLessThan(100);
    expect(calculateFiscalConstraint(220)).toBe(65);
  });

  it("locks a completed run against further advancement", () => {
    let state = createInitialCommandCentreState();
    state = advanceQuarter(state, DEFAULT_POLICY).stateAfter;
    state = advanceQuarter(state, DEFAULT_POLICY).stateAfter;
    state = advanceQuarter(state, DEFAULT_POLICY).stateAfter;
    expect(() => advanceQuarter(state, DEFAULT_POLICY)).toThrow("Completed runs");
  });
});
