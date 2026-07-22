import type { EquationStep } from "@/lib/economics/types";
import { MODEL_PARAMETER_DEFINITIONS, defaultModelParameters, runFocusedModel, sanitizeModelParameters, type FocusedModelKey } from "@/lib/experiments/model-runtime";

export type MechanismStep = { stage: string; text: string };
const f = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

function changeContext(modelKey: FocusedModelKey, parameters: Record<string, unknown>, changedKey?: string | null) {
  const clean = sanitizeModelParameters(modelKey, parameters);
  const defaults = defaultModelParameters(modelKey);
  const key = changedKey && keyExists(modelKey, changedKey) ? changedKey : MODEL_PARAMETER_DEFINITIONS[modelKey].find((item) => clean[item.key] !== defaults[item.key])?.key ?? MODEL_PARAMETER_DEFINITIONS[modelKey][0].key;
  const definition = MODEL_PARAMETER_DEFINITIONS[modelKey].find((item) => item.key === key)!;
  const direction = clean[key] > defaults[key] ? "increased" : clean[key] < defaults[key] ? "decreased" : "is at its baseline";
  return { clean, defaults, key, definition, direction, result: runFocusedModel(modelKey, clean) };
}

function keyExists(modelKey: FocusedModelKey, key: string) {
  return MODEL_PARAMETER_DEFINITIONS[modelKey].some((item) => item.key === key);
}

const affected = (changed: string, ...terms: string[]) => terms.includes(changed) ? [changed] : undefined;

export function modelEquationSteps(modelKey: FocusedModelKey, parameters: Record<string, unknown>, changedKey?: string | null): EquationStep[] {
  const { clean: p, key: changed, result: r } = changeContext(modelKey, parameters, changedKey);
  switch (modelKey) {
    case "supply-demand": return [
      { label: "General demand", expression: "Qd = a − bP", affectedTerms: affected(changed, "demandIntercept", "demandSlope") },
      { label: "Current demand", expression: `Qd = ${f(p.demandIntercept)} − ${f(p.demandSlope)}P`, affectedTerms: affected(changed, "demandIntercept", "demandSlope") },
      { label: "General supply", expression: "Qs = c + dP", affectedTerms: affected(changed, "supplyIntercept", "supplySlope") },
      { label: "Current supply", expression: `Qs = ${f(p.supplyIntercept)} + ${f(p.supplySlope)}P`, affectedTerms: affected(changed, "supplyIntercept", "supplySlope") },
      { label: "Set Qd = Qs", expression: `${f(p.demandIntercept)} − ${f(p.demandSlope)}P = ${f(p.supplyIntercept)} + ${f(p.supplySlope)}P` },
      { label: "Solve equilibrium", expression: `P* = (a − c)/(b + d) = ${f(r.price)}; Q* = a − bP* = ${f(r.quantity)}` },
    ];
    case "policy": return [
      { label: "General system", expression: "Qd = a − bPc; Qs = c + dPp; Pc − Pp = t", affectedTerms: [changed] },
      { label: "Current curves", expression: `Qd = ${f(p.demandIntercept)} − ${f(p.demandSlope)}Pc; Qs = ${f(p.supplyIntercept)} + ${f(p.supplySlope)}Pp`, affectedTerms: affected(changed, "demandIntercept", "demandSlope", "supplyIntercept", "supplySlope") },
      { label: "Current wedge", expression: `Pc − Pp = ${f(p.wedge)}`, affectedTerms: affected(changed, "wedge") },
      { label: "Substitute", expression: `${f(p.demandIntercept)} − ${f(p.demandSlope)}Pc = ${f(p.supplyIntercept)} + ${f(p.supplySlope)}(Pc − ${p.wedge < 0 ? `(${f(p.wedge)})` : f(p.wedge)})` },
      { label: "Buyer and seller prices", expression: `Pc = (a − c + dt)/(b + d) = ${f(r.consumerPrice)}; Pp = Pc − t = ${f(r.producerPrice)}` },
      { label: "Quantity and welfare", expression: `Q* = a − bPc = ${f(r.quantity)}; DWL = ½|t||Q* − Q₀| = ${f(r.deadweightLoss)}` },
    ];
    case "price-controls": return [
      { label: "Market curves", expression: `Qd = ${f(p.demandIntercept)} − ${f(p.demandSlope)}P; Qs = ${f(p.supplyIntercept)} + ${f(p.supplySlope)}P`, affectedTerms: affected(changed, "demandIntercept", "demandSlope", "supplyIntercept", "supplySlope") },
      { label: "Unregulated equilibrium", expression: `P* = (a − c)/(b + d) = ${f(r.equilibriumPrice)}` },
      { label: "Legal rule", expression: `${p.controlType === 1 ? "P ≥ floor" : "P ≤ ceiling"} = ${f(p.controlPrice)}`, affectedTerms: affected(changed, "controlType", "controlPrice") },
      { label: "Binding test", expression: `Binding = ${r.binding ? "yes" : "no"}; effective P = ${f(r.controlledPrice)}` },
      { label: "Short-side trade", expression: `Q traded = min(Qd, Qs) = ${f(r.quantityTraded)}; shortage = ${f(r.shortage)}; surplus = ${f(r.surplus)}` },
      { label: "Welfare", expression: `DWL = baseline surplus − controlled surplus = ${f(r.deadweightLoss)}` },
    ];
    case "elasticity": return [
      { label: "Demand", expression: "Q = a − bP", affectedTerms: affected(changed, "demandIntercept", "demandSlope", "price") },
      { label: "Current quantity", expression: `Q = ${f(p.demandIntercept)} − ${f(p.demandSlope)} × ${f(p.price)} = ${f(r.quantity)}`, affectedTerms: affected(changed, "demandIntercept", "demandSlope", "price") },
      { label: "Point elasticity", expression: "ε = |(dQ/dP)(P/Q)| = |−b(P/Q)|" },
      { label: "Current elasticity", expression: `ε = |−${f(p.demandSlope)} × (${f(p.price)}/${f(r.quantity)})| = ${f(r.elasticity)}` },
      { label: "Revenue", expression: `TR = P × Q = ${f(p.price)} × ${f(r.quantity)} = ${f(r.totalRevenue)}` },
      { label: "Revenue maximum", expression: `P at ε = 1 is a/(2b) = ${f(r.revenueMaximizingPrice)}` },
    ];
    case "externalities": return [
      { label: "Private market", expression: "Qd = a − bP; Qs = c + dP", affectedTerms: affected(changed, "demandIntercept", "demandSlope", "supplyIntercept", "supplySlope") },
      { label: "Private equilibrium", expression: `Pm = ${f(r.marketPrice)}; Qm = ${f(r.marketQuantity)}` },
      { label: "Social cost", expression: `MSC(Q) = PMC(Q) + e; e = ${f(p.externalCost)}`, affectedTerms: affected(changed, "externalCost") },
      { label: "Efficient condition", expression: "Marginal benefit = marginal social cost" },
      { label: "Efficient quantity", expression: `Qe = (da + bc − bde)/(b + d) = ${f(r.efficientQuantity)}` },
      { label: "Corrective policy", expression: `Pigouvian tax/subsidy = e = ${f(r.correctivePolicy)}; welfare gain = ${f(r.welfareGain)}` },
    ];
    case "monopoly": return [
      { label: "Inverse demand", expression: `P(Q) = (a − Q)/b = (${f(p.demandIntercept)} − Q)/${f(p.demandSlope)}`, affectedTerms: affected(changed, "demandIntercept", "demandSlope") },
      { label: "Marginal revenue", expression: `MR(Q) = (a − 2Q)/b = (${f(p.demandIntercept)} − 2Q)/${f(p.demandSlope)}` },
      { label: "Cost", expression: `MC = ${f(p.marginalCost)}; F = ${f(p.fixedCost)}`, affectedTerms: affected(changed, "marginalCost", "fixedCost") },
      { label: "Choose output", expression: `MR = MC → Qm = (a − bMC)/2 = ${f(r.monopolyQuantity)}` },
      { label: "Set price", expression: `Pm = (a − Qm)/b = ${f(r.monopolyPrice)}; markup = ${f(r.markup)}` },
      { label: "Profit and welfare", expression: `π = (Pm − MC)Qm − F = ${f(r.profit)}; DWL = ${f(r.deadweightLoss)}` },
    ];
    case "ppf": return [
      { label: "Frontier", expression: "Y = Ymax[1 − (X/Xmax)^α]", affectedTerms: affected(changed, "capacityX", "capacityY", "curvature") },
      { label: "Shifted capacity", expression: `Xmax′ = ${f(p.capacityX)}(1 + ${f(p.growthRate)}/100) = ${f(r.shiftedCapacityX)}; Ymax′ = ${f(r.shiftedCapacityY)}`, affectedTerms: affected(changed, "growthRate") },
      { label: "Allocated X", expression: `X = Xmax′ × ${f(p.allocation)}/100 × ${f(p.capacityUse)}/100 = ${f(r.outputX)}`, affectedTerms: affected(changed, "allocation", "capacityUse") },
      { label: "Allocated Y", expression: `Y = Ymax′[1 − (${f(p.allocation)}/100)^${f(p.curvature)}] × ${f(p.capacityUse)}/100 = ${f(r.outputY)}` },
      { label: "Opportunity cost", expression: `|dY/dX| = (Ymax′α/Xmax′)(X/Xmax′)^(α−1) = ${f(r.opportunityCost)}` },
      { label: "Feasibility", expression: `Capacity gap = ${f(r.capacityGap)}; status code = ${f(r.statusCode)} (1 efficient, 0 inefficient, −1 unattainable)` },
    ];
    case "ad-as": return [
      { label: "Aggregate demand", expression: `Y = Y* + ΔAD − a(P − 100) = ${f(p.potentialOutput)} + ${f(p.demandShock)} − ${f(p.demandSensitivity)}(P − 100)`, affectedTerms: affected(changed, "potentialOutput", "demandShock", "demandSensitivity") },
      { label: "Short-run supply", expression: `Y = Y* + ΔSRAS + b(P − 100) = ${f(p.potentialOutput)} + ${f(p.supplyShock)} + ${f(p.supplySensitivity)}(P − 100)`, affectedTerms: affected(changed, "potentialOutput", "supplyShock", "supplySensitivity") },
      { label: "Set AD = SRAS", expression: "Y* + ΔAD − a(P − 100) = Y* + ΔSRAS + b(P − 100)" },
      { label: "Price level", expression: `P = 100 + (ΔAD − ΔSRAS)/(a + b) = ${f(r.priceLevel)}` },
      { label: "Output", expression: `Y = Y* + ΔAD − a(P − 100) = ${f(r.output)}` },
      { label: "Gaps", expression: `Output gap = ${f(r.outputGap)}%; unemployment gap = −0.5 × output gap = ${f(r.unemploymentGap)}pp` },
    ];
  }
}

export function modelMechanismChain(modelKey: FocusedModelKey, parameters: Record<string, unknown>, changedKey?: string | null): MechanismStep[] {
  const { clean: p, key, definition, direction, result: r } = changeContext(modelKey, parameters, changedKey);
  const change = `${definition.label} ${direction} to ${f(p[key])}.`;
  switch (modelKey) {
    case "supply-demand": {
      const demand = key.startsWith("demand");
      const curve = key.endsWith("Intercept") ? `${demand ? "Demand" : "Supply"} shifts ${p[key] >= defaultModelParameters(modelKey)[key] ? "outward" : "inward"}.` : `${demand ? "Demand" : "Supply"} rotates as price responsiveness changes.`;
      return chain(change, curve, "At the old price, planned purchases and sales no longer match.", demand ? "Buyers and sellers bid the price toward market clearing." : "Sellers and buyers adjust quantities and offers.", `The new equilibrium is P = ${f(r.price)} and Q = ${f(r.quantity)}.`, `Total gains from trade equal ${f(r.totalSurplus)} in this competitive model.`);
    }
    case "policy": return chain(change, `The policy supply curve ${p.wedge >= 0 ? "shifts upward by the tax" : "shifts downward by the subsidy"}.`, `Buyer and seller prices separate by ${f(Math.abs(p.wedge))} per unit.`, "Consumers and producers adjust quantities according to their relative price responsiveness.", `Trade settles at Q = ${f(r.quantity)}, with buyer price ${f(r.consumerPrice)} and seller price ${f(r.producerPrice)}.`, `Government balance is ${f(r.governmentBalance)} and deadweight loss is ${f(r.deadweightLoss)}.`);
    case "price-controls": return chain(change, `The legal ${p.controlType === 1 ? "floor" : "ceiling"} line moves relative to equilibrium.`, r.binding ? `The control binds, creating ${r.shortage > 0 ? `a shortage of ${f(r.shortage)}` : `a surplus of ${f(r.surplus)}`}.` : "The control is non-binding, so there is no immediate imbalance.", r.shortage > 0 ? "Buyers compete for rationed units while sellers limit supply." : r.surplus > 0 ? "Sellers accumulate unsold output while buyers reduce purchases." : "Market participants continue trading at the competitive equilibrium.", `Quantity traded is ${f(r.quantityTraded)} at effective price ${f(r.controlledPrice)}.`, `The simplified welfare loss is ${f(r.deadweightLoss)}.`);
    case "elasticity": return chain(change, key === "price" ? "The economy moves to a different point along the demand curve." : "The demand curve shifts or rotates.", `Quantity demanded becomes ${f(r.quantity)} and point elasticity becomes ${f(r.elasticity)}.`, r.elasticity > 1 ? "Buyers respond proportionally more than the price change." : "Buyers respond proportionally less than the price change.", `The current price–quantity combination is P = ${f(p.price)}, Q = ${f(r.quantity)}.`, `Total revenue becomes ${f(r.totalRevenue)}; its linear-demand maximum is near P = ${f(r.revenueMaximizingPrice)}.`);
    case "externalities": return chain(change, `Marginal social cost ${p.externalCost >= 0 ? "moves above" : "moves below"} private marginal cost.`, `Private output ${f(r.marketQuantity)} differs from efficient output ${f(r.efficientQuantity)}.`, `A policymaker can use a ${p.externalCost >= 0 ? "tax" : "subsidy"} equal to the per-unit spillover.`, `The corrected outcome moves quantity toward ${f(r.efficientQuantity)}.`, `Recoverable welfare is ${f(r.welfareGain)}, with efficient social welfare ${f(r.socialWelfare)}.`);
    case "monopoly": return chain(change, key === "fixedCost" ? "The profit level changes without shifting MR or MC." : key === "marginalCost" ? "The marginal-cost line shifts." : "Demand and marginal revenue shift or rotate.", `The MR = MC output target becomes ${f(r.monopolyQuantity)}.`, "The firm restricts output and reads the corresponding price from demand.", `The monopoly sets P = ${f(r.monopolyPrice)} and Q = ${f(r.monopolyQuantity)}.`, `Profit is ${f(r.profit)}, markup is ${f(r.markup)}, and deadweight loss is ${f(r.deadweightLoss)}.`);
    case "ppf": return chain(change, key === "growthRate" || key.startsWith("capacity") ? "The production frontier shifts." : key === "curvature" ? "The frontier changes curvature." : "The selected production point moves relative to the frontier.", `The candidate bundle is X = ${f(r.outputX)}, Y = ${f(r.outputY)}.`, r.statusCode === 1 ? "Resources are fully employed on the frontier." : r.statusCode === 0 ? "Unused capacity leaves the bundle inside the frontier." : "The bundle exceeds current productive capacity.", `The model classifies the point as ${r.statusCode === 1 ? "efficient" : r.statusCode === 0 ? "inefficient" : "unattainable"}.`, `Local opportunity cost is ${f(r.opportunityCost)} units of Y per additional X.`);
    case "ad-as": return chain(change, key.includes("demand") ? "Aggregate demand shifts or changes slope." : key.includes("supply") ? "Short-run aggregate supply shifts or changes slope." : "The potential-output benchmark moves.", "At the old price level, planned spending and short-run production differ.", "Firms adjust output and prices; labor demand responds with the output gap.", `Short-run equilibrium becomes output ${f(r.output)} and price index ${f(r.priceLevel)}.`, `The output gap is ${f(r.outputGap)}%, inflation pressure ${f(r.inflationPressure)}, and unemployment gap ${f(r.unemploymentGap)}pp.`);
  }
}

function chain(parameter: string, response: string, immediate: string, behavior: string, outcome: string, finalEffect: string): MechanismStep[] {
  return [
    { stage: "Parameter change", text: parameter },
    { stage: "Model response", text: response },
    { stage: "Immediate effect", text: immediate },
    { stage: "Behavioral response", text: behavior },
    { stage: "New outcome", text: outcome },
    { stage: "Final effect", text: finalEffect },
  ];
}
