import type { EquationStep } from "@/lib/economics/types";
import type { MechanismStep } from "@/lib/models/explanations";
import type { StakeholderImpactItem } from "@/components/models/stakeholder-impact";

export type CaseCategory = "macroeconomics" | "environment" | "housing" | "labour" | "trade" | "business-decision";
export type CaseStatus = "draft" | "published" | "archived";
export type CaseDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type CaseStage = "context" | "problem" | "mapping" | "conditions" | "prediction" | "simulation" | "comparison" | "evaluation" | "recommendation" | "reflection";
export type CaseDataKind = "real" | "calibrated" | "indexed" | "stylised";

export type RealWorldContext = { overview: string; location: string; actors: string[]; decision: string; significance: string; facts: string[]; assumptions: string[] };
export type EconomicProblemDefinition = { primaryOptions: string[]; secondaryOptions: string[]; correctPrimary: string; correctSecondary?: string[]; reveal: string };
export type CaseModelMapping = { model: string; route: string; realWorldEvent: string; mechanism: string; modelVariable: string; response: string; expectedOutcome: string; selectedReason: string; omittedVariables: string[]; alternatives: string[]; limitation: string };
export type CaseInitialCondition = { key: string; label: string; value: number | string; unit: string; sourceType: CaseDataKind; baselineDate?: string; note: string };
export type CasePredictionQuestion = { id: string; prompt: string; type: "direction" | "choice" | "text" | "rank"; options?: string[]; required?: boolean };
export type CasePolicyControl = { key: string; label: string; min: number; max: number; step: number; defaultValue: number; unit: string; description: string; group?: string };
export type CaseConstraint = { label: string; rule: string; explanation: string };
export type CaseOutputMetric = { key: string; label: string; unit: string; meaning: string };
export type CaseStakeholder = { name: string; note: string };
export type CaseEvidenceSource = { label: string; url: string; sourceType: "official" | "research" | "project-origin"; note: string };
export type CaseEvaluationConfig = { objectives: Array<{ key: string; label: string; defaultWeight: number }>; note: string };

export interface EconomicCaseDefinition {
  id: string; slug: string; title: string; subtitle: string; status: CaseStatus; featured: boolean; category: CaseCategory; difficulty: CaseDifficulty; estimatedMinutes: number;
  realWorldContext: RealWorldContext; economicProblem: EconomicProblemDefinition; modelMappings: CaseModelMapping[]; initialConditions: CaseInitialCondition[]; predictionQuestions: CasePredictionQuestion[]; availablePolicies: CasePolicyControl[]; constraints: CaseConstraint[]; outputMetrics: CaseOutputMetric[]; stakeholderGroups: CaseStakeholder[]; reflectionQuestions: string[]; evidenceSources: CaseEvidenceSource[]; simulationAdapterKey: CaseSimulationAdapterKey; evaluationConfig: CaseEvaluationConfig; relatedCaseSlugs?: string[];
}

export type CaseSimulationAdapterKey = "oil-price-shock" | "carbon-tax" | "housing-rent-control" | "minimum-wage" | "tariff-conflict" | "restaurant-food-waste";
export type CaseScenarioName = "baseline" | "no-intervention" | "policy-a" | "policy-b";
export type CaseScenarioSnapshot = { name: CaseScenarioName; label: string; settings: Record<string, number>; results: CaseSimulationResult; savedAt: string; notes?: string };
export type CaseSimulationResult = { valid: boolean; validationMessage?: string; modelNative: Record<string, number>; headline: Record<string, number>; metricUnits: Record<string, string>; mechanism: MechanismStep[]; equations: EquationStep[]; stakeholders: StakeholderImpactItem[]; shortRun: string; longRun: string; assumptions: string[]; limitations: string[]; fiscalCost: number; efficiency: number; equity: number; constraintsSatisfied: boolean; constraintMessages: string[] };
export type CaseEvaluation = { weights: Record<string, number>; score: number; dimensionScores: Record<string, number>; explanation: string };
export type CaseRecommendation = { selectedPolicy: string; mainBenefit: string; mainCost: string; affectedStakeholder: string; tradeOff: string; keyAssumption: string; limitation: string; evidenceNeeded: string };
export type CaseRunDraft = { caseSlug: string; currentStage: CaseStage; problemAnswer?: { primary: string; secondary: string[] }; predictions: Record<string, string>; settings: Record<string, number>; scenarios: Partial<Record<CaseScenarioName, CaseScenarioSnapshot>>; evaluation?: CaseEvaluation; recommendation?: CaseRecommendation; completed: boolean; updatedAt: string };
