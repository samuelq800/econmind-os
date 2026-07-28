export type SupportedModelKey =
  | "supply-demand" | "policy" | "price-controls" | "elasticity" | "externalities" | "monopoly" | "ppf" | "ad-as"
  | "is-lm" | "phillips-curve" | "solow-growth" | "lorenz-gini" | "prisoners-dilemma" | "repeated-games" | "cournot"
  | "sandbox" | "policy-lab";

export type ModelParameterChange = {
  parameterKey: string;
  previousValue: number | string | boolean;
  currentValue: number | string | boolean;
  direction: "increase" | "decrease" | "unchanged";
  absoluteChange?: number;
  percentChange?: number | null;
  comparisonType: "previous-state" | "default-baseline" | "scenario-a";
  affectedEquations: string[];
  affectedCurves: string[];
  affectedOutputs: string[];
  updateOrder: number;
  changedAt: string;
};

export type ParameterEffect = Pick<ModelParameterChange, "affectedEquations" | "affectedCurves" | "affectedOutputs"> & { label?: string };

const effect = (affectedEquations: string[], affectedCurves: string[], affectedOutputs: string[], label?: string): ParameterEffect => ({ affectedEquations, affectedCurves, affectedOutputs, label });

/**
 * One metadata table keeps the explanation layer separate from calculation engines.
 * The strings name relationships, not numerical coefficients.
 */
export const PARAMETER_EFFECTS: Partial<Record<SupportedModelKey, Record<string, ParameterEffect>>> = {
  "supply-demand": {
    demandIntercept: effect(["Qd = a − bP"], ["Demand"], ["Equilibrium price", "Equilibrium quantity", "Consumer surplus"]),
    demandSlope: effect(["Qd = a − bP"], ["Demand (rotation)"], ["Equilibrium price", "Equilibrium quantity", "Consumer surplus"]),
    supplyIntercept: effect(["Qs = c + dP"], ["Supply"], ["Equilibrium price", "Equilibrium quantity", "Producer surplus"]),
    supplySlope: effect(["Qs = c + dP"], ["Supply (rotation)"], ["Equilibrium price", "Equilibrium quantity", "Producer surplus"]),
  },
  policy: { wedge: effect(["Pc − Pp = t"], ["Policy-adjusted supply"], ["Buyer price", "Seller price", "Quantity", "Government balance", "Deadweight loss"]) },
  "price-controls": { controlPrice: effect(["P ≤ ceiling / P ≥ floor"], ["Legal price line"], ["Quantity traded", "Shortage or surplus", "Deadweight loss"]), controlType: effect(["P ≤ ceiling / P ≥ floor"], ["Legal price line"], ["Quantity traded", "Shortage or surplus"]) },
  elasticity: { price: effect(["ε = |−b(P/Q)|", "TR = P × Q"], ["Demand (movement along)"], ["Quantity", "Elasticity", "Total revenue"]) },
  externalities: { externalCost: effect(["MSC = PMC + e"], ["Marginal social cost"], ["Efficient quantity", "Corrective policy", "Welfare gain"]) },
  monopoly: { marginalCost: effect(["MR = MC"], ["Marginal-cost line"], ["Monopoly output", "Price", "Profit", "Deadweight loss"]), fixedCost: effect(["π = (P − MC)Q − F"], [], ["Profit"]) },
  ppf: { growthRate: effect(["Xmax′, Ymax′"], ["PPF"], ["Capacity", "Output X", "Output Y"]), allocation: effect(["Y = Ymax[1 − (X/Xmax)^α]"], ["Production point"], ["Output X", "Output Y", "Opportunity cost"]), capacityUse: effect(["Actual output = capacity use × frontier output"], ["Production point"], ["Output X", "Output Y", "Capacity gap"]) },
  "ad-as": { demandShock: effect(["Y = Y* + ΔAD − a(P − 100)"], ["Aggregate demand"], ["Output", "Price level", "Output gap"]), supplyShock: effect(["Y = Y* + ΔSRAS + b(P − 100)"], ["Short-run aggregate supply"], ["Output", "Price level", "Output gap"]) },
  "is-lm": { governmentSpending: effect(["IS: Y = C + I + G"], ["IS"], ["Output", "Interest rate", "Investment", "Crowding out"]), taxation: effect(["C = C0 + c(Y − T)"], ["IS"], ["Output", "Interest rate", "Consumption"]), moneySupply: effect(["M/P = kY − hi"], ["LM"], ["Output", "Interest rate", "Investment"]), priceLevel: effect(["M/P = kY − hi"], ["LM"], ["Real money balances", "Output", "Interest rate"]) },
  "phillips-curve": { expectedInflation: effect(["π = πe − α(u − un) + v"], ["SRPC"], ["Inflation"]), supplyShock: effect(["π = πe − α(u − un) + v"], ["SRPC"], ["Inflation"]), unemployment: effect(["π = πe − α(u − un) + v"], ["Point on SRPC"], ["Inflation", "Unemployment gap"]), demandPressure: effect(["u_eff = u − d"], ["Point on SRPC"], ["Effective unemployment", "Inflation"]) },
  "solow-growth": { savingsRate: effect(["Δk = sf(k) − (n + g + δ)k"], ["Saving / investment"], ["Capital", "Output", "Consumption", "Steady state"]), depreciation: effect(["(n + g + δ)k"], ["Break-even investment"], ["Capital", "Steady state"]), technologyGrowth: effect(["(n + g + δ)k"], ["Break-even investment"], ["Capital", "Steady state"]), productivity: effect(["y = Ak^α"], ["Production / saving"], ["Output", "Capital", "Steady state"]) },
  "lorenz-gini": { taxRate: effect(["y′ = y − tax + transfer"], ["Post-policy Lorenz curve"], ["Post-policy Gini", "Revenue", "Net fiscal impact"]), transfer: effect(["y′ = y − tax + transfer"], ["Post-policy Lorenz curve"], ["Post-policy Gini", "Transfer cost", "Net fiscal impact"]), minimumIncome: effect(["y′ = max(M, y − tax + transfer)"], ["Post-policy Lorenz curve"], ["Post-policy Gini", "Transfer cost"]) },
  "prisoners-dilemma": { ccA: effect(["Payoff matrix"], ["Best-response correspondence"], ["Nash equilibria", "Pareto-efficient outcomes"]), cdA: effect(["Payoff matrix"], ["Best-response correspondence"], ["Nash equilibria", "Dominance"]), dcA: effect(["Payoff matrix"], ["Best-response correspondence"], ["Nash equilibria", "Dominance"]), ddA: effect(["Payoff matrix"], ["Best-response correspondence"], ["Nash equilibria", "Dominance"]) },
  "repeated-games": { discountFactor: effect(["V = Σ β^(t−1)u_t"], ["Continuation-value path"], ["Discounted payoff", "Cooperation incentives"]), futureInteractionProbability: effect(["β = δ × p"], ["Continuation-value path"], ["Discounted payoff", "Cooperation incentives"]), mistakeProbability: effect(["Deterministic error rule"], ["Action path"], ["Cooperation rate", "Cumulative payoff"]) },
  cournot: { marginalCost1: effect(["BR1(q2) = (a − c1 − bq2)/(2b)"], ["Firm 1 best response"], ["Firm 1 output", "Firm 2 output", "Price", "Profits"]), marginalCost2: effect(["BR2(q1) = (a − c2 − bq1)/(2b)"], ["Firm 2 best response"], ["Firm 1 output", "Firm 2 output", "Price", "Profits"]), quantity1: effect(["P = a − b(q1 + q2)"], ["Current quantity point"], ["Price", "Firm profits", "Consumer surplus"]), quantity2: effect(["P = a − b(q1 + q2)"], ["Current quantity point"], ["Price", "Firm profits", "Consumer surplus"]) },
  sandbox: { governmentSpending: effect(["Sandbox contribution ledger"], ["GDP / inflation indicator response"], ["GDP index", "Inflation", "Government revenue"]), interestRate: effect(["Sandbox contribution ledger"], ["Monetary-policy contribution"], ["GDP index", "Inflation", "Unemployment"]), carbonTax: effect(["Sandbox contribution ledger"], ["Environmental-policy contribution"], ["Carbon emissions", "Government revenue", "Consumer welfare"]) },
  "policy-lab": { governmentSpending: effect(["Shared Sandbox contribution ledger"], ["Policy transmission"], ["Priority score", "GDP index", "Inflation"]), interestRate: effect(["Shared Sandbox contribution ledger"], ["Policy transmission"], ["Priority score", "Inflation", "Unemployment"]) },
};

function genericLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function getParameterEffect(modelKey: SupportedModelKey | undefined, parameterKey: string): ParameterEffect {
  return PARAMETER_EFFECTS[modelKey ?? "supply-demand"]?.[parameterKey]
    ?? effect(["Current model relationship"], ["Model response"], ["Displayed outcomes"], genericLabel(parameterKey));
}

export function meaningfulNumberChange(previous: number, current: number, tolerance = 1e-7) {
  return Math.abs(current - previous) > Math.max(tolerance, Math.abs(previous) * 1e-6);
}

export function describeParameterChange(input: {
  modelKey?: SupportedModelKey;
  parameterKey: string;
  previousValue: number | string | boolean;
  currentValue: number | string | boolean;
  comparisonType?: ModelParameterChange["comparisonType"];
  updateOrder?: number;
}): ModelParameterChange | null {
  const { previousValue, currentValue } = input;
  const bothNumbers = typeof previousValue === "number" && typeof currentValue === "number";
  if (bothNumbers && !meaningfulNumberChange(previousValue, currentValue)) return null;
  if (!bothNumbers && previousValue === currentValue) return null;
  const numericChange = bothNumbers ? currentValue - previousValue : undefined;
  const metadata = getParameterEffect(input.modelKey, input.parameterKey);
  return {
    parameterKey: input.parameterKey,
    previousValue,
    currentValue,
    direction: !bothNumbers ? "unchanged" : numericChange! > 0 ? "increase" : "decrease",
    absoluteChange: numericChange,
    percentChange: bothNumbers && Math.abs(previousValue) > 1e-9 ? numericChange! / Math.abs(previousValue) * 100 : null,
    comparisonType: input.comparisonType ?? "previous-state",
    affectedEquations: metadata.affectedEquations,
    affectedCurves: metadata.affectedCurves,
    affectedOutputs: metadata.affectedOutputs,
    updateOrder: input.updateOrder ?? 1,
    changedAt: new Date().toISOString(),
  };
}

export function parameterLabel(modelKey: SupportedModelKey | undefined, key: string) {
  return getParameterEffect(modelKey, key).label ?? genericLabel(key);
}
