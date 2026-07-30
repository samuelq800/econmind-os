import {
  FINAL_WORLD_TEACHING,
  asArray,
  asRecord,
  numeric,
} from "@/lib/economics/final-world-teaching/catalog";

export const EVIDENCE_STEPS = [
  { id: "question", label: "Research Question", short: "Ask" },
  { id: "theory", label: "Theory", short: "Model" },
  { id: "data", label: "Data", short: "Inspect Data" },
  { id: "method", label: "Method", short: "Choose Method" },
  { id: "results", label: "Results", short: "Read Results" },
  { id: "limits", label: "Causal Limits", short: "Judge the Claim" },
] as const;

export type EvidenceStepId = (typeof EVIDENCE_STEPS)[number]["id"];
type DataValue = string | number;
type Source = {
  label: string;
  publisher?: string;
  coverage?: string;
  licence?: string;
  url?: string;
  accessed?: string;
};
export type EvidenceVariable = {
  name: string;
  meaning: string;
  unit: string;
  role: "ID" | "Time" | "Explanatory" | "Outcome" | "Control" | "Derived";
  example: string;
};
export type EvidenceProject = {
  id: string;
  slug: string;
  title: string;
  category: string;
  topic: string;
  subtitle: string;
  researchQuestion: string;
  hypothesis: string;
  competingHypotheses: string[];
  actors: string[];
  evidenceSupport: string;
  evidenceWeakens: string;
  duration: string;
  evidenceStatus: string;
  causalConfidence: "Association" | "Operational teaching evidence";
  methods: string[];
  relatedModels: Array<{ label: string; href: string }>;
  relatedCase: { label: string; href: string };
  datasetSummary: Array<{ value: string; label: string }>;
  sampleStatus: string;
  sampleReason: string;
  variables: EvidenceVariable[];
  sampleRows: Record<string, DataValue>[];
  sources: Source[];
  cleaningSteps: Array<{ stage: string; detail: string }>;
  equations: Array<{
    label: string;
    expression: string;
    plain: string;
    question: string;
    risk: string;
  }>;
  theoryNodes: Array<{ id: string; label: string; measured?: boolean }>;
  theoryLinks: Array<{ from: string; to: string; dotted?: boolean }>;
  theoryPredicts: string;
  theoryDoesNotProve: string;
  expectedResult: string;
  interpretation: { shows: string[]; doesNotShow: string[] };
  limitations: Array<{ title: string; text: string }>;
  strongerDesigns: string[];
  conclusion: {
    theory: string;
    calculation: string;
    judgement: string;
    nextQuestion: string;
  };
};

type RawSource = {
  url?: string;
  publisher?: string;
  coverage?: string;
  licence_or_access?: string;
  accessed?: string;
};
type RawProject = {
  project_id: string;
  title: string;
  status: string;
  source_data: Record<string, RawSource>;
  teaching_sample: { path: string; status: string; reason: string };
  sample_period: string;
  variables: [string, string, string][];
  cleaning: string[];
  formulae: Record<string, string>;
  expected_result: string;
  causal_limit: string;
};

const rawProjects = asArray<RawProject>(
  asRecord(FINAL_WORLD_TEACHING.evidenceLabProjects).projects,
);
const rawById = Object.fromEntries(
  rawProjects.map((project) => [project.project_id, project]),
);
const source = (label: string, value: RawSource | undefined): Source => ({
  label,
  publisher: value?.publisher,
  coverage: value?.coverage,
  licence: value?.licence_or_access,
  url: value?.url,
  accessed: value?.accessed,
});
const variable = (
  project: RawProject,
  name: string,
  role: EvidenceVariable["role"],
  example: string,
): EvidenceVariable => {
  const definition = project.variables.find(([item]) => item === name);
  const meaning = definition?.[1] ?? "";
  const unit = definition?.[2] ?? "";
  return { name, meaning, unit, role, example };
};

const flexibleRows = [
  ["w1", "2026-01", 0, 6.1, 62],
  ["w1", "2026-02", 1, 6.3, 60],
  ["w1", "2026-03", 2, 6.7, 58],
  ["w1", "2026-04", 2, 6.6, 61],
  ["w2", "2026-01", 1, 5.8, 70],
  ["w2", "2026-02", 1, 5.9, 68],
  ["w2", "2026-03", 2, 6.2, 65],
  ["w2", "2026-04", 3, 6.4, 63],
  ["w3", "2026-01", 0, 7.0, 45],
  ["w3", "2026-02", 1, 7.1, 46],
  ["w3", "2026-03", 1, 7.2, 44],
  ["w3", "2026-04", 2, 7.4, 43],
  ["w4", "2026-01", 2, 6.3, 66],
  ["w4", "2026-02", 2, 6.3, 67],
  ["w4", "2026-03", 3, 6.6, 64],
  ["w4", "2026-04", 3, 6.7, 62],
].map(
  ([worker_id, month, remote_days_week, wellbeing_0_10, workload_index]) => ({
    worker_id: String(worker_id),
    month: String(month),
    remote_days_week: Number(remote_days_week),
    wellbeing_0_10: Number(wellbeing_0_10),
    workload_index: Number(workload_index),
    status: "synthetic_calibration",
  }),
);

const restaurantRows = [
  [1, 92, 88, 100, 88, 12],
  [2, 105, 111, 112, 111, 1],
  [3, 98, 94, 105, 94, 11],
  [4, 120, 126, 125, 125, 0],
  [5, 110, 102, 116, 102, 14],
  [6, 82, 79, 90, 79, 11],
  [7, 101, 108, 110, 108, 2],
  [8, 115, 119, 122, 119, 3],
  [9, 96, 91, 105, 91, 14],
  [10, 108, 112, 114, 112, 2],
  [11, 90, 86, 98, 86, 12],
  [12, 104, 109, 112, 109, 3],
].map(
  ([day, forecast_meals, actual_meals, order_qty, sold_qty, waste_qty]) => ({
    day: Number(day),
    forecast_meals: Number(forecast_meals),
    actual_meals: Number(actual_meals),
    order_qty: Number(order_qty),
    sold_qty: Number(sold_qty),
    waste_qty: Number(waste_qty),
    unit_cost: 5,
    sale_price: 12,
    salvage_value: 1,
    status: "synthetic_calibration",
  }),
);

const oilRows = [
  ["2025-01", 100, 0, 120, 2.4, -0.8],
  ["2025-02", 102, 1.98, 120.3, 2.5, -0.7],
  ["2025-03", 108, 5.72, 120.8, 2.7, -0.5],
  ["2025-04", 121, 11.35, 121.7, 3.1, -0.3],
  ["2025-05", 126, 4.05, 122.6, 3.5, -0.1],
  ["2025-06", 124, -1.6, 123.3, 3.7, 0],
  ["2025-07", 118, -4.96, 123.8, 3.6, 0.1],
  ["2025-08", 115, -2.58, 124.1, 3.4, 0],
  ["2025-09", 119, 3.42, 124.6, 3.3, -0.1],
  ["2025-10", 127, 6.51, 125.4, 3.6, 0],
  ["2025-11", 130, 2.33, 126.2, 3.9, 0.2],
  ["2025-12", 128, -1.55, 126.8, 3.8, 0.1],
].map(
  ([
    month,
    oil_price_index,
    oil_log_change_pct,
    cpi_index,
    inflation_yoy_pct,
    output_gap_pct,
  ]) => ({
    month: String(month),
    oil_price_index: Number(oil_price_index),
    oil_log_change_pct: Number(oil_log_change_pct),
    cpi_index: Number(cpi_index),
    inflation_yoy_pct: Number(inflation_yoy_pct),
    output_gap_pct: Number(output_gap_pct),
    status: "synthetic_calibration",
  }),
);

const flex = rawById["EL-FLEX-WORK"];
const restaurant = rawById["EL-RESTAURANT-WASTE"];
const oil = rawById["EL-OIL-INFLATION"];

export const EVIDENCE_PROJECTS: EvidenceProject[] = [
  {
    id: flex.project_id,
    slug: "flexible-work-wellbeing",
    title: flex.title,
    category: "Labour Economics · Econometrics",
    topic: "Labour Economics",
    subtitle:
      "A fixed worker panel separates a transparent teaching calculation from population evidence.",
    researchQuestion:
      "Is an increase in remote working associated with improved employee wellbeing after controlling for workload and stable individual differences?",
    hypothesis:
      "More remote work may be associated with higher wellbeing when reduced commuting burden and greater autonomy outweigh isolation or blurred work boundaries.",
    competingHypotheses: [
      "More remote work → lower commuting burden → potentially higher wellbeing",
      "More remote work → isolation or blurred work boundaries → potentially lower wellbeing",
    ],
    actors: ["Workers", "Managers", "Employers", "Researchers"],
    evidenceSupport:
      "A positive adjusted association, especially within the same worker as remote days change.",
    evidenceWeakens:
      "A null or negative adjusted association, or a pattern explained by workload and stable worker differences.",
    duration: "15–20 min",
    evidenceStatus: "Association, not causal proof",
    causalConfidence: "Association",
    methods: ["OLS", "Fixed Effects", "Panel Data", "Curated Sample"],
    relatedModels: [
      { label: "Labour Market", href: "/models/labour-market" },
      { label: "OLS Regression", href: "/models" },
      { label: "Fixed Effects", href: "/models" },
    ],
    relatedCase: {
      label: "Flexible-work pilot",
      href: "/econbench/eb-09-flex-work",
    },
    datasetSummary: [
      { value: "4", label: "monthly periods" },
      { value: "Panel", label: "structure" },
      { value: "16", label: "worker-month rows" },
      { value: "No", label: "personal data" },
    ],
    sampleStatus: "Teaching sample, not respondent-level survey evidence",
    sampleReason: flex.teaching_sample.reason,
    variables: [
      variable(flex, "worker_id", "ID", "w2"),
      variable(flex, "month", "Time", "2026-03"),
      variable(flex, "remote_days_week", "Explanatory", "2 days"),
      variable(flex, "wellbeing_0_10", "Outcome", "6.7"),
      variable(flex, "workload_index", "Control", "58"),
    ],
    sampleRows: flexibleRows,
    sources: [
      source("Primary public source", flex.source_data.primary),
      source("Context source", flex.source_data.secondary),
    ],
    cleaningSteps: [
      { stage: "Raw source", detail: flex.cleaning[0] },
      { stage: "Filter", detail: flex.cleaning[1] },
      { stage: "Validate", detail: flex.cleaning[2] },
      { stage: "Construct panel variables", detail: flex.cleaning[3] },
    ],
    equations: [
      {
        label: "OLS",
        expression: "wellbeingᵢₜ = α + β remote_daysᵢₜ + γ workloadᵢₜ + εᵢₜ",
        plain: flex.formulae.OLS,
        question:
          "Across all observations, is remote work associated with wellbeing after workload control?",
        risk: "Stable worker characteristics may be omitted.",
      },
      {
        label: "Fixed Effects",
        expression:
          "wellbeingᵢₜ = αᵢ + τₜ + β remote_daysᵢₜ + γ workloadᵢₜ + εᵢₜ",
        plain: flex.formulae.FE,
        question:
          "When the same worker changes remote-working days, does wellbeing also change?",
        risk: "Time-varying confounding remains.",
      },
    ],
    theoryNodes: [
      { id: "remote", label: "Remote Days", measured: true },
      { id: "commute", label: "Commuting Time" },
      { id: "workload", label: "Workload", measured: true },
      { id: "autonomy", label: "Autonomy" },
      { id: "isolation", label: "Isolation" },
      { id: "wellbeing", label: "Wellbeing", measured: true },
      { id: "traits", label: "Worker Characteristics" },
      { id: "policy", label: "Employer Policy" },
    ],
    theoryLinks: [
      { from: "remote", to: "commute" },
      { from: "commute", to: "wellbeing" },
      { from: "remote", to: "autonomy" },
      { from: "autonomy", to: "wellbeing" },
      { from: "remote", to: "isolation" },
      { from: "isolation", to: "wellbeing" },
      { from: "traits", to: "remote", dotted: true },
      { from: "traits", to: "wellbeing", dotted: true },
      { from: "policy", to: "remote", dotted: true },
    ],
    theoryPredicts:
      "Remote work can improve wellbeing through less commuting and more autonomy, while increased isolation can offset those gains.",
    theoryDoesNotProve:
      "A plausible pathway does not establish that remote access caused a population-level change in wellbeing.",
    expectedResult: flex.expected_result,
    interpretation: {
      shows: [
        "In this teaching sample, higher remote-working days are associated with higher wellbeing after workload adjustment.",
        "The Fixed Effects estimate focuses on within-worker change.",
      ],
      doesNotShow: [
        "It does not estimate a population effect.",
        "It does not prove that remote work causes higher wellbeing.",
        "It does not remove reverse causality or time-varying confounding.",
        "It does not account for non-random employer adoption.",
      ],
    },
    limitations: [
      {
        title: "Time-varying confounding",
        text: "Changes in manager quality, workload or family circumstances can move with remote work.",
      },
      {
        title: "Reverse causality",
        text: "Wellbeing may influence access to flexibility rather than only respond to it.",
      },
      {
        title: "Non-random adoption",
        text: "Employer policy and worker selection are not assigned at random.",
      },
      {
        title: "Limited synthetic periods",
        text: "Four illustrative months cannot support a population claim.",
      },
    ],
    strongerDesigns: [
      "A credible natural experiment",
      "Randomised adoption",
      "Instrumental variables with justified assumptions",
      "Difference-in-differences with defensible parallel trends",
      "A real representative panel with richer controls",
    ],
    conclusion: {
      theory:
        "Remote work may affect wellbeing through commuting, autonomy, workload and isolation.",
      calculation:
        "The fixed sample produces a positive adjusted within-worker association.",
      judgement:
        "The calculation is consistent with one theoretical pathway but does not establish a causal population effect.",
      nextQuestion:
        "What research design could isolate exogenous changes in remote-working access?",
    },
  },
  {
    id: restaurant.project_id,
    slug: "restaurant-demand-food-waste",
    title: restaurant.title,
    category: "Operations Economics · Sustainability",
    topic: "Operations Economics",
    subtitle:
      "A fixed point-of-sale sample demonstrates forecasting error, waste and the newsvendor trade-off.",
    researchQuestion:
      "Does improved demand forecasting reduce food waste without producing unacceptable stockout risk?",
    hypothesis:
      "Orders closer to realised demand can reduce avoidable waste, but overly cautious orders can create stockouts and lost sales.",
    competingHypotheses: [
      "Better forecasts → orders nearer demand → less waste",
      "Lower orders → fewer leftovers → potentially more stockouts",
    ],
    actors: [
      "Restaurant managers",
      "Customers",
      "Suppliers",
      "Food-waste partners",
    ],
    evidenceSupport:
      "Lower waste alongside acceptable fulfilled demand and profit in the fixed sample.",
    evidenceWeakens:
      "Waste reductions that are achieved only by increasing missed sales or lowering profit.",
    duration: "15–20 min",
    evidenceStatus: "Operational teaching evidence",
    causalConfidence: "Operational teaching evidence",
    methods: [
      "Descriptive comparison",
      "Forecasting error",
      "Newsvendor calibration",
    ],
    relatedModels: [
      { label: "Demand and Supply", href: "/models/supply-demand" },
      { label: "Expected Value", href: "/models" },
      { label: "Externalities", href: "/models/externalities" },
    ],
    relatedCase: {
      label: "Restaurant inventory challenge",
      href: "/econbench/eb-06-restaurant-inventory",
    },
    datasetSummary: [
      { value: "12", label: "service days" },
      { value: "Fixed", label: "teaching sample" },
      { value: "12", label: "daily records" },
      { value: "No", label: "customer data" },
    ],
    sampleStatus:
      "Synthetic classroom calibration, not restaurant transaction evidence",
    sampleReason: restaurant.teaching_sample.reason,
    variables: [
      variable(restaurant, "day", "Time", "4"),
      variable(restaurant, "forecast_meals", "Explanatory", "120"),
      variable(restaurant, "actual_meals", "Outcome", "126"),
      variable(restaurant, "order_qty", "Explanatory", "125"),
      variable(restaurant, "waste_qty", "Outcome", "0"),
      variable(restaurant, "sold_qty", "Derived", "125"),
    ],
    sampleRows: restaurantRows,
    sources: [
      source("Primary public source", restaurant.source_data.primary),
      source("Context source", restaurant.source_data.secondary),
    ],
    cleaningSteps: [
      { stage: "Raw source", detail: restaurant.cleaning[0] },
      { stage: "Filter", detail: restaurant.cleaning[2] },
      { stage: "Validate", detail: restaurant.cleaning[1] },
      { stage: "Construct panel variables", detail: restaurant.cleaning[3] },
    ],
    equations: [
      {
        label: "Forecast",
        expression: "demand̂ₜ = α + β day_of_week + errorₜ",
        plain: restaurant.formulae.forecast,
        question:
          "How close is the pre-service demand forecast to realised meals?",
        risk: "A 12-day sample cannot establish performance in a new restaurant or season.",
      },
      {
        label: "Newsvendor",
        expression: "Q* = F⁻¹(Cᵤ / (Cᵤ + Cₒ))",
        plain: restaurant.formulae.newsvendor,
        question:
          "Which order quantity balances shortage cost against leftover cost?",
        risk: "The fixed sample does not contain an insurance-coverage variable.",
      },
    ],
    theoryNodes: [
      { id: "forecast", label: "Forecast", measured: true },
      { id: "order", label: "Order Quantity", measured: true },
      { id: "demand", label: "Actual Demand", measured: true },
      { id: "waste", label: "Waste", measured: true },
      { id: "stockout", label: "Stockouts" },
      { id: "profit", label: "Profit" },
      { id: "events", label: "Weather & Events" },
    ],
    theoryLinks: [
      { from: "forecast", to: "order" },
      { from: "order", to: "waste" },
      { from: "order", to: "stockout" },
      { from: "demand", to: "waste" },
      { from: "demand", to: "stockout" },
      { from: "waste", to: "profit" },
      { from: "stockout", to: "profit" },
      { from: "events", to: "demand", dotted: true },
    ],
    theoryPredicts:
      "The profit-maximising order is usually neither the minimum-waste order nor the highest possible order.",
    theoryDoesNotProve:
      "A descriptive fixed teaching sample cannot identify the causal effect of forecasting software or insurance on food waste.",
    expectedResult: restaurant.expected_result,
    interpretation: {
      shows: [
        "The fixed sample exposes the trade-off between waste, fulfilled demand and profit.",
        "The stated cost inputs imply a newsvendor critical ratio of about 0.636.",
      ],
      doesNotShow: [
        "It does not identify a restaurant-level causal effect.",
        "It does not include an insurance-coverage series.",
        "It does not represent observed transaction data.",
      ],
    },
    limitations: [
      {
        title: "Synthetic calibration",
        text: "The point-of-sale records are fixed teaching values, not an observed restaurant dataset.",
      },
      {
        title: "No evaluation design",
        text: "There is no random or quasi-experimental change in forecast quality.",
      },
      {
        title: "Missing insurance field",
        text: "The supplied sample cannot support an insurance comparison.",
      },
      {
        title: "External validity",
        text: "Demand, menu and cost conditions may differ elsewhere.",
      },
    ],
    strongerDesigns: [
      "Randomised forecasting-tool rollout",
      "A pre-registered staggered adoption design",
      "Transaction-level data with stable definitions",
      "Explicit insurance coverage and claims records",
    ],
    conclusion: {
      theory: "Order quantity trades surplus inventory against stockout risk.",
      calculation:
        "The sample makes the forecast error, waste and one-period profit arithmetic reproducible.",
      judgement:
        "It is operational teaching evidence, not a causal estimate of a restaurant intervention.",
      nextQuestion:
        "Which credible rollout design could isolate the effect of better forecasting on waste?",
    },
  },
  {
    id: oil.project_id,
    slug: "oil-prices-inflation",
    title: oil.title,
    category: "Macroeconomics · Time-Series Evidence",
    topic: "Macroeconomics",
    subtitle:
      "A documented synthetic monthly series explores oil movements, inflation and lag structure.",
    researchQuestion:
      "How strongly and how quickly are oil-price movements associated with inflation?",
    hypothesis:
      "Oil-price increases may coincide with higher headline inflation contemporaneously and with a short lag, while pass-through differs by context.",
    competingHypotheses: [
      "Oil-price increase → higher energy costs → higher headline inflation",
      "Global demand, exchange rates or policy → jointly move oil and inflation",
    ],
    actors: ["Households", "Energy importers", "Central banks", "Firms"],
    evidenceSupport:
      "A positive contemporaneous-plus-one-month association in the documented teaching series.",
    evidenceWeakens:
      "No stable association once timing and the output-gap control are considered.",
    duration: "15–20 min",
    evidenceStatus: "Association with substantial identification limitations",
    causalConfidence: "Association",
    methods: [
      "Time-series comparison",
      "Distributed lags",
      "Controlled association",
    ],
    relatedModels: [
      { label: "AD–AS", href: "/models/ad-as" },
      { label: "Phillips Curve", href: "/models/phillips-curve" },
      { label: "Exchange Rates", href: "/models" },
    ],
    relatedCase: {
      label: "Oil-shock challenge",
      href: "/econbench/eb-01-oil-shock",
    },
    datasetSummary: [
      { value: "12", label: "monthly observations" },
      { value: "Lagged", label: "association" },
      { value: "12", label: "fixed records" },
      { value: "No", label: "observed series" },
    ],
    sampleStatus:
      "Fixed illustrative monthly series, not historical observed data",
    sampleReason: oil.teaching_sample.reason,
    variables: [
      variable(oil, "month", "Time", "2025-04"),
      variable(oil, "oil_price_index", "Explanatory", "121.0"),
      variable(oil, "oil_log_change_pct", "Derived", "11.35%"),
      variable(oil, "inflation_yoy_pct", "Outcome", "3.1%"),
      variable(oil, "output_gap_pct", "Control", "−0.3%"),
    ],
    sampleRows: oilRows,
    sources: [
      source("Oil series route", oil.source_data.oil),
      source("Inflation series route", oil.source_data.inflation),
      source("Context source", oil.source_data.context),
    ],
    cleaningSteps: [
      { stage: "Raw source", detail: oil.cleaning[0] },
      { stage: "Filter", detail: oil.cleaning[1] },
      { stage: "Validate", detail: oil.cleaning[2] },
      { stage: "Construct panel variables", detail: oil.cleaning[3] },
    ],
    equations: [
      {
        label: "Distributed lag",
        expression:
          "inflationₜ = α + β₀ oil_changeₜ + β₁ oil_changeₜ₋₁ + γ gapₜ + εₜ",
        plain: oil.formulae.distributed_lag,
        question:
          "Are contemporaneous and one-month oil movements associated with inflation after the supplied control?",
        risk: "Short time-series OLS is sensitive to confounding, autocorrelation and revision vintage.",
      },
      {
        label: "Cumulative pass-through",
        expression: "cumulative pass-throughₕ = Σₖ₌₀ʰ βₖ",
        plain: oil.formulae.pass_through,
        question:
          "How is the displayed association distributed across short lags?",
        risk: "The fixed sample does not contain core inflation or cross-country observations.",
      },
    ],
    theoryNodes: [
      { id: "oil", label: "Oil Price", measured: true },
      { id: "energy", label: "Energy Costs" },
      { id: "headline", label: "Headline Inflation", measured: true },
      { id: "core", label: "Core Inflation" },
      { id: "exchange", label: "Exchange Rate" },
      { id: "demand", label: "Global Demand" },
      { id: "policy", label: "Monetary Policy" },
    ],
    theoryLinks: [
      { from: "oil", to: "energy" },
      { from: "energy", to: "headline" },
      { from: "headline", to: "core", dotted: true },
      { from: "exchange", to: "oil", dotted: true },
      { from: "exchange", to: "headline", dotted: true },
      { from: "demand", to: "oil", dotted: true },
      { from: "demand", to: "headline", dotted: true },
      { from: "policy", to: "headline", dotted: true },
    ],
    theoryPredicts:
      "Oil-price moves can pass through to energy costs and headline inflation, but the size and timing vary with global demand, exchange rates and policy.",
    theoryDoesNotProve:
      "A small controlled time-series association is not an identified structural pass-through estimate.",
    expectedResult: oil.expected_result,
    interpretation: {
      shows: [
        "The synthetic series is constructed with a positive contemporaneous-plus-one-month association.",
        "The charts make timing and units visible.",
      ],
      doesNotShow: [
        "It does not identify structural pass-through.",
        "It does not include core inflation.",
        "It does not separate global demand, supply disruptions and monetary policy.",
      ],
    },
    limitations: [
      {
        title: "Joint shocks",
        text: "Oil, global demand and inflation can move together for different reasons.",
      },
      {
        title: "Autocorrelation",
        text: "A short monthly series can violate simple independent-error assumptions.",
      },
      {
        title: "Revision vintage",
        text: "Observed source series require dated downloads and documented revisions.",
      },
      {
        title: "Missing core inflation",
        text: "The teaching sample has headline inflation only.",
      },
    ],
    strongerDesigns: [
      "A documented multi-country panel",
      "Clearly justified external supply shocks",
      "Longer pre-registered lag design",
      "Observed series with archived vintages and robustness checks",
    ],
    conclusion: {
      theory:
        "Oil can affect headline inflation through energy costs, yet global demand and exchange rates also matter.",
      calculation: "The fixed series makes a short lagged association visible.",
      judgement:
        "It is consistent with one pass-through channel but does not identify a causal structural effect.",
      nextQuestion:
        "Which quasi-experimental variation could separate oil supply shocks from global-demand shocks?",
    },
  },
];

export function getEvidenceProject(slugOrId: string) {
  const normalized = slugOrId.toLowerCase();
  return EVIDENCE_PROJECTS.find(
    (project) =>
      project.slug === normalized || project.id.toLowerCase() === normalized,
  );
}

export function evidenceProjectStorageKey(project: EvidenceProject) {
  return `econmind:evidence-lab:${project.slug}:v1`;
}
export function displayValue(value: DataValue) {
  return typeof value === "number"
    ? Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(/\.00$/, "")
    : value;
}

type RegressionResult = { beta: number; low: number; high: number };
function invert(matrix: number[][]) {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row += 1)
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot]))
        best = row;
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    if (Math.abs(divisor) < 1e-9) return null;
    augmented[pivot] = augmented[pivot].map((value) => value / divisor);
    for (let row = 0; row < n; row += 1)
      if (row !== pivot) {
        const factor = augmented[row][pivot];
        augmented[row] = augmented[row].map(
          (value, col) => value - factor * augmented[pivot][col],
        );
      }
  }
  return augmented.map((row) => row.slice(n));
}
function regression(x: number[][], y: number[]): RegressionResult {
  const k = x[0]?.length ?? 0;
  const xtx = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) =>
      x.reduce((sum, row) => sum + row[i] * row[j], 0),
    ),
  );
  const inverse = invert(xtx);
  if (!inverse) return { beta: 0, low: 0, high: 0 };
  const xty = Array.from({ length: k }, (_, i) =>
    x.reduce((sum, row, index) => sum + row[i] * y[index], 0),
  );
  const coefficients = inverse.map((row) =>
    row.reduce((sum, value, index) => sum + value * xty[index], 0),
  );
  const residuals = x.map(
    (row, index) =>
      y[index] -
      row.reduce((sum, value, column) => sum + value * coefficients[column], 0),
  );
  const sigma2 =
    residuals.reduce((sum, value) => sum + value ** 2, 0) /
    Math.max(y.length - k, 1);
  const se = Math.sqrt(Math.max(0, sigma2 * inverse[1][1]));
  const beta = coefficients[1];
  return { beta, low: beta - 1.96 * se, high: beta + 1.96 * se };
}

export function flexibleTeachingEstimates() {
  const workers = [...new Set(flexibleRows.map((row) => row.worker_id))];
  const months = [...new Set(flexibleRows.map((row) => row.month))];
  const y = flexibleRows.map((row) => row.wellbeing_0_10);
  const ols = regression(
    flexibleRows.map((row) => [1, row.remote_days_week, row.workload_index]),
    y,
  );
  const fe = regression(
    flexibleRows.map((row) => [
      1,
      row.remote_days_week,
      row.workload_index,
      ...workers.slice(1).map((worker) => (row.worker_id === worker ? 1 : 0)),
      ...months.slice(1).map((month) => (row.month === month ? 1 : 0)),
    ]),
    y,
  );
  return { ols, fe };
}

export function restaurantProfit(row: Record<string, DataValue>) {
  return (
    numeric(row.sale_price) * numeric(row.sold_qty) +
    numeric(row.salvage_value) * numeric(row.waste_qty) -
    numeric(row.unit_cost) * numeric(row.order_qty)
  );
}
