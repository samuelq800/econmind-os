import { describe, expect, it } from "vitest";
import { calculatePriceControl, DEFAULT_PRICE_CONTROLS } from "../lib/economics/price-controls";
import { BASELINE_INDICATORS, BASELINE_PARAMETERS, INDICATOR_LIMITS } from "../lib/economics/sandbox/defaults";
import { clampValue, sanitizeParameters, simulateSandbox } from "../lib/economics/sandbox/simulation";
import { recommendNext } from "../lib/recommendations";

describe("price controls", () => {
  it("calculates a binding price ceiling", () => {
    expect(calculatePriceControl(DEFAULT_PRICE_CONTROLS)).toMatchObject({
      valid: true,
      binding: true,
      equilibriumPrice: 20,
      equilibriumQuantity: 60,
      controlledPrice: 15,
      quantityDemanded: 70,
      quantitySupplied: 50,
      quantityTraded: 50,
      shortage: 20,
      deadweightLoss: 50,
    });
  });

  it("calculates a binding price floor", () => {
    expect(calculatePriceControl({ ...DEFAULT_PRICE_CONTROLS, controlType: "floor", controlPrice: 25 })).toMatchObject({
      valid: true,
      binding: true,
      quantityTraded: 50,
      surplus: 20,
      deadweightLoss: 50,
    });
  });

  it("keeps a non-binding control at market equilibrium", () => {
    expect(calculatePriceControl({ ...DEFAULT_PRICE_CONTROLS, controlPrice: 25 })).toMatchObject({
      binding: false,
      controlledPrice: 20,
      quantityTraded: 60,
      deadweightLoss: 0,
    });
  });

  it("rejects a zero slope", () => {
    expect(calculatePriceControl({ ...DEFAULT_PRICE_CONTROLS, demandSlope: 0 }).valid).toBe(false);
  });
});

describe("economic sandbox", () => {
  it("returns the standardized baseline", () => {
    expect(simulateSandbox(BASELINE_PARAMETERS).indicators).toEqual(BASELINE_INDICATORS);
  });

  it("keeps extreme input finite and inside every indicator clamp", () => {
    const result = simulateSandbox({
      incomeTaxRate: Number.POSITIVE_INFINITY,
      corporateTaxRate: -999,
      governmentSpending: 9999,
      subsidyRate: 9999,
      interestRate: 9999,
      moneySupplyGrowth: 9999,
      minimumWage: 9999,
      priceCeiling: 9999,
      priceFloor: 9999,
      carbonTax: 9999,
      greenSubsidy: 9999,
      tariffRate: 9999,
      importQuotaIntensity: 9999,
    });
    for (const [key, value] of Object.entries(result.indicators)) {
      const [minimum, maximum] = INDICATOR_LIMITS[key as keyof typeof INDICATOR_LIMITS];
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(minimum);
      expect(value).toBeLessThanOrEqual(maximum);
    }
  });

  it("clamps invalid policy input back to safe bounds", () => {
    const parameters = sanitizeParameters({ interestRate: Number.NaN, carbonTax: -100, tariffRate: 999 });
    expect(parameters.interestRate).toBe(0);
    expect(parameters.carbonTax).toBe(0);
    expect(parameters.tariffRate).toBe(60);
    expect(clampValue(Number.NaN, 5, 10)).toBe(5);
  });

  it("moves green-transition indicators in consistent directions", () => {
    const result = simulateSandbox({ ...BASELINE_PARAMETERS, carbonTax: 50, greenSubsidy: 20 });
    expect(result.indicators.carbonEmissions).toBeLessThan(100);
    expect(result.indicators.governmentRevenue).toBeGreaterThan(100);
  });
});

describe("recommendations", () => {
  it("recommends the foundation model for empty progress", () => {
    expect(recommendNext([])[0].model.slug).toBe("supply-demand");
  });

  it("uses completion rules without recommending a completed model", () => {
    const recommendations = recommendNext(["supply-demand"]);
    expect(recommendations.map((item) => item.model.slug)).toEqual(["policy", "price-controls", "elasticity"]);
  });
});
