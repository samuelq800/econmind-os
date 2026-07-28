export type SolowParameters = {
  savingsRate: number;
  populationGrowth: number;
  technologyGrowth: number;
  depreciation: number;
  capitalElasticity: number;
  productivity: number;
  initialCapital: number;
};

export const DEFAULT_SOLOW: SolowParameters = {
  savingsRate: 30, populationGrowth: 2, technologyGrowth: 2, depreciation: 5, capitalElasticity: 0.35, productivity: 1, initialCapital: 20,
};

const r = (value: number, digits = 3) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
const rate = (value: number) => value / 100;

function invalidSolow(validationMessage: string) {
  return {
    valid: false, validationMessage,
    capital: 0, output: 0, consumption: 0, investment: 0, breakEven: 0,
    steadyCapital: 0, steadyOutput: 0, steadyConsumption: 0, steadyInvestment: 0,
    goldenRuleCapital: 0, goldenRuleSavings: 0, transitionSpeed: 0,
    transition: [] as Array<{ period: number; capital: number; output: number; investment: number; breakEven: number; consumption: number }>,
  };
}

export function calculateSolow(p: SolowParameters) {
  if (!Object.values(p).every(Number.isFinite)) return invalidSolow("All Solow parameters must be finite numbers.");
  if (p.savingsRate < 0 || p.savingsRate > 100) return invalidSolow("The savings rate must be between 0% and 100%.");
  if (p.populationGrowth < 0 || p.technologyGrowth < 0 || p.depreciation < 0) return invalidSolow("Population growth, technology growth, and depreciation cannot be negative.");
  if (p.capitalElasticity <= 0 || p.capitalElasticity >= 1) return invalidSolow("Capital elasticity must be strictly between zero and one.");
  if (p.productivity <= 0) return invalidSolow("Productivity must be greater than zero.");
  if (p.initialCapital < 0) return invalidSolow("Initial capital cannot be negative.");
  const s = rate(p.savingsRate);
  const breakEvenRate = rate(p.populationGrowth + p.technologyGrowth + p.depreciation);
  if (breakEvenRate <= 0) return invalidSolow("At least one of population growth, technology growth, or depreciation must be positive to define a finite steady state.");
  const alpha = p.capitalElasticity;
  const steadyCapital = (s * p.productivity / breakEvenRate) ** (1 / (1 - alpha));
  const steadyOutput = p.productivity * steadyCapital ** alpha;
  const steadyInvestment = s * steadyOutput;
  const steadyConsumption = (1 - s) * steadyOutput;
  const goldenRuleCapital = ((alpha * p.productivity) / breakEvenRate) ** (1 / (1 - alpha));
  const goldenRuleSavings = alpha * 100;
  let capital = Math.max(0.01, p.initialCapital);
  const transition = Array.from({ length: 35 }, (_, period) => {
    const output = p.productivity * capital ** alpha;
    const investment = s * output;
    const breakEven = breakEvenRate * capital;
    const consumption = output - investment;
    const point = { period, capital: r(capital), output: r(output), investment: r(investment), breakEven: r(breakEven), consumption: r(consumption) };
    capital = Math.max(0.01, capital + investment - breakEven);
    return point;
  });
  const initial = transition[0];
  return {
    valid: true, validationMessage: "",
    capital: initial.capital, output: initial.output, consumption: initial.consumption, investment: initial.investment, breakEven: initial.breakEven,
    steadyCapital: r(steadyCapital), steadyOutput: r(steadyOutput), steadyConsumption: r(steadyConsumption), steadyInvestment: r(steadyInvestment),
    goldenRuleCapital: r(goldenRuleCapital), goldenRuleSavings: r(goldenRuleSavings, 1),
    transitionSpeed: r(Math.abs(transition[1].capital - initial.capital)), transition,
  };
}

export function solowDiagramData(p: SolowParameters) {
  const result = calculateSolow(p);
  if (!result.valid) return Array.from({ length: 2 }, (_, index) => ({ capital: index * 5, saving: 0, breakEven: 0 }));
  const maxK = Math.max(5, result.steadyCapital * 1.6, p.initialCapital * 1.4);
  const s = rate(p.savingsRate);
  const breakEvenRate = rate(p.populationGrowth + p.technologyGrowth + p.depreciation);
  return Array.from({ length: 31 }, (_, index) => {
    const capital = (maxK * index) / 30;
    const output = p.productivity * Math.max(capital, 0.0001) ** p.capitalElasticity;
    return { capital: r(capital), saving: r(s * output), breakEven: r(breakEvenRate * capital) };
  });
}
