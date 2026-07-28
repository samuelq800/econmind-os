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

export function calculateSolow(p: SolowParameters) {
  const s = rate(p.savingsRate);
  const breakEvenRate = rate(p.populationGrowth + p.technologyGrowth + p.depreciation);
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
    capital: initial.capital, output: initial.output, consumption: initial.consumption, investment: initial.investment, breakEven: initial.breakEven,
    steadyCapital: r(steadyCapital), steadyOutput: r(steadyOutput), steadyConsumption: r(steadyConsumption), steadyInvestment: r(steadyInvestment),
    goldenRuleCapital: r(goldenRuleCapital), goldenRuleSavings: r(goldenRuleSavings, 1),
    transitionSpeed: r(Math.abs(transition[1].capital - initial.capital)), transition,
  };
}

export function solowDiagramData(p: SolowParameters) {
  const result = calculateSolow(p);
  const maxK = Math.max(5, result.steadyCapital * 1.6, p.initialCapital * 1.4);
  const s = rate(p.savingsRate);
  const breakEvenRate = rate(p.populationGrowth + p.technologyGrowth + p.depreciation);
  return Array.from({ length: 31 }, (_, index) => {
    const capital = (maxK * index) / 30;
    const output = p.productivity * Math.max(capital, 0.0001) ** p.capitalElasticity;
    return { capital: r(capital), saving: r(s * output), breakEven: r(breakEvenRate * capital) };
  });
}
