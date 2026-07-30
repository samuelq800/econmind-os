import { describe, expect, it } from "vitest";
import { advanceContinuousWorld, clearContinuousMarket, policyLifecycleWeight, type CalibratedPolicyDefinition, type ContinuousPolicyAction, type ContinuousWorldState } from "@/lib/economics/continuous-world";

const definition: CalibratedPolicyDefinition = { id: "policy-rate", allowed_range: [-800, 1200], implementation_lag_days: [1, 7], ramp_days: [2, 14], peak_days: [10, 30], decay_half_life_days: [20, 90], max_duration_days: 365, effects_per_impulse: { inflation_pp: [-0.2, -0.1, 0] } };
const state: ContinuousWorldState = { worldId: "world", calibrationVersion: "0.1.0", lastProcessedAt: "2026-01-01T00:00:00.000Z", stateVersion: 1, countries: [{ id: "a", baseline: {}, outcomes: {} }], markets: [{ id: "energy", price: 100, priceFloor: 50, priceCeiling: 150, supply: 80, demand: 120, inventoryDays: 10, stockFloorDays: 5, kappa: 0.15 }] };
const action: ContinuousPolicyAction = { id: "action", countryId: "a", policyId: "policy-rate", change: 1, startsAt: "2026-01-01T00:00:00.000Z", status: "active" };

describe("continuous world engine", () => {
  it("is a no-op for a repeated processing timestamp", () => {
    expect(advanceContinuousWorld(state, [action], { [definition.id]: definition }, state.lastProcessedAt)).toEqual({ state, appliedEffects: [], processedDays: 0 });
  });

  it("advances proportionally during sub-day server ticks", () => {
    const result = advanceContinuousWorld(state, [], { [definition.id]: definition }, "2026-01-01T01:00:00.000Z");
    expect(result.processedDays).toBeCloseTo(1 / 24);
    expect(result.state.stateVersion).toBe(2);
    expect(result.state.markets[0].price).not.toBe(100);
  });

  it("respects the implementation lag and then applies the central effect", () => {
    expect(policyLifecycleWeight(definition, action, "2026-01-01T00:00:00.000Z")).toBe(0);
    const result = advanceContinuousWorld(state, [action], { [definition.id]: definition }, "2026-01-04T00:00:00.000Z");
    expect(result.appliedEffects).toHaveLength(1);
    expect(result.state.countries[0].outcomes.inflation_pp).toBeLessThan(0);
  });

  it("never lets a market price cross its calibrated guardrails", () => {
    const cleared = clearContinuousMarket({ ...state.markets[0], demand: 1_000_000 });
    expect(cleared.price).toBeLessThanOrEqual(150);
    expect(cleared.inventoryDays).toBeGreaterThanOrEqual(0);
  });

  it("ignores policy changes outside the calibrated range", () => {
    const result = advanceContinuousWorld(state, [{ ...action, change: 1201 }], { [definition.id]: definition }, "2026-01-04T00:00:00.000Z");
    expect(result.appliedEffects).toHaveLength(0);
  });
});
