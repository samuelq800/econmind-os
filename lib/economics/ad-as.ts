import { round } from "./types";

export type AdAsParameters = {
  potentialOutput: number;
  demandShock: number;
  supplyShock: number;
  demandSensitivity: number;
  supplySensitivity: number;
};

export type AdAsOutcome = {
  output: number;
  priceLevel: number;
  outputGap: number;
  inflationPressure: number;
  unemploymentGap: number;
  demandBase: number;
  supplyBase: number;
  condition: "Expansionary gap" | "Recessionary gap" | "Near potential";
  valid: boolean;
};

export const DEFAULT_AD_AS: AdAsParameters = {
  potentialOutput: 100,
  demandShock: 0,
  supplyShock: 0,
  demandSensitivity: 0.8,
  supplySensitivity: 0.8,
};

export function calculateAdAs(parameters: AdAsParameters): AdAsOutcome {
  const { potentialOutput, demandShock, supplyShock, demandSensitivity, supplySensitivity } = parameters;
  if (potentialOutput <= 0 || demandSensitivity <= 0 || supplySensitivity <= 0 || !Object.values(parameters).every(Number.isFinite)) {
    return { output: 0, priceLevel: 0, outputGap: 0, inflationPressure: 0, unemploymentGap: 0, demandBase: 0, supplyBase: 0, condition: "Near potential", valid: false };
  }

  const demandBase = potentialOutput + demandShock;
  const supplyBase = potentialOutput + supplyShock;
  const priceLevel = 100 + (demandBase - supplyBase) / (demandSensitivity + supplySensitivity);
  const output = demandBase - demandSensitivity * (priceLevel - 100);
  const outputGap = ((output - potentialOutput) / potentialOutput) * 100;
  const inflationPressure = priceLevel - 100;
  const unemploymentGap = -0.5 * outputGap;
  const condition = outputGap > 1 ? "Expansionary gap" : outputGap < -1 ? "Recessionary gap" : "Near potential";

  return {
    output: round(output),
    priceLevel: round(priceLevel),
    outputGap: round(outputGap),
    inflationPressure: round(inflationPressure),
    unemploymentGap: round(unemploymentGap),
    demandBase: round(demandBase),
    supplyBase: round(supplyBase),
    condition,
    valid: true,
  };
}

export function adAsChartData(parameters: AdAsParameters, points = 51) {
  const minOutput = Math.max(0, parameters.potentialOutput * 0.55);
  const maxOutput = parameters.potentialOutput * 1.45;
  const demandBase = parameters.potentialOutput + parameters.demandShock;
  const supplyBase = parameters.potentialOutput + parameters.supplyShock;
  return Array.from({ length: points }, (_, index) => {
    const output = minOutput + (maxOutput - minOutput) * index / (points - 1);
    return {
      output: round(output),
      aggregateDemand: round(100 + (demandBase - output) / parameters.demandSensitivity),
      shortRunSupply: round(100 + (output - supplyBase) / parameters.supplySensitivity),
    };
  });
}

export function adAsExplanation(parameters: AdAsParameters, outcome = calculateAdAs(parameters)) {
  if (!outcome.valid) return "These assumptions do not produce a valid short-run macro equilibrium.";
  const source = Math.abs(parameters.demandShock) > Math.abs(parameters.supplyShock) ? "aggregate demand" : Math.abs(parameters.supplyShock) > 0 ? "short-run aggregate supply" : "balanced baseline conditions";
  return `The simplified AD–AS intersection occurs at output ${outcome.output} and price index ${outcome.priceLevel}. That is a ${outcome.outputGap}% output gap, classified as ${outcome.condition.toLowerCase()}. The larger modeled disturbance comes from ${source}. The unemployment-gap estimate of ${outcome.unemploymentGap} percentage points uses a simplified Okun-style rule and is a teaching illustration, not a forecast.`;
}
