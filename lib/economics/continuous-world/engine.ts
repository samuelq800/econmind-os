import type {
  CalibratedPolicyDefinition,
  ContinuousCountryDynamics,
  ContinuousMarketState,
  ContinuousPolicyAction,
  ContinuousWorldState,
  ContinuousWorldTick,
} from "./types.ts";

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const daysBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / 86_400_000);
const numeric = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function mergedOutcome(country: ContinuousWorldState["countries"][number], metric: string) {
  return numeric(country.structuralOutcomes?.[metric], numeric(country.outcomes[metric])) + numeric(country.policyOutcomes?.[metric]) + numeric(country.shockOutcomes?.[metric]);
}

function initialDynamics(country: ContinuousWorldState["countries"][number]): ContinuousCountryDynamics {
  const baseline = country.baseline;
  const trust = clamp(numeric(baseline.institutional_trust, 50), 0, 100);
  const support = clamp(numeric(baseline.public_support, 50), 0, 100);
  return {
    governanceState: "normal",
    stability: clamp((trust + support) / 2, 0, 100),
    trust,
    serviceCapacity: clamp(numeric(baseline.social_protection_coverage, 50), 0, 100),
    costOfLivingPressure: clamp(numeric(baseline.food_energy_burden, 20) / 2, 0, 100),
    shortagePressure: 0,
    debtServiceStress: clamp(numeric(baseline.interest_cost, 2) * 3, 0, 100),
    daysBelow35: 0,
    daysBelow25: 0,
    daysBelow12: 0,
    recoveryDays: 0,
  };
}

/** Implements the supplied synthetic protest, collapse and recovery contract. */
function nextDynamics(country: ContinuousWorldState["countries"][number], marketShortage: number, elapsedDays: number): ContinuousCountryDynamics {
  const previous = country.dynamics ?? initialDynamics(country);
  const inflation = numeric(country.baseline.cpi_inflation) + mergedOutcome(country, "inflation_pp");
  const unemployment = numeric(country.baseline.unemployment_rate) + mergedOutcome(country, "unemployment_pp");
  const poverty = numeric(country.baseline.poverty_rate) + mergedOutcome(country, "poverty_pp");
  const debt = numeric(country.baseline.public_debt) + mergedOutcome(country, "debt_gdp_pp");
  const support = mergedOutcome(country, "public_support_pp");
  const directStability = mergedOutcome(country, "stability_points");
  const serviceCapacity = clamp(previous.serviceCapacity + (numeric(country.outcomes.social_protection_coverage_pp) + support * 0.12) * elapsedDays / 30, 0, 100);
  const trust = clamp(previous.trust + (support * 0.16 + directStability * 0.1 - Math.max(0, inflation - 10) * 0.08) * elapsedDays / 30, 0, 100);
  const costOfLivingPressure = clamp(previous.costOfLivingPressure + (Math.max(0, inflation - 3) * 0.28 + Math.max(0, poverty - 12) * 0.12 - support * 0.04) * elapsedDays, 0, 100);
  const shortagePressure = clamp(marketShortage + Math.max(0, numeric(country.baseline.import_dependency) - 35) * 0.06, 0, 100);
  const debtServiceStress = clamp(Math.max(0, debt - 60) * 0.2 + Math.max(0, inflation - 7) * 0.8, 0, 100);
  const dailyStabilityChange = serviceCapacity * 0.022 + support * 0.012 + trust * 0.008 + directStability * 0.08
    - costOfLivingPressure * 0.045 - Math.max(0, unemployment - 5) * 0.48 - shortagePressure * 0.42 - debtServiceStress * 0.18;
  const stability = clamp(previous.stability + dailyStabilityChange * elapsedDays, 0, 100);
  const daysBelow35 = stability < 35 ? previous.daysBelow35 + elapsedDays : 0;
  const daysBelow25 = stability < 25 ? previous.daysBelow25 + elapsedDays : 0;
  const daysBelow12 = stability < 12 ? previous.daysBelow12 + elapsedDays : 0;
  const recoveryReady = serviceCapacity >= 40 && trust >= 35 && stability >= 30;
  const recoveryDays = recoveryReady ? previous.recoveryDays + elapsedDays : 0;
  let governanceState = previous.governanceState;
  if (governanceState === "empty_state" && recoveryDays >= 30) governanceState = "recovery";
  else if (governanceState === "institutional_collapse" && stability < 8 && serviceCapacity < 10) governanceState = "empty_state";
  else if (governanceState !== "empty_state" && stability < 12 && daysBelow12 >= 60 && serviceCapacity < 25) governanceState = "institutional_collapse";
  else if (governanceState !== "institutional_collapse" && governanceState !== "empty_state" && (stability < 25 && daysBelow25 >= 30 || trust < 20 && debtServiceStress > 25)) governanceState = "government_crisis";
  else if (governanceState === "normal" && stability < 35 && daysBelow35 >= 7 && costOfLivingPressure + shortagePressure >= 18) governanceState = "protest";
  else if (governanceState === "recovery" && stability >= 45 && trust >= 45) governanceState = "normal";
  return { governanceState, stability, trust, serviceCapacity, costOfLivingPressure, shortagePressure, debtServiceStress, daysBelow35, daysBelow25, daysBelow12, recoveryDays };
}

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
  if (!processedDays) return { state, appliedEffects: [], stateChanges: [], processedDays: 0 };
  const appliedEffects: ContinuousWorldTick["appliedEffects"] = [];
  const countries = state.countries.map((country) => ({
    ...country,
    structuralOutcomes: { ...(country.structuralOutcomes ?? country.outcomes) },
    policyOutcomes: {} as Record<string, number>,
    shockOutcomes: {} as Record<string, number>,
    outcomes: { ...(country.structuralOutcomes ?? country.outcomes) },
  }));
  for (const shock of state.activeShocks ?? []) {
    if (shock.status !== "active" || Date.parse(shock.startsAt) > Date.parse(processedAt) || Date.parse(shock.endsAt) <= Date.parse(processedAt)) continue;
    for (const country of countries) {
      if (shock.countryId && shock.countryId !== country.id) continue;
      for (const [metric, value] of Object.entries(shock.effects)) {
        country.shockOutcomes![metric] = Number(((country.shockOutcomes?.[metric] ?? 0) + value).toFixed(8));
        country.outcomes[metric] = Number(((country.outcomes[metric] ?? 0) + value).toFixed(8));
      }
    }
  }
  for (const action of policies) {
    const definition = definitions[action.policyId];
    const country = countries.find((entry) => entry.id === action.countryId);
    if (!definition || !country || action.change < definition.allowed_range[0] || action.change > definition.allowed_range[1]) continue;
    const weight = policyLifecycleWeight(definition, action, processedAt);
    if (!weight) continue;
    for (const [metric, range] of Object.entries(definition.effects_per_impulse)) {
      const value = Number((range[1] * action.change * weight).toFixed(8));
      country.policyOutcomes![metric] = Number(((country.policyOutcomes?.[metric] ?? 0) + value).toFixed(8));
      country.outcomes[metric] = Number(((country.outcomes[metric] ?? 0) + value).toFixed(8));
      appliedEffects.push({ actionId: action.id, countryId: country.id, metric, value });
    }
  }
  const markets = state.markets.map((market) => clearContinuousMarket(market, processedDays));
  const marketShortage = markets.length
    ? markets.reduce((sum, market) => sum + Math.max(0, market.stockFloorDays - market.inventoryDays) / Math.max(1, market.stockFloorDays) * 25, 0) / markets.length
    : 0;
  const stateChanges: ContinuousWorldTick["stateChanges"] = [];
  for (const country of countries) {
    const dynamics = nextDynamics(country, marketShortage, processedDays);
    if (country.dynamics && country.dynamics.governanceState !== dynamics.governanceState) stateChanges.push({ countryId: country.id, from: country.dynamics.governanceState, to: dynamics.governanceState });
    country.dynamics = dynamics;
  }
  return {
    state: { ...state, lastProcessedAt: processedAt, stateVersion: state.stateVersion + 1, countries, markets },
    appliedEffects,
    stateChanges,
    processedDays,
  };
}
