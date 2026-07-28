import { describe, expect, it } from "vitest";
import { describeParameterChange } from "../lib/models/change-tracking";
import { CROSS_MODEL_MAPPINGS, DEFAULT_MACRO_WORKSPACE, calculateMacroTransmission, mapADASToPhillips, mapISLMToADAS, mapWorkspaceToISLM, normalisedIndex } from "../lib/models/model-mapping";
import { calculateIsLm, DEFAULT_IS_LM } from "../lib/economics/is-lm";
import { calculatePhillips, DEFAULT_PHILLIPS } from "../lib/economics/phillips";
import { calculateSolow, DEFAULT_SOLOW } from "../lib/economics/solow";
import { calculateLorenz, DEFAULT_LORENZ, lorenzPoints } from "../lib/economics/lorenz";
import { analyzePrisonersDilemma, DEFAULT_PRISONERS_DILEMMA, DEFAULT_REPEATED_GAME, simulateRepeatedGame } from "../lib/economics/game-theory";
import { calculateCournot, DEFAULT_COURNOT } from "../lib/economics/cournot";
import { calculateMarketEquilibrium, DEFAULT_MARKET } from "../lib/economics/supply-demand";
import { calculatePriceControl, DEFAULT_PRICE_CONTROLS } from "../lib/economics/price-controls";
import { calculateMonopoly, DEFAULT_MONOPOLY } from "../lib/economics/monopoly";

describe("parameter-level change tracking", () => {
  it("records a meaningful change with the affected equation, curve, and outputs", () => {
    const change = describeParameterChange({ modelKey: "is-lm", parameterKey: "governmentSpending", previousValue: 35, currentValue: 45, updateOrder: 3 });
    expect(change).toMatchObject({ direction: "increase", absoluteChange: 10, comparisonType: "previous-state", updateOrder: 3 });
    expect(change?.affectedCurves).toContain("IS");
    expect(change?.affectedOutputs).toContain("Output");
  });

  it("does not create a mechanism event from floating-point noise", () => {
    expect(describeParameterChange({ modelKey: "supply-demand", parameterKey: "demandIntercept", previousValue: 100, currentValue: 100 + 1e-10 })).toBeNull();
  });
});

describe("cross-model mapping layer", () => {
  it("keeps all mappings in one documented configuration", () => {
    expect(CROSS_MODEL_MAPPINGS).toHaveLength(5);
    expect(CROSS_MODEL_MAPPINGS.every((mapping) => mapping.assumptionLabel && mapping.limitation && mapping.rationale)).toBe(true);
  });

  it("synchronises macro controls through IS–LM, AD–AS, and Phillips adapters", () => {
    const base = calculateMacroTransmission(DEFAULT_MACRO_WORKSPACE);
    const fiscal = calculateMacroTransmission({ ...DEFAULT_MACRO_WORKSPACE, governmentSpending: 120 });
    expect(fiscal.islm.output).toBeGreaterThan(base.islm.output);
    expect(fiscal.adasParameters.demandShock).toBeGreaterThan(base.adasParameters.demandShock);
    expect(fiscal.phillipsParameters.unemployment).toBeLessThan(base.phillipsParameters.unemployment);
  });

  it("retains native values while providing a normalised baseline index", () => {
    expect(normalisedIndex(210, 200)).toBe(105);
    expect(normalisedIndex(0, 0)).toBe(100);
  });

  it("maps each macro stage with bounded finite parameters", () => {
    const islm = calculateIsLm(mapWorkspaceToISLM({ ...DEFAULT_MACRO_WORKSPACE, policyRate: 15, moneySupplyGrowth: -5 }));
    const adas = mapISLMToADAS(islm);
    const phillips = mapADASToPhillips({ ...calculateMacroTransmission(DEFAULT_MACRO_WORKSPACE).adas, outputGap: 4 }, DEFAULT_MACRO_WORKSPACE);
    expect(Object.values({ ...adas, ...phillips }).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
  });
});

describe("model audit invariants and invalid-input handling", () => {
  it("keeps valid market outcomes finite and non-negative", () => {
    const market = calculateMarketEquilibrium(DEFAULT_MARKET);
    expect(market.valid).toBe(true);
    expect([market.price, market.quantity, market.consumerSurplus, market.producerSurplus].every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
  });

  it("handles singular or unsupported IS–LM and Phillips inputs without NaN", () => {
    expect(calculateIsLm({ ...DEFAULT_IS_LM, interestMoneySensitivity: 0 }).valid).toBe(false);
    const invalidPhillips = calculatePhillips({ ...DEFAULT_PHILLIPS, sensitivity: 0 });
    expect(invalidPhillips).toMatchObject({ valid: false, inflation: 0 });
    expect(invalidPhillips.validationMessage).toContain("sensitivity");
  });

  it("satisfies the Solow steady-state invariant and rejects a zero break-even denominator", () => {
    const solow = calculateSolow(DEFAULT_SOLOW);
    const breakEvenRate = (DEFAULT_SOLOW.populationGrowth + DEFAULT_SOLOW.technologyGrowth + DEFAULT_SOLOW.depreciation) / 100;
    expect(solow.valid).toBe(true);
    expect(solow.steadyInvestment).toBeCloseTo(breakEvenRate * solow.steadyCapital, 2);
    expect(calculateSolow({ ...DEFAULT_SOLOW, populationGrowth: 0, technologyGrowth: 0, depreciation: 0 }).valid).toBe(false);
    expect(calculateSolow({ ...DEFAULT_SOLOW, capitalElasticity: 1 }).valid).toBe(false);
  });

  it("keeps Lorenz endpoints monotonic and rejects an all-zero distribution", () => {
    const points = lorenzPoints([8, 14, 22, 36, 80]);
    expect(points[0]).toEqual({ population: 0, income: 0 });
    expect(points.at(-1)).toEqual({ population: 100, income: 100 });
    expect(points.every((point, index) => index === 0 || point.population >= points[index - 1].population && point.income >= points[index - 1].income)).toBe(true);
    expect(calculateLorenz({ ...DEFAULT_LORENZ, quintile1: 0, quintile2: 0, quintile3: 0, quintile4: 0, quintile5: 0 }).valid).toBe(false);
  });

  it("handles game ties, multiple equilibria, and invalid payoffs", () => {
    const ties = analyzePrisonersDilemma({ ccA: 1, ccB: 1, cdA: 1, cdB: 1, dcA: 1, dcB: 1, ddA: 1, ddB: 1 });
    expect(ties.nash).toHaveLength(4);
    expect(ties.pareto).toHaveLength(4);
    expect(analyzePrisonersDilemma({ ...DEFAULT_PRISONERS_DILEMMA, ccA: Number.NaN }).valid).toBe(false);
    expect(simulateRepeatedGame({ ...DEFAULT_REPEATED_GAME, mistakeProbability: 2 }).valid).toBe(false);
  });

  it("places the Cournot equilibrium on both best-response functions and rejects malformed demand", () => {
    const first = calculateCournot(DEFAULT_COURNOT);
    const equilibrium = calculateCournot({ ...DEFAULT_COURNOT, quantity1: first.equilibrium1, quantity2: first.equilibrium2 });
    expect(equilibrium.equilibrium1).toBeCloseTo(equilibrium.bestResponse1, 1);
    expect(equilibrium.equilibrium2).toBeCloseTo(equilibrium.bestResponse2, 1);
    expect(equilibrium.totalOutput).toBeCloseTo(equilibrium.equilibrium1 + equilibrium.equilibrium2, 1);
    expect(calculateCournot({ ...DEFAULT_COURNOT, demandSlope: 0 }).valid).toBe(false);
  });

  it("returns clear invalid states for malformed market-policy curves", () => {
    expect(calculatePriceControl({ ...DEFAULT_PRICE_CONTROLS, demandSlope: 0 }).valid).toBe(false);
    expect(calculateMonopoly({ ...DEFAULT_MONOPOLY, demandSlope: 0 }).valid).toBe(false);
  });
});
