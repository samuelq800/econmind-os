import { describe, expect, it } from "vitest";
import { ECONOMIC_CASES, CASE_BY_SLUG } from "@/lib/cases/definitions";
import { defaultCaseSettings, evaluateCase, runCaseSimulation } from "@/lib/cases/adapters";
import { calculateFoodWaste, DEFAULT_FOOD_WASTE } from "@/lib/economics/food-waste";

describe("restaurant food-waste engine", () => {
  it("returns a valid, finite baseline outcome", () => {
    const outcome = calculateFoodWaste(DEFAULT_FOOD_WASTE);
    expect(outcome).toMatchObject({ valid: true });
    expect(outcome.expectedSales).toBeGreaterThan(0);
    expect(outcome.expectedWaste).toBeGreaterThanOrEqual(0);
    expect(outcome.expectedShortage).toBeGreaterThanOrEqual(0);
    expect(outcome.serviceLevel).toBeGreaterThan(0);
  });

  it("makes extra preparation trade lower shortages for higher expected waste", () => {
    const low = calculateFoodWaste({ ...DEFAULT_FOOD_WASTE, inventoryLevel: 80 });
    const high = calculateFoodWaste({ ...DEFAULT_FOOD_WASTE, inventoryLevel: 160 });
    expect(high.expectedWaste).toBeGreaterThan(low.expectedWaste);
    expect(high.expectedShortage).toBeLessThan(low.expectedShortage);
  });

  it("rejects invalid percentage inputs", () => {
    expect(calculateFoodWaste({ ...DEFAULT_FOOD_WASTE, forecastAccuracy: 101 })).toMatchObject({ valid: false });
  });

  it("keeps insurance scoped to modelled eligible losses", () => {
    const noCover = calculateFoodWaste({ ...DEFAULT_FOOD_WASTE, insuranceCoverage: 0 });
    const cover = calculateFoodWaste({ ...DEFAULT_FOOD_WASTE, insuranceCoverage: 100, claimThreshold: 0 });
    expect(cover.expectedClaim).toBeGreaterThanOrEqual(noCover.expectedClaim);
    expect(cover.insurancePremiumCost).toBeGreaterThan(noCover.insurancePremiumCost);
  });
});

describe("real-world case adapters", () => {
  it("contains the six required published cases", () => {
    expect(ECONOMIC_CASES.map((item) => item.slug)).toEqual(["oil-price-shock", "carbon-tax", "housing-rent-control", "minimum-wage", "tariff-conflict", "restaurant-food-waste"]);
  });

  it("runs each adapter locally and exposes equations and limits", () => {
    for (const definition of ECONOMIC_CASES) {
      const result = runCaseSimulation(definition, defaultCaseSettings(definition));
      expect(result.valid, definition.slug).toBe(true);
      expect(result.equations.length, definition.slug).toBeGreaterThan(1);
      expect(result.mechanism.length, definition.slug).toBeGreaterThan(2);
      expect(result.assumptions.length, definition.slug).toBeGreaterThan(0);
      expect(result.limitations.length, definition.slug).toBeGreaterThan(0);
    }
  });

  it("evaluates with visible weights rather than a hidden policy answer", () => {
    const definition = CASE_BY_SLUG["carbon-tax"];
    const result = runCaseSimulation(definition, defaultCaseSettings(definition));
    const evaluation = evaluateCase(definition, result, { efficiency: 100, equity: 0, fiscal: 0 });
    expect(evaluation.score).toBe(evaluation.dimensionScores.efficiency);
    expect(evaluation.explanation).toContain("not an objective policy ranking");
  });
});
