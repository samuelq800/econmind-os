export type LorenzParameters = {
  quintile1: number; quintile2: number; quintile3: number; quintile4: number; quintile5: number;
  taxSystem: "progressive" | "flat";
  taxRate: number;
  transfer: number;
  minimumIncome: number;
};

export const DEFAULT_LORENZ: LorenzParameters = {
  quintile1: 8, quintile2: 14, quintile3: 22, quintile4: 36, quintile5: 80,
  taxSystem: "progressive", taxRate: 20, transfer: 4, minimumIncome: 10,
};

const r = (value: number, digits = 3) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;

export function giniCoefficient(incomes: number[]) {
  const sorted = [...incomes].map((value) => Math.max(0, value)).sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  let cumulative = 0;
  let sum = 0;
  for (const income of sorted) {
    const previous = cumulative / total;
    cumulative += income;
    sum += previous + cumulative / total;
  }
  return r(1 - sum / sorted.length);
}

export function lorenzPoints(incomes: number[]) {
  const sorted = [...incomes].map((value) => Math.max(0, value)).sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0) || 1;
  let cumulative = 0;
  return [{ population: 0, income: 0 }, ...sorted.map((value, index) => {
    cumulative += value;
    return { population: r(((index + 1) / sorted.length) * 100, 1), income: r((cumulative / total) * 100, 1) };
  })];
}

export function calculateLorenz(p: LorenzParameters) {
  const preTax = [p.quintile1, p.quintile2, p.quintile3, p.quintile4, p.quintile5].map((value) => Math.max(0, value));
  const average = preTax.reduce((sum, value) => sum + value, 0) / preTax.length || 1;
  const tax = preTax.map((income) => {
    const rate = p.taxSystem === "flat" ? p.taxRate / 100 : (p.taxRate / 100) * Math.min(1.7, Math.max(0.25, income / average));
    return income * rate;
  });
  const afterTax = preTax.map((income, index) => Math.max(p.minimumIncome, income - tax[index] + p.transfer));
  const revenue = tax.reduce((sum, value) => sum + value, 0);
  const transferCost = p.transfer * preTax.length + afterTax.reduce((sum, value, index) => sum + Math.max(0, p.minimumIncome - (preTax[index] - tax[index] + p.transfer)), 0);
  const preGini = giniCoefficient(preTax);
  const postGini = giniCoefficient(afterTax);
  const prePoints = lorenzPoints(preTax);
  const postPoints = lorenzPoints(afterTax);
  return {
    preTax, afterTax: afterTax.map((value) => r(value)), preGini, postGini, giniChange: r(postGini - preGini),
    revenue: r(revenue), transferCost: r(transferCost), netFiscalImpact: r(revenue - transferCost),
    prePoints, postPoints,
    povertyBefore: preTax.filter((income) => income < p.minimumIncome).length,
    povertyAfter: afterTax.filter((income) => income < p.minimumIncome).length,
  };
}
