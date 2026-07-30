import { describe, expect, it } from "vitest";
import { EXTENDED_MODEL_SLUGS, EXTENDED_MODEL_SOURCE_TESTS, getExtendedModelDefinition } from "@/lib/economics/extended-models";
import { AVAILABLE_MODELS } from "@/lib/models/registry";

type Case = {
  slug: (typeof EXTENDED_MODEL_SLUGS)[number];
  values: Record<string, number>;
  results: Record<string, string>;
};

/** UI control names are intentionally different from the source shorthand. */
const cases: Record<string, Case> = {
  labour_market: { slug: "labour-market", values: { demandIntercept: 100, demandSlope: 2, supplyIntercept: 20, supplySlope: 1 }, results: { w: "wage", L: "employment" } },
  public_goods: { slug: "public-goods", values: { endowment: 10, players: 4, multiplier: 1.6, contribution: 10 }, results: { payoff_each: "payoffEach" } },
  common_pool_resources: { slug: "common-pool-resources", values: { stock: 100, growthRate: 0.3, capacity: 200, harvest: 40 }, results: { S_next: "nextStock" } },
  information_asymmetry: { slug: "information-asymmetry", values: { probabilityHigh: 0.7, highValue: 100, lowValue: 40 }, results: { expected_value: "expectedValue" } },
  adverse_selection: { slug: "adverse-selection", values: { lowRisk: 0.1, highRisk: 0.4, lowRiskShare: 0.5, loss: 100 }, results: { fair_premium: "fairPremium" } },
  moral_hazard: { slug: "moral-hazard", values: { probabilityBefore: 0.4, probabilityAfter: 0.3, loss: 100, effortCost: 2 }, results: { prevention_net_value: "preventionNetValue", choose_effort: "chooseEffort" } },
  signalling: { slug: "signalling", values: { wageGap: 20, highCost: 5, lowCost: 25 }, results: { separating_signal_exists: "separatingSignalExists" } },
  monetary_policy: { slug: "monetary-policy", values: { neutralRate: 1, inflation: 4, targetInflation: 2, inflationResponse: 0.5, outputResponse: 0.5, outputGap: -1 }, results: { i: "policyRate" } },
  fiscal_policy: { slug: "fiscal-policy", values: { consumptionPropensity: 0.75, spendingMultiplier: 1.5, spendingChange: 10, taxChange: 4 }, results: { dY: "outputChange" } },
  public_debt: { slug: "public-debt", values: { previousDebt: 0.8, interestRate: 0.06, growthRate: 0.03, primaryBalance: 0.01 }, results: { d_next: "nextDebtRatio" } },
  business_cycle: { slug: "business-cycle", values: { actualOutput: 98, potentialOutput: 100, okunBeta: 0.4, gapChange: 2 }, results: { output_gap_pct: "outputGap", du_pp: "unemploymentChange" } },
  money_market: { slug: "money-market", values: { realBalances: 100, incomeSensitivity: 0.5, output: 240, interestSensitivity: 10 }, results: { i: "interestRate" } },
  loanable_funds: { slug: "loanable-funds", values: { savingIntercept: 20, savingSlope: 2, investmentIntercept: 80, investmentSlope: 3, deficit: 10 }, results: { r: "clearingRate" } },
  bank_credit_creation: { slug: "bank-credit-creation", values: { reserveRatio: 0.1, reserveChange: 10 }, results: { max_dD: "maxDepositChange" } },
  comparative_advantage: { slug: "comparative-advantage", values: { aX: 2, aY: 4, bX: 6, bY: 3 }, results: { oc_x_A: "opportunityCostA", oc_x_B: "opportunityCostB", x_advantage: "aHasXAdvantage" } },
  tariffs: { slug: "tariffs", values: { worldPrice: 10, tariffRate: 0.2, imports: 50 }, results: { Pd: "domesticPrice", revenue: "tariffRevenue" } },
};

describe("extended model library", () => {
  it("turns all 35 registered models into available learning experiences", () => {
    expect(AVAILABLE_MODELS).toHaveLength(35);
    expect(EXTENDED_MODEL_SLUGS).toHaveLength(18);
    for (const slug of EXTENDED_MODEL_SLUGS) expect(getExtendedModelDefinition(slug)).not.toBeNull();
  });

  it("matches every selected supplied formula regression case", () => {
    for (const source of EXTENDED_MODEL_SOURCE_TESTS) {
      const mapped = cases[source.id];
      if (!mapped) continue;
      const definition = getExtendedModelDefinition(mapped.slug);
      expect(definition, source.id).not.toBeNull();
      const actual = definition!.calculate(mapped.values).results;
      for (const [sourceKey, resultKey] of Object.entries(mapped.results)) {
        const expected = source.expected[sourceKey];
        const expectedNumber = expected === true ? 1 : expected === false ? 0 : expected === "A" ? 1 : Number(expected);
        expect(actual[resultKey], `${source.id}.${sourceKey}`).toBeCloseTo(expectedNumber, Math.max(0, Math.ceil(-Math.log10(source.tolerance || 0.000001))));
      }
    }
  });

  it("uses the economically consistent MRP = marginal-expenditure condition for monopsony", () => {
    const monopsony = getExtendedModelDefinition("monopsony")!;
    const result = monopsony.calculate({ mrp: 30, supplyIntercept: 5, supplySlope: 0.1 }).results;
    // With w(L)=5+0.1L, ME=5+0.2L. Therefore MRP=30 gives L=125 and w=17.5.
    expect(result).toMatchObject({ employment: 125, wage: 17.5, marginalExpenditure: 30 });
  });

  it("uses the stated open-economy multiplier equation for the Keynesian model", () => {
    const multiplier = getExtendedModelDefinition("keynesian-multiplier")!;
    const result = multiplier.calculate({ consumptionPropensity: 0.75, taxRate: 0.2, importPropensity: 0.1, spendingChange: 10 }).results;
    // k = 1 / [1 - c(1 - t) + m] = 1 / (1 - .75 × .8 + .1) = 2.
    expect(result).toMatchObject({ multiplier: 2, outputChange: 20 });
  });
});
