export type WorldCountrySnapshot = {
  baseline: Record<string, unknown>;
  outcomes: Record<string, unknown>;
  dynamics: Record<string, unknown>;
};

export type PolicyEffectPreview = {
  id: string;
  allowedRange: [number, number];
  /** The 13 calibrated effects in the published teaching-data order. */
  effectVector: number[];
};

export type WorldEffectAxis = {
  id:
    | "activity"
    | "livelihoods"
    | "prices"
    | "fiscal"
    | "financial"
    | "stability";
  label: string;
  current: number;
  preview: number;
};

const clamp = (number: number, low = 70, high = 130) =>
  Math.min(high, Math.max(low, number));
const numeric = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const outcome = (country: WorldCountrySnapshot, key: string) =>
  numeric(country.outcomes[key]);

/**
 * Converts the documented 13-dimensional policy vector into the same six teaching
 * dimensions used throughout EconMind. The values are directional indices, not a
 * claim of a cross-country welfare estimate.
 */
function vectorsToAxes(vector: number[]) {
  const at = (index: number) => vector[index] ?? 0;
  return {
    activity: at(0) + at(7) * 0.7 + at(8) * 0.4,
    livelihoods: -at(2) * 1.2 - at(10) * 0.9 + at(11) * 0.2,
    prices: -at(1),
    fiscal: -at(3) * 0.65 - at(4),
    financial: at(6) * 1.2 - Math.abs(at(5)) * 0.15 - at(3) * 0.2,
    stability: at(11) * 0.65 + at(12) - at(10) * 0.55,
  };
}

function countryVector(country: WorldCountrySnapshot) {
  return vectorsToAxes([
    outcome(country, "growth_pp") || outcome(country, "real_gdp_growth_pp"),
    outcome(country, "inflation_pp"),
    outcome(country, "unemployment_pp"),
    outcome(country, "debt_gdp_pp"),
    outcome(country, "deficit_gdp_pp"),
    outcome(country, "fx_appreciation_percent"),
    outcome(country, "reserves_import_months"),
    outcome(country, "trade_gdp_pp"),
    outcome(country, "productivity_percent"),
    outcome(country, "emissions_percent"),
    outcome(country, "poverty_pp"),
    outcome(country, "public_support_pp"),
    outcome(country, "stability_points"),
  ]);
}

function previewScale(policy: PolicyEffectPreview, change: number) {
  const [low, high] = policy.allowedRange;
  const span = Math.max(Math.abs(low), Math.abs(high), 1);
  return Math.min(1, Math.abs(change) / span) * Math.sign(change || 1);
}

export function buildWorldEffectAxes(
  country: WorldCountrySnapshot,
  policy?: PolicyEffectPreview | null,
  change = 0,
): WorldEffectAxis[] {
  const current = countryVector(country);
  const calibrated = policy ? vectorsToAxes(policy.effectVector) : null;
  const scale = policy ? previewScale(policy, change) : 0;
  const axes: Array<[WorldEffectAxis["id"], string]> = [
    ["activity", "Activity & trade"],
    ["livelihoods", "Employment & livelihoods"],
    ["prices", "Price stability"],
    ["fiscal", "Fiscal capacity"],
    ["financial", "Financial resilience"],
    ["stability", "Social stability"],
  ];

  return axes.map(([id, label]) => {
    const currentIndex = clamp(100 + current[id] * 5);
    const policyDelta = calibrated ? calibrated[id] * scale * 5 : 0;
    return {
      id,
      label,
      current: currentIndex,
      preview: clamp(currentIndex + policyDelta),
    };
  });
}
