import { calculateAdAs, DEFAULT_AD_AS } from "@/lib/economics/ad-as";
import { calculateElasticity } from "@/lib/economics/elasticity";
import { calculateExternality, DEFAULT_EXTERNALITY } from "@/lib/economics/externalities";
import { calculateMonopoly, DEFAULT_MONOPOLY } from "@/lib/economics/monopoly";
import { calculatePolicyOutcome } from "@/lib/economics/policy";
import { calculatePpf, DEFAULT_PPF } from "@/lib/economics/ppf";
import { calculatePriceControl, DEFAULT_PRICE_CONTROLS } from "@/lib/economics/price-controls";
import { calculateMarketEquilibrium, DEFAULT_MARKET } from "@/lib/economics/supply-demand";

export const FOCUSED_MODEL_KEYS = ["supply-demand", "policy", "price-controls", "elasticity", "externalities", "monopoly", "ppf", "ad-as"] as const;
export type FocusedModelKey = (typeof FOCUSED_MODEL_KEYS)[number];

export type ExperimentParameterDefinition = {
  key: string;
  label: string;
  symbol: string;
  description: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

const marketParameters: ExperimentParameterDefinition[] = [
  { key: "demandIntercept", label: "Demand intercept", symbol: "a", description: "Quantity demanded when price is zero.", min: 60, max: 160, step: 5, defaultValue: 100 },
  { key: "demandSlope", label: "Demand slope", symbol: "b", description: "Buyer responsiveness to price.", min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
  { key: "supplyIntercept", label: "Supply intercept", symbol: "c", description: "Quantity supplied when price is zero.", min: 0, max: 60, step: 5, defaultValue: 20 },
  { key: "supplySlope", label: "Supply slope", symbol: "d", description: "Seller responsiveness to price.", min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
];

export const MODEL_PARAMETER_DEFINITIONS: Record<FocusedModelKey, readonly ExperimentParameterDefinition[]> = {
  "supply-demand": marketParameters,
  policy: [...marketParameters, { key: "wedge", label: "Policy per unit", symbol: "t / s", description: "Positive is a tax; negative is a subsidy.", min: -20, max: 30, step: 1, defaultValue: 10 }],
  "price-controls": [...marketParameters, { key: "controlType", label: "Control type", symbol: "type", description: "0 is a ceiling; 1 is a floor.", min: 0, max: 1, step: 1, defaultValue: 0 }, { key: "controlPrice", label: "Controlled price", symbol: "Pc", description: "Legal maximum or minimum price.", min: 0, max: 60, step: 1, defaultValue: 15 }],
  elasticity: [
    { key: "demandIntercept", label: "Demand intercept", symbol: "a", description: "Quantity demanded when price is zero.", min: 60, max: 160, step: 5, defaultValue: 100 },
    { key: "demandSlope", label: "Demand slope", symbol: "b", description: "Absolute quantity change per unit of price.", min: 0.5, max: 5, step: 0.5, defaultValue: 2 },
    { key: "price", label: "Current price", symbol: "P", description: "Operating point for elasticity and revenue.", min: 1, max: 45, step: 1, defaultValue: 25 },
  ],
  externalities: [...marketParameters, { key: "externalCost", label: "External cost per unit", symbol: "e", description: "Negative values represent an external benefit.", min: -20, max: 30, step: 1, defaultValue: 10 }],
  monopoly: [
    { key: "demandIntercept", label: "Demand intercept", symbol: "a", description: "Quantity demanded when price is zero.", min: 60, max: 180, step: 5, defaultValue: DEFAULT_MONOPOLY.demandIntercept },
    { key: "demandSlope", label: "Demand slope", symbol: "b", description: "Price sensitivity of market demand.", min: 0.5, max: 5, step: 0.5, defaultValue: DEFAULT_MONOPOLY.demandSlope },
    { key: "marginalCost", label: "Marginal cost", symbol: "MC", description: "Constant cost of one more unit.", min: 0, max: 40, step: 1, defaultValue: DEFAULT_MONOPOLY.marginalCost },
    { key: "fixedCost", label: "Fixed cost", symbol: "F", description: "Cost independent of output.", min: 0, max: 500, step: 10, defaultValue: DEFAULT_MONOPOLY.fixedCost },
  ],
  ppf: [
    { key: "capacityX", label: "Maximum Good X", symbol: "Xmax", description: "Specialized capacity for Good X.", min: 50, max: 200, step: 5, defaultValue: DEFAULT_PPF.capacityX },
    { key: "capacityY", label: "Maximum Good Y", symbol: "Ymax", description: "Specialized capacity for Good Y.", min: 50, max: 200, step: 5, defaultValue: DEFAULT_PPF.capacityY },
    { key: "curvature", label: "Opportunity-cost curvature", symbol: "α", description: "How sharply marginal opportunity cost rises.", min: 1, max: 3, step: 0.1, defaultValue: DEFAULT_PPF.curvature },
    { key: "allocation", label: "Resources toward X", symbol: "s", description: "Location along the frontier.", min: 0, max: 100, step: 1, defaultValue: DEFAULT_PPF.allocation },
    { key: "capacityUse", label: "Capacity use", symbol: "u", description: "Use of available productive capacity.", min: 50, max: 120, step: 1, defaultValue: DEFAULT_PPF.capacityUse },
    { key: "growthRate", label: "Capacity shift", symbol: "g", description: "Technology or resource change.", min: -25, max: 40, step: 1, defaultValue: DEFAULT_PPF.growthRate },
  ],
  "ad-as": [
    { key: "potentialOutput", label: "Potential output", symbol: "Y*", description: "Long-run productive benchmark.", min: 80, max: 140, step: 1, defaultValue: DEFAULT_AD_AS.potentialOutput },
    { key: "demandShock", label: "Aggregate demand shock", symbol: "ΔAD", description: "Horizontal demand displacement.", min: -25, max: 25, step: 1, defaultValue: DEFAULT_AD_AS.demandShock },
    { key: "supplyShock", label: "Short-run supply shock", symbol: "ΔSRAS", description: "Horizontal short-run supply displacement.", min: -25, max: 25, step: 1, defaultValue: DEFAULT_AD_AS.supplyShock },
    { key: "demandSensitivity", label: "Demand sensitivity", symbol: "a", description: "Output response along AD.", min: 0.3, max: 1.5, step: 0.1, defaultValue: DEFAULT_AD_AS.demandSensitivity },
    { key: "supplySensitivity", label: "Supply sensitivity", symbol: "b", description: "Output response along SRAS.", min: 0.3, max: 1.5, step: 0.1, defaultValue: DEFAULT_AD_AS.supplySensitivity },
  ],
};

export function defaultModelParameters(modelKey: FocusedModelKey) {
  return Object.fromEntries(MODEL_PARAMETER_DEFINITIONS[modelKey].map((definition) => [definition.key, definition.defaultValue]));
}

export function sanitizeModelParameters(modelKey: FocusedModelKey, input: Record<string, unknown>) {
  return Object.fromEntries(MODEL_PARAMETER_DEFINITIONS[modelKey].map((definition) => {
    const raw = Number(input[definition.key] ?? definition.defaultValue);
    const value = Number.isFinite(raw) ? Math.min(definition.max, Math.max(definition.min, raw)) : definition.defaultValue;
    return [definition.key, Math.round(value / definition.step) * definition.step];
  }));
}

export function runFocusedModel(modelKey: FocusedModelKey, input: Record<string, unknown>): Record<string, number> {
  const p = sanitizeModelParameters(modelKey, input);
  switch (modelKey) {
    case "supply-demand": {
      const r = calculateMarketEquilibrium(p as typeof DEFAULT_MARKET);
      return { price: r.price, quantity: r.quantity, consumerSurplus: r.consumerSurplus, producerSurplus: r.producerSurplus, totalSurplus: r.totalSurplus, valid: Number(r.valid) };
    }
    case "policy": {
      const r = calculatePolicyOutcome(p as typeof DEFAULT_MARKET & { wedge: number });
      return { consumerPrice: r.consumerPrice, producerPrice: r.producerPrice, quantity: r.quantity, governmentBalance: r.governmentBalance, consumerShare: r.consumerShare, producerShare: r.producerShare, deadweightLoss: r.deadweightLoss, valid: Number(r.valid) };
    }
    case "price-controls": {
      const r = calculatePriceControl({ ...p, controlType: p.controlType === 1 ? "floor" : "ceiling" } as typeof DEFAULT_PRICE_CONTROLS);
      return { equilibriumPrice: r.equilibriumPrice, controlledPrice: r.controlledPrice, quantityTraded: r.quantityTraded, shortage: r.shortage, surplus: r.surplus, totalSurplus: r.totalSurplus, deadweightLoss: r.deadweightLoss, binding: Number(r.binding), valid: Number(r.valid) };
    }
    case "elasticity": {
      const r = calculateElasticity(p as { demandIntercept: number; demandSlope: number; price: number });
      return { price: p.price, quantity: r.quantity, elasticity: r.elasticity, totalRevenue: r.totalRevenue, revenueMaximizingPrice: r.revenueMaximizingPrice, valid: Number(r.valid) };
    }
    case "externalities": {
      const r = calculateExternality(p as typeof DEFAULT_EXTERNALITY);
      return { marketPrice: r.marketPrice, marketQuantity: r.marketQuantity, efficientQuantity: r.efficientQuantity, correctivePolicy: r.correctivePolicy, externalImpact: r.externalImpactAtMarket, welfareGain: r.welfareGain, socialWelfare: r.socialWelfareEfficient, valid: Number(r.valid) };
    }
    case "monopoly": {
      const r = calculateMonopoly(p as typeof DEFAULT_MONOPOLY);
      return { monopolyPrice: r.monopolyPrice, monopolyQuantity: r.monopolyQuantity, competitivePrice: r.competitivePrice, competitiveQuantity: r.competitiveQuantity, profit: r.profit, markup: r.markup, lernerIndex: r.lernerIndex, deadweightLoss: r.deadweightLoss, valid: Number(r.valid) };
    }
    case "ppf": {
      const r = calculatePpf(p as typeof DEFAULT_PPF);
      return { outputX: r.outputX, outputY: r.outputY, opportunityCost: r.opportunityCost, capacityGap: r.capacityGap, shiftedCapacityX: r.shiftedCapacityX, shiftedCapacityY: r.shiftedCapacityY, statusCode: r.status === "Efficient" ? 1 : r.status === "Inefficient" ? 0 : -1, valid: Number(r.valid) };
    }
    case "ad-as": {
      const r = calculateAdAs(p as typeof DEFAULT_AD_AS);
      return { output: r.output, priceLevel: r.priceLevel, outputGap: r.outputGap, inflationPressure: r.inflationPressure, unemploymentGap: r.unemploymentGap, valid: Number(r.valid) };
    }
  }
}
