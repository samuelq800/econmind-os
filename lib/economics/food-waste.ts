export type FoodWasteParameters = {
  expectedDemand: number;
  demandVolatility: number;
  forecastAccuracy: number;
  inventoryLevel: number;
  minimumOrderQuantity: number;
  replenishmentFlexibility: number;
  sellingPrice: number;
  productionCost: number;
  disposalCost: number;
  shortageCost: number;
  customerComplaintCost: number;
  insuranceCoverage: number;
  insurancePremiumRate: number;
  claimThreshold: number;
  freshnessVerification: number;
  transparency: number;
  consumerAcceptance: number;
};

export const DEFAULT_FOOD_WASTE: FoodWasteParameters = {
  expectedDemand: 100, demandVolatility: 24, forecastAccuracy: 65, inventoryLevel: 110, minimumOrderQuantity: 10, replenishmentFlexibility: 20,
  sellingPrice: 15, productionCost: 6, disposalCost: 1.2, shortageCost: 4, customerComplaintCost: 1.5,
  insuranceCoverage: 0, insurancePremiumRate: 4, claimThreshold: 80, freshnessVerification: 20, transparency: 15, consumerAcceptance: 82,
};

export type FoodWasteOutcome = {
  valid: boolean;
  validationMessage: string;
  effectiveInventory: number;
  effectiveDemand: number;
  demandStandardDeviation: number;
  expectedSales: number;
  expectedWaste: number;
  expectedShortage: number;
  stockoutProbability: number;
  serviceLevel: number;
  revenue: number;
  productionCost: number;
  disposalCost: number;
  shortageCost: number;
  complaintCost: number;
  insurancePremiumCost: number;
  expectedClaim: number;
  expectedProfit: number;
  consumerAcceptance: number;
  operationalRisk: number;
  wasteReduction: number;
};

const round = (value: number, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const phi = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
// Abramowitz–Stegun approximation.  It is deterministic and accurate enough for a teaching inventory model.
const normalCdf = (z: number) => {
  const sign = z < 0 ? -1 : 1; const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
};

function invalid(validationMessage: string): FoodWasteOutcome {
  return { valid: false, validationMessage, effectiveInventory: 0, effectiveDemand: 0, demandStandardDeviation: 0, expectedSales: 0, expectedWaste: 0, expectedShortage: 0, stockoutProbability: 0, serviceLevel: 0, revenue: 0, productionCost: 0, disposalCost: 0, shortageCost: 0, complaintCost: 0, insurancePremiumCost: 0, expectedClaim: 0, expectedProfit: 0, consumerAcceptance: 0, operationalRisk: 0, wasteReduction: 0 };
}

/**
 * Stylised newsvendor calculation. Demand is approximated by a normal distribution;
 * insurance covers eligible operational-loss claims, not every cost or real contract term.
 */
export function calculateFoodWaste(input: FoodWasteParameters): FoodWasteOutcome {
  if (!Object.values(input).every(Number.isFinite)) return invalid("Every inventory parameter must be a finite number.");
  if (input.expectedDemand <= 0 || input.demandVolatility < 0 || input.inventoryLevel < 0 || input.minimumOrderQuantity <= 0 || input.sellingPrice < 0 || input.productionCost < 0 || input.disposalCost < 0 || input.shortageCost < 0 || input.customerComplaintCost < 0) return invalid("Demand, order quantity, inventory, and unit-cost values must be non-negative; expected demand and MOQ must be positive.");
  if ([input.forecastAccuracy, input.replenishmentFlexibility, input.insuranceCoverage, input.freshnessVerification, input.transparency, input.consumerAcceptance].some((value) => value < 0 || value > 100) || input.insurancePremiumRate < 0 || input.claimThreshold < 0) return invalid("Percentage controls must be between 0 and 100, and insurance values cannot be negative.");

  const demandStandardDeviation = Math.max(0.1, input.demandVolatility * (1 - input.forecastAccuracy / 200));
  const orderRounded = Math.ceil(input.inventoryLevel / input.minimumOrderQuantity) * input.minimumOrderQuantity;
  const flexibleAdjustment = (input.replenishmentFlexibility / 100) * (input.expectedDemand - orderRounded);
  const effectiveInventory = Math.max(0, orderRounded + flexibleAdjustment);
  const acceptance = clamp(input.consumerAcceptance + input.freshnessVerification * 0.08 + input.transparency * 0.05, 0, 100);
  const effectiveDemand = input.expectedDemand * acceptance / 100;
  const z = (effectiveInventory - effectiveDemand) / demandStandardDeviation;
  const cdf = normalCdf(z);
  const expectedSales = effectiveDemand * cdf - demandStandardDeviation * phi(z) + effectiveInventory * (1 - cdf);
  const expectedWaste = Math.max(0, effectiveInventory - expectedSales);
  const expectedShortage = Math.max(0, effectiveDemand - expectedSales);
  const stockoutProbability = clamp(1 - cdf, 0, 1);
  const serviceLevel = effectiveDemand <= 0 ? 0 : clamp(expectedSales / effectiveDemand, 0, 1);
  const revenue = expectedSales * input.sellingPrice;
  const productionCost = effectiveInventory * input.productionCost;
  const disposalCost = expectedWaste * input.disposalCost;
  const shortageCost = expectedShortage * input.shortageCost;
  const complaintCost = expectedShortage * input.customerComplaintCost * (1 - input.freshnessVerification / 250);
  const eligibleLoss = Math.max(0, shortageCost + complaintCost - input.claimThreshold);
  const expectedClaim = eligibleLoss * input.insuranceCoverage / 100;
  const insurancePremiumCost = (productionCost + shortageCost + complaintCost) * input.insurancePremiumRate / 100 * input.insuranceCoverage / 100;
  const expectedProfit = revenue - productionCost - disposalCost - shortageCost - complaintCost - insurancePremiumCost + expectedClaim;
  const baseline = input === DEFAULT_FOOD_WASTE ? undefined : calculateFoodWaste(DEFAULT_FOOD_WASTE);
  const wasteReduction = baseline ? baseline.expectedWaste - expectedWaste : 0;
  const operationalRisk = clamp(stockoutProbability * 55 + (effectiveInventory <= 0 ? 35 : expectedWaste / effectiveInventory * 35) + (1 - acceptance / 100) * 10 - input.insuranceCoverage * 0.08, 0, 100);
  return { valid: true, validationMessage: "", effectiveInventory: round(effectiveInventory), effectiveDemand: round(effectiveDemand), demandStandardDeviation: round(demandStandardDeviation), expectedSales: round(expectedSales), expectedWaste: round(expectedWaste), expectedShortage: round(expectedShortage), stockoutProbability: round(stockoutProbability * 100), serviceLevel: round(serviceLevel * 100), revenue: round(revenue), productionCost: round(productionCost), disposalCost: round(disposalCost), shortageCost: round(shortageCost), complaintCost: round(complaintCost), insurancePremiumCost: round(insurancePremiumCost), expectedClaim: round(expectedClaim), expectedProfit: round(expectedProfit), consumerAcceptance: round(acceptance), operationalRisk: round(operationalRisk), wasteReduction: round(wasteReduction) };
}
