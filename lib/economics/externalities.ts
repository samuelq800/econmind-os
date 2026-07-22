import { clamp, round, type MarketParameters } from "./types";
import { calculateMarketEquilibrium } from "./supply-demand";

export type ExternalityParameters = MarketParameters & {
  externalCost: number;
};

export type ExternalityOutcome = {
  marketPrice: number;
  marketQuantity: number;
  efficientConsumerPrice: number;
  efficientProducerPrice: number;
  efficientQuantity: number;
  correctivePolicy: number;
  externalImpactAtMarket: number;
  socialWelfareAtMarket: number;
  socialWelfareEfficient: number;
  welfareGain: number;
  valid: boolean;
};

export const DEFAULT_EXTERNALITY: ExternalityParameters = {
  demandIntercept: 100,
  demandSlope: 2,
  supplyIntercept: 20,
  supplySlope: 2,
  externalCost: 10,
};

export function calculateExternality(parameters: ExternalityParameters): ExternalityOutcome {
  const { demandIntercept: a, demandSlope: b, supplyIntercept: c, supplySlope: d, externalCost: e } = parameters;
  const market = calculateMarketEquilibrium(parameters);
  if (!market.valid || b <= 0 || d <= 0 || !Number.isFinite(e)) {
    return { marketPrice: 0, marketQuantity: 0, efficientConsumerPrice: 0, efficientProducerPrice: 0, efficientQuantity: 0, correctivePolicy: 0, externalImpactAtMarket: 0, socialWelfareAtMarket: 0, socialWelfareEfficient: 0, welfareGain: 0, valid: false };
  }

  const efficientQuantity = clamp((d * a + b * c - b * d * e) / (b + d));
  const efficientConsumerPrice = clamp((a - efficientQuantity) / b);
  const efficientProducerPrice = clamp((efficientQuantity - c) / d);
  const externalImpactAtMarket = e * market.quantity;
  const socialWelfareAtMarket = market.totalSurplus - externalImpactAtMarket;
  const welfareGain = 0.5 * Math.abs(e) * Math.abs(market.quantity - efficientQuantity);

  return {
    marketPrice: market.price,
    marketQuantity: market.quantity,
    efficientConsumerPrice: round(efficientConsumerPrice),
    efficientProducerPrice: round(efficientProducerPrice),
    efficientQuantity: round(efficientQuantity),
    correctivePolicy: round(e),
    externalImpactAtMarket: round(externalImpactAtMarket),
    socialWelfareAtMarket: round(socialWelfareAtMarket),
    socialWelfareEfficient: round(socialWelfareAtMarket + welfareGain),
    welfareGain: round(welfareGain),
    valid: true,
  };
}

export function externalityChartData(parameters: ExternalityParameters, points = 51) {
  const outcome = calculateExternality(parameters);
  const maxQuantity = Math.max(parameters.demandIntercept * 1.05, outcome.efficientQuantity * 1.15, 10);
  return Array.from({ length: points }, (_, index) => {
    const quantity = maxQuantity * index / (points - 1);
    const privateCost = (quantity - parameters.supplyIntercept) / parameters.supplySlope;
    return {
      quantity: round(quantity),
      demand: round(clamp((parameters.demandIntercept - quantity) / parameters.demandSlope)),
      privateCost: round(clamp(privateCost)),
      socialCost: round(clamp(privateCost + parameters.externalCost)),
    };
  });
}

export function externalityExplanation(parameters: ExternalityParameters, outcome = calculateExternality(parameters)) {
  if (!outcome.valid) return "These assumptions do not produce a feasible market comparison.";
  if (Math.abs(parameters.externalCost) < 0.01) return `Private and social incentives coincide, so the market quantity of ${outcome.marketQuantity} is already efficient.`;
  if (parameters.externalCost > 0) return `Each unit creates an external cost of ${round(parameters.externalCost)}. The unregulated market produces ${outcome.marketQuantity}, above the efficient quantity of ${outcome.efficientQuantity}. A corrective tax of ${outcome.correctivePolicy} per unit aligns private supply with social cost and recovers ${outcome.welfareGain} of potential welfare.`;
  return `Each unit creates an external benefit of ${round(Math.abs(parameters.externalCost))}. The market produces ${outcome.marketQuantity}, below the efficient quantity of ${outcome.efficientQuantity}. A corrective subsidy of ${round(Math.abs(outcome.correctivePolicy))} per unit aligns private incentives with social value and recovers ${outcome.welfareGain} of potential welfare.`;
}
