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
};

export type ContinuousWorldState = {
  worldId: string;
  calibrationVersion: string;
  lastProcessedAt: string;
  stateVersion: number;
  countries: ContinuousCountryState[];
  markets: ContinuousMarketState[];
};

export type ContinuousWorldTick = {
  state: ContinuousWorldState;
  appliedEffects: Array<{ actionId: string; countryId: string; metric: string; value: number }>;
  processedDays: number;
};
