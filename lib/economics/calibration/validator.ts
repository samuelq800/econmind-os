export type CalibrationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type CalibrationValidation = {
  ready: boolean;
  issues: CalibrationIssue[];
  summary: {
    countries: number;
    markets: number;
    policies: number;
    shocks: number;
  };
};

export const REQUIRED_CALIBRATION_FILES = [
  "package_metadata.json",
  "variable_dictionary.csv",
  "world_country_calibration.json",
  "market_baselines.json",
  "policy_effect_library.json",
  "shock_library.json",
  "stability_rules.md",
  "sources.md",
] as const;

type JsonRecord = Record<string, unknown>;
type JsonFiles = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const issue = (issues: CalibrationIssue[], severity: CalibrationIssue["severity"], code: string, message: string) => issues.push({ severity, code, message });

function csvRows(source: string) {
  return source.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
}

function assertCountryIntegrity(country: JsonRecord, issues: CalibrationIssue[]) {
  const id = typeof country.id === "string" ? country.id : "unknown-country";
  const values = asRecord(country.values);
  const number = (key: string) => finite(values[key]) ? Number(values[key]) : Number.NaN;
  const approx = (left: number, right: number, tolerance: number, label: string) => {
    if (!Number.isFinite(left) || !Number.isFinite(right) || Math.abs(left - right) > tolerance) {
      issue(issues, "error", "COUNTRY_IDENTITY", `${id}: ${label} is not internally consistent.`);
    }
  };
  approx(number("gdp_per_capita"), number("gdp_current") * 1000 / number("population"), 1.1, "GDP per capita");
  approx(number("overall_fiscal_balance"), number("total_revenue") - number("total_expenditure"), 0.11, "fiscal balance");
  approx(number("primary_balance"), number("overall_fiscal_balance") + number("interest_cost"), 0.11, "primary balance");
  approx(number("current_account"), number("trade_balance") + number("net_primary_secondary_income"), 0.11, "current account");
  approx(number("agriculture_share") + number("manufacturing_share") + number("services_share"), 100, 0.11, "sector shares");
  approx(number("renewable_share") + number("nuclear_share") + number("fossil_share"), 100, 0.11, "energy shares");
}

function validatePolicy(policy: JsonRecord, issues: CalibrationIssue[]) {
  const id = typeof policy.id === "string" ? policy.id : "unknown-policy";
  const lag = asArray(policy.implementation_lag_days);
  const peak = asArray(policy.peak_days);
  const duration = Number(policy.max_duration_days);
  const minLag = Number(lag[0]);
  const minPeak = Number(peak[0]);
  if (!Number.isFinite(minLag) || !Number.isFinite(minPeak) || !Number.isFinite(duration) || minLag > minPeak || minPeak > duration) {
    issue(issues, "error", "POLICY_TIMING", `${id}: implementation lag, peak and maximum duration must be ordered.`);
  }
  const range = asArray(policy.allowed_range).map(Number);
  if (range.length !== 2 || !Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[0] > range[1]) {
    issue(issues, "error", "POLICY_RANGE", `${id}: allowed_range must contain a valid minimum and maximum.`);
  }
  for (const [metric, rawValues] of Object.entries(asRecord(policy.effects_per_impulse))) {
    const values = asArray(rawValues).map(Number);
    const monotonic = values[0] <= values[1] && values[1] <= values[2]
      || values[0] >= values[1] && values[1] >= values[2];
    // A contraction can be increasingly negative as severity rises, while a
    // positive effect rises normally. Both directions are valid low/central/high ranges.
    if (values.length !== 3 || values.some((value) => !Number.isFinite(value)) || !monotonic) {
      issue(issues, "error", "POLICY_EFFECT", `${id}: ${metric} must provide a monotonic low, central and high coefficient range.`);
    }
  }
}

/**
 * Validates a calibration package before it is promoted to an active world.
 * The function is intentionally framework-independent so it can run in CI,
 * the import script and a future administrator preview without browser state.
 */
export function validateCalibrationPackage(files: JsonFiles, textFiles: Record<string, string> = {}): CalibrationValidation {
  const issues: CalibrationIssue[] = [];
  for (const file of REQUIRED_CALIBRATION_FILES) {
    if (!(file in files) && !(file in textFiles)) issue(issues, "error", "FILE_MISSING", `Required calibration file is missing: ${file}.`);
  }

  const metadata = asRecord(files["package_metadata.json"]);
  const declaredFiles = asRecord(metadata.files);
  for (const file of Object.keys(declaredFiles)) {
    if (!(file in files) && !(file in textFiles)) issue(issues, "warning", "DECLARED_FILE_MISSING", `The package declares ${file}, but it has not been supplied yet.`);
  }

  const countries = asArray(asRecord(files["world_country_calibration.json"]).countries).map(asRecord);
  const countryIds = countries.map((country) => country.id).filter((id): id is string => typeof id === "string");
  if (countries.length !== 12) issue(issues, "error", "COUNTRY_COUNT", `Expected 12 fictional countries, found ${countries.length}.`);
  if (new Set(countryIds).size !== countryIds.length) issue(issues, "error", "COUNTRY_IDS", "Country identifiers must be unique.");
  for (const country of countries) assertCountryIntegrity(country, issues);

  const markets = asArray(asRecord(files["market_baselines.json"]).markets).map(asRecord);
  const marketIds = markets.map((market) => market.id).filter((id): id is string => typeof id === "string");
  if (!marketIds.includes("energy") || !marketIds.includes("food")) issue(issues, "error", "MARKETS", "Energy and food markets are required for the initial world.");
  for (const market of markets) {
    const id = typeof market.id === "string" ? market.id : "unknown-market";
    const price = asRecord(market.price);
    if (!["initial", "floor", "ceiling"].every((key) => finite(price[key])) || Number(price.floor) > Number(price.initial) || Number(price.initial) > Number(price.ceiling)) {
      issue(issues, "error", "MARKET_PRICE", `${id}: floor ≤ initial ≤ ceiling is required.`);
    }
  }

  const policies = asArray(asRecord(files["policy_effect_library.json"]).policies).map(asRecord);
  const policyIds = policies.map((policy) => policy.id).filter((id): id is string => typeof id === "string");
  if (new Set(policyIds).size !== policyIds.length) issue(issues, "error", "POLICY_IDS", "Policy identifiers must be unique.");
  for (const policy of policies) validatePolicy(policy, issues);

  const shocks = asArray(asRecord(files["shock_library.json"]).shocks).map(asRecord);
  for (const shock of shocks) {
    const id = typeof shock.id === "string" ? shock.id : "unknown-shock";
    const probability = Number(shock.annual_probability_prior);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) issue(issues, "error", "SHOCK_PROBABILITY", `${id}: annual probability must be between 0 and 1.`);
  }

  const testCases = asArray(asRecord(files["calibration_test_suite.json"]).tests).map(asRecord);
  if ("calibration_test_suite.json" in files && testCases.length === 0) issue(issues, "error", "CALIBRATION_TESTS", "The calibration test suite needs at least one executable case.");
  const testIds = testCases.map((test) => test.id).filter((id): id is string => typeof id === "string");
  if (testIds.length !== testCases.length || new Set(testIds).size !== testIds.length) issue(issues, "error", "CALIBRATION_TEST_IDS", "Calibration test cases must have unique identifiers.");

  const rawPracticeBank = files["practice_question_bank.json"];
  const rawPracticeBanks = Array.isArray(rawPracticeBank) ? rawPracticeBank : asRecord(rawPracticeBank).banks;
  const practiceBanks = asArray(rawPracticeBanks).map(asRecord);
  if ("practice_question_bank.json" in files && practiceBanks.length === 0) issue(issues, "error", "PRACTICE_BANK", "The practice question bank needs at least one model bank.");
  for (const bank of practiceBanks) {
    const modelId = typeof bank.model_id === "string" ? bank.model_id : "unknown-model";
    const questions = asArray(bank.questions).map(asRecord);
    if (!questions.length || questions.some((question) => typeof question.id !== "string" || typeof question.answer_condition !== "string")) {
      issue(issues, "error", "PRACTICE_QUESTION", `${modelId}: every practice bank needs identified questions and answer conditions.`);
    }
  }

  if ("model_formula_catalog.md" in textFiles && textFiles["model_formula_catalog.md"].trim().length < 200) {
    issue(issues, "error", "FORMULA_CATALOG", "The model formula catalogue is unexpectedly empty.");
  }

  const variableRows = csvRows(textFiles["variable_dictionary.csv"] ?? "");
  if (variableRows.length < 2) issue(issues, "error", "VARIABLE_DICTIONARY", "The variable dictionary needs a header and at least one variable.");
  const header = variableRows[0]?.split(",") ?? [];
  const idIndex = header.indexOf("variable_id");
  if (idIndex < 0) issue(issues, "error", "VARIABLE_DICTIONARY_HEADER", "variable_dictionary.csv must include variable_id.");
  else {
    const ids = variableRows.slice(1).map((row) => row.split(",")[idIndex]?.trim()).filter(Boolean);
    if (new Set(ids).size !== ids.length) issue(issues, "error", "VARIABLE_IDS", "Variable identifiers must be unique.");
  }

  return {
    ready: !issues.some((entry) => entry.severity === "error"),
    issues,
    summary: { countries: countries.length, markets: markets.length, policies: policies.length, shocks: shocks.length },
  };
}
