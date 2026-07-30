import { describe, expect, it } from "vitest";
import { checkEconBenchCondition } from "@/components/learning/econbench-lab";
import { FINAL_WORLD_TEACHING, asArray, asRecord } from "@/lib/economics/final-world-teaching/catalog";

describe("learning-system presets", () => {
  it("keeps every EconBench challenge fully prescribed", () => {
    const challenges = asArray<Record<string, unknown>>(asRecord(FINAL_WORLD_TEACHING.econbenchScenarioLibrary).challenges);
    expect(challenges).toHaveLength(10);
    for (const challenge of challenges) {
      expect(asArray(asRecord(challenge.accept).all).length).toBeGreaterThan(1);
      expect(Object.keys(asRecord(challenge.adjustable)).length).toBeGreaterThan(0);
      expect(asArray(challenge.model_options).length).toBeGreaterThan(0);
    }
  });

  it("grades model, range, interpretation and OR conditions deterministically", () => {
    const models = ["supply_shock_ad_as", "public_debt_dynamics"];
    const values = { policy_rate_change_pp: 1, revenue_measure_gdp_pct: 0.2, debt_restructuring_haircut_pct: 12 };
    const claims = { "states short-run balance can worsen": true };
    expect(checkEconBenchCondition("select supply_shock_ad_as", models, values, claims)).toBe(true);
    expect(checkEconBenchCondition("policy_rate_change_pp between 0.5 and 2.0", models, values, claims)).toBe(true);
    expect(checkEconBenchCondition("revenue_measure_gdp_pct >= 0.5 OR debt_restructuring_haircut_pct >= 10", models, values, claims)).toBe(true);
    expect(checkEconBenchCondition("states short-run balance can worsen", models, values, claims)).toBe(true);
    expect(checkEconBenchCondition("policy_rate_change_pp >= 2", models, values, claims)).toBe(false);
  });

  it("retains the promised ten mechanisms, three read-only evidence projects and 37 practice bindings", () => {
    expect(asArray(asRecord(FINAL_WORLD_TEACHING.mechanismArenaScenarios).scenarios)).toHaveLength(10);
    expect(asArray(asRecord(FINAL_WORLD_TEACHING.evidenceLabProjects).projects)).toHaveLength(3);
    expect(asArray(asRecord(FINAL_WORLD_TEACHING.extendedPracticeQuestionBank).model_bindings)).toHaveLength(37);
  });
});
