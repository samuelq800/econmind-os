import type { EquationStep } from "@/lib/economics/types";

export type IsLmParameters = {
  autonomousConsumption: number;
  marginalPropensityToConsume: number;
  taxation: number;
  governmentSpending: number;
  autonomousInvestment: number;
  investmentSensitivity: number;
  moneySupply: number;
  priceLevel: number;
  incomeMoneySensitivity: number;
  interestMoneySensitivity: number;
};

export const DEFAULT_IS_LM: IsLmParameters = {
  autonomousConsumption: 35,
  marginalPropensityToConsume: 0.65,
  taxation: 20,
  governmentSpending: 35,
  autonomousInvestment: 30,
  investmentSensitivity: 8,
  moneySupply: 80,
  priceLevel: 1,
  incomeMoneySensitivity: 0.55,
  interestMoneySensitivity: 10,
};

const round = (value: number, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;

export function calculateIsLm(input: IsLmParameters) {
  const p = input;
  const realMoneyBalances = p.moneySupply / Math.max(0.1, p.priceLevel);
  const autonomousSpending = p.autonomousConsumption - p.marginalPropensityToConsume * p.taxation + p.autonomousInvestment + p.governmentSpending;
  const denominator = 1 - p.marginalPropensityToConsume + (p.investmentSensitivity * p.incomeMoneySensitivity) / p.interestMoneySensitivity;
  const output = (autonomousSpending + (p.investmentSensitivity * realMoneyBalances) / p.interestMoneySensitivity) / denominator;
  const interestRate = (p.incomeMoneySensitivity * output - realMoneyBalances) / p.interestMoneySensitivity;
  const consumption = p.autonomousConsumption + p.marginalPropensityToConsume * (output - p.taxation);
  const investment = p.autonomousInvestment - p.investmentSensitivity * interestRate;
  const fiscalMultiplier = 1 / denominator;
  const simpleKeynesianMultiplier = 1 / (1 - p.marginalPropensityToConsume);
  const crowdingOut = Math.max(0, simpleKeynesianMultiplier - fiscalMultiplier) * p.governmentSpending;
  return {
    valid: Number.isFinite(output) && Number.isFinite(interestRate) && denominator > 0,
    output: round(output),
    interestRate: round(interestRate),
    consumption: round(consumption),
    investment: round(investment),
    realMoneyBalances: round(realMoneyBalances),
    autonomousSpending: round(autonomousSpending),
    fiscalMultiplier: round(fiscalMultiplier, 3),
    crowdingOut: round(crowdingOut),
    moneyMarketGap: round(realMoneyBalances - (p.incomeMoneySensitivity * output - p.interestMoneySensitivity * interestRate), 6),
  };
}

export function isLmChartData(p: IsLmParameters) {
  const result = calculateIsLm(p);
  const maximum = Math.max(180, result.output * 1.4);
  const points = 32;
  const autonomousSpending = p.autonomousConsumption - p.marginalPropensityToConsume * p.taxation + p.autonomousInvestment + p.governmentSpending;
  return Array.from({ length: points + 1 }, (_, index) => {
    const output = (maximum * index) / points;
    return {
      output: round(output),
      is: round((autonomousSpending - (1 - p.marginalPropensityToConsume) * output) / p.investmentSensitivity),
      lm: round((p.incomeMoneySensitivity * output - p.moneySupply / Math.max(0.1, p.priceLevel)) / p.interestMoneySensitivity),
    };
  });
}

export function isLmEquationSteps(p: IsLmParameters): EquationStep[] {
  const r = calculateIsLm(p);
  return [
    { label: "Consumption", expression: "C = C0 + c(Y − T) = " + p.autonomousConsumption + " + " + p.marginalPropensityToConsume + "(Y − " + p.taxation + ")" },
    { label: "Goods market", expression: "(1 − c)Y + bi = C0 − cT + I0 + G = " + r.autonomousSpending },
    { label: "Money market", expression: "M/P = kY − hi; " + r.realMoneyBalances + " = " + p.incomeMoneySensitivity + "Y − " + p.interestMoneySensitivity + "i" },
    { label: "Substitution", expression: "Y = [A + b(M/P)/h] / [1 − c + bk/h]" },
    { label: "Equilibrium output", expression: "Y* = " + r.output },
    { label: "Equilibrium interest rate", expression: "i* = (kY* − M/P)/h = " + r.interestRate },
  ];
}
