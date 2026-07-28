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
  const totalOutput = Math.max(0, p.quantity1 + p.quantity2);
  const price = Math.max(0, p.demandIntercept - p.demandSlope * totalOutput);
  const profit1 = (price - p.marginalCost1) * p.quantity1;
  const profit2 = (price - p.marginalCost2) * p.quantity2;
  const bestResponse1 = Math.max(0, (p.demandIntercept - p.marginalCost1 - p.demandSlope * p.quantity2) / (2 * p.demandSlope));
  const bestResponse2 = Math.max(0, (p.demandIntercept - p.marginalCost2 - p.demandSlope * p.quantity1) / (2 * p.demandSlope));
  const equilibrium1 = Math.max(0, (p.demandIntercept - 2 * p.marginalCost1 + p.marginalCost2) / (3 * p.demandSlope));
  const equilibrium2 = Math.max(0, (p.demandIntercept - 2 * p.marginalCost2 + p.marginalCost1) / (3 * p.demandSlope));
  const equilibriumTotal = equilibrium1 + equilibrium2;
  const equilibriumPrice = Math.max(0, p.demandIntercept - p.demandSlope * equilibriumTotal);
  const lowCost = Math.min(p.marginalCost1, p.marginalCost2);
  const competitiveOutput = Math.max(0, (p.demandIntercept - lowCost) / p.demandSlope);
  const consumerSurplus = 0.5 * totalOutput * Math.max(0, p.demandIntercept - price);
  const producerSurplus = profit1 + profit2;
  const totalWelfare = consumerSurplus + producerSurplus;
  const competitiveWelfare = 0.5 * competitiveOutput * Math.max(0, p.demandIntercept - lowCost);
  const monopolyOutput = Math.max(0, (p.demandIntercept - lowCost) / (2 * p.demandSlope));
  return {
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
      responseOfFirm1: r(Math.max(0, (p.demandIntercept - p.marginalCost1 - p.demandSlope * q) / (2 * p.demandSlope))),
    };
  });
}
