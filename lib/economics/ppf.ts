import { clamp, round } from "./types";

export type PpfParameters = {
  capacityX: number;
  capacityY: number;
  curvature: number;
  allocation: number;
  capacityUse: number;
  growthRate: number;
};

export type PpfOutcome = {
  outputX: number;
  outputY: number;
  frontierOutputY: number;
  opportunityCost: number;
  capacityGap: number;
  status: "Efficient" | "Inefficient" | "Unattainable";
  shiftedCapacityX: number;
  shiftedCapacityY: number;
  valid: boolean;
};

export const DEFAULT_PPF: PpfParameters = {
  capacityX: 100,
  capacityY: 100,
  curvature: 2,
  allocation: 50,
  capacityUse: 100,
  growthRate: 0,
};

function frontierY(x: number, capacityX: number, capacityY: number, curvature: number) {
  if (x < 0 || x > capacityX) return 0;
  return capacityY * (1 - (x / capacityX) ** curvature);
}

export function calculatePpf(parameters: PpfParameters): PpfOutcome {
  const { capacityX, capacityY, curvature, allocation, capacityUse, growthRate } = parameters;
  if (capacityX <= 0 || capacityY <= 0 || curvature < 1 || ![capacityX, capacityY, curvature, allocation, capacityUse, growthRate].every(Number.isFinite)) {
    return { outputX: 0, outputY: 0, frontierOutputY: 0, opportunityCost: 0, capacityGap: 0, status: "Inefficient", shiftedCapacityX: 0, shiftedCapacityY: 0, valid: false };
  }

  const growthFactor = Math.max(0.1, 1 + growthRate / 100);
  const shiftedCapacityX = capacityX * growthFactor;
  const shiftedCapacityY = capacityY * growthFactor;
  const share = clamp(allocation / 100, 0, 1);
  const use = clamp(capacityUse / 100, 0, 2);
  const frontierX = shiftedCapacityX * share;
  const selectedFrontierY = frontierY(frontierX, shiftedCapacityX, shiftedCapacityY, curvature);
  const outputX = frontierX * use;
  const outputY = selectedFrontierY * use;
  const feasibleY = frontierY(outputX, shiftedCapacityX, shiftedCapacityY, curvature);
  const tolerance = Math.max(shiftedCapacityY * 0.005, 0.05);
  const capacityGap = feasibleY - outputY;
  const status = outputX > shiftedCapacityX + tolerance || capacityGap < -tolerance
    ? "Unattainable"
    : Math.abs(capacityGap) <= tolerance
      ? "Efficient"
      : "Inefficient";
  const opportunityCost = (shiftedCapacityY * curvature / shiftedCapacityX) * share ** (curvature - 1);

  return {
    outputX: round(outputX),
    outputY: round(outputY),
    frontierOutputY: round(feasibleY),
    opportunityCost: round(opportunityCost),
    capacityGap: round(capacityGap),
    status,
    shiftedCapacityX: round(shiftedCapacityX),
    shiftedCapacityY: round(shiftedCapacityY),
    valid: true,
  };
}

export function ppfChartData(parameters: PpfParameters, points = 51) {
  const growthFactor = Math.max(0.1, 1 + parameters.growthRate / 100);
  const shiftedX = parameters.capacityX * growthFactor;
  const shiftedY = parameters.capacityY * growthFactor;
  const maxX = Math.max(parameters.capacityX, shiftedX);
  return Array.from({ length: points }, (_, index) => {
    const x = maxX * index / (points - 1);
    return {
      outputX: round(x),
      baseline: x <= parameters.capacityX ? round(frontierY(x, parameters.capacityX, parameters.capacityY, parameters.curvature)) : undefined,
      current: x <= shiftedX ? round(frontierY(x, shiftedX, shiftedY, parameters.curvature)) : undefined,
    };
  });
}

export function ppfExplanation(parameters: PpfParameters, outcome = calculatePpf(parameters)) {
  if (!outcome.valid) return "These assumptions do not produce a valid production frontier.";
  const growth = parameters.growthRate === 0 ? "Productive capacity is unchanged" : parameters.growthRate > 0 ? `Growth shifts both capacity limits outward by ${parameters.growthRate}%` : `A contraction shifts both capacity limits inward by ${Math.abs(parameters.growthRate)}%`;
  const status = outcome.status === "Efficient" ? "The selected point lies on the frontier and fully uses available resources." : outcome.status === "Inefficient" ? `The point lies inside the frontier, leaving a vertical capacity gap of ${outcome.capacityGap}.` : "The point lies outside the current frontier and cannot be produced with these resources and technology.";
  return `${growth}. ${status} Near this allocation, one additional unit of Good X costs about ${outcome.opportunityCost} units of Good Y.`;
}
