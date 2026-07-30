import type {
  CalibratedPolicyDefinition,
  ContinuousMarketState,
  ContinuousPolicyAction,
  ContinuousWorldState,
  ContinuousWorldTick,
} from "./types.ts";

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const daysBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / 86_400_000);

/** Uses the central coefficient and a transparent lag/ramp/decay lifecycle. */
export function policyLifecycleWeight(definition: CalibratedPolicyDefinition, action: ContinuousPolicyAction, processedAt: string) {
  const elapsed = daysBetween(action.startsAt, processedAt);
  if (action.status === "cancelled" || elapsed < definition.implementation_lag_days[0] || elapsed > definition.max_duration_days) return 0;
  if (action.endsAt && Date.parse(processedAt) > Date.parse(action.endsAt)) return 0;
  const rampStart = definition.implementation_lag_days[0];
  const rampEnd = rampStart + Math.max(1, definition.ramp_days[0]);
  const peak = Math.max(rampEnd, definition.peak_days[0]);
  if (elapsed <= rampEnd) return clamp((elapsed - rampStart) / Math.max(1, rampEnd - rampStart), 0, 1);
  if (elapsed <= peak) return 1;
  return 2 ** (-(elapsed - peak) / Math.max(1, definition.decay_half_life_days[0]));
}

export function clearContinuousMarket(market: ContinuousMarketState, elapsedDays = 1): ContinuousMarketState {
  const flow = Math.max(1, (market.supply + market.demand) / 2);
  const targetInventoryDays = Math.max(1, market.inventoryDays, market.stockFloorDays + 1);
  const inventoryBuffer = Math.max(0, (market.inventoryDays - market.stockFloorDays) / targetInventoryDays);
  const price = clamp(
    market.price * Math.exp(clamp(market.kappa, 0.05, 0.25) * ((market.demand - market.supply) / flow - inventoryBuffer) * elapsedDays),
    market.priceFloor,
    market.priceCeiling,
  );
  return { ...market, price: Number(price.toFixed(6)), inventoryDays: Math.max(0, market.inventoryDays + (market.supply - market.demand) / flow * elapsedDays) };
}

/**
 * Pure, deterministic tick. Scheduling, authorization and persistence remain
 * server-side; this function receives an explicit timestamp so a replay always
 * produces the same result and a repeated timestamp is a no-op.
 */
export function advanceContinuousWorld(
  state: ContinuousWorldState,
  policies: ContinuousPolicyAction[],
  definitions: Record<string, CalibratedPolicyDefinition>,
  processedAt: string,
): ContinuousWorldTick {
  const processedDays = daysBetween(state.lastProcessedAt, processedAt);
  if (!processedDays) return { state, appliedEffects: [], processedDays: 0 };
  const appliedEffects: ContinuousWorldTick["appliedEffects"] = [];
  const countries = state.countries.map((country) => ({ ...country, outcomes: { ...country.outcomes } }));
  for (const action of policies) {
    const definition = definitions[action.policyId];
    const country = countries.find((entry) => entry.id === action.countryId);
    if (!definition || !country || action.change < definition.allowed_range[0] || action.change > definition.allowed_range[1]) continue;
    const weight = policyLifecycleWeight(definition, action, processedAt);
    if (!weight) continue;
    for (const [metric, range] of Object.entries(definition.effects_per_impulse)) {
      const value = Number((range[1] * action.change * weight).toFixed(8));
      country.outcomes[metric] = Number(((country.outcomes[metric] ?? 0) + value).toFixed(8));
      appliedEffects.push({ actionId: action.id, countryId: country.id, metric, value });
    }
  }
  return {
    state: { ...state, lastProcessedAt: processedAt, stateVersion: state.stateVersion + 1, countries, markets: state.markets.map((market) => clearContinuousMarket(market, processedDays)) },
    appliedEffects,
    processedDays,
  };
}
