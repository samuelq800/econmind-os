import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_WEIGHTS, type ExperimentConfig, type SuccessCondition } from "../lib/experiments/types";
import { FOCUSED_MODEL_KEYS, MODEL_PARAMETER_DEFINITIONS, defaultModelParameters } from "../lib/experiments/model-runtime";
import { canPerformExperimentAction, canViewPrivateReport, enforceParameterPermissions, validateParameterPermissions } from "../lib/experiments/security";
import { evaluateCondition, evaluatePrediction, scoreExperiment } from "../lib/experiments/scoring";
import { runExperimentAttempt, submitLatestAttempt } from "../lib/experiments/workflow";
import { MODEL_ASSUMPTIONS } from "../lib/models/assumptions";
import { modelEquationSteps, modelMechanismChain } from "../lib/models/explanations";

function config(overrides: Partial<ExperimentConfig> = {}): ExperimentConfig {
  const modelKey = overrides.modelKey ?? "supply-demand";
  return { id: "experiment-1", teacherId: "teacher-1", code: "7KQ9W2MX", title: "Market test", modelKey, context: "Context", objective: "Objective", status: "published", prediction: { type: "choice", question: "What happens?", options: ["Increase", "Decrease"], expectedChoice: "Increase" }, parameterPermissions: MODEL_PARAMETER_DEFINITIONS[modelKey].map((item) => ({ parameterKey: item.key, editable: true, minimum: item.min, maximum: item.max, initialValue: item.defaultValue })), successConditions: [{ id: "c1", metricKey: modelKey === "supply-demand" ? "quantity" : Object.keys(defaultModelParameters(modelKey))[0], operator: "gte", targetMinimum: 0, targetMaximum: 0, tolerance: 0 }], attemptLimit: 3, explanationRequired: true, immediateFeedback: true, resultVisibility: "private", aggregatePublished: false, scoringWeights: DEFAULT_SCORING_WEIGHTS, ...overrides };
}

describe("shared explanations for all eight focused models", () => {
  it.each(FOCUSED_MODEL_KEYS)("provides assumptions, a six-stage mechanism, and a derivation for %s", (modelKey) => {
    const assumptions = MODEL_ASSUMPTIONS[modelKey];
    expect(assumptions.structural.length).toBeGreaterThan(0);
    expect(assumptions.parameters.length).toBeGreaterThan(0);
    expect(assumptions.limitations.length).toBeGreaterThan(0);
    expect(modelMechanismChain(modelKey, defaultModelParameters(modelKey))).toHaveLength(6);
    const equations = modelEquationSteps(modelKey, defaultModelParameters(modelKey));
    expect(equations.length).toBeGreaterThanOrEqual(6);
    expect(equations.some((step) => /\d/.test(step.expression))).toBe(true);
  });

  it.each(FOCUSED_MODEL_KEYS)("highlights equations affected by a changed parameter in %s", (modelKey) => {
    const first = MODEL_PARAMETER_DEFINITIONS[modelKey][0]; const parameters = { ...defaultModelParameters(modelKey), [first.key]: first.defaultValue + first.step };
    expect(modelEquationSteps(modelKey, parameters, first.key).some((step) => step.affectedTerms?.includes(first.key))).toBe(true);
    expect(modelMechanismChain(modelKey, parameters, first.key)[0].text).toContain(first.label);
  });
});

describe("experiment roles and parameter security", () => {
  it("enforces the guest, student, and teacher action matrix", () => {
    expect(canPerformExperimentAction("guest", "preview")).toBe(true);
    expect(canPerformExperimentAction("guest", "join")).toBe(false);
    expect(canPerformExperimentAction("student", "run")).toBe(true);
    expect(canPerformExperimentAction("student", "edit")).toBe(false);
    expect(canPerformExperimentAction("teacher", "publish")).toBe(true);
    expect(canPerformExperimentAction("teacher", "join")).toBe(false);
  });

  it("rejects missing, unknown, locked, and teacher-out-of-bounds parameters", () => {
    const current = config();
    expect(validateParameterPermissions(current.modelKey, current.parameterPermissions.slice(1))).toBe(false);
    expect(() => enforceParameterPermissions(current.modelKey, { ...defaultModelParameters(current.modelKey), secret: 1 }, current.parameterPermissions)).toThrow("Unknown parameter");
    const locked = current.parameterPermissions.map((item, index) => index === 0 ? { ...item, editable: false } : item);
    expect(() => enforceParameterPermissions(current.modelKey, { ...defaultModelParameters(current.modelKey), demandIntercept: 110 }, locked)).toThrow("Locked parameter");
    const narrow = current.parameterPermissions.map((item, index) => index === 0 ? { ...item, minimum: 90, maximum: 110 } : item);
    expect(() => enforceParameterPermissions(current.modelKey, { ...defaultModelParameters(current.modelKey), demandIntercept: 120 }, narrow)).toThrow("outside teacher range");
  });

  it("keeps private reports owner/teacher-only unless a valid share exists", () => {
    expect(canViewPrivateReport({ viewerId: "student", studentId: "student", teacherId: "teacher" })).toBe(true);
    expect(canViewPrivateReport({ viewerId: "teacher", studentId: "student", teacherId: "teacher" })).toBe(true);
    expect(canViewPrivateReport({ viewerId: "peer", studentId: "student", teacherId: "teacher" })).toBe(false);
    expect(canViewPrivateReport({ viewerId: null, studentId: "student", teacherId: "teacher", validShareToken: true })).toBe(true);
  });
});

describe("condition, prediction, and score branches", () => {
  const base: SuccessCondition = { id: "c", metricKey: "quantity", operator: "gte", targetMinimum: 10, targetMaximum: 20, tolerance: 0.5 };
  it("evaluates gte, lte, between, and equals-with-tolerance distinctly", () => {
    expect(evaluateCondition(10, base)).toBe(true);
    expect(evaluateCondition(20, { ...base, operator: "lte" })).toBe(true);
    expect(evaluateCondition(15, { ...base, operator: "between" })).toBe(true);
    expect(evaluateCondition(10.4, { ...base, operator: "equals" })).toBe(true);
    expect(evaluateCondition(10.6, { ...base, operator: "equals" })).toBe(false);
  });

  it("scores choice and numeric predictions while leaving text for manual review", () => {
    expect(evaluatePrediction({ type: "choice", question: "", options: ["A"], expectedChoice: "A" }, "A")).toBe(true);
    expect(evaluatePrediction({ type: "numeric", question: "", options: [], expectedMinimum: 4, expectedMaximum: 6 }, 5)).toBe(true);
    expect(evaluatePrediction({ type: "numeric", question: "", options: [], expectedMinimum: 4, expectedMaximum: 6 }, 7)).toBe(false);
    expect(evaluatePrediction({ type: "text", question: "", options: [] }, "Reasoning")).toBeNull();
  });

  it("requires weights to total 100", () => {
    const parameters = defaultModelParameters("supply-demand");
    expect(() => scoreExperiment({ modelKey: "supply-demand", parameters, submittedResults: {}, predictionConfig: config().prediction, predictionAnswer: "Increase", conditions: [], parameterCompliant: true, attemptNumber: 1, weights: { ...DEFAULT_SCORING_WEIGHTS, attempts: 11 } })).toThrow("total 100");
  });
});

describe("local teacher-to-student integration workflow", () => {
  it("runs immutable attempts and submits only the latest run", () => {
    const experiment = config(); const parameters = defaultModelParameters(experiment.modelKey);
    const first = runExperimentAttempt(experiment, "student-1", parameters, 1);
    const second = runExperimentAttempt(experiment, "student-1", { ...parameters, demandIntercept: 110 }, 2);
    expect(first.id).not.toBe(second.id);
    expect(first.parameters.demandIntercept).toBe(100);
    expect(second.parameters.demandIntercept).toBe(110);
    const submission = submitLatestAttempt(experiment, second, "Increase", "Demand shifts outward.");
    expect(submission.attempt.id).toBe(second.id);
    expect(submission.explanation).toEqual({ schemaVersion: 1, response: "Demand shifts outward." });
    expect(submission.feedbackReleased).toBe(true);
  });

  it("enforces attempt limits and required explanations", () => {
    const experiment = config({ attemptLimit: 1 });
    expect(() => runExperimentAttempt(experiment, "student-1", defaultModelParameters(experiment.modelKey), 2)).toThrow("Attempt limit");
    const attempt = runExperimentAttempt(experiment, "student-1", defaultModelParameters(experiment.modelKey), 1);
    expect(() => submitLatestAttempt(experiment, attempt, "Increase", " ")).toThrow("Explanation is required");
  });
});
