import { calculateAdAs, DEFAULT_AD_AS, type AdAsParameters } from "@/lib/economics/ad-as";
import { calculateIsLm, DEFAULT_IS_LM, type IsLmParameters } from "@/lib/economics/is-lm";
import { calculatePhillips, DEFAULT_PHILLIPS, type PhillipsParameters } from "@/lib/economics/phillips";
import { BASELINE_PARAMETERS } from "@/lib/economics/sandbox/defaults";
import type { SandboxParameters } from "@/lib/economics/sandbox/types";

export type ModelMetricDefinition = {
  metricKey: string;
  displayName: string;
  modelSource: string;
  scaleType: "index" | "percentage" | "model-units" | "currency" | "share" | "rate";
  baselineValue?: number;
  unitLabel: string;
  interpretation: string;
  comparableWith: string[];
};

export type CrossModelMappingConfig = {
  sourceModel: string;
  sourceMetric: string;
  targetModel: string;
  targetMetric: string;
  coefficient: number;
  transformation: "linear" | "percentage-change" | "index-change" | "bounded-linear";
  assumptionLabel: string;
  rationale: string;
  limitation: string;
  mappingType: "structural" | "calibrated" | "stylised";
};

export const MODEL_METRICS: ModelMetricDefinition[] = [
  { metricKey: "gdpIndex", displayName: "Sandbox GDP index", modelSource: "Economic Sandbox / Policy Lab", scaleType: "index", baselineValue: 100, unitLabel: "index points", interpretation: "A standardised headline indicator within the Sandbox only.", comparableWith: ["ad-as.output"] },
  { metricKey: "output", displayName: "IS–LM equilibrium output", modelSource: "IS–LM", scaleType: "model-units", baselineValue: calculateIsLm(DEFAULT_IS_LM).output, unitLabel: "model units", interpretation: "Output that jointly clears the stylised goods and money markets.", comparableWith: ["ad-as.output"] },
  { metricKey: "adAsOutput", displayName: "AD–AS output", modelSource: "AD–AS", scaleType: "index", baselineValue: DEFAULT_AD_AS.potentialOutput, unitLabel: "output index", interpretation: "Short-run output around a potential-output index.", comparableWith: ["sandbox.gdpIndex", "is-lm.output"] },
  { metricKey: "inflation", displayName: "Phillips Curve inflation estimate", modelSource: "Phillips Curve", scaleType: "percentage", baselineValue: DEFAULT_PHILLIPS.expectedInflation, unitLabel: "%", interpretation: "A short-run teaching estimate conditional on expectations and unemployment.", comparableWith: ["sandbox.inflationRate", "ad-as.priceLevel"] },
  { metricKey: "unemployment", displayName: "Sandbox standardised unemployment", modelSource: "Economic Sandbox", scaleType: "percentage", baselineValue: 5, unitLabel: "%", interpretation: "A Sandbox rate, not the same object as an IS–LM output level.", comparableWith: ["phillips-curve.unemployment"] },
];

/** Central, visible coefficients for cross-model teaching links. Never copy these into components. */
export const CROSS_MODEL_MAPPINGS: CrossModelMappingConfig[] = [
  { sourceModel: "Economic Sandbox", sourceMetric: "government spending index", targetModel: "IS–LM", targetMetric: "government spending", coefficient: 0.6, transformation: "index-change", assumptionLabel: "Each one-point Sandbox spending-index change maps to 0.6 IS–LM spending units.", rationale: "Creates a transparent fiscal-demand bridge while retaining the native models.", limitation: "The Sandbox index is not a national-accounts spending measure.", mappingType: "stylised" },
  { sourceModel: "Economic Sandbox", sourceMetric: "money supply growth", targetModel: "IS–LM", targetMetric: "nominal money supply", coefficient: 3, transformation: "linear", assumptionLabel: "Each percentage-point change in money-supply growth maps to 3 IS–LM money units relative to the 3% baseline.", rationale: "Represents a directional real-balances channel.", limitation: "It does not estimate a central-bank reaction function.", mappingType: "stylised" },
  { sourceModel: "IS–LM", sourceMetric: "equilibrium output", targetModel: "AD–AS", targetMetric: "aggregate-demand shock", coefficient: 0.6, transformation: "percentage-change", assumptionLabel: "Each 1% IS–LM output change maps to a 0.6-point AD shift.", rationale: "Passes a demand-side output movement into the separate AD–AS scale.", limitation: "The coefficient is an educational calibration, not an econometric estimate.", mappingType: "calibrated" },
  { sourceModel: "AD–AS", sourceMetric: "output gap", targetModel: "Phillips Curve", targetMetric: "unemployment", coefficient: -0.5, transformation: "linear", assumptionLabel: "A 1 percentage-point output gap maps to a −0.5 percentage-point unemployment gap.", rationale: "Uses the displayed Okun-style teaching rule consistently.", limitation: "It cannot identify labour-market institutions or a causal forecast.", mappingType: "stylised" },
  { sourceModel: "AD–AS", sourceMetric: "supply shock", targetModel: "Phillips Curve", targetMetric: "supply shock", coefficient: -0.08, transformation: "linear", assumptionLabel: "An adverse AD–AS supply shock maps into positive inflation pressure at 0.08 per point.", rationale: "Keeps an adverse supply disturbance directionally consistent across models.", limitation: "Price-setting dynamics are deliberately simplified.", mappingType: "stylised" },
];

export type MacroWorkspaceState = {
  governmentSpending: number;
  taxLevel: number;
  moneySupplyGrowth: number;
  policyRate: number;
  expectedInflation: number;
  supplyShock: number;
};

export const DEFAULT_MACRO_WORKSPACE: MacroWorkspaceState = { governmentSpending: 100, taxLevel: 25, moneySupplyGrowth: 3, policyRate: 4, expectedInflation: 2, supplyShock: 0 };

const byTarget = (targetModel: string, targetMetric: string) => CROSS_MODEL_MAPPINGS.find((mapping) => mapping.targetModel === targetModel && mapping.targetMetric === targetMetric)!;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const round = (value: number, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;

export function mapWorkspaceToISLM(state: MacroWorkspaceState): IsLmParameters {
  const spendingMap = byTarget("IS–LM", "government spending");
  const moneyMap = byTarget("IS–LM", "nominal money supply");
  return {
    ...DEFAULT_IS_LM,
    governmentSpending: clamp(DEFAULT_IS_LM.governmentSpending + (state.governmentSpending - 100) * spendingMap.coefficient, 0, 120),
    taxation: clamp(state.taxLevel, 0, 70),
    moneySupply: clamp(DEFAULT_IS_LM.moneySupply + (state.moneySupplyGrowth - 3) * moneyMap.coefficient - (state.policyRate - 4) * 2, 20, 180),
  };
}

export function mapISLMToADAS(islm: ReturnType<typeof calculateIsLm>): AdAsParameters {
  const map = byTarget("AD–AS", "aggregate-demand shock");
  const baseline = calculateIsLm(DEFAULT_IS_LM).output;
  const outputChangePercent = baseline === 0 ? 0 : (islm.output - baseline) / baseline * 100;
  return { ...DEFAULT_AD_AS, demandShock: round(clamp(outputChangePercent * map.coefficient, -25, 25)), };
}

export function mapADASToPhillips(adas: ReturnType<typeof calculateAdAs>, state: Pick<MacroWorkspaceState, "expectedInflation" | "supplyShock">): PhillipsParameters {
  const okun = byTarget("Phillips Curve", "unemployment");
  const supply = byTarget("Phillips Curve", "supply shock");
  return {
    ...DEFAULT_PHILLIPS,
    expectedInflation: state.expectedInflation,
    unemployment: clamp(DEFAULT_PHILLIPS.naturalUnemployment + adas.outputGap * okun.coefficient, 0, 20),
    supplyShock: round(-state.supplyShock * supply.coefficient),
  };
}

export function calculateMacroTransmission(state: MacroWorkspaceState) {
  const islmParameters = mapWorkspaceToISLM(state);
  const islm = calculateIsLm(islmParameters);
  const adasParameters = mapISLMToADAS(islm);
  const adas = calculateAdAs({ ...adasParameters, supplyShock: state.supplyShock });
  const phillipsParameters = mapADASToPhillips(adas, state);
  const phillips = calculatePhillips(phillipsParameters);
  return { islmParameters, islm, adasParameters: { ...adasParameters, supplyShock: state.supplyShock }, adas, phillipsParameters, phillips };
}

export function normalisedIndex(value: number, baseline: number) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || Math.abs(baseline) < 1e-9) return 100;
  return round(100 + (value - baseline) / Math.abs(baseline) * 100);
}

export function mapSandboxToMacro(parameters: SandboxParameters): MacroWorkspaceState {
  return {
    governmentSpending: parameters.governmentSpending,
    taxLevel: parameters.incomeTaxRate,
    moneySupplyGrowth: parameters.moneySupplyGrowth,
    policyRate: parameters.interestRate,
    expectedInflation: DEFAULT_PHILLIPS.expectedInflation,
    supplyShock: 0,
  };
}

export const SANDBOX_BASELINE_FOR_MAPPING = BASELINE_PARAMETERS;
