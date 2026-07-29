import { DEFAULT_ALLOCATION, RESOURCE_BOUNDS } from "./config.ts";
import type { FiscalAllocation, PolicyPackage } from "./types.ts";

export const clamp = (value: number, [minimum, maximum]: readonly [number, number]) => Math.min(maximum, Math.max(minimum, value));
export const round = (value: number, digits = 1) => Number(value.toFixed(digits));
export const fiscalAllocationTotal = (allocation: FiscalAllocation) => Object.values(allocation).reduce((total, amount) => total + amount, 0);
export const isValidFiscalAllocation = (allocation: FiscalAllocation) => Object.values(allocation).every((amount) => Number.isFinite(amount) && amount >= 0 && amount <= 100) && fiscalAllocationTotal(allocation) === 100;

/** Debt above 80% gradually narrows effective capacity; the nominal allocation remains 100 points. */
export function calculateFiscalConstraint(debt: number) {
  return round(clamp(100 - Math.max(0, debt - 80) * 0.65, RESOURCE_BOUNDS.fiscalSpace));
}

export function policyCapitalCost(policy: PolicyPackage, previous: PolicyPackage) {
  const rateMove = Math.abs(policy.interestRate - previous.interestRate);
  const taxMove = Math.abs(policy.businessTaxRate - previous.businessTaxRate);
  const allocationShift = Object.keys(DEFAULT_ALLOCATION).reduce((total, key) => total + Math.abs(policy.allocation[key as keyof FiscalAllocation] - previous.allocation[key as keyof FiscalAllocation]), 0) / 2;
  return round(rateMove * 4 + taxMove * 0.65 + Math.max(0, allocationShift - 18) * 0.22);
}

export function assertPolicyPackage(policy: PolicyPackage) {
  if (policy.interestRate < 0 || policy.interestRate > 10 || Math.round(policy.interestRate * 2) !== policy.interestRate * 2) throw new Error("Interest rate must be between 0% and 10% in 0.5-point steps.");
  if (policy.businessTaxRate < 15 || policy.businessTaxRate > 35 || !Number.isInteger(policy.businessTaxRate)) throw new Error("Business tax must be between 15% and 35% in 1-point steps.");
  if (!isValidFiscalAllocation(policy.allocation)) throw new Error("Fiscal allocation must total exactly 100 points.");
}
