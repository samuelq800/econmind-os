import { runFocusedModel, type FocusedModelKey } from "@/lib/experiments/model-runtime";
import type { PredictionConfig, ScoreBreakdown, ScoringWeights, SuccessCondition } from "@/lib/experiments/types";

export function evaluateCondition(value: number, condition: SuccessCondition) {
  if (!Number.isFinite(value)) return false;
  if (condition.operator === "gte") return value >= condition.targetMinimum;
  if (condition.operator === "lte") return value <= condition.targetMaximum;
  if (condition.operator === "between") return value >= condition.targetMinimum && value <= condition.targetMaximum;
  return Math.abs(value - condition.targetMinimum) <= condition.tolerance;
}

export function evaluatePrediction(config: PredictionConfig, answer: unknown) {
  if (config.type === "text") return null;
  if (config.type === "choice") return typeof answer === "string" && answer === config.expectedChoice;
  const numeric = Number(answer);
  return Number.isFinite(numeric) && numeric >= (config.expectedMinimum ?? numeric + 1) && numeric <= (config.expectedMaximum ?? numeric - 1);
}

export function resultAccuracy(expected: Record<string, number>, submitted: Record<string, number>, tolerance = 0.01) {
  const keys = Object.keys(expected).filter((key) => key !== "valid" && Number.isFinite(expected[key]));
  if (keys.length === 0) return 0;
  const correct = keys.filter((key) => Number.isFinite(submitted[key]) && Math.abs(submitted[key] - expected[key]) <= Math.max(tolerance, Math.abs(expected[key]) * tolerance)).length;
  return correct / keys.length * 100;
}

export function scoreExperiment(input: {
  modelKey: FocusedModelKey;
  parameters: Record<string, number>;
  submittedResults: Record<string, number>;
  predictionConfig: PredictionConfig;
  predictionAnswer: unknown;
  conditions: SuccessCondition[];
  parameterCompliant: boolean;
  attemptNumber: number;
  weights: ScoringWeights;
}): ScoreBreakdown {
  const expectedResults = runFocusedModel(input.modelKey, input.parameters);
  const predictionResult = evaluatePrediction(input.predictionConfig, input.predictionAnswer);
  const prediction = predictionResult === null ? 100 : predictionResult ? 100 : 0;
  const passedConditions = input.conditions.filter((condition) => evaluateCondition(expectedResults[condition.metricKey], condition)).length;
  const success = input.conditions.length ? passedConditions / input.conditions.length * 100 : 100;
  const compliance = input.parameterCompliant ? 100 : 0;
  const accuracy = resultAccuracy(expectedResults, input.submittedResults);
  const attempts = Math.max(0, 100 - Math.max(0, input.attemptNumber - 1) * 20);
  const weightTotal = Object.values(input.weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(weightTotal - 100) > 0.01) throw new Error("Scoring weights must total 100.");
  const weightedTotal = prediction * input.weights.prediction / 100 + success * input.weights.success / 100 + compliance * input.weights.compliance / 100 + accuracy * input.weights.accuracy / 100 + attempts * input.weights.attempts / 100;
  return { prediction, success, compliance, accuracy, attempts, weightedTotal: Math.round(weightedTotal * 100) / 100, passedConditions, totalConditions: input.conditions.length };
}
