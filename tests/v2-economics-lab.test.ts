import { describe, expect, it } from "vitest";
import { calculateIsLm, DEFAULT_IS_LM, isLmEquationSteps } from "../lib/economics/is-lm";
import { analyzePrisonersDilemma, DEFAULT_PRISONERS_DILEMMA, DEFAULT_REPEATED_GAME, simulateRepeatedGame } from "../lib/economics/game-theory";
import { calculateCournot, DEFAULT_COURNOT } from "../lib/economics/cournot";
import { calculatePhillips, DEFAULT_PHILLIPS } from "../lib/economics/phillips";
import { calculateSolow, DEFAULT_SOLOW } from "../lib/economics/solow";
import { calculateLorenz, DEFAULT_LORENZ, giniCoefficient, lorenzPoints } from "../lib/economics/lorenz";
import { BASELINE_PARAMETERS } from "../lib/economics/sandbox/defaults";
import { simulateSandbox } from "../lib/economics/sandbox/simulation";

describe("IS–LM", () => {
  it("solves the default goods and money market equilibrium", () => {
    expect(calculateIsLm(DEFAULT_IS_LM)).toMatchObject({ valid: true, output: 191.14, interestRate: 2.51, realMoneyBalances: 80 });
  });

  it("raises output and interest rates after a fiscal expansion", () => {
    const base = calculateIsLm(DEFAULT_IS_LM);
    const expansion = calculateIsLm({ ...DEFAULT_IS_LM, governmentSpending: DEFAULT_IS_LM.governmentSpending + 15 });
    expect(expansion.output).toBeGreaterThan(base.output);
    expect(expansion.interestRate).toBeGreaterThan(base.interestRate);
    expect(expansion.investment).toBeLessThan(base.investment);
  });

  it("raises output and lowers the interest rate after monetary expansion", () => {
    const base = calculateIsLm(DEFAULT_IS_LM);
    const expansion = calculateIsLm({ ...DEFAULT_IS_LM, moneySupply: DEFAULT_IS_LM.moneySupply + 30 });
    expect(expansion.output).toBeGreaterThan(base.output);
    expect(expansion.interestRate).toBeLessThan(base.interestRate);
    expect(isLmEquationSteps(DEFAULT_IS_LM).map((step) => step.label)).toContain("Equilibrium output");
  });
});

describe("strategic interaction", () => {
  it("finds dominant defection, the DD Nash equilibrium, and CC Pareto efficiency", () => {
    const result = analyzePrisonersDilemma(DEFAULT_PRISONERS_DILEMMA);
    expect(result.aStrictDominant).toEqual(["D"]);
    expect(result.bStrictDominant).toEqual(["D"]);
    expect(result.nash).toEqual(["DD"]);
    expect(result.pareto).toEqual(expect.arrayContaining(["CC"]));
    expect(result.jointMaximum).toEqual(["CC"]);
    expect(result.socialDilemma).toBe(true);
  });

  it("updates Nash detection when payoffs create multiple equilibria", () => {
    const result = analyzePrisonersDilemma({ ccA: 4, ccB: 4, cdA: 0, cdB: 0, dcA: 0, dcB: 0, ddA: 3, ddB: 3 });
    expect(result.nash).toEqual(expect.arrayContaining(["CC", "DD"]));
    expect(result.socialDilemma).toBe(false);
  });

  it("keeps mutual Tit for Tat cooperative without noise", () => {
    const game = simulateRepeatedGame({ ...DEFAULT_REPEATED_GAME, strategyA: "tit-for-tat", strategyB: "tit-for-tat", mistakeProbability: 0, rounds: 8 });
    expect(game.cooperationRate).toBe(100);
    expect(game.punishmentPeriods).toBe(0);
    expect(game.cumulativeA).toBe(game.cumulativeB);
  });
});

describe("Cournot competition", () => {
  it("derives symmetric best responses and the Cournot–Nash equilibrium", () => {
    const result = calculateCournot(DEFAULT_COURNOT);
    expect(result.equilibrium1).toBeCloseTo(26.67, 1);
    expect(result.equilibrium2).toBeCloseTo(26.67, 1);
    expect(result.equilibriumPrice).toBeCloseTo(46.67, 1);
    expect(result.competitiveOutput).toBeGreaterThan(result.equilibriumTotal);
    expect(result.monopolyOutput).toBeLessThan(result.equilibriumTotal);
  });
});

describe("Phillips curve", () => {
  it("distinguishes a movement along the SRPC from a shift", () => {
    const movement = calculatePhillips({ ...DEFAULT_PHILLIPS, unemployment: 4 });
    const shift = calculatePhillips({ ...DEFAULT_PHILLIPS, supplyShock: 2 });
    expect(movement.inflation).toBeGreaterThan(DEFAULT_PHILLIPS.expectedInflation);
    expect(movement.movement).toBe("Movement along the SRPC");
    expect(shift.movement).toBe("SRPC shifts");
    expect(shift.inflation).toBe(4);
  });
});

describe("Solow growth", () => {
  it("calculates a positive steady state and transitions toward it", () => {
    const result = calculateSolow(DEFAULT_SOLOW);
    expect(result.steadyCapital).toBeGreaterThan(0);
    expect(result.steadyOutput).toBeGreaterThan(0);
    expect(Math.abs(result.transition[1].capital - result.steadyCapital)).toBeLessThan(Math.abs(result.transition[0].capital - result.steadyCapital));
    expect(result.goldenRuleSavings).toBe(35);
  });

  it("lowers steady-state capital when depreciation rises", () => {
    const base = calculateSolow(DEFAULT_SOLOW);
    const higherDepreciation = calculateSolow({ ...DEFAULT_SOLOW, depreciation: 10 });
    expect(higherDepreciation.steadyCapital).toBeLessThan(base.steadyCapital);
  });
});

describe("Lorenz curve and Gini", () => {
  it("constructs a Lorenz curve and identifies complete equality", () => {
    expect(giniCoefficient([10, 10, 10, 10, 10])).toBe(0);
    expect(lorenzPoints([10, 10, 10, 10, 10]).at(-1)).toEqual({ population: 100, income: 100 });
  });

  it("calculates policy inequality and fiscal changes", () => {
    const result = calculateLorenz(DEFAULT_LORENZ);
    expect(result.preGini).toBeGreaterThan(result.postGini);
    expect(result.revenue).toBeGreaterThan(0);
    expect(result.transferCost).toBeGreaterThan(0);
    expect(result.postPoints).toHaveLength(6);
  });
});

describe("Sandbox transparency", () => {
  it("reconciles every unclamped displayed contribution with its baseline", () => {
    const result = simulateSandbox({ ...BASELINE_PARAMETERS, carbonTax: 40, greenSubsidy: 20, governmentSpending: 120, interestRate: 2 });
    for (const key of Object.keys(result.indicators) as Array<keyof typeof result.indicators>) {
      const delta = result.contributions.reduce((sum, item) => sum + (item.values[key] ?? 0), 0);
      expect(result.indicators[key]).toBeCloseTo(result.baseline[key] + delta, 2);
    }
    expect(result.interactionContributions.length).toBeGreaterThan(0);
  });
});
