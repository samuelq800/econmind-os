import { calculateMarketEquilibrium } from "./supply-demand";
import { clamp, round, type EquationStep, type MarketParameters } from "./types";

export type PolicyParameters = MarketParameters & { wedge: number };
export type PolicyOutcome = { baselinePrice: number; baselineQuantity: number; consumerPrice: number; producerPrice: number; quantity: number; governmentBalance: number; consumerIncidence: number; producerIncidence: number; consumerShare: number; producerShare: number; deadweightLoss: number; valid: boolean };
export type IncidencePattern = "equal" | "consumer-majority" | "producer-majority";

const empty = (baselinePrice = 0, baselineQuantity = 0): PolicyOutcome => ({ baselinePrice, baselineQuantity, consumerPrice: 0, producerPrice: 0, quantity: 0, governmentBalance: 0, consumerIncidence: 0, producerIncidence: 0, consumerShare: 0, producerShare: 0, deadweightLoss: 0, valid: false });
const format = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

/** Solves Pc - Pp = wedge. Positive is a tax; negative is a subsidy. */
export function calculatePolicyOutcome(parameters: PolicyParameters): PolicyOutcome {
  const { demandIntercept: a, demandSlope: b, supplyIntercept: c, supplySlope: d, wedge } = parameters;
  const baseline = calculateMarketEquilibrium(parameters);
  const denominator = b + d;
  if (!baseline.valid || b <= 0 || d <= 0 || denominator <= 0) return empty();
  const consumerPrice = (a - c + d * wedge) / denominator;
  const producerPrice = consumerPrice - wedge;
  const quantity = a - b * consumerPrice;
  if (consumerPrice < 0 || producerPrice < 0 || quantity < 0) return empty(baseline.price, baseline.quantity);
  const size = Math.abs(wedge);
  const consumerIncidence = wedge >= 0 ? consumerPrice - baseline.price : baseline.price - consumerPrice;
  const producerIncidence = wedge >= 0 ? baseline.price - producerPrice : producerPrice - baseline.price;
  return {
    baselinePrice: baseline.price,
    baselineQuantity: baseline.quantity,
    consumerPrice: round(clamp(consumerPrice)),
    producerPrice: round(clamp(producerPrice)),
    quantity: round(clamp(quantity)),
    governmentBalance: round(wedge * quantity),
    consumerIncidence: round(clamp(consumerIncidence)),
    producerIncidence: round(clamp(producerIncidence)),
    consumerShare: size === 0 ? 0 : round(clamp(consumerIncidence) / size * 100, 1),
    producerShare: size === 0 ? 0 : round(clamp(producerIncidence) / size * 100, 1),
    deadweightLoss: round(0.5 * size * Math.abs(quantity - baseline.quantity)),
    valid: true,
  };
}

export function incidencePattern(outcome: PolicyOutcome): IncidencePattern {
  if (Math.abs(outcome.consumerShare - outcome.producerShare) < 0.2) return "equal";
  return outcome.consumerShare > outcome.producerShare ? "consumer-majority" : "producer-majority";
}

export function policyChartData(parameters: PolicyParameters, points = 51) {
  const { demandIntercept: a, demandSlope: b, supplyIntercept: c, supplySlope: d, wedge } = parameters;
  const maxQuantity = Math.max(a * 1.08, c * 1.2, 10);
  return Array.from({ length: points }, (_, index) => {
    const quantity = maxQuantity * index / (points - 1);
    const supply = (quantity - c) / d;
    return { quantity: round(quantity), demand: round(clamp((a - quantity) / b)), supply: round(clamp(supply)), policySupply: round(clamp(supply + wedge)) };
  });
}

export function policyExplanation(parameters: PolicyParameters) {
  const outcome = calculatePolicyOutcome(parameters);
  if (!outcome.valid) return "The selected policy is too large for a feasible non-negative equilibrium. Reduce the policy wedge.";
  if (Math.abs(parameters.wedge) < 0.01) return "With no tax or subsidy, buyers and sellers face the same market price and the market remains at its competitive equilibrium.";

  const size = format(Math.abs(parameters.wedge));
  const fiscal = parameters.wedge > 0
    ? `raises ${format(Math.abs(outcome.governmentBalance))} in government revenue`
    : `requires ${format(Math.abs(outcome.governmentBalance))} in government expenditure`;
  const opening = `A ${size} per-unit ${parameters.wedge > 0 ? "tax" : "subsidy"} creates a wedge between buyer and seller prices. Trade ${parameters.wedge > 0 ? "contracts" : "expands"} from ${format(outcome.baselineQuantity)} to ${format(outcome.quantity)} units, and the policy ${fiscal}.`;
  const pattern = incidencePattern(outcome);

  if (parameters.wedge > 0 && pattern === "equal") return `${opening} The tax burden is split equally: buyers pay ${format(outcome.consumerIncidence)} more per unit and sellers receive ${format(outcome.producerIncidence)} less per unit.`;
  if (parameters.wedge > 0 && pattern === "consumer-majority") return `${opening} Consumers bear the majority of the tax burden (${format(outcome.consumerShare)}%): the buyer price rises by ${format(outcome.consumerIncidence)}, while sellers bear ${format(outcome.producerShare)}% as their received price falls by ${format(outcome.producerIncidence)}. Demand is relatively less price-responsive than supply.`;
  if (parameters.wedge > 0) return `${opening} Producers bear the majority of the tax burden (${format(outcome.producerShare)}%): the seller price falls by ${format(outcome.producerIncidence)}, while consumers bear ${format(outcome.consumerShare)}% as the buyer price rises by ${format(outcome.consumerIncidence)}. Supply is relatively less price-responsive than demand.`;
  if (pattern === "equal") return `${opening} The subsidy benefit is split equally: buyers pay ${format(outcome.consumerIncidence)} less per unit and sellers receive ${format(outcome.producerIncidence)} more per unit.`;
  if (pattern === "consumer-majority") return `${opening} Consumers receive the majority of the subsidy benefit (${format(outcome.consumerShare)}%): the buyer price falls by ${format(outcome.consumerIncidence)}, while producers receive ${format(outcome.producerShare)}% through a ${format(outcome.producerIncidence)} increase in the seller price. Demand is relatively less price-responsive than supply.`;
  return `${opening} Producers receive the majority of the subsidy benefit (${format(outcome.producerShare)}%): the seller price rises by ${format(outcome.producerIncidence)}, while consumers receive ${format(outcome.consumerShare)}% through a ${format(outcome.consumerIncidence)} fall in the buyer price. Supply is relatively less price-responsive than demand.`;
}

export function policyEquationSteps(parameters: PolicyParameters): EquationStep[] {
  const outcome = calculatePolicyOutcome(parameters);
  const { demandIntercept: a, demandSlope: b, supplyIntercept: c, supplySlope: d, wedge } = parameters;
  const wedgeValue = wedge < 0 ? `(${format(wedge)})` : format(wedge);
  if (!outcome.valid) return [{ label: "No feasible solution", expression: "Qd = Qs and Pc − Pp = t", detail: "The selected wedge does not produce non-negative prices and quantity." }];
  return [
    { label: "Demand", expression: `Qd = a − bPc = ${format(a)} − ${format(b)}Pc` },
    { label: "Supply", expression: `Qs = c + dPp = ${format(c)} + ${format(d)}Pp` },
    { label: "Policy wedge", expression: `Pc − Pp = t = ${format(wedge)}`, detail: wedge > 0 ? "Positive t is a tax." : wedge < 0 ? "Negative t is a subsidy." : "With t = 0, Pc = Pp." },
    { label: "Substitute Pp = Pc − t", expression: `${format(a)} − ${format(b)}Pc = ${format(c)} + ${format(d)}(Pc − ${wedgeValue})` },
    { label: "Buyer price", expression: `Pc = (a − c + dt) / (b + d) = (${format(a)} − ${format(c)} + ${format(d)} × ${wedgeValue}) / (${format(b)} + ${format(d)}) = ${format(outcome.consumerPrice)}` },
    { label: "Seller price", expression: `Pp = Pc − t = ${format(outcome.consumerPrice)} − ${wedgeValue} = ${format(outcome.producerPrice)}` },
    { label: "Quantity", expression: `Q* = a − bPc = ${format(a)} − ${format(b)} × ${format(outcome.consumerPrice)} = ${format(outcome.quantity)}` },
  ];
}
