import type { ModelDefinition } from "@/lib/models/registry";

export type ModelVariableKind =
  | "exogenous"
  | "endogenous"
  | "policy"
  | "behavioural"
  | "institutional"
  | "state"
  | "calculated"
  | "shock"
  | "constraint";

export type ModelTimeHorizon = "immediate" | "short-run" | "medium-run" | "long-run";
export type FormulaReadiness = "ready" | "provisional" | "needs-calibration";

export type ModelVariable = {
  id: string;
  symbol: string;
  name: string;
  description: string;
  unit: string;
  kind: ModelVariableKind;
  defaultValue: number | string | boolean | null;
  minimum?: number;
  maximum?: number;
  step?: number;
  precision?: number;
  editable: boolean;
  visible: boolean;
  required: boolean;
  dependencies: string[];
  graphBindings: string[];
  equationBindings: string[];
  order: number;
};

export type ModelEquation = {
  id: string;
  display: string;
  symbols: string[];
  purpose: string;
  readiness: FormulaReadiness;
};

export type ModelGraphDefinition = {
  id: string;
  title: string;
  xAxis: { label: string; unit: string };
  yAxis: { label: string; unit: string };
  accessibleSummary: string;
  variableBindings: string[];
};

export type ModelPracticeReadiness = "not-authored" | "authoring" | "ready";

export type StandardModelDescriptor = {
  id: string;
  version: number;
  title: string;
  shortTitle: string;
  category: string;
  subcategory: string | null;
  difficulty: string;
  recommendedLevel: string;
  estimatedMinutes: number;
  learningObjectives: string[];
  economicQuestion: string;
  realWorldRelevance: string;
  agents: string[];
  assumptions: string[];
  variables: ModelVariable[];
  equations: ModelEquation[];
  graphs: ModelGraphDefinition[];
  causalMechanisms: string[];
  outputs: string[];
  welfareEffects: string[];
  distributionalEffects: string[];
  limitations: string[];
  commonMistakes: string[];
  compatibleModelIds: string[];
  conflictingModelIds: string[];
  prerequisiteModelIds: string[];
  linkedCaseIds: string[];
  linkedEvidenceIds: string[];
  formulaReadiness: FormulaReadiness;
  practiceReadiness: ModelPracticeReadiness;
  supportsComposition: boolean;
  updatedAt: string;
};

export type ModelState = {
  modelId: string;
  modelVersion: number;
  timestamp: string;
  inputValues: Record<string, unknown>;
  parameterValues: Record<string, unknown>;
  assumptionStates: Record<string, boolean>;
  calculatedValues: Record<string, unknown>;
  graphState: Record<string, unknown>;
  welfareState: Record<string, unknown>;
  distributionState: Record<string, unknown>;
  explanationState: Record<string, unknown>;
  validationWarnings: string[];
};

const emptyDescriptorFields = {
  subcategory: null,
  recommendedLevel: "To be calibrated",
  economicQuestion: "A formal economic question will be attached when the model's equation set is published.",
  realWorldRelevance: "Evidence and real-world mapping are curated separately from the calculation engine.",
  agents: [],
  assumptions: [],
  variables: [],
  equations: [],
  graphs: [],
  causalMechanisms: [],
  outputs: [],
  welfareEffects: [],
  distributionalEffects: [],
  limitations: [],
  commonMistakes: [],
  conflictingModelIds: [],
  linkedCaseIds: [],
  linkedEvidenceIds: [],
  formulaReadiness: "needs-calibration" as const,
  practiceReadiness: "not-authored" as const,
  supportsComposition: false,
};

/**
 * A compatibility adapter for the existing model registry. It deliberately
 * does not invent equations, evidence, or Practice questions before those are
 * authored and calibrated.
 */
export function createStandardModelDescriptor(model: ModelDefinition): StandardModelDescriptor {
  return {
    id: model.slug,
    version: 1,
    title: model.title,
    shortTitle: model.shortTitle,
    category: model.category,
    difficulty: model.difficulty,
    estimatedMinutes: model.estimatedMinutes,
    learningObjectives: model.learningObjectives,
    compatibleModelIds: model.relatedModels,
    prerequisiteModelIds: model.prerequisites,
    updatedAt: new Date(0).toISOString(),
    ...emptyDescriptorFields,
  };
}
