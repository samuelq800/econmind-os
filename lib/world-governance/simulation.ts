import {
  SIMULATION_DAY_MS,
  WORLD_APPROVAL_THRESHOLDS,
  WORLD_COUNTRIES,
  WORLD_POLICY_DEFINITIONS,
} from "./config";
import type {
  Country,
  EconomicIndicator,
  NationalCondition,
  PolicyDefinition,
  PolicyDraft,
  PolicyForecast,
  PolicyLifecycleStatus,
  PublishedPolicy,
  SharedResource,
  WorldGovernanceRole,
} from "./types";

const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;

const hash = (value: string) =>
  [...value].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const round = (value: number, places = 1) => Number(value.toFixed(places));

export function simulationDay(now = Date.now()) {
  return Math.floor(now / SIMULATION_DAY_MS);
}

export function simulationDate(day = simulationDay()) {
  const start = new Date("2026-08-04T00:00:00.000Z").getTime();
  return new Date(start + day * CALENDAR_DAY_MS);
}

function risk(value: number, warnAt = 35): SharedResource["risk"] {
  if (value < 15) return "critical";
  if (value < warnAt) return "warning";
  if (value < warnAt + 15) return "watch";
  return "normal";
}

function resource(
  id: SharedResource["id"],
  label: string,
  value: number,
  explanation: string,
): SharedResource {
  const safeValue = round(clamp(value, 0, 100));
  return {
    id,
    label,
    value: safeValue,
    change: 0,
    risk: risk(safeValue),
    explanation,
    sparkline: [-3, -1, 1, -2, 0, 2, 1].map((change) =>
      clamp(safeValue + change, 0, 100),
    ),
  };
}

function indicator(
  id: string,
  label: string,
  value: number,
  unit: string,
  change = 0,
): EconomicIndicator {
  return { id, label, value: round(value), unit, change: round(change) };
}

/** A transparent synthetic initial condition for the fictional teaching world. */
export function createCountry(countryId: string): Country {
  const country =
    WORLD_COUNTRIES.find((item) => item.id === countryId) ?? WORLD_COUNTRIES[0];
  const seed = hash(country.id);
  const share = (offset: number, spread: number) =>
    offset + ((seed >> (offset % 16)) % spread);
  const fiscal = share(38, 40);
  const support = share(42, 34);
  const stability = share(46, 36);
  const inflation = 2.2 + (seed % 60) / 10;
  const debt = 35 + ((seed >> 4) % 58);
  const trade = 28 + ((seed >> 8) % 48);
  return {
    id: country.id,
    name: country.name,
    flag: country.coastal ? "◒" : "◇",
    condition: conditionFromResources(stability, support),
    indicators: [
      indicator("growth", "Growth", 1.2 + ((seed >> 12) % 42) / 10, "%", 0.1),
      indicator("inflation", "Inflation", inflation, "%", -0.1),
      indicator(
        "unemployment",
        "Unemployment",
        3.4 + ((seed >> 15) % 84) / 10,
        "%",
        0,
      ),
      indicator("debt", "Public debt", debt, "% GDP", 0.2),
      indicator("trade", "Trade openness", trade, "% GDP", 0.1),
      indicator(
        "poverty",
        "Poverty risk",
        7 + ((seed >> 20) % 170) / 10,
        "%",
        -0.1,
      ),
    ],
    resources: [
      resource(
        "fiscal_space",
        "Fiscal space",
        fiscal,
        "Room to finance new commitments without increasing fragility.",
      ),
      resource(
        "foreign_reserves",
        "Foreign reserves",
        share(35, 45),
        "External liquidity and import-cover resilience.",
      ),
      resource(
        "political_capital",
        "Political capital",
        share(30, 54),
        "Capacity to sustain difficult or contested reforms.",
      ),
      resource(
        "administrative_capacity",
        "Administrative capacity",
        share(38, 44),
        "Ability to deliver, verify and maintain public action.",
      ),
      resource(
        "policy_credibility",
        "Policy credibility",
        share(44, 42),
        "Trust that announced policy will be implemented consistently.",
      ),
      resource(
        "public_support",
        "Public support",
        support,
        "Current social mandate; not a claim about voter intent.",
      ),
      resource(
        "national_stability",
        "National stability",
        stability,
        "Composite teaching index for social and institutional resilience.",
      ),
    ],
  };
}

export function allCountries() {
  return WORLD_COUNTRIES.map((country) => createCountry(country.id));
}

export function conditionFromResources(
  stability: number,
  support: number,
): NationalCondition {
  if (stability < 12) return "empty_state";
  if (stability < 25) return "institutional_collapse";
  if (stability < 35) return "government_crisis";
  if (stability < 45 || support < 30) return "protest";
  if (stability < 55) return "vulnerable";
  return "normal";
}

export function policyLifecycleStatus(
  policy: Pick<PublishedPolicy, "publishedAt" | "status" | "lifecycle">,
  now = Date.now(),
): PolicyLifecycleStatus {
  if (policy.status === "blocked" || policy.status === "cancelled")
    return policy.status;
  const elapsed = Math.max(
    0,
    (now - new Date(policy.publishedAt).getTime()) / SIMULATION_DAY_MS,
  );
  const { delayDays, rampDays, peakDays, decayDays, maxDurationDays } =
    policy.lifecycle;
  if (elapsed < delayDays) return elapsed === 0 ? "announced" : "waiting";
  if (elapsed < delayDays + rampDays) return "ramping_up";
  if (elapsed < delayDays + rampDays + peakDays) return "full_effect";
  if (
    elapsed <
    Math.min(maxDurationDays, delayDays + rampDays + peakDays + decayDays)
  )
    return "fading";
  return "expired";
}

export function lifecycleStrength(
  lifecycle: PolicyDefinition["lifecycle"],
  publishedAt: string,
  now = Date.now(),
) {
  const elapsed = Math.max(
    0,
    (now - new Date(publishedAt).getTime()) / SIMULATION_DAY_MS,
  );
  if (elapsed < lifecycle.delayDays) return 0;
  if (elapsed < lifecycle.delayDays + lifecycle.rampDays) {
    return lifecycle.rampDays === 0
      ? 1
      : (elapsed - lifecycle.delayDays) / lifecycle.rampDays;
  }
  if (elapsed < lifecycle.delayDays + lifecycle.rampDays + lifecycle.peakDays)
    return 1;
  const decayStart =
    lifecycle.delayDays + lifecycle.rampDays + lifecycle.peakDays;
  if (
    elapsed <
    Math.min(lifecycle.maxDurationDays, decayStart + lifecycle.decayDays)
  ) {
    return lifecycle.decayDays === 0
      ? 0
      : 1 - (elapsed - decayStart) / lifecycle.decayDays;
  }
  return 0;
}

export function policyCosts(
  definition: PolicyDefinition,
  proposedValue: number,
) {
  const intensity = Math.abs(proposedValue - definition.defaultValue);
  return {
    fiscalCost: round(
      Math.max(0, intensity * definition.fiscalCostPerPoint),
      2,
    ),
    reserveCost: round(
      Math.max(0, intensity * definition.reserveCostPerPoint),
      2,
    ),
    politicalCost: round(
      Math.max(0, intensity * definition.politicalCostPerPoint),
      2,
    ),
    administrativeBurden: round(
      Math.max(0, definition.administrativeCost + intensity * 0.2),
      1,
    ),
  };
}

export function requiredApprovals(
  definition: PolicyDefinition,
  proposedValue: number,
) {
  const costs = policyCosts(definition, proposedValue);
  const approvals = new Set<WorldGovernanceRole>(definition.requiredApprovals);
  if (
    costs.fiscalCost > WORLD_APPROVAL_THRESHOLDS.fiscalCostPctGdp ||
    costs.reserveCost > WORLD_APPROVAL_THRESHOLDS.reserveUsePercent ||
    costs.politicalCost > WORLD_APPROVAL_THRESHOLDS.politicalCapitalPercent
  ) {
    approvals.add("captain");
  }
  return [...approvals];
}

function forecastEffects(
  effects: Record<string, [number, number]>,
  intensity: number,
  unit: string,
) {
  return Object.entries(effects)
    .filter(([, range]) => range[0] !== 0 || range[1] !== 0)
    .slice(0, 4)
    .map(([label, range]) => ({
      label,
      low: round(range[0] * intensity, 2),
      high: round(range[1] * intensity, 2),
      unit,
    }));
}

export function buildPolicyForecast(
  definition: PolicyDefinition,
  proposedValue: number,
): PolicyForecast {
  const span = Math.max(Math.abs(definition.min), Math.abs(definition.max), 1);
  const intensity = Math.min(
    1,
    Math.abs(proposedValue - definition.defaultValue) / span,
  );
  const prefix =
    proposedValue === definition.defaultValue
      ? "No material change is proposed."
      : "Directional teaching estimate";
  const costs = policyCosts(definition, proposedValue);
  return {
    confidence: definition.confidence,
    immediate: forecastEffects(
      definition.impacts.immediate,
      intensity,
      "pp / index",
    ),
    medium: forecastEffects(definition.impacts.medium, intensity, "pp / index"),
    long: forecastEffects(definition.impacts.long, intensity, "pp / index"),
    distributional: forecastEffects(
      definition.impacts.distributional,
      intensity,
      "pp / index",
    ),
    dependencies: definition.prerequisites,
    directEffect: `${prefix}: effects begin after ${definition.lifecycle.delayDays} simulation day(s), then ramp over ${definition.lifecycle.rampDays} day(s).`,
    secondOrderEffect:
      "Results also depend on current capacity, the international network, active shocks and other published policies.",
    unintendedConsequence: `Delivery burden is ${costs.administrativeBurden.toFixed(1)} index points; this is a scenario range, not a guaranteed causal outcome.`,
    model: definition.educationalModel,
    uncertainty: `${definition.confidence} confidence. Ranges are supplied teaching calibrations and remain conditional on the stated prerequisites.`,
  };
}

export function createDraft(
  policyId: string,
  countryId: string,
  proposedValue?: number,
): PolicyDraft {
  const definition = WORLD_POLICY_DEFINITIONS.find(
    (policy) => policy.id === policyId,
  );
  if (!definition) throw new Error(`Unknown policy: ${policyId}`);
  return {
    policyId,
    countryId,
    proposedValue: proposedValue ?? definition.defaultValue,
    previousValue: definition.defaultValue,
    changedAt: new Date().toISOString(),
  };
}

export function toPublishedPolicy(
  draft: PolicyDraft,
  role: WorldGovernanceRole,
  now = new Date(),
): PublishedPolicy {
  const definition = WORLD_POLICY_DEFINITIONS.find(
    (policy) => policy.id === draft.policyId,
  );
  if (!definition) throw new Error(`Unknown policy: ${draft.policyId}`);
  const costs = policyCosts(definition, draft.proposedValue);
  return {
    ...draft,
    id: `local-${draft.policyId}-${now.getTime()}`,
    role,
    status: "announced",
    publishedAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + definition.lifecycle.maxDurationDays * SIMULATION_DAY_MS,
    ).toISOString(),
    effectiveStrength: 0,
    ...costs,
    lifecycle: definition.lifecycle,
    approvalIds: [],
  };
}

export function policyDefinition(policyId: string) {
  return (
    WORLD_POLICY_DEFINITIONS.find((policy) => policy.id === policyId) ?? null
  );
}

export function rolePolicies(role: WorldGovernanceRole) {
  return WORLD_POLICY_DEFINITIONS.filter((policy) => policy.role === role);
}
