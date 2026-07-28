export type PhillipsParameters = {
  expectedInflation: number;
  unemployment: number;
  naturalUnemployment: number;
  sensitivity: number;
  supplyShock: number;
  demandPressure: number;
};

export const DEFAULT_PHILLIPS: PhillipsParameters = {
  expectedInflation: 2, unemployment: 5, naturalUnemployment: 5, sensitivity: 1, supplyShock: 0, demandPressure: 0,
};

const r = (value: number, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;

export function calculatePhillips(p: PhillipsParameters) {
  const valid = Object.values(p).every(Number.isFinite) && p.unemployment >= 0 && p.naturalUnemployment >= 0 && p.sensitivity > 0;
  if (!valid) return {
    valid: false, validationMessage: "Unemployment rates must be non-negative, curve sensitivity must be positive, and all inputs must be finite.",
    inflation: 0, effectiveUnemployment: 0, unemploymentGap: 0, inflationSurprise: 0,
    shortRunPosition: "Invalid inputs", movement: "Invalid inputs", longRunPosition: "Unavailable",
  };
  const effectiveUnemployment = p.unemployment - p.demandPressure;
  const inflation = p.expectedInflation - p.sensitivity * (effectiveUnemployment - p.naturalUnemployment) + p.supplyShock;
  const unemploymentGap = effectiveUnemployment - p.naturalUnemployment;
  const inflationSurprise = inflation - p.expectedInflation;
  return {
    valid: true, validationMessage: "",
    inflation: r(inflation), effectiveUnemployment: r(effectiveUnemployment), unemploymentGap: r(unemploymentGap), inflationSurprise: r(inflationSurprise),
    shortRunPosition: unemploymentGap < -0.1 ? "Below natural unemployment" : unemploymentGap > 0.1 ? "Above natural unemployment" : "At natural unemployment",
    movement: p.supplyShock !== 0 || p.expectedInflation !== DEFAULT_PHILLIPS.expectedInflation ? "SRPC shifts" : "Movement along the SRPC",
    longRunPosition: "LRPC at " + p.naturalUnemployment + "% unemployment",
  };
}

export function phillipsChartData(p: PhillipsParameters) {
  if (!calculatePhillips(p).valid) return [{ unemployment: 0, srpc: 0, baseline: 0 }, { unemployment: 10, srpc: 0, baseline: 0 }];
  return Array.from({ length: 31 }, (_, index) => {
    const unemployment = index / 2;
    return {
      unemployment: r(unemployment),
      srpc: r(p.expectedInflation - p.sensitivity * (unemployment - p.naturalUnemployment) + p.supplyShock),
      baseline: r(DEFAULT_PHILLIPS.expectedInflation - p.sensitivity * (unemployment - p.naturalUnemployment)),
    };
  });
}
