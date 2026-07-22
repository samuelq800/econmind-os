import { runFocusedModel } from "@/lib/experiments/model-runtime";
import { scoreExperiment } from "@/lib/experiments/scoring";
import { canPerformExperimentAction, enforceParameterPermissions } from "@/lib/experiments/security";
import type { ExperimentAttempt, ExperimentConfig, ExperimentSubmission } from "@/lib/experiments/types";
import { modelMechanismChain } from "@/lib/models/explanations";

export function runExperimentAttempt(config: ExperimentConfig, studentId: string, input: Record<string, unknown>, attemptNumber: number): ExperimentAttempt {
  if (!canPerformExperimentAction("student", "run", config.status)) throw new Error("Experiment is not open for student runs.");
  if (config.attemptLimit !== null && attemptNumber > config.attemptLimit) throw new Error("Attempt limit reached.");
  const parameters = enforceParameterPermissions(config.modelKey, input, config.parameterPermissions);
  const results = runFocusedModel(config.modelKey, parameters);
  return { id: `attempt-${attemptNumber}`, experimentId: config.id, studentId, attemptNumber, parameters, results, mechanismChain: modelMechanismChain(config.modelKey, parameters), createdAt: new Date(0).toISOString() };
}

export function submitLatestAttempt(config: ExperimentConfig, attempt: ExperimentAttempt, prediction: unknown, explanation: string): ExperimentSubmission {
  if (config.explanationRequired && !explanation.trim()) throw new Error("Explanation is required.");
  const score = scoreExperiment({ modelKey: config.modelKey, parameters: attempt.parameters, submittedResults: attempt.results, predictionConfig: config.prediction, predictionAnswer: prediction, conditions: config.successConditions, parameterCompliant: true, attemptNumber: attempt.attemptNumber, weights: config.scoringWeights });
  return { id: `submission-${attempt.id}`, experimentId: config.id, studentId: attempt.studentId, attempt, prediction, explanation: { schemaVersion: 1, response: explanation.trim() }, score, finalScore: score.weightedTotal, feedbackReleased: config.immediateFeedback, submittedAt: new Date(0).toISOString() };
}
