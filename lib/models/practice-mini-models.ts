export type MiniControl = {
  id: string;
  label: string;
  symbol: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

export type MiniCalculation = {
  primaryKey: string;
  labels: Record<string, string>;
  results: Record<string, number>;
  interpretation: string;
};

export type PracticeMiniModel = {
  controls: MiniControl[];
  calculate: (values: Record<string, number>) => MiniCalculation;
};

const control = (
  id: string,
  label: string,
  symbol: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
): MiniControl => ({ id, label, symbol, min, max, step, defaultValue });

const round = (value: number, digits = 3) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
const logistic = (value: number) => 1 / (1 + Math.exp(-value));

const miniModels: Record<string, PracticeMiniModel> = {
  quotas: {
    controls: [
      control("quotaPrice", "Quota price", "P_q", 1, 50, 1, 14),
      control("worldPrice", "World price", "P_w", 1, 50, 1, 10),
      control("quota", "Quota quantity", "Q", 0, 200, 5, 50),
    ],
    calculate: (p) => {
      const rent = (p.quotaPrice - p.worldPrice) * p.quota;
      return {
        primaryKey: "quotaRent",
        labels: {
          quotaRent: "Quota rent",
          priceWedge: "Price wedge",
          quota: "Imported units",
        },
        results: {
          quotaRent: round(rent),
          priceWedge: round(p.quotaPrice - p.worldPrice),
          quota: round(p.quota),
        },
        interpretation:
          rent > 0
            ? "A binding quota creates a positive scarcity rent on the stated import quantity."
            : "There is no positive quota rent when the domestic and world prices are equal or reversed.",
      };
    },
  },
  exchange_rates: {
    controls: [
      control(
        "previousRate",
        "Previous exchange rate",
        "e_{t-1}",
        0.2,
        10,
        0.1,
        2,
      ),
      control("currentRate", "Current exchange rate", "e_t", 0.2, 10, 0.1, 2.2),
    ],
    calculate: (p) => {
      const change = 100 * Math.log(p.currentRate / p.previousRate);
      return {
        primaryKey: "depreciation",
        labels: { depreciation: "Log change (%)", currentRate: "Current rate" },
        results: {
          depreciation: round(change),
          currentRate: round(p.currentRate),
        },
        interpretation:
          change > 0
            ? "With this quote convention, the higher rate is a depreciation."
            : "With this quote convention, the lower rate is an appreciation.",
      };
    },
  },
  balance_of_payments: {
    controls: [
      control("currentAccount", "Current account", "CA", -20, 20, 1, -3),
      control("capitalAccount", "Capital account", "KA", -20, 20, 1, 0),
      control("financialAccount", "Financial account", "FA", -20, 20, 1, 5),
      control("errors", "Errors and omissions", "EO", -10, 10, 1, 0),
    ],
    calculate: (p) => {
      const reserves =
        p.currentAccount + p.capitalAccount + p.financialAccount + p.errors;
      return {
        primaryKey: "reserveChange",
        labels: {
          reserveChange: "Reserve change",
          currentAccount: "Current account",
        },
        results: {
          reserveChange: round(reserves),
          currentAccount: round(p.currentAccount),
        },
        interpretation:
          "The displayed reserve change closes the balance-of-payments accounting identity under one stated sign convention.",
      };
    },
  },
  marshall_lerner: {
    controls: [
      control("exportElasticity", "Export elasticity", "|ε_x|", 0, 2, 0.1, 0.8),
      control("importElasticity", "Import elasticity", "|ε_m|", 0, 2, 0.1, 0.6),
    ],
    calculate: (p) => {
      const total = p.exportElasticity + p.importElasticity;
      return {
        primaryKey: "elasticitySum",
        labels: {
          elasticitySum: "Elasticity sum",
          conditionMet: "Condition met",
        },
        results: {
          elasticitySum: round(total),
          conditionMet: total > 1 ? 1 : 0,
        },
        interpretation:
          total > 1
            ? "The long-run Marshall–Lerner condition is met in this simplified elasticity check."
            : "The long-run Marshall–Lerner condition is not met in this simplified elasticity check.",
      };
    },
  },
  j_curve: {
    controls: [
      control("priceEffect", "Initial price effect", "P", -10, 5, 1, -2),
      control("volumeEffect", "Delayed volume effect", "V", -2, 10, 1, 3),
      control("lag", "Volume-response lag", "lag", 0, 6, 1, 3),
      control("period", "Months since shock", "t", 0, 8, 1, 3),
    ],
    calculate: (p) => {
      const tradeBalance =
        p.priceEffect + (p.period >= p.lag ? p.volumeEffect : 0);
      return {
        primaryKey: "tradeBalance",
        labels: {
          tradeBalance: "Trade-balance effect",
          volumeActive: "Volume response active",
        },
        results: {
          tradeBalance: round(tradeBalance),
          volumeActive: p.period >= p.lag ? 1 : 0,
        },
        interpretation:
          p.period >= p.lag
            ? "The delayed volume response is now included in the trade-balance effect."
            : "Only the immediate price effect is active before the selected lag ends.",
      };
    },
  },
  ppp: {
    controls: [
      control(
        "domesticInflation",
        "Domestic inflation",
        "π",
        -0.1,
        0.2,
        0.01,
        0.06,
      ),
      control(
        "foreignInflation",
        "Foreign inflation",
        "π^*",
        -0.1,
        0.2,
        0.01,
        0.02,
      ),
    ],
    calculate: (p) => {
      const depreciation = 100 * (p.domesticInflation - p.foreignInflation);
      return {
        primaryKey: "predictedDepreciation",
        labels: {
          predictedDepreciation: "PPP prediction (%)",
          inflationGap: "Inflation gap (pp)",
        },
        results: {
          predictedDepreciation: round(depreciation),
          inflationGap: round(100 * (p.domesticInflation - p.foreignInflation)),
        },
        interpretation:
          "Relative PPP gives a compatible-period inflation differential, not an exact short-run exchange-rate forecast.",
      };
    },
  },
  newsvendor: {
    controls: [
      control("sellingPrice", "Selling price", "p", 1, 40, 1, 12),
      control("unitCost", "Unit cost", "c", 0, 30, 1, 5),
      control("salvageValue", "Salvage value", "s", 0, 20, 1, 1),
    ],
    calculate: (p) => {
      const denominator = Math.max(0.001, p.sellingPrice - p.salvageValue);
      const ratio = Math.min(
        1,
        Math.max(0, (p.sellingPrice - p.unitCost) / denominator),
      );
      return {
        primaryKey: "criticalRatio",
        labels: {
          criticalRatio: "Critical ratio",
          underageCost: "Underage cost",
        },
        results: {
          criticalRatio: round(ratio),
          underageCost: round(p.sellingPrice - p.unitCost),
        },
        interpretation:
          "The critical ratio balances the stated underage and overage costs for a single selling period.",
      };
    },
  },
  inventory_optimisation: {
    controls: [
      control("annualDemand", "Annual demand", "D", 100, 5000, 50, 1200),
      control("orderCost", "Order cost", "S", 1, 100, 1, 20),
      control("holdingCost", "Holding cost", "H", 0.5, 50, 0.5, 2),
    ],
    calculate: (p) => {
      const eoq = Math.sqrt((2 * p.annualDemand * p.orderCost) / p.holdingCost);
      return {
        primaryKey: "eoq",
        labels: {
          eoq: "Economic order quantity",
          annualDemand: "Annual demand",
        },
        results: { eoq: round(eoq), annualDemand: round(p.annualDemand) },
        interpretation:
          "EOQ trades off the selected order cost against holding cost under stable demand.",
      };
    },
  },
  demand_forecasting: {
    controls: [
      control("alpha", "Smoothing weight", "α", 0, 1, 0.05, 0.3),
      control("latestDemand", "Latest demand", "D_t", 0, 300, 5, 120),
      control("previousForecast", "Previous forecast", "F_t", 0, 300, 5, 100),
    ],
    calculate: (p) => {
      const forecast =
        p.alpha * p.latestDemand + (1 - p.alpha) * p.previousForecast;
      return {
        primaryKey: "nextForecast",
        labels: {
          nextForecast: "Next forecast",
          forecastError: "Latest minus previous",
        },
        results: {
          nextForecast: round(forecast),
          forecastError: round(p.latestDemand - p.previousForecast),
        },
        interpretation:
          "The smoothing weight determines how strongly the next forecast responds to the latest observation.",
      };
    },
  },
  insurance_risk_pooling: {
    controls: [
      control(
        "lowRiskProbability",
        "Low-risk probability",
        "p_L",
        0,
        1,
        0.05,
        0.1,
      ),
      control(
        "highRiskProbability",
        "High-risk probability",
        "p_H",
        0,
        1,
        0.05,
        0.4,
      ),
      control("lowRiskPeople", "Low-risk people", "n_L", 0, 20, 1, 2),
      control("highRiskPeople", "High-risk people", "n_H", 0, 20, 1, 2),
      control("loss", "Loss", "L", 10, 500, 10, 100),
    ],
    calculate: (p) => {
      const expected =
        (p.lowRiskPeople * p.lowRiskProbability +
          p.highRiskPeople * p.highRiskProbability) *
        p.loss;
      return {
        primaryKey: "expectedClaims",
        labels: {
          expectedClaims: "Expected claims",
          totalPeople: "People in pool",
        },
        results: {
          expectedClaims: round(expected),
          totalPeople: round(p.lowRiskPeople + p.highRiskPeople),
        },
        interpretation:
          "Pooling changes the distribution of losses, while the displayed expected claims add individual expected losses.",
      };
    },
  },
  expected_value: {
    controls: [
      control("probabilityA", "Probability A", "p_A", 0, 1, 0.05, 0.6),
      control("valueA", "Outcome A", "x_A", -50, 100, 5, 10),
      control("valueB", "Outcome B", "x_B", -50, 100, 5, -5),
    ],
    calculate: (p) => {
      const expected =
        p.probabilityA * p.valueA + (1 - p.probabilityA) * p.valueB;
      return {
        primaryKey: "expectedValue",
        labels: {
          expectedValue: "Expected value",
          probabilityB: "Probability B",
        },
        results: {
          expectedValue: round(expected),
          probabilityB: round(1 - p.probabilityA),
        },
        interpretation:
          "Expected value weights each payoff by its displayed probability; it does not describe the risk of any one outcome.",
      };
    },
  },
  ols: {
    controls: [
      control("intercept", "Intercept", "α", -20, 20, 1, 0),
      control("slope", "Slope", "β", -10, 10, 0.5, 2),
      control("x", "Illustrative x value", "x", -10, 10, 1, 3),
    ],
    calculate: (p) => {
      const prediction = p.intercept + p.slope * p.x;
      return {
        primaryKey: "slope",
        labels: { slope: "OLS slope", prediction: "Predicted outcome" },
        results: { slope: round(p.slope), prediction: round(prediction) },
        interpretation:
          "The simplified line shows an association between x and y; it does not make the slope causal by itself.",
      };
    },
  },
  multiple_regression: {
    controls: [
      control("intercept", "Intercept", "β_0", -10, 10, 0.5, 1),
      control("coefficientOne", "Coefficient on x₁", "β_1", -10, 10, 0.5, 2),
      control("coefficientTwo", "Coefficient on x₂", "β_2", -10, 10, 0.5, 3),
      control("xOne", "x₁", "x_1", -10, 10, 1, 1),
      control("xTwo", "x₂", "x_2", -10, 10, 1, 1),
    ],
    calculate: (p) => {
      const prediction =
        p.intercept + p.coefficientOne * p.xOne + p.coefficientTwo * p.xTwo;
      return {
        primaryKey: "prediction",
        labels: {
          prediction: "Predicted y",
          coefficientOne: "Coefficient on x₁",
        },
        results: {
          prediction: round(prediction),
          coefficientOne: round(p.coefficientOne),
        },
        interpretation:
          "Each coefficient is interpreted conditional on the other displayed regressor in this linear teaching model.",
      };
    },
  },
  fixed_effects: {
    controls: [
      control("xBefore", "Worker x: before", "x_{i0}", -10, 20, 1, 1),
      control("xAfter", "Worker x: after", "x_{i1}", -10, 20, 1, 3),
      control("yBefore", "Worker y: before", "y_{i0}", -20, 40, 1, 5),
      control("yAfter", "Worker y: after", "y_{i1}", -20, 40, 1, 7),
    ],
    calculate: (p) => {
      const deltaX = p.xAfter - p.xBefore;
      const slope =
        Math.abs(deltaX) < 0.001 ? 0 : (p.yAfter - p.yBefore) / deltaX;
      return {
        primaryKey: "withinSlope",
        labels: {
          withinSlope: "Within-person slope",
          xChange: "Within-person x change",
        },
        results: { withinSlope: round(slope), xChange: round(deltaX) },
        interpretation:
          "The within comparison removes time-invariant individual levels, not time-varying confounders.",
      };
    },
  },
  difference_in_differences: {
    controls: [
      control("treatedPre", "Treated: pre", "T_{pre}", -20, 50, 1, 10),
      control("treatedPost", "Treated: post", "T_{post}", -20, 50, 1, 14),
      control("controlPre", "Control: pre", "C_{pre}", -20, 50, 1, 10),
      control("controlPost", "Control: post", "C_{post}", -20, 50, 1, 11),
    ],
    calculate: (p) => {
      const did = p.treatedPost - p.treatedPre - (p.controlPost - p.controlPre);
      return {
        primaryKey: "did",
        labels: {
          did: "Difference-in-differences",
          treatedChange: "Treated change",
        },
        results: {
          did: round(did),
          treatedChange: round(p.treatedPost - p.treatedPre),
        },
        interpretation:
          "The estimate subtracts the control-group change; its causal use relies on a parallel-trends assumption.",
      };
    },
  },
  logit: {
    controls: [
      control("linearIndex", "Linear index", "Xβ", -6, 6, 0.25, 0),
      control("comparisonIndex", "Comparison index", "Xβ'", -6, 6, 0.25, 1.1),
    ],
    calculate: (p) => {
      const probability = logistic(p.linearIndex);
      return {
        primaryKey: "probability",
        labels: {
          probability: "Probability",
          comparisonProbability: "Comparison probability",
        },
        results: {
          probability: round(probability),
          comparisonProbability: round(logistic(p.comparisonIndex)),
        },
        interpretation:
          "The logit link keeps probabilities between zero and one; coefficient changes are not constant probability changes.",
      };
    },
  },
  rdd: {
    controls: [
      control("rightMean", "Mean right of cutoff", "E[Y|x↓c]", -20, 50, 1, 12),
      control("leftMean", "Mean left of cutoff", "E[Y|x↑c]", -20, 50, 1, 10),
    ],
    calculate: (p) => {
      const discontinuity = p.rightMean - p.leftMean;
      return {
        primaryKey: "discontinuity",
        labels: {
          discontinuity: "Cutoff discontinuity",
          rightMean: "Right-side mean",
        },
        results: {
          discontinuity: round(discontinuity),
          rightMean: round(p.rightMean),
        },
        interpretation:
          "The discontinuity is local to the cutoff and requires that units cannot precisely sort around it.",
      };
    },
  },
  iv: {
    controls: [
      control(
        "covariationZY",
        "Covariance: Z and Y",
        "Cov(Z,Y)",
        -20,
        20,
        1,
        6,
      ),
      control(
        "covariationZX",
        "Covariance: Z and X",
        "Cov(Z,X)",
        0.5,
        20,
        0.5,
        3,
      ),
    ],
    calculate: (p) => {
      const estimate = p.covariationZY / p.covariationZX;
      return {
        primaryKey: "ivEstimate",
        labels: {
          ivEstimate: "IV estimate",
          covariationZX: "First-stage covariance",
        },
        results: {
          ivEstimate: round(estimate),
          covariationZX: round(p.covariationZX),
        },
        interpretation:
          "Relevance is necessary but not sufficient: a valid instrument must also meet independence and exclusion assumptions.",
      };
    },
  },
  confidence_intervals: {
    controls: [
      control("estimate", "Point estimate", "θ̂", -20, 20, 0.1, 2),
      control("standardError", "Standard error", "SE", 0.05, 10, 0.05, 0.5),
      control("criticalValue", "Critical value", "c", 0.5, 3, 0.01, 1.96),
    ],
    calculate: (p) => {
      const margin = p.criticalValue * p.standardError;
      return {
        primaryKey: "lowerBound",
        labels: { lowerBound: "Lower bound", upperBound: "Upper bound" },
        results: {
          lowerBound: round(p.estimate - margin),
          upperBound: round(p.estimate + margin),
        },
        interpretation:
          "The interval reflects the stated standard error and critical value under the model's sampling assumptions.",
      };
    },
  },
};

export function getPracticeMiniModel(modelId: string) {
  return miniModels[modelId] ?? null;
}

export function miniModelDefaults(model: PracticeMiniModel) {
  return Object.fromEntries(
    model.controls.map((item) => [item.id, item.defaultValue]),
  );
}
