import { BASELINE_INDICATORS, BASELINE_PARAMETERS, INDICATOR_LIMITS, POLICY_DEFINITIONS } from "@/lib/economics/sandbox/defaults";
import { environmentalContributions } from "@/lib/economics/sandbox/environment";
import { fiscalContributions } from "@/lib/economics/sandbox/fiscal";
import { laborContributions } from "@/lib/economics/sandbox/labor";
import { monetaryContributions } from "@/lib/economics/sandbox/monetary";
import { tradeContributions } from "@/lib/economics/sandbox/trade";
import type { IndicatorKey, PolicyContribution, RadarScores, SandboxIndicators, SandboxParameters, SandboxResult } from "@/lib/economics/sandbox/types";

export const clampValue = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
const round = (value: number, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;

export function sanitizeParameters(input: Partial<SandboxParameters>): SandboxParameters {
  const output = { ...BASELINE_PARAMETERS };
  for (const definition of POLICY_DEFINITIONS) {
    output[definition.key] = round(clampValue(Number(input[definition.key] ?? BASELINE_PARAMETERS[definition.key]), definition.min, definition.max));
  }
  return output;
}

function radarScores(indicators: SandboxIndicators): RadarScores {
  return {
    growth: round(clampValue(indicators.gdpIndex, 0, 140)),
    employment: round(clampValue(100 - (indicators.unemploymentRate - BASELINE_INDICATORS.unemploymentRate) * 6, 0, 140)),
    priceStability: round(clampValue(100 - Math.abs(indicators.inflationRate - BASELINE_INDICATORS.inflationRate) * 8, 0, 140)),
    consumerWelfare: round(clampValue(indicators.consumerWelfare, 0, 140)),
    firmProfit: round(clampValue(indicators.firmProfit, 0, 140)),
    environmentalPerformance: round(clampValue(200 - indicators.carbonEmissions, 0, 140)),
  };
}

export function simulateSandbox(input: Partial<SandboxParameters>): SandboxResult {
  const parameters = sanitizeParameters(input);
  const contributions: PolicyContribution[] = [
    ...fiscalContributions(parameters),
    ...monetaryContributions(parameters),
    ...laborContributions(parameters),
    ...environmentalContributions(parameters),
    ...tradeContributions(parameters),
  ].filter((contribution) => Object.values(contribution.values).some((value) => Math.abs(value ?? 0) > 0.001));

  const indicators = { ...BASELINE_INDICATORS };
  for (const contribution of contributions) {
    for (const [key, value] of Object.entries(contribution.values) as Array<[IndicatorKey, number]>) {
      indicators[key] += Number.isFinite(value) ? value : 0;
    }
  }

  for (const key of Object.keys(indicators) as IndicatorKey[]) {
    const [minimum, maximum] = INDICATOR_LIMITS[key];
    indicators[key] = round(clampValue(indicators[key], minimum, maximum));
  }

  return {
    parameters,
    baseline: { ...BASELINE_INDICATORS },
    indicators,
    contributions,
    radar: radarScores(indicators),
  };
}
