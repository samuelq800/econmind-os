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
  const inflation = p.expectedInflation - p.sensitivity * (p.unemployment - p.naturalUnemployment) + p.supplyShock + p.demandPressure;
  const unemploymentGap = p.unemployment - p.naturalUnemployment;
  const inflationSurprise = inflation - p.expectedInflation;
  return {
    inflation: r(inflation), unemploymentGap: r(unemploymentGap), inflationSurprise: r(inflationSurprise),
    shortRunPosition: unemploymentGap < -0.1 ? "Below natural unemployment" : unemploymentGap > 0.1 ? "Above natural unemployment" : "At natural unemployment",
    movement: p.supplyShock !== 0 || p.expectedInflation !== DEFAULT_PHILLIPS.expectedInflation ? "SRPC shifts" : "Movement along the SRPC",
    longRunPosition: "LRPC at " + p.naturalUnemployment + "% unemployment",
  };
}

export function phillipsChartData(p: PhillipsParameters) {
  return Array.from({ length: 31 }, (_, index) => {
    const unemployment = index / 2;
    return {
      unemployment: r(unemployment),
      srpc: r(p.expectedInflation - p.sensitivity * (unemployment - p.naturalUnemployment) + p.supplyShock),
      baseline: r(DEFAULT_PHILLIPS.expectedInflation - p.sensitivity * (unemployment - p.naturalUnemployment)),
    };
  });
}
