import { describe, expect, it } from "vitest";
import { CRISIS_INITIAL_METRICS, applyCrisisRound, applyOilPriceShock, buildCrisisReflection, calculateCrisisScores } from "@/lib/league/crisis-engine";

describe("Crisis Sprint rule engine", () => {
  it("keeps a rate rise directionally disinflationary but weaker for activity", () => {
    const result = applyCrisisRound(CRISIS_INITIAL_METRICS, { monetary: "raise", fiscal: "maintain", energy: "none" }, false);
    expect(result.metrics.inflation).toBeLessThan(CRISIS_INITIAL_METRICS.inflation);
    expect(result.metrics.growth).toBeLessThan(CRISIS_INITIAL_METRICS.growth);
    expect(result.metrics.unemployment).toBeGreaterThan(CRISIS_INITIAL_METRICS.unemployment);
  });

  it("makes broad subsidy more fiscally costly and more protective than targeted support", () => {
    const targeted = applyCrisisRound(CRISIS_INITIAL_METRICS, { monetary: "hold", fiscal: "maintain", energy: "targeted" }, true);
    const broad = applyCrisisRound(CRISIS_INITIAL_METRICS, { monetary: "hold", fiscal: "maintain", energy: "broad" }, true);
    expect(broad.metrics.debt).toBeGreaterThan(targeted.metrics.debt);
    expect(broad.metrics.approval).toBeGreaterThan(targeted.metrics.approval);
    expect(broad.metrics.emissions).toBeGreaterThan(targeted.metrics.emissions);
  });

  it("applies the oil shock without resetting the existing economy", () => {
    const firstRound = applyCrisisRound(CRISIS_INITIAL_METRICS, { monetary: "cut", fiscal: "increase", energy: "targeted" }, false).metrics;
    const shocked = applyOilPriceShock(firstRound).metrics;
    expect(shocked.inflation).toBeGreaterThan(firstRound.inflation);
    expect(shocked.growth).toBeLessThan(firstRound.growth);
    expect(shocked.debt).toBeGreaterThan(firstRound.debt);
  });

  it("scores all six dimensions and returns a bounded total", () => {
    const outcome = calculateCrisisScores(CRISIS_INITIAL_METRICS);
    expect(Object.keys(outcome.scores)).toHaveLength(6);
    expect(outcome.totalScore).toBeGreaterThanOrEqual(0);
    expect(outcome.totalScore).toBeLessThanOrEqual(100);
  });

  it("writes a deterministic reflection from choices and outcomes", () => {
    const reflection = buildCrisisReflection(CRISIS_INITIAL_METRICS, [{ monetary: "raise", fiscal: "reduce", energy: "targeted" }]);
    expect(reflection.strongestDecision.length).toBeGreaterThan(20);
    expect(reflection.unintendedConsequence.length).toBeGreaterThan(20);
  });
});
