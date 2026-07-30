import {
  FINAL_WORLD_TEACHING,
  asArray,
  asRecord,
  numeric,
} from "@/lib/economics/final-world-teaching/catalog";

export type RawChallenge = {
  challenge_id: string;
  title: string;
  territory: string;
  scenario: string;
  initial_state: Record<string, unknown>;
  model_options: string[];
  adjustable: Record<string, [number, number]>;
  policy_options: string[];
  goal: Record<string, unknown>;
  constraints: Record<string, unknown>;
  accept: { all: string[] };
  wrong_types: string[];
  model_chain: string;
  explanation: string;
};

export type ChallengeMetadata = {
  category:
    | "Macroeconomics"
    | "Microeconomics"
    | "International Economics"
    | "Behavioural Economics"
    | "Econometrics"
    | "Operations";
  difficulty: "Foundation" | "Intermediate" | "Advanced";
  minutes: string;
  objective: string;
  constraint: string;
  situation: string;
  affectedActors: string;
  maxModels: number;
  modelNotes?: Record<string, { role: string; relevance: string }>;
};

const metadata: Record<string, ChallengeMetadata> = {
  "EB-01-OIL-SHOCK": {
    category: "Macroeconomics",
    difficulty: "Intermediate",
    minutes: "12–15 min",
    objective: "Limit inflation and household hardship.",
    constraint: "Protect output and preserve reserves.",
    situation:
      "Imported energy is suddenly more expensive, spreading costs through transport, food and household budgets.",
    affectedActors:
      "Firms, households with high energy exposure, the central bank and the external sector.",
    maxModels: 4,
    modelNotes: {
      supply_shock_ad_as: {
        role: "Supply shock / AD–AS",
        relevance:
          "Shows how higher costs raise inflation while weakening output.",
      },
      exchange_rate_pass_through: {
        role: "Exchange-rate pass-through",
        relevance:
          "Links reserve policy and currency pressure to import prices.",
      },
      monetary_policy: {
        role: "Monetary policy",
        relevance: "Shows how rates affect demand and second-round inflation.",
      },
      targeted_fiscal_support: {
        role: "Targeted fiscal support",
        relevance:
          "Shows how vouchers protect real income with a fiscal trade-off.",
      },
    },
  },
  "EB-02-DEBT-RECESSION": {
    category: "Macroeconomics",
    difficulty: "Advanced",
    minutes: "15–18 min",
    objective: "Support recovery without losing debt sustainability.",
    constraint: "Avoid an unfunded permanent fiscal expansion.",
    situation:
      "A recession collides with high refinancing costs and a weak primary balance.",
    affectedActors:
      "Workers, fiscal authorities, bondholders and public-service users.",
    maxModels: 3,
  },
  "EB-03-MONOPSONY-WAGE": {
    category: "Microeconomics",
    difficulty: "Intermediate",
    minutes: "10–12 min",
    objective: "Raise wages while protecting employment.",
    constraint: "Keep the wage floor below the calibrated ceiling.",
    situation:
      "A dominant employer pays below workers’ marginal revenue product.",
    affectedActors: "Workers, the major employer and competing local firms.",
    maxModels: 3,
  },
  "EB-04-DEPRECIATION-JCURVE": {
    category: "International Economics",
    difficulty: "Advanced",
    minutes: "12–15 min",
    objective: "Limit imported inflation while improving the trade path.",
    constraint: "Keep temporary controls time-limited.",
    situation: "Depreciation raises import prices before exports can adjust.",
    affectedActors: "Importers, exporters, consumers and the central bank.",
    maxModels: 3,
  },
  "EB-05-RENT-CONTROL": {
    category: "Microeconomics",
    difficulty: "Intermediate",
    minutes: "10–12 min",
    objective: "Lower rent burden without destroying housing availability.",
    constraint: "Do not set the cap below the disclosed floor.",
    situation: "A housing affordability response risks intensifying shortages.",
    affectedActors:
      "Low-income tenants, landlords, builders and the municipality.",
    maxModels: 3,
  },
  "EB-06-RESTAURANT-INVENTORY": {
    category: "Operations",
    difficulty: "Foundation",
    minutes: "10–12 min",
    objective: "Raise expected profit while reducing food waste.",
    constraint: "Use whole-unit orders.",
    situation:
      "Perishable inventory forces a choice between stockouts and waste.",
    affectedActors: "Restaurant managers, customers and food suppliers.",
    maxModels: 4,
  },
  "EB-07-CARBON-POLICY": {
    category: "Microeconomics",
    difficulty: "Advanced",
    minutes: "12–15 min",
    objective: "Cut emissions while protecting vulnerable households.",
    constraint: "Choose one primary carbon-price instrument.",
    situation:
      "A decarbonisation policy creates affordability and distribution trade-offs.",
    affectedActors: "Households, energy-intensive firms and public finance.",
    maxModels: 3,
  },
  "EB-08-BANK-RUN": {
    category: "Behavioural Economics",
    difficulty: "Advanced",
    minutes: "12–15 min",
    objective: "Meet withdrawals and restore stability.",
    constraint: "Keep support within the disclosed prudential limit.",
    situation: "Rumours trigger withdrawals at a solvent but illiquid bank.",
    affectedActors: "Depositors, the bank, the central bank and taxpayers.",
    maxModels: 3,
  },
  "EB-09-FLEX-WORK": {
    category: "Econometrics",
    difficulty: "Intermediate",
    minutes: "12–15 min",
    objective: "Improve wellbeing without reducing service quality.",
    constraint: "Make causal claims only with a credible design.",
    situation:
      "A work-policy pilot requires evidence rather than correlation alone.",
    affectedActors: "Employees, managers, customers and researchers.",
    maxModels: 3,
  },
  "EB-10-TRADE-WAR": {
    category: "International Economics",
    difficulty: "Advanced",
    minutes: "12–15 min",
    objective: "Protect export volume while limiting input-cost inflation.",
    constraint: "Limit retaliatory tariffs.",
    situation:
      "Retaliation can protect leverage yet disrupt supply chains and exports.",
    affectedActors: "Exporters, import-dependent producers and households.",
    maxModels: 3,
  },
};

export const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export const slugForChallenge = (challengeId: string) =>
  challengeId.toLowerCase();

export const ECONBENCH_CHALLENGES = asArray<RawChallenge>(
  asRecord(FINAL_WORLD_TEACHING.econbenchScenarioLibrary).challenges,
).map((challenge) => ({
  ...challenge,
  model_options:
    challenge.challenge_id === "EB-01-OIL-SHOCK"
      ? [...challenge.model_options, "targeted_fiscal_support"]
      : challenge.model_options,
  meta: metadata[challenge.challenge_id],
}));

export type EconBenchChallenge = (typeof ECONBENCH_CHALLENGES)[number];

export function getEconBenchChallenge(slugOrId: string) {
  const normalized = slugOrId.toLowerCase();
  return ECONBENCH_CHALLENGES.find(
    (challenge) =>
      challenge.challenge_id.toLowerCase() === normalized ||
      slugForChallenge(challenge.challenge_id) === normalized,
  );
}

export function defaultsForChallenge(challenge: EconBenchChallenge) {
  return Object.fromEntries(
    Object.entries(challenge.adjustable).map(([key, [minimum, maximum]]) => [
      key,
      Number(((minimum + maximum) / 2).toFixed(2)),
    ]),
  );
}

export function checkEconBenchCondition(
  condition: string,
  models: string[],
  values: Record<string, number>,
  claims: Record<string, boolean>,
): boolean {
  if (condition.includes(" OR "))
    return condition
      .split(" OR ")
      .some((part) =>
        checkEconBenchCondition(part.trim(), models, values, claims),
      );
  const select = condition.match(/^select\s+(.+)$/i);
  if (select) return models.includes(select[1]);
  const between = condition.match(
    /^([a-z0-9_]+) between (-?[\d.]+) and (-?[\d.]+)$/i,
  );
  if (between)
    return (
      numeric(values[between[1]]) >= Number(between[2]) &&
      numeric(values[between[1]]) <= Number(between[3])
    );
  const compare = condition.match(/^([a-z0-9_]+)\s*(>=|<=|>|<)\s*(-?[\d.]+)$/i);
  if (compare) {
    const current = numeric(values[compare[1]]);
    const target = Number(compare[3]);
    return compare[2] === ">="
      ? current >= target
      : compare[2] === "<="
        ? current <= target
        : compare[2] === ">"
          ? current > target
          : current < target;
  }
  return Boolean(claims[condition]);
}

export type OutcomePreview = {
  key: string;
  label: string;
  value: number;
  unit: string;
  comparator: "min" | "max";
  target: number;
  source: "objective" | "constraint";
};

function unitFor(key: string) {
  if (key.includes("pct") || key.includes("gdp")) return "%";
  if (key.includes("months")) return " months";
  if (key.includes("units")) return " units";
  if (key.includes("points")) return " points";
  return "";
}

function comparatorFor(key: string): "min" | "max" {
  return key.endsWith("_min") ? "min" : "max";
}

/** Browser-only working estimate. It never participates in the binary grading contract. */
export function previewEconBenchOutcomes(
  challenge: EconBenchChallenge,
  values: Record<string, number>,
): OutcomePreview[] {
  if (challenge.challenge_id === "EB-01-OIL-SHOCK") {
    const rate = numeric(values.policy_rate_change_pp);
    const reserve = numeric(values.reserve_release_pct);
    const voucher = numeric(values.targeted_voucher_pct);
    return [
      {
        key: "inflation_pct_max",
        label: "Inflation",
        value: 8 - rate * 0.6 - reserve * 0.08 + voucher * 0.01,
        unit: "%",
        comparator: "max",
        target: 6.5,
        source: "objective",
      },
      {
        key: "poverty_change_pp_max",
        label: "Poverty increase",
        value: 1.4 - voucher * 0.06 - reserve * 0.01,
        unit: " pp",
        comparator: "max",
        target: 0.5,
        source: "objective",
      },
      {
        key: "output_growth_pp_min",
        label: "Output growth impact",
        value: -0.45 - rate * 0.22 + reserve * 0.025 + voucher * 0.015,
        unit: " pp",
        comparator: "min",
        target: -1,
        source: "constraint",
      },
      {
        key: "reserve_release_pct_max",
        label: "Reserve release",
        value: reserve,
        unit: "%",
        comparator: "max",
        target: 20,
        source: "constraint",
      },
    ];
  }
  const controls = Object.entries(challenge.adjustable);
  const strength = controls.length
    ? controls.reduce(
        (sum, [key, [min, max]]) =>
          sum + (numeric(values[key]) - min) / Math.max(max - min, 1),
        0,
      ) / controls.length
    : 0;
  const make = (
    source: "objective" | "constraint",
    entries: Record<string, unknown>,
  ) =>
    Object.entries(entries).flatMap(([key, target]) =>
      typeof target === "number"
        ? [
            {
              key,
              label: humanize(key.replace(/_(min|max)$/, "")),
              value:
                comparatorFor(key) === "min"
                  ? target - strength * Math.max(Math.abs(target) * 0.12, 0.4)
                  : target +
                    (1 - strength) * Math.max(Math.abs(target) * 0.12, 0.4),
              unit: unitFor(key),
              comparator: comparatorFor(key),
              target,
              source,
            },
          ]
        : [],
    );
  return [
    ...make("objective", challenge.goal),
    ...make("constraint", challenge.constraints),
  ];
}

export function conditionLabel(condition: string) {
  const selected = condition.match(/^select\s+(.+)$/i);
  return selected ? `Select ${humanize(selected[1])}` : humanize(condition);
}
