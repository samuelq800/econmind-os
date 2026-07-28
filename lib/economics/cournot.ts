export type CournotParameters = {
  demandIntercept: number;
  demandSlope: number;
  marginalCost1: number;
  marginalCost2: number;
  quantity1: number;
  quantity2: number;
};

export const DEFAULT_COURNOT: CournotParameters = {
  demandIntercept: 100, demandSlope: 1, marginalCost1: 20, marginalCost2: 20, quantity1: 30, quantity2: 30,
};

const r = (value: number, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;

export function calculateCournot(p: CournotParameters) {
  if (!Object.values(p).every(Number.isFinite) || p.demandIntercept <= 0 || p.demandSlope <= 0 || p.marginalCost1 < 0 || p.marginalCost2 < 0 || p.quantity1 < 0 || p.quantity2 < 0) {
    return { valid: false, totalOutput: 0, price: 0, profit1: 0, profit2: 0, bestResponse1: 0, bestResponse2: 0, equilibrium1: 0, equilibrium2: 0, equilibriumTotal: 0, equilibriumPrice: 0, consumerSurplus: 0, producerSurplus: 0, totalWelfare: 0, competitiveOutput: 0, monopolyOutput: 0, deadweightLoss: 0 };
  }
  const totalOutput = Math.max(0, p.quantity1 + p.quantity2);
  const chokeOutput = p.demandIntercept / p.demandSlope;
  const price = Math.max(0, p.demandIntercept - p.demandSlope * totalOutput);
  const profit1 = (price - p.marginalCost1) * p.quantity1;
  const profit2 = (price - p.marginalCost2) * p.quantity2;
  const bestResponse1 = Math.max(0, (p.demandIntercept - p.marginalCost1 - p.demandSlope * p.quantity2) / (2 * p.demandSlope));
  const bestResponse2 = Math.max(0, (p.demandIntercept - p.marginalCost2 - p.demandSlope * p.quantity1) / (2 * p.demandSlope));
  let equilibrium1 = (p.demandIntercept - 2 * p.marginalCost1 + p.marginalCost2) / (3 * p.demandSlope);
  let equilibrium2 = (p.demandIntercept - 2 * p.marginalCost2 + p.marginalCost1) / (3 * p.demandSlope);
  if (equilibrium1 < 0) {
    equilibrium1 = 0;
    equilibrium2 = Math.max(0, (p.demandIntercept - p.marginalCost2) / (2 * p.demandSlope));
  } else if (equilibrium2 < 0) {
    equilibrium2 = 0;
    equilibrium1 = Math.max(0, (p.demandIntercept - p.marginalCost1) / (2 * p.demandSlope));
  }
  const equilibriumTotal = equilibrium1 + equilibrium2;
  const equilibriumPrice = Math.max(0, p.demandIntercept - p.demandSlope * equilibriumTotal);
  const lowCost = Math.min(p.marginalCost1, p.marginalCost2);
  const competitiveOutput = Math.max(0, (p.demandIntercept - lowCost) / p.demandSlope);
  // Linear demand reaches zero price at a / b.  If a user enters more output
  // than that, the additional units have no willingness-to-pay and therefore
  // cannot add consumer surplus.
  const quantityPurchased = Math.min(totalOutput, chokeOutput);
  const consumerSurplus = 0.5 * quantityPurchased * Math.max(0, p.demandIntercept - price);
  const producerSurplus = profit1 + profit2;
  const totalWelfare = consumerSurplus + producerSurplus;
  const competitiveWelfare = 0.5 * competitiveOutput * Math.max(0, p.demandIntercept - lowCost);
  const monopolyOutput = Math.max(0, (p.demandIntercept - lowCost) / (2 * p.demandSlope));
  return {
    valid: true,
    totalOutput: r(totalOutput), price: r(price), profit1: r(profit1), profit2: r(profit2),
    bestResponse1: r(bestResponse1), bestResponse2: r(bestResponse2),
    equilibrium1: r(equilibrium1), equilibrium2: r(equilibrium2), equilibriumTotal: r(equilibriumTotal), equilibriumPrice: r(equilibriumPrice),
    consumerSurplus: r(consumerSurplus), producerSurplus: r(producerSurplus), totalWelfare: r(totalWelfare),
    competitiveOutput: r(competitiveOutput), monopolyOutput: r(monopolyOutput), deadweightLoss: r(Math.max(0, competitiveWelfare - totalWelfare)),
  };
}

export function cournotChartData(p: CournotParameters) {
  const maximum = Math.max(100, p.demandIntercept / Math.max(0.2, p.demandSlope));
  return Array.from({ length: 31 }, (_, index) => {
    const q = (maximum * index) / 30;
    return {
      quantity1: r(q),
      responseOfFirm2: r(Math.max(0, (p.demandIntercept - p.marginalCost2 - p.demandSlope * q) / (2 * p.demandSlope))),
      // The chart uses q1 on the horizontal axis and q2 on the vertical axis.
      // Rearranging q1 = BR1(q2) produces Firm 1's best-response locus in
      // those coordinates (rather than plotting BR1 against the wrong axis).
      responseOfFirm1: r(Math.max(0, (p.demandIntercept - p.marginalCost1 - 2 * p.demandSlope * q) / p.demandSlope)),
    };
  });
}
