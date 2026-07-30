export const CONTINUOUS_WORLD_ROLES = [
  "country_captain",
  "central_bank_governor",
  "economic_policy_minister",
  "trade_minister",
  "infrastructure_investment_minister",
  "social_labour_minister",
  "research_innovation_minister",
] as const;

export type ContinuousWorldRole = typeof CONTINUOUS_WORLD_ROLES[number];
export type PolicyEffectRange = readonly [number, number, number];

export type CalibratedPolicyDefinition = {
  id: string;
  allowed_range: readonly [number, number];
  implementation_lag_days: readonly [number, number];
  ramp_days: readonly [number, number];
  peak_days: readonly [number, number];
  decay_half_life_days: readonly [number, number];
  max_duration_days: number;
  effects_per_impulse: Record<string, PolicyEffectRange>;
};

export type ContinuousPolicyAction = {
  id: string;
  countryId: string;
  policyId: string;
  change: number;
  startsAt: string;
  endsAt?: string | null;
  status: "scheduled" | "active" | "expired" | "cancelled";
};

export type ContinuousMarketState = {
  id: string;
  price: number;
  priceFloor: number;
  priceCeiling: number;
  supply: number;
  demand: number;
  inventoryDays: number;
  stockFloorDays: number;
  kappa: number;
};

export type ContinuousCountryState = {
  id: string;
  baseline: Record<string, number | string>;
  outcomes: Record<string, number>;
  /** Effects that are not policy lifecycle effects, such as resolved shocks. */
  structuralOutcomes?: Record<string, number>;
  /** Recomputed on every tick so active policies never compound by accident. */
  policyOutcomes?: Record<string, number>;
  /** Recomputed from currently active shocks; expires cleanly with the shock. */
  shockOutcomes?: Record<string, number>;
  dynamics?: ContinuousCountryDynamics;
};

export type CountryGovernanceState = "normal" | "protest" | "government_crisis" | "institutional_collapse" | "empty_state" | "recovery";

export type ContinuousCountryDynamics = {
  governanceState: CountryGovernanceState;
  stability: number;
  trust: number;
  serviceCapacity: number;
  costOfLivingPressure: number;
  shortagePressure: number;
  debtServiceStress: number;
  daysBelow35: number;
  daysBelow25: number;
  daysBelow12: number;
  recoveryDays: number;
};

export type ContinuousWorldShock = {
  id: string;
  shockId: string;
  countryId?: string | null;
  startsAt: string;
  endsAt: string;
  effects: Record<string, number>;
  status: "scheduled" | "active" | "expired" | "cancelled";
};

export type ContinuousContractState = {
  id: string;
  templateId: string;
  exporterCountryId: string;
  importerCountryId: string;
  status: string;
  startsAt: string;
  endsAt?: string | null;
  quantity: number;
  unitPrice: number;
  paymentCycleDays: number;
};

export type ContinuousWorldState = {
  worldId: string;
  calibrationVersion: string;
  lastProcessedAt: string;
  stateVersion: number;
  countries: ContinuousCountryState[];
  markets: ContinuousMarketState[];
  activeShocks?: ContinuousWorldShock[];
  contracts?: ContinuousContractState[];
};

export type ContinuousWorldTick = {
  state: ContinuousWorldState;
  appliedEffects: Array<{ actionId: string; countryId: string; metric: string; value: number }>;
  stateChanges: Array<{ countryId: string; from: CountryGovernanceState; to: CountryGovernanceState }>;
  processedDays: number;
};
