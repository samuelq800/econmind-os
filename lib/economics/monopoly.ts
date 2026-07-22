import { clamp, round } from "./types";

export type MonopolyParameters = {
  demandIntercept: number;
  demandSlope: number;
  marginalCost: number;
  fixedCost: number;
};

export type MonopolyOutcome = {
  monopolyPrice: number;
  monopolyQuantity: number;
  competitivePrice: number;
  competitiveQuantity: number;
  profit: number;
  consumerSurplus: number;
  totalSurplus: number;
  deadweightLoss: number;
  markup: number;
  lernerIndex: number;
  valid: boolean;
};

export const DEFAULT_MONOPOLY: MonopolyParameters = {
  demandIntercept: 100,
  demandSlope: 2,
  marginalCost: 10,
  fixedCost: 100,
};

export function calculateMonopoly(parameters: MonopolyParameters): MonopolyOutcome {
  const { demandIntercept: a, demandSlope: b, marginalCost: mc, fixedCost } = parameters;
  if (a <= 0 || b <= 0 || mc < 0 || fixedCost < 0 || ![a, b, mc, fixedCost].every(Number.isFinite)) {
    return { monopolyPrice: 0, monopolyQuantity: 0, competitivePrice: 0, competitiveQuantity: 0, profit: 0, consumerSurplus: 0, totalSurplus: 0, deadweightLoss: 0, markup: 0, lernerIndex: 0, valid: false };
  }

  const chokePrice = a / b;
  const competitiveQuantity = clamp(a - b * mc);
  const monopolyQuantity = clamp((a - b * mc) / 2);
  const monopolyPrice = monopolyQuantity > 0 ? (a - monopolyQuantity) / b : chokePrice;
  const markup = clamp(monopolyPrice - mc);
  const operatingProfit = markup * monopolyQuantity;
  const consumerSurplus = 0.5 * clamp(chokePrice - monopolyPrice) * monopolyQuantity;
  const totalSurplus = consumerSurplus + operatingProfit;
  const competitiveSurplus = 0.5 * clamp(chokePrice - mc) * competitiveQuantity;
  const deadweightLoss = clamp(competitiveSurplus - totalSurplus);

  return {
    monopolyPrice: round(monopolyPrice),
    monopolyQuantity: round(monopolyQuantity),
    competitivePrice: round(mc),
    competitiveQuantity: round(competitiveQuantity),
    profit: round(operatingProfit - fixedCost),
    consumerSurplus: round(consumerSurplus),
    totalSurplus: round(totalSurplus),
    deadweightLoss: round(deadweightLoss),
    markup: round(markup),
    lernerIndex: monopolyPrice > 0 ? round(markup / monopolyPrice, 3) : 0,
    valid: true,
  };
}

export function monopolyChartData(parameters: MonopolyParameters, points = 51) {
  const maxQuantity = Math.max(parameters.demandIntercept * 1.02, 10);
  return Array.from({ length: points }, (_, index) => {
    const quantity = maxQuantity * index / (points - 1);
    return {
      quantity: round(quantity),
      demand: round(clamp((parameters.demandIntercept - quantity) / parameters.demandSlope)),
      marginalRevenue: round(clamp((parameters.demandIntercept - 2 * quantity) / parameters.demandSlope)),
      marginalCost: round(parameters.marginalCost),
    };
  });
}

export function monopolyExplanation(parameters: MonopolyParameters, outcome = calculateMonopoly(parameters)) {
  if (!outcome.valid) return "These assumptions do not produce a valid monopoly comparison.";
  return `The firm expands output until marginal revenue equals marginal cost, producing ${outcome.monopolyQuantity} units and charging ${outcome.monopolyPrice}. A competitive market with the same marginal cost would produce ${outcome.competitiveQuantity} units at a price of ${outcome.competitivePrice}. Restricting output creates a markup of ${outcome.markup} and deadweight loss of ${outcome.deadweightLoss}. Fixed cost changes profit, but not the MR = MC output decision in this simplified model.`;
}
