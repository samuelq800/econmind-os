import type { FocusedModelKey } from "@/lib/experiments/model-runtime";
import type { MechanismStep } from "@/lib/models/explanations";

export type AppRole = "guest" | "student" | "teacher";
export type ExperimentStatus = "draft" | "published" | "closed" | "archived";
export type PredictionType = "choice" | "numeric" | "text";
export type ConditionOperator = "gte" | "lte" | "between" | "equals";
export type ResultVisibility = "private" | "aggregate";

export type ScoringWeights = { prediction: number; success: number; compliance: number; accuracy: number; attempts: number };
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = { prediction: 20, success: 30, compliance: 20, accuracy: 20, attempts: 10 };

export type ParameterPermission = {
  parameterKey: string;
  editable: boolean;
  minimum: number;
  maximum: number;
  initialValue: number;
};

export type SuccessCondition = {
  id: string;
  metricKey: string;
  operator: ConditionOperator;
  targetMinimum: number;
  targetMaximum: number;
  tolerance: number;
};

export type PredictionConfig = {
  type: PredictionType;
  question: string;
  options: string[];
  expectedChoice?: string;
  expectedMinimum?: number;
  expectedMaximum?: number;
};

export type ExperimentConfig = {
  id: string;
  teacherId: string;
  code: string;
  title: string;
  modelKey: FocusedModelKey;
  context: string;
  objective: string;
  status: ExperimentStatus;
  prediction: PredictionConfig;
  parameterPermissions: ParameterPermission[];
  successConditions: SuccessCondition[];
  attemptLimit: number | null;
  explanationRequired: boolean;
  immediateFeedback: boolean;
  resultVisibility: ResultVisibility;
  aggregatePublished: boolean;
  scoringWeights: ScoringWeights;
};

export type ExperimentAttempt = {
  id: string;
  experimentId: string;
  studentId: string;
  attemptNumber: number;
  parameters: Record<string, number>;
  results: Record<string, number>;
  mechanismChain: MechanismStep[];
  createdAt: string;
};

export type ScoreBreakdown = {
  prediction: number;
  success: number;
  compliance: number;
  accuracy: number;
  attempts: number;
  weightedTotal: number;
  passedConditions: number;
  totalConditions: number;
};

export type ExperimentSubmission = {
  id: string;
  experimentId: string;
  studentId: string;
  attempt: ExperimentAttempt;
  prediction: unknown;
  explanation: { schemaVersion: 1; response: string };
  score: ScoreBreakdown;
  finalScore: number;
  feedbackReleased: boolean;
  submittedAt: string;
};
