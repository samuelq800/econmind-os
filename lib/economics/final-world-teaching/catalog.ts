import bilateralTradeMatrix from "@/data/final-world-teaching/bilateral_trade_matrix.json";
import continuousWorldScenarios from "@/data/final-world-teaching/continuous_world_scenarios.json";
import contractTemplates from "@/data/final-world-teaching/contract_templates.json";
import econbenchScenarioLibrary from "@/data/final-world-teaching/econbench_scenario_library.json";
import evidenceLabProjects from "@/data/final-world-teaching/evidence_lab_projects.json";
import extendedModelTestSuite from "@/data/final-world-teaching/extended_model_test_suite.json";
import extendedPolicyEffectLibrary from "@/data/final-world-teaching/extended_policy_effect_library.json";
import extendedPracticeQuestionBank from "@/data/final-world-teaching/extended_practice_question_bank.json";
import fictionalWorldMap from "@/data/final-world-teaching/fictional_world_map_spec.json";
import governanceApprovalRules from "@/data/final-world-teaching/governance_approval_rules.json";
import mechanismArenaScenarios from "@/data/final-world-teaching/mechanism_arena_scenarios.json";
import mechanismResultMetrics from "@/data/final-world-teaching/mechanism_result_metrics.json";
import policyInteractions from "@/data/final-world-teaching/policy_interactions.json";
import projectCalibrationLibrary from "@/data/final-world-teaching/project_calibration_library.json";
import settlementAndDefaultRules from "@/data/final-world-teaching/settlement_and_default_rules.json";
import stabilityCollapseTests from "@/data/final-world-teaching/stability_collapse_test_suite.json";
import territoryNetwork from "@/data/final-world-teaching/territory_network.json";
import tradeRouteGraph from "@/data/final-world-teaching/trade_route_graph.json";

export const FINAL_WORLD_TEACHING = {
  bilateralTradeMatrix,
  continuousWorldScenarios,
  contractTemplates,
  econbenchScenarioLibrary,
  evidenceLabProjects,
  extendedModelTestSuite,
  extendedPolicyEffectLibrary,
  extendedPracticeQuestionBank,
  fictionalWorldMap,
  governanceApprovalRules,
  mechanismArenaScenarios,
  mechanismResultMetrics,
  policyInteractions,
  projectCalibrationLibrary,
  settlementAndDefaultRules,
  stabilityCollapseTests,
  territoryNetwork,
  tradeRouteGraph,
} as const;

export const FINAL_WORLD_ROLE_PORTFOLIOS = [
  { id: "country_captain", label: "Country Captain", description: "Coordinates the country, resolves conflicts and can approve every permitted action." },
  { id: "central_bank_governor", label: "Central Bank Governor", description: "Owns monetary, liquidity, prudential and reserve decisions." },
  { id: "economic_policy_minister", label: "Economic Policy Minister", description: "Owns tax, spending, transfers, debt and fiscal-policy decisions." },
  { id: "trade_minister", label: "Trade Minister", description: "Owns trade policy, cross-border offers and contract drafting." },
  { id: "infrastructure_investment_minister", label: "Infrastructure & Investment Minister", description: "Owns infrastructure, projects, energy and resource-resilience decisions." },
  { id: "social_labour_minister", label: "Social & Labour Minister", description: "Owns employment, household protection and social-stability decisions." },
  { id: "research_innovation_minister", label: "Research & Innovation Minister", description: "Owns research, innovation and technology-transfer decisions." },
] as const;

export type FinalWorldRoleId = typeof FINAL_WORLD_ROLE_PORTFOLIOS[number]["id"];

const roleBySourceLabel: Record<string, FinalWorldRoleId> = {
  Captain: "country_captain",
  "Central Bank Governor": "central_bank_governor",
  "Finance & Fiscal Minister": "economic_policy_minister",
  "Trade & Foreign Economic Minister": "trade_minister",
  "Industry, Investment & Infrastructure Minister": "infrastructure_investment_minister",
  "Resources, Energy & Environment Minister": "infrastructure_investment_minister",
  "Social Affairs & Internal Stability Minister": "social_labour_minister",
};

/** Maps supplied policy records to the seven confirmed product portfolios. */
export function policyPortfolio(policy: { policy_id?: string; role?: string }): FinalWorldRoleId {
  if (policy.role && roleBySourceLabel[policy.role]) return roleBySourceLabel[policy.role];
  if (policy.policy_id?.startsWith("POL-CB-")) return "central_bank_governor";
  if (policy.policy_id?.startsWith("POL-FIN-")) return "economic_policy_minister";
  if (policy.policy_id?.startsWith("POL-TRADE-")) return "trade_minister";
  if (policy.policy_id?.startsWith("POL-SOC-")) return "social_labour_minister";
  if (policy.policy_id?.startsWith("POL-IND-") || policy.policy_id?.startsWith("POL-RES-")) return "infrastructure_investment_minister";
  return "research_innovation_minister";
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function numeric(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}
