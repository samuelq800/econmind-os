import { describe, expect, it } from "vitest";
import { calculateElasticity } from "../lib/economics/elasticity";
import {
  calculatePolicyOutcome,
  incidencePattern,
  policyEquationSteps,
  policyExplanation,
  type PolicyParameters,
} from "../lib/economics/policy";
import {
  calculateMarketEquilibrium,
  DEFAULT_MARKET,
  marketEquationSteps,
} from "../lib/economics/supply-demand";

const policy = (overrides: Partial<PolicyParameters> = {}): PolicyParameters => ({
  ...DEFAULT_MARKET,
  wedge: 10,
  ...overrides,
});

describe("economic model calculations", () => {
  it("solves the default equilibrium", () => {
    expect(calculateMarketEquilibrium(DEFAULT_MARKET)).toMatchObject({ price: 20, quantity: 60, valid: true });
  });

  it("solves a tax", () => {
    expect(calculatePolicyOutcome(policy())).toMatchObject({ consumerPrice: 25, producerPrice: 15, quantity: 50, governmentBalance: 500, deadweightLoss: 50 });
  });

  it("solves a subsidy", () => {
    expect(calculatePolicyOutcome(policy({ wedge: -10 }))).toMatchObject({ consumerPrice: 15, producerPrice: 25, quantity: 70, governmentBalance: -700 });
  });

  it("finds unit elasticity at maximum revenue", () => {
    expect(calculateElasticity({ demandIntercept: 100, demandSlope: 2, price: 25 })).toMatchObject({ quantity: 50, elasticity: 1, totalRevenue: 1250, classification: "Approximately unit elastic" });
  });
});

describe("tax and subsidy interpretation branches", () => {
  it("describes no-policy and infeasible-policy branches", () => {
    expect(policyExplanation(policy({ wedge: 0 }))).toContain("no tax or subsidy");
    expect(policyExplanation(policy({ wedge: 100 }))).toContain("too large for a feasible");
  });

  it("describes equal tax incidence as an equal tax burden", () => {
    const outcome = calculatePolicyOutcome(policy());
    expect(incidencePattern(outcome)).toBe("equal");
    expect(policyExplanation(policy())).toContain("tax burden is split equally");
    expect(policyExplanation(policy())).toContain("buyers pay 5 more");
  });

  it("describes a consumer-majority tax burden", () => {
    const parameters = policy({ demandSlope: 1, supplySlope: 3 });
    expect(incidencePattern(calculatePolicyOutcome(parameters))).toBe("consumer-majority");
    expect(policyExplanation(parameters)).toContain("Consumers bear the majority of the tax burden (75%)");
    expect(policyExplanation(parameters)).toContain("Demand is relatively less price-responsive than supply");
  });

  it("describes a producer-majority tax burden", () => {
    const parameters = policy({ demandSlope: 3, supplySlope: 1 });
    expect(incidencePattern(calculatePolicyOutcome(parameters))).toBe("producer-majority");
    expect(policyExplanation(parameters)).toContain("Producers bear the majority of the tax burden (75%)");
    expect(policyExplanation(parameters)).toContain("Supply is relatively less price-responsive than demand");
  });

  it("describes an equally divided subsidy benefit", () => {
    const parameters = policy({ wedge: -10 });
    expect(incidencePattern(calculatePolicyOutcome(parameters))).toBe("equal");
    expect(policyExplanation(parameters)).toContain("subsidy benefit is split equally");
    expect(policyExplanation(parameters)).toContain("buyers pay 5 less");
  });

  it("describes a consumer-majority subsidy benefit", () => {
    const parameters = policy({ wedge: -10, demandSlope: 1, supplySlope: 3 });
    expect(incidencePattern(calculatePolicyOutcome(parameters))).toBe("consumer-majority");
    expect(policyExplanation(parameters)).toContain("Consumers receive the majority of the subsidy benefit (75%)");
  });

  it("describes a producer-majority subsidy benefit", () => {
    const parameters = policy({ wedge: -10, demandSlope: 3, supplySlope: 1 });
    expect(incidencePattern(calculatePolicyOutcome(parameters))).toBe("producer-majority");
    expect(policyExplanation(parameters)).toContain("Producers receive the majority of the subsidy benefit (75%)");
  });
});

describe("equation derivations", () => {
  it("substitutes and solves the supply-demand equilibrium", () => {
    const steps = marketEquationSteps(DEFAULT_MARKET);
    expect(steps.map((step) => step.expression)).toEqual([
      "Qd = a − bP = 100 − 2P",
      "Qs = c + dP = 20 + 2P",
      "100 − 2P = 20 + 2P",
      "P* = (a − c) / (b + d) = (100 − 20) / (2 + 2) = 20",
      "Q* = a − bP* = 100 − 2 × 20 = 60",
    ]);
  });

  it("derives buyer price, seller price, and quantity for a tax", () => {
    const steps = policyEquationSteps(policy());
    expect(steps.find((step) => step.label === "Buyer price")?.expression).toBe("Pc = (a − c + dt) / (b + d) = (100 − 20 + 2 × 10) / (2 + 2) = 25");
    expect(steps.find((step) => step.label === "Seller price")?.expression).toBe("Pp = Pc − t = 25 − 10 = 15");
    expect(steps.find((step) => step.label === "Quantity")?.expression).toBe("Q* = a − bPc = 100 − 2 × 25 = 50");
  });

  it("preserves the negative subsidy wedge in the substituted derivation", () => {
    const steps = policyEquationSteps(policy({ wedge: -10 }));
    expect(steps.find((step) => step.label === "Buyer price")?.expression).toContain("2 × (-10)");
    expect(steps.find((step) => step.label === "Seller price")?.expression).toBe("Pp = Pc − t = 15 − (-10) = 25");
    expect(steps.find((step) => step.label === "Quantity")?.expression).toBe("Q* = a − bPc = 100 − 2 × 15 = 70");
  });

  it("returns a clear no-solution equation state for invalid inputs", () => {
    expect(marketEquationSteps({ ...DEFAULT_MARKET, demandSlope: 0 })[0].label).toBe("No feasible solution");
    expect(policyEquationSteps(policy({ wedge: 100 }))[0].label).toBe("No feasible solution");
  });
});
