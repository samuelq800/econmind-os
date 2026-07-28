import type { StakeholderImpactItem } from "@/components/models/stakeholder-impact";
import { calculateFoodWaste, DEFAULT_FOOD_WASTE, type FoodWasteParameters } from "@/lib/economics/food-waste";
import { calculateExternality } from "@/lib/economics/externalities";
import { calculateLorenz, DEFAULT_LORENZ } from "@/lib/economics/lorenz";
import { calculatePolicyOutcome } from "@/lib/economics/policy";
import { calculatePriceControl } from "@/lib/economics/price-controls";
import { simulateSandbox } from "@/lib/economics/sandbox/simulation";
import { calculateMacroTransmission, DEFAULT_MACRO_WORKSPACE } from "@/lib/models/model-mapping";
import type { CaseEvaluation, CaseSimulationResult, EconomicCaseDefinition } from "@/lib/cases/types";

const n = (value: number, digits = 2) => Math.round((Number.isFinite(value) ? value : 0) * 10 ** digits) / 10 ** digits;
const metric = (metric: string, previousValue: number, currentValue: number, unit = "") => ({ metric, previousValue: n(previousValue), currentValue: n(currentValue), change: n(currentValue - previousValue), unit });
const impact = (stakeholder: string, before: number, after: number, unit: string, mechanism: string, higherIsBetter = true, uncertainty?: string): StakeholderImpactItem => ({
  stakeholder,
  status: Math.abs(after - before) < 0.01 ? "unchanged" : (after > before) === higherIsBetter ? "improves" : "worsens",
  comparisonBaseline: "Compared with the case baseline using the same stylised assumptions.",
  affectedMetrics: [metric("Case metric", before, after, unit)],
  mechanism,
  uncertainty,
});
const defaultResult = (partial: Omit<CaseSimulationResult, "valid" | "metricUnits" | "constraintsSatisfied" | "constraintMessages"> & { metricUnits: Record<string, string>; valid?: boolean; constraintMessages?: string[] }): CaseSimulationResult => ({ valid: partial.valid ?? true, constraintsSatisfied: (partial.constraintMessages ?? []).length === 0, constraintMessages: partial.constraintMessages ?? [], ...partial });
const baseSettings = (definition: EconomicCaseDefinition) => Object.fromEntries(definition.availablePolicies.map((control) => [control.key, control.defaultValue]));
export function defaultCaseSettings(definition: EconomicCaseDefinition) { return baseSettings(definition); }

function oil(settings: Record<string, number>): CaseSimulationResult {
  const energyShock = settings.energyShock ?? 12;
  const policyRate = settings.policyRate ?? 4;
  const householdRelief = settings.householdRelief ?? 0;
  const baseline = calculateMacroTransmission({ ...DEFAULT_MACRO_WORKSPACE, supplyShock: 0 });
  const current = calculateMacroTransmission({ ...DEFAULT_MACRO_WORKSPACE, supplyShock: -energyShock, policyRate, governmentSpending: 100 + householdRelief * 0.4 });
  const fiscalCost = n(householdRelief * 2.2);
  const efficiency = n(100 - Math.abs(current.adas.outputGap) * 2 - Math.max(0, current.phillips.inflation - baseline.phillips.inflation) * 4);
  const equity = n(50 + householdRelief * 1.1 - Math.max(0, current.phillips.inflation - 2) * 2);
  return defaultResult({
    modelNative: { output: current.adas.output, priceLevel: current.adas.priceLevel, inflation: current.phillips.inflation, unemployment: current.phillips.effectiveUnemployment },
    headline: { inflation: current.phillips.inflation, output: current.adas.output, unemployment: current.phillips.effectiveUnemployment, fiscalCost }, metricUnits: { inflation: "%", output: " index", unemployment: "%", fiscalCost: " index" },
    mechanism: [{ stage: "Energy costs", text: `An adverse supply shock of ${energyShock} index points raises short-run production costs.` }, { stage: "Short-run supply", text: "SRAS pressure worsens the output–inflation trade-off." }, { stage: "Policy response", text: `The policy rate is ${policyRate}% and targeted household relief is ${householdRelief} index points.` }, { stage: "Outcome", text: `The teaching model reports inflation ${current.phillips.inflation}% and output ${current.adas.output}.` }],
    equations: [{ label: "Supply shock", expression: `ΔSRAS = −${energyShock}` }, { label: "Short-run price", expression: `P = 100 + (ΔAD − ΔSRAS)/(a + b) = ${current.adas.priceLevel}` }, { label: "Output", expression: `Y = Y* + ΔAD − a(P − 100) = ${current.adas.output}` }],
    stakeholders: [impact("Low-income households", baseline.phillips.inflation, current.phillips.inflation - householdRelief * 0.1, " inflation pressure", "Energy prices and general inflation raise budget pressure; relief only partly offsets it.", false), impact("Energy-intensive firms", baseline.adas.output, current.adas.output, " output index", "Higher input costs reduce activity in the aggregate teaching model."), impact("Central bank", baseline.phillips.inflation, current.phillips.inflation, "% inflation", "The monetary authority faces an inflation–activity trade-off.", false)],
    shortRun: "Cost pressure can raise inflation while lowering activity before contracts and supply adjust.", longRun: "Energy efficiency, supply diversification, expectations, and investment can change the trade-off; none is estimated here.", assumptions: ["The supply shock is an indexed calibration.", "A policy rate maps through the existing teaching transmission."], limitations: ["No oil-price forecast, exchange-rate path, or distributional microdata."], fiscalCost, efficiency, equity,
  });
}

function carbon(settings: Record<string, number>): CaseSimulationResult {
  const carbonTax = settings.carbonTax ?? 10;
  const recycling = settings.recycling ?? 20;
  const greenSubsidy = settings.greenSubsidy ?? 0;
  // Keep the underlying external damage fixed at a visible teaching calibration.
  // The selected tax is a policy response, not a redefinition of the harm.
  const social = calculateExternality({ demandIntercept: 100, demandSlope: 2, supplyIntercept: 20, supplySlope: 2, externalCost: 10 });
  const policy = calculatePolicyOutcome({ demandIntercept: 100, demandSlope: 2, supplyIntercept: 20, supplySlope: 2, wedge: carbonTax });
  const sandbox = simulateSandbox({ carbonTax: carbonTax * 2.5, greenSubsidy });
  const selectedQuantity = policy.quantity;
  const remainingLoss = n(0.5 * (selectedQuantity - social.efficientQuantity) ** 2);
  const welfareChange = n(social.welfareGain - remainingLoss);
  const revenue = n(Math.max(0, policy.governmentBalance));
  const fiscalCost = n(revenue * recycling / 100 + greenSubsidy * 0.7);
  const efficiency = n(100 - Math.abs(selectedQuantity - social.efficientQuantity) * 10);
  const lorenz = calculateLorenz({ ...DEFAULT_LORENZ, transfer: recycling / 10, taxRate: 20 });
  const equity = n(100 - lorenz.postGini * 100 + recycling * 0.15);
  return defaultResult({
    modelNative: { marketQuantity: social.marketQuantity, policyQuantity: selectedQuantity, efficientQuantity: social.efficientQuantity, welfareChange, carbonEmissions: sandbox.indicators.carbonEmissions },
    headline: { quantity: selectedQuantity, welfare: welfareChange, revenue, emissions: sandbox.indicators.carbonEmissions }, metricUnits: { quantity: " units", welfare: " model value", revenue: " model value", emissions: " index" },
    mechanism: [{ stage: "Unpriced harm", text: "The calibrated external cost remains 10 per unit in every tax scenario." }, { stage: "Corrective price", text: `The selected carbon tax is ${carbonTax} per unit; the calibrated corrective benchmark is ${social.correctivePolicy}.` }, { stage: "Revenue use", text: `${recycling}% of notional revenue is earmarked for targeted recycling.` }, { stage: "Outcome", text: `Policy quantity is ${selectedQuantity} versus the efficient quantity ${social.efficientQuantity}; Sandbox emissions index is ${sandbox.indicators.carbonEmissions}.` }],
    equations: [{ label: "Social cost", expression: "MSC(Q) = PMC(Q) + 10" }, { label: "Efficient quantity", expression: `Qe = (da + bc − bde)/(b + d) = ${social.efficientQuantity}` }, { label: "Tax-policy quantity", expression: `Qt = a − bPc = ${selectedQuantity}` }, { label: "Welfare change vs no tax", expression: `ΔW = ${social.welfareGain} − ½(Qt − Qe)² = ${welfareChange}` }, { label: "Notional revenue", expression: `R = tax × Qt = ${carbonTax} × ${selectedQuantity} = ${revenue}` }],
    stakeholders: [impact("Low-income households", social.marketPrice, policy.consumerPrice - recycling * 0.04, " consumer price proxy", "The tax raises buyer price, while targeted recycling partially offsets budget pressure.", false), impact("Emitting firms", social.marketQuantity, selectedQuantity, " output units", "The selected tax changes the producer-side incentive and quantity traded."), impact("Future residents", social.externalImpactAtMarket, n(10 * selectedQuantity), " external-impact units", "Lower output reduces the modelled harmful spillover.", false)],
    shortRun: "A charge changes the per-unit incentive immediately in the static market.", longRun: "Innovation, abatement costs, and leakage can change both the efficient charge and incidence.", assumptions: ["External cost equals the selected tax parameter.", "Revenue recycling is a stylised share, not a household microsimulation."], limitations: ["No emissions inventory, sectoral heterogeneity, or actual tax base."], fiscalCost, efficiency: Math.max(0, Math.min(100, efficiency)), equity: Math.max(0, Math.min(100, equity)),
  });
}

function housing(settings: Record<string, number>): CaseSimulationResult {
  const ceiling = settings.rentCeiling ?? 15;
  const support = settings.supplySupport ?? 0;
  const tenantSupport = settings.tenantSupport ?? 0;
  const baseline = calculatePriceControl({ demandIntercept: 100, demandSlope: 2, supplyIntercept: 20, supplySlope: 2, controlType: "ceiling", controlPrice: 20 });
  const current = calculatePriceControl({ demandIntercept: 100 + tenantSupport * 0.45, demandSlope: 2, supplyIntercept: 20 + support * 1.2, supplySlope: 2, controlType: "ceiling", controlPrice: ceiling });
  const fiscalCost = n(support * 1.5 + tenantSupport * 1.1);
  return defaultResult({
    modelNative: { equilibriumPrice: current.equilibriumPrice, traded: current.quantityTraded, shortage: current.shortage, dwl: current.deadweightLoss }, headline: { shortage: current.shortage, traded: current.quantityTraded, dwl: current.deadweightLoss, rent: current.controlledPrice }, metricUnits: { shortage: " units", traded: " units", dwl: " model value", rent: " rent index" },
    mechanism: [{ stage: "Legal cap", text: `The ceiling is ${ceiling}; equilibrium is ${current.equilibriumPrice}.` }, { stage: "Market response", text: current.binding ? "The ceiling binds, so supply limits traded units." : "The ceiling is non-binding in this calibration." }, { stage: "Supply support", text: `Supply support of ${support} shifts the stylised supply intercept.` }, { stage: "Outcome", text: `Shortage is ${current.shortage}; ${current.quantityTraded} units trade.` }],
    equations: [{ label: "Unregulated equilibrium", expression: `P* = (a − c)/(b + d) = ${current.equilibriumPrice}` }, { label: "Controlled trade", expression: `Q traded = min(Qd, Qs) = ${current.quantityTraded}` }, { label: "Shortage", expression: `max(Qd − Qs, 0) = ${current.shortage}` }],
    stakeholders: [impact("Incumbent tenants", baseline.controlledPrice, current.controlledPrice, " rent index", "A binding ceiling lowers the posted rent for households who obtain a unit.", false), impact("Prospective tenants", baseline.shortage, current.shortage, " shortage units", "Access can worsen when demand exceeds supply.", false), impact("Landlords / builders", baseline.quantityTraded, current.quantityTraded, " units rented", "The simplified supply schedule responds to price and supply support.")],
    shortRun: "A binding cap changes posted rents immediately but does not allocate scarce units.", longRun: "Construction, maintenance, turnover, and quality responses may change supply; the static calculation does not forecast them.", assumptions: ["One homogeneous rental market.", "Efficient rationing is used only for welfare arithmetic."], limitations: ["No queues, lotteries, tenant selection, vacancy chain, or local construction data."], fiscalCost, efficiency: n(Math.max(0, 100 - current.deadweightLoss * 0.5)), equity: n(Math.max(0, 55 + (baseline.controlledPrice - current.controlledPrice) * 2 - current.shortage * 0.4 + tenantSupport)),
  });
}

function minimumWage(settings: Record<string, number>): CaseSimulationResult {
  const wage = settings.minimumWage ?? 25;
  const workerSupport = settings.workerSupport ?? 0;
  const training = settings.training ?? 0;
  const baseline = calculatePriceControl({ demandIntercept: 100, demandSlope: 2, supplyIntercept: 20, supplySlope: 2, controlType: "floor", controlPrice: 20 });
  const current = calculatePriceControl({ demandIntercept: 100 + training * 0.4, demandSlope: 2, supplyIntercept: 20, supplySlope: 2, controlType: "floor", controlPrice: wage });
  const earnings = n(current.quantityTraded * current.controlledPrice + workerSupport * current.quantityTraded * 0.15);
  const baselineEarnings = n(baseline.quantityTraded * baseline.controlledPrice);
  const fiscalCost = n(workerSupport * 1.2 + training * 1.5);
  return defaultResult({
    modelNative: { employment: current.quantityTraded, surplus: current.surplus, wage: current.controlledPrice, earnings }, headline: { employment: current.quantityTraded, surplus: current.surplus, earnings, wage: current.controlledPrice }, metricUnits: { employment: " labour units", surplus: " labour units", earnings: " earnings index", wage: " wage index" },
    mechanism: [{ stage: "Wage rule", text: `The statutory floor is ${wage}; competitive proxy equilibrium is ${current.equilibriumPrice}.` }, { stage: "Employer demand", text: current.binding ? "A binding floor reduces labour demanded in the competitive proxy." : "The floor is non-binding in this calibration." }, { stage: "Complementary policy", text: `Worker support ${workerSupport} and training ${training} modify the teaching comparison.` }, { stage: "Outcome", text: `Jobs traded are ${current.quantityTraded}, with excess labour supply ${current.surplus}.` }],
    equations: [{ label: "Wage floor", expression: `w ≥ ${wage}` }, { label: "Labour traded", expression: `L = min(Ld, Ls) = ${current.quantityTraded}` }, { label: "Potential mismatch", expression: `max(Ls − Ld, 0) = ${current.surplus}` }],
    stakeholders: [impact("Employed low-wage workers", baselineEarnings, earnings, " earnings index", "Those employed receive the controlled wage and may receive support."), impact("Job seekers", baseline.surplus, current.surplus, " excess labour units", "The competitive proxy allows labour supply to exceed demand.", false), impact("Small employers", baseline.quantityTraded * baseline.controlledPrice, current.quantityTraded * current.controlledPrice, " wage-bill proxy", "Higher pay and adjusted labour demand change the stylised wage bill.", false)],
    shortRun: "The proxy shows a floor relative to a competitive labour market; it is not a measured employment forecast.", longRun: "Productivity, turnover, monopsony, prices, hours, and enforcement can change outcomes.", assumptions: ["Competitive labour-market proxy.", "Training shifts labour demand in a small calibrated way."], limitations: ["No local elasticities, monopsony, hours, informal work, or employer margin data."], fiscalCost, efficiency: n(Math.max(0, 100 - current.deadweightLoss * 0.5)), equity: n(Math.max(0, Math.min(100, 50 + (earnings - baselineEarnings) * 0.12 - current.surplus * 0.4 + workerSupport))),
  });
}

function tariff(settings: Record<string, number>): CaseSimulationResult {
  const tariffRate = settings.tariffRate ?? 10;
  const domesticSubsidy = settings.domesticSubsidy ?? 0;
  const retaliation = settings.retaliation ?? 20;
  const current = simulateSandbox({ tariffRate, domesticProductionSubsidy: domesticSubsidy, importQuotaIntensity: retaliation * 0.25 });
  const baseline = simulateSandbox({ tariffRate: 5, domesticProductionSubsidy: 0, importQuotaIntensity: 0 });
  const expectedRetaliationCost = n(retaliation * tariffRate * 0.03);
  const fiscalCost = n(domesticSubsidy * 1.3 + expectedRetaliationCost);
  return defaultResult({
    modelNative: { consumerWelfare: current.indicators.consumerWelfare, firmProfit: current.indicators.firmProfit, revenue: current.indicators.governmentRevenue, output: current.indicators.marketOutput }, headline: { consumerWelfare: current.indicators.consumerWelfare, firmProfit: current.indicators.firmProfit, revenue: current.indicators.governmentRevenue, retaliationCost: expectedRetaliationCost }, metricUnits: { consumerWelfare: " index", firmProfit: " index", revenue: " index", retaliationCost: " index" },
    mechanism: [{ stage: "Border charge", text: `Tariff rate is ${tariffRate}%.` }, { stage: "Domestic response", text: `Domestic transition support is ${domesticSubsidy} index points.` }, { stage: "Strategic risk", text: `Expected retaliation intensity is ${retaliation}% (a transparent scenario assumption).` }, { stage: "Outcome", text: `The Sandbox reports consumer welfare ${current.indicators.consumerWelfare} and firm profit ${current.indicators.firmProfit}.` }],
    equations: [{ label: "Tariff scenario", expression: `t = ${tariffRate}%` }, { label: "Retaliation risk proxy", expression: `cost = ${retaliation} × ${tariffRate} × 0.03 = ${expectedRetaliationCost}` }, { label: "Sandbox output", expression: `Output index = ${current.indicators.marketOutput}` }],
    stakeholders: [impact("Consumers", baseline.indicators.consumerWelfare, current.indicators.consumerWelfare, " welfare index", "Trade restrictions feed through the existing Sandbox consumer-welfare rule."), impact("Protected domestic firms", baseline.indicators.firmProfit, current.indicators.firmProfit, " profit index", "Tariff and domestic support alter the stylised domestic-firm indicator."), impact("Exporters", 0, expectedRetaliationCost, " retaliation-cost index", "Partner response is an assumed scenario risk, not a prediction.", false)],
    shortRun: "Protection and consumer costs can move together in the teaching Sandbox.", longRun: "Supply chains, product substitution, negotiations, exchange rates, and retaliation can change effects.", assumptions: ["Sandbox indices are not customs-revenue or trade-flow estimates.", "Retaliation is a user-visible scenario parameter."], limitations: ["No country-specific trade elasticities, bilateral flows, or legal assessment."], fiscalCost, efficiency: n(Math.max(0, 100 - Math.abs(current.indicators.consumerWelfare - 100) * 1.2 - expectedRetaliationCost)), equity: n(Math.max(0, Math.min(100, 55 + (current.indicators.firmProfit - baseline.indicators.firmProfit) * 0.5 - (baseline.indicators.consumerWelfare - current.indicators.consumerWelfare) * 0.7))),
  });
}

function restaurant(settings: Record<string, number>): CaseSimulationResult {
  const input = { ...DEFAULT_FOOD_WASTE, ...settings } as FoodWasteParameters;
  const baseline = calculateFoodWaste(DEFAULT_FOOD_WASTE);
  const current = calculateFoodWaste(input);
  const fiscalCost = 0;
  return defaultResult({
    valid: current.valid,
    constraintMessages: current.valid ? [] : [current.validationMessage],
    modelNative: { waste: current.expectedWaste, shortage: current.expectedShortage, sales: current.expectedSales, profit: current.expectedProfit, serviceLevel: current.serviceLevel, risk: current.operationalRisk }, headline: { waste: current.expectedWaste, shortage: current.expectedShortage, profit: current.expectedProfit, risk: current.operationalRisk, service: current.serviceLevel }, metricUnits: { waste: " meals", shortage: " meals", profit: " currency", risk: "/100", service: "%" },
    mechanism: [{ stage: "Demand uncertainty", text: `Effective expected demand is ${current.effectiveDemand} with a standard deviation of ${current.demandStandardDeviation}.` }, { stage: "Preparation", text: `Prepared inventory rounds to ${current.effectiveInventory} meals after MOQ and flexibility.` }, { stage: "Service trade-off", text: `Expected sales are ${current.expectedSales}; waste is ${current.expectedWaste}; shortage is ${current.expectedShortage}.` }, { stage: "Risk management", text: `Insurance premium is ${current.insurancePremiumCost}; eligible expected claim is ${current.expectedClaim}.` }],
    equations: [{ label: "Expected sales", expression: `E[min(D,Q)] = ${current.expectedSales}`, detail: "Demand is normally approximated in this teaching engine." }, { label: "Waste", expression: `E[W] = Q − E[min(D,Q)] = ${current.expectedWaste}` }, { label: "Shortage", expression: `E[S] = E[D] − E[min(D,Q)] = ${current.expectedShortage}` }, { label: "Expected profit", expression: `π = revenue − production − disposal − shortage − complaint − premium + claim = ${current.expectedProfit}` }],
    stakeholders: [impact("Restaurant manager", baseline.expectedProfit, current.expectedProfit, " expected profit", "Inventory and service costs determine expected contribution."), impact("Customers", baseline.serviceLevel, current.serviceLevel, "% service level", "Availability and quality controls influence expected fulfilment."), impact("Kitchen team / waste partner", baseline.expectedWaste, current.expectedWaste, " meals wasted", "Perishability makes unused preparation a disposal burden.", false)],
    shortRun: "The model updates expected daily inventory outcomes instantly as inputs change.", longRun: "Better demand data, menu design, donation, pricing, and multi-period storage could change the operational frontier.", assumptions: ["Demand is normally approximated.", "Meals are perishable after the service period.", "Insurance is a simplified eligible-loss formula."], limitations: ["Not a private-data analysis, actual insurance quote, or operational recommendation."], fiscalCost, efficiency: n(Math.max(0, Math.min(100, 100 - current.expectedWaste * 1.2 - current.expectedShortage * 0.8))), equity: n(Math.max(0, Math.min(100, current.serviceLevel * 0.65 + (100 - current.operationalRisk) * 0.35))),
  });
}

export function runCaseSimulation(definition: EconomicCaseDefinition, settings: Record<string, number>): CaseSimulationResult {
  switch (definition.simulationAdapterKey) {
    case "oil-price-shock": return oil(settings);
    case "carbon-tax": return carbon(settings);
    case "housing-rent-control": return housing(settings);
    case "minimum-wage": return minimumWage(settings);
    case "tariff-conflict": return tariff(settings);
    case "restaurant-food-waste": return restaurant(settings);
  }
}

export function evaluateCase(definition: EconomicCaseDefinition, result: CaseSimulationResult, providedWeights: Record<string, number>): CaseEvaluation {
  const defaults = Object.fromEntries(definition.evaluationConfig.objectives.map((item) => [item.key, item.defaultWeight]));
  const weights = { ...defaults, ...Object.fromEntries(Object.entries(providedWeights).map(([key, value]) => [key, Math.max(0, Number(value) || 0)])) };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const dimensionScores = { efficiency: n(Math.max(0, Math.min(100, result.efficiency))), equity: n(Math.max(0, Math.min(100, result.equity))), fiscal: n(Math.max(0, Math.min(100, 100 - result.fiscalCost))) };
  const score = n(Object.entries(weights).reduce((sum, [key, weight]) => sum + (dimensionScores[key as keyof typeof dimensionScores] ?? 50) * weight, 0) / total);
  return { weights, score, dimensionScores, explanation: `Weighted score ${score}/100. It combines transparent teaching scores for efficiency (${dimensionScores.efficiency}), equity (${dimensionScores.equity}), and fiscal sustainability (${dimensionScores.fiscal}); it is not an objective policy ranking.` };
}
