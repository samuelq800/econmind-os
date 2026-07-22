import { clamp, round, type MarketParameters } from "@/lib/economics/types";

export type PriceControlType = "ceiling" | "floor";
export type PriceControlParameters = MarketParameters & {
  controlType: PriceControlType;
  controlPrice: number;
};

export type PriceControlOutcome = {
  valid: boolean;
  binding: boolean;
  equilibriumPrice: number;
  equilibriumQuantity: number;
  controlledPrice: number;
  quantityDemanded: number;
  quantitySupplied: number;
  quantityTraded: number;
  shortage: number;
  surplus: number;
  consumerSurplus: number;
  producerSurplus: number;
  totalSurplus: number;
  deadweightLoss: number;
};

export const DEFAULT_PRICE_CONTROLS: PriceControlParameters = {
  demandIntercept: 100,
  demandSlope: 2,
  supplyIntercept: 20,
  supplySlope: 2,
  controlType: "ceiling",
  controlPrice: 15,
};

export function calculatePriceControl(parameters: PriceControlParameters): PriceControlOutcome {
  const { demandIntercept: a, demandSlope: b, supplyIntercept: c, supplySlope: d, controlType } = parameters;
  if (![a, b, c, d, parameters.controlPrice].every(Number.isFinite) || b <= 0 || d <= 0 || a <= c) {
    return { valid: false, binding: false, equilibriumPrice: 0, equilibriumQuantity: 0, controlledPrice: 0, quantityDemanded: 0, quantitySupplied: 0, quantityTraded: 0, shortage: 0, surplus: 0, consumerSurplus: 0, producerSurplus: 0, totalSurplus: 0, deadweightLoss: 0 };
  }

  const equilibriumPrice = (a - c) / (b + d);
  const equilibriumQuantity = a - b * equilibriumPrice;
  const controlledPrice = clamp(parameters.controlPrice, 0, 200);
  const binding = controlType === "ceiling" ? controlledPrice < equilibriumPrice : controlledPrice > equilibriumPrice;
  const effectivePrice = binding ? controlledPrice : equilibriumPrice;
  const quantityDemanded = clamp(a - b * effectivePrice);
  const quantitySupplied = clamp(c + d * effectivePrice);
  const quantityTraded = binding ? Math.min(quantityDemanded, quantitySupplied) : equilibriumQuantity;
  const shortage = binding && controlType === "ceiling" ? clamp(quantityDemanded - quantitySupplied) : 0;
  const surplus = binding && controlType === "floor" ? clamp(quantitySupplied - quantityDemanded) : 0;

  // Surplus is calculated for the units that actually trade. This assumes
  // efficient rationing: the highest-value buyers and lowest-cost sellers trade first.
  const demandChokePrice = a / b;
  const supplyPriceIntercept = -c / d;
  const consumerSurplus = clamp(demandChokePrice * quantityTraded - quantityTraded ** 2 / (2 * b) - effectivePrice * quantityTraded);
  const producerSurplus = clamp(effectivePrice * quantityTraded - (quantityTraded ** 2 / (2 * d) + supplyPriceIntercept * quantityTraded));
  const baselineConsumerSurplus = 0.5 * (demandChokePrice - equilibriumPrice) * equilibriumQuantity;
  const baselineProducerSurplus = 0.5 * (equilibriumPrice - supplyPriceIntercept) * equilibriumQuantity;
  const totalSurplus = consumerSurplus + producerSurplus;
  const deadweightLoss = clamp(baselineConsumerSurplus + baselineProducerSurplus - totalSurplus);

  return {
    valid: true,
    binding,
    equilibriumPrice: round(equilibriumPrice),
    equilibriumQuantity: round(equilibriumQuantity),
    controlledPrice: round(effectivePrice),
    quantityDemanded: round(quantityDemanded),
    quantitySupplied: round(quantitySupplied),
    quantityTraded: round(quantityTraded),
    shortage: round(shortage),
    surplus: round(surplus),
    consumerSurplus: round(consumerSurplus),
    producerSurplus: round(producerSurplus),
    totalSurplus: round(totalSurplus),
    deadweightLoss: round(deadweightLoss),
  };
}

export function priceControlChartData(parameters: PriceControlParameters) {
  const maxQuantity = Math.max(parameters.demandIntercept, parameters.supplyIntercept + parameters.supplySlope * 60, 100);
  return Array.from({ length: 41 }, (_, index) => {
    const quantity = maxQuantity * index / 40;
    return {
      quantity: round(quantity),
      demand: round(clamp((parameters.demandIntercept - quantity) / Math.max(parameters.demandSlope, 0.001))),
      supply: round(clamp((quantity - parameters.supplyIntercept) / Math.max(parameters.supplySlope, 0.001))),
    };
  });
}

export function priceControlExplanation(parameters: PriceControlParameters, outcome: PriceControlOutcome) {
  if (!outcome.valid) return "The selected slopes and intercepts do not produce a valid positive market equilibrium.";
  if (!outcome.binding) return `The ${parameters.controlType} is non-binding because it does not constrain the equilibrium price of ${outcome.equilibriumPrice}. Market quantity and welfare are unchanged.`;
  if (parameters.controlType === "ceiling") return `The ceiling holds price below equilibrium. Buyers demand ${outcome.quantityDemanded} units while sellers supply ${outcome.quantitySupplied}, creating a shortage of ${outcome.shortage}. Only ${outcome.quantityTraded} units trade under the simplified efficient-rationing assumption.`;
  return `The floor holds price above equilibrium. Sellers offer ${outcome.quantitySupplied} units while buyers demand ${outcome.quantityDemanded}, creating a surplus of ${outcome.surplus}. Only ${outcome.quantityTraded} units trade.`;
}
