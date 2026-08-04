import policyLibrary from "@/data/final-world-teaching/extended_policy_effect_library.json";
import mapSpec from "@/data/final-world-teaching/fictional_world_map_spec.json";
import territoryNetwork from "@/data/final-world-teaching/territory_network.json";
import type {
  PolicyDefinition,
  PolicyImpactRange,
  WorldGovernanceRole,
} from "./types";

export const SIMULATION_DAY_MS = 2 * 60 * 60 * 1000;
export const WORLD_CLOCK_LABEL = "1 simulation day = 2 real hours";
export const POLICY_DATA_VERSION = policyLibrary.version;

export const WORLD_ROLE_META: Record<
  WorldGovernanceRole,
  {
    title: string;
    shortTitle: string;
    description: string;
    accent: string;
    kpis: string[];
  }
> = {
  captain: {
    title: "Country Captain / Prime Minister",
    shortTitle: "Captain",
    description:
      "Coordinates a national response, resolves cross-ministry conflicts and promulgates approved packages.",
    accent: "amber",
    kpis: ["National stability", "Public support", "Cabinet delivery"],
  },
  "central-bank": {
    title: "Central Bank Governor",
    shortTitle: "Central Bank",
    description:
      "Safeguards price, financial and external stability through independent, evidence-recorded monetary tools.",
    accent: "sky",
    kpis: ["Inflation", "FX resilience", "Financial stability"],
  },
  finance: {
    title: "Finance & Economic Minister",
    shortTitle: "Finance",
    description:
      "Balances tax, spending, debt and automatic stabilisers against credible medium-term funding.",
    accent: "violet",
    kpis: ["Fiscal space", "Debt sustainability", "Delivery quality"],
  },
  trade: {
    title: "Trade & Foreign Affairs Minister",
    shortTitle: "Trade",
    description:
      "Manages trade exposure, strategic contracts, market access and foreign economic relationships.",
    accent: "cyan",
    kpis: ["Trade reliability", "External balance", "Partner relations"],
  },
  industry: {
    title: "Industry, Infrastructure & Innovation Minister",
    shortTitle: "Industry",
    description:
      "Owns sector strategy, resources, energy resilience, investment projects and innovation capacity.",
    accent: "orange",
    kpis: ["Productivity", "Project delivery", "Energy & resource resilience"],
  },
  social: {
    title: "Social & Labour Minister",
    shortTitle: "Social & Labour",
    description:
      "Protects household security, labour-market access and social cohesion while monitoring delivery gaps.",
    accent: "rose",
    kpis: ["Employment", "Poverty", "Social stability"],
  },
};

export const SOURCE_ROLE_TO_WORLD_ROLE: Record<string, WorldGovernanceRole> = {
  Captain: "captain",
  "Central Bank Governor": "central-bank",
  "Finance & Fiscal Minister": "finance",
  "Trade & Foreign Economic Minister": "trade",
  "Industry, Investment & Infrastructure Minister": "industry",
  "Resources, Energy & Environment Minister": "industry",
  "Social Affairs & Internal Stability Minister": "social",
};

const indicatorLabels: Record<string, string> = {
  growth_pp: "Growth",
  inflation_pp: "Inflation",
  unemployment_pp: "Unemployment",
  debt_gdp_pp: "Debt / GDP",
  deficit_gdp_pp: "Fiscal balance",
  fx_appreciation_percent: "Exchange rate",
  reserves_import_months: "Reserve cover",
  trade_gdp_pp: "Trade / GDP",
  productivity_percent: "Productivity",
  emissions_percent: "Emissions",
  poverty_pp: "Poverty",
  public_support_pp: "Public support",
  stability_points: "National stability",
};

const outputOrder = [
  "growth_pp",
  "inflation_pp",
  "unemployment_pp",
  "debt_gdp_pp",
  "deficit_gdp_pp",
  "fx_appreciation_percent",
  "reserves_import_months",
  "trade_gdp_pp",
  "productivity_percent",
  "emissions_percent",
  "poverty_pp",
  "public_support_pp",
  "stability_points",
] as const;

type SourcePolicy = (typeof policyLibrary.policies)[number];

function asRange(value: string): [number, number] {
  const values = value
    .split("/")
    .map((part) => Number(part.replaceAll("+", "")))
    .filter(Number.isFinite);
  return [Math.min(...values), Math.max(...values)];
}

function impactRange(source: SourcePolicy): PolicyImpactRange {
  const values = Object.fromEntries(
    outputOrder.map((outcome, index) => [
      outcome,
      asRange(source.effects[index] ?? "0/0/0"),
    ]),
  );
  const select = (ids: readonly string[]) =>
    Object.fromEntries(
      ids.map((id) => [indicatorLabels[id], values[id] ?? [0, 0]]),
    );

  return {
    immediate: select([
      "growth_pp",
      "inflation_pp",
      "unemployment_pp",
      "fx_appreciation_percent",
    ]),
    medium: select([
      "debt_gdp_pp",
      "deficit_gdp_pp",
      "trade_gdp_pp",
      "poverty_pp",
    ]),
    long: select([
      "productivity_percent",
      "emissions_percent",
      "reserves_import_months",
    ]),
    distributional: select([
      "poverty_pp",
      "public_support_pp",
      "stability_points",
    ]),
  };
}

function toTitle(value: string) {
  return value
    .replace(/^POL-[A-Z]+-/, "")
    .split("-")
    .map((word) =>
      word === "RND" ? "R&D" : word[0] + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

function toPolicyDefinition(source: SourcePolicy): PolicyDefinition {
  const [min, max] = source.allowed_range;
  const span = max - min;
  const role = SOURCE_ROLE_TO_WORLD_ROLE[source.role];
  const requiredApprovals: WorldGovernanceRole[] = [
    ...(source.approval_requirement.toLowerCase().includes("captain")
      ? ["captain" as const]
      : []),
    ...(source.approval_requirement.toLowerCase().includes("finance") &&
    role !== "finance"
      ? ["finance" as const]
      : []),
    ...(source.approval_requirement.toLowerCase().includes("central bank") &&
    role !== "central-bank"
      ? ["central-bank" as const]
      : []),
    ...(source.approval_requirement.toLowerCase().includes("trade") &&
    role !== "trade"
      ? ["trade" as const]
      : []),
    ...(source.approval_requirement.toLowerCase().includes("social") &&
    role !== "social"
      ? ["social" as const]
      : []),
  ];
  const fiscalScale =
    /(transfer|voucher|subsidy|grant|funding|guarantee|liquidity|reserve|project|farm|support)/i.test(
      source.policy_id,
    )
      ? 0.18
      : /(tax|licence|permit|carbon)/i.test(source.policy_id)
        ? -0.08
        : 0.03;

  return {
    id: source.policy_id,
    role,
    category: source.policy_id.split("-")[1] ?? "POL",
    title: toTitle(source.policy_id),
    description: source.calibration_reason,
    unit: source.parameter_unit,
    min,
    max,
    step: span <= 5 ? 0.1 : span <= 30 ? 1 : 5,
    defaultValue: min < 0 && max > 0 ? 0 : min,
    safeRange: [
      Math.max(min, min + span * 0.2),
      Math.min(max, max - span * 0.2),
    ],
    lifecycle: {
      delayDays: source.lifecycle_days.lag,
      rampDays: source.lifecycle_days.ramp,
      peakDays: source.lifecycle_days.peak,
      decayDays: source.lifecycle_days.decay,
      maxDurationDays: source.lifecycle_days.duration_max,
    },
    fiscalCostPerPoint: fiscalScale,
    reserveCostPerPoint: /(FX-SWAP|OUTFLOW|RESERVE)/.test(source.policy_id)
      ? 0.12
      : 0,
    politicalCostPerPoint:
      /(TAX|CONTROL|LICENCE|RESTRUCTURING|MINIMUM-WAGE|CARBON)/.test(
        source.policy_id,
      )
        ? 0.16
        : 0.05,
    administrativeCost:
      /(COVERAGE|TRANSFER|VOUCHER|PROJECT|ZONE|SCREENING)/.test(
        source.policy_id,
      )
        ? 7
        : 3,
    confidence:
      source.confidence === "high"
        ? "High"
        : source.confidence === "medium"
          ? "Medium"
          : "Low",
    prerequisites: source.preconditions,
    requiredApprovals: [...new Set(requiredApprovals)],
    affectedIndicators: outputOrder.filter(
      (_, index) => source.effects[index] !== "0/0/0",
    ),
    impacts: impactRange(source),
    educationalModel: `${source.role}: ${source.calibration_reason}`,
  };
}

/**
 * The full policy catalogue comes from the supplied transparent teaching
 * calibration. Resource/energy policies are intentionally administered by
 * Industry in the six-office cabinet rather than creating a seventh office.
 */
export const WORLD_POLICY_DEFINITIONS =
  policyLibrary.policies.map(toPolicyDefinition);

export const WORLD_COUNTRIES = Object.entries(mapSpec.territory_centroids).map(
  ([id, centroid]) => {
    const network = territoryNetwork.territories.find(
      (territory) => territory.id === id,
    );
    return {
      id,
      name: id[0].toUpperCase() + id.slice(1),
      centroid: { x: centroid[0], y: centroid[1] },
      coastal: network?.coastal ?? false,
      neighbors: network?.neighbors ?? [],
      regions: mapSpec.regions
        .filter((region) => region.members.includes(id))
        .map((region) => region.name),
    };
  },
);

export const WORLD_COUNTRY_IDS = WORLD_COUNTRIES.map((country) => country.id);

export const WORLD_OFFICE_PATHS = [
  "captain",
  "central-bank",
  "finance",
  "trade",
  "industry",
  "social",
  "cabinet",
  "reports",
  "policies",
] as const;

export const WORLD_APPROVAL_THRESHOLDS = {
  fiscalCostPctGdp: 4,
  reserveUsePercent: 20,
  politicalCapitalPercent: 40,
} as const;
