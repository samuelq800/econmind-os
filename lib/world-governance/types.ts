export const WORLD_GOVERNANCE_ROLES = [
  "captain",
  "central-bank",
  "finance",
  "trade",
  "industry",
  "social",
] as const;

export type WorldGovernanceRole = (typeof WORLD_GOVERNANCE_ROLES)[number];
export type WorldGovernanceOffice =
  WorldGovernanceRole | "cabinet" | "reports" | "policies";

export type NationalCondition =
  | "normal"
  | "vulnerable"
  | "protest"
  | "government_crisis"
  | "institutional_collapse"
  | "empty_state"
  | "recovery";

export type PolicyLifecycleStatus =
  | "announced"
  | "waiting"
  | "ramping_up"
  | "full_effect"
  | "fading"
  | "expired"
  | "blocked"
  | "cancelled";

export type PolicyLifecycle = {
  delayDays: number;
  rampDays: number;
  peakDays: number;
  decayDays: number;
  maxDurationDays: number;
};

export type PolicyImpactRange = {
  immediate: Record<string, [number, number]>;
  medium: Record<string, [number, number]>;
  long: Record<string, [number, number]>;
  distributional: Record<string, [number, number]>;
};

export type PolicyDefinition = {
  id: string;
  role: WorldGovernanceRole;
  category: string;
  title: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  safeRange: [number, number];
  lifecycle: PolicyLifecycle;
  fiscalCostPerPoint: number;
  reserveCostPerPoint: number;
  politicalCostPerPoint: number;
  administrativeCost: number;
  confidence: "Low" | "Medium" | "High";
  prerequisites: string[];
  requiredApprovals: WorldGovernanceRole[];
  affectedIndicators: string[];
  impacts: PolicyImpactRange;
  educationalModel: string;
};

export type PolicyDraft = {
  policyId: string;
  countryId: string;
  proposedValue: number;
  previousValue: number;
  changedAt: string;
};

export type PublishedPolicy = PolicyDraft & {
  id: string;
  role: WorldGovernanceRole;
  status: PolicyLifecycleStatus;
  publishedAt: string;
  expiresAt: string;
  effectiveStrength: number;
  fiscalCost: number;
  reserveCost: number;
  politicalCost: number;
  administrativeBurden: number;
  lifecycle: PolicyLifecycle;
  approvalIds: string[];
};

export type PolicyForecast = {
  confidence: "Low" | "Medium" | "High";
  immediate: ForecastEffect[];
  medium: ForecastEffect[];
  long: ForecastEffect[];
  distributional: ForecastEffect[];
  dependencies: string[];
  directEffect: string;
  secondOrderEffect: string;
  unintendedConsequence: string;
  model: string;
  uncertainty: string;
};

export type ForecastEffect = {
  label: string;
  low: number;
  high: number;
  unit: string;
};

export type SharedResource = {
  id:
    | "fiscal_space"
    | "foreign_reserves"
    | "political_capital"
    | "administrative_capacity"
    | "policy_credibility"
    | "public_support"
    | "national_stability";
  label: string;
  value: number;
  change: number;
  risk: "normal" | "watch" | "warning" | "critical";
  explanation: string;
  sparkline: number[];
};

export type EconomicIndicator = {
  id: string;
  label: string;
  value: number;
  unit: string;
  change: number;
  status?: "normal" | "watch" | "warning" | "critical";
};

export type Country = {
  id: string;
  name: string;
  flag: string;
  condition: NationalCondition;
  indicators: EconomicIndicator[];
  resources: SharedResource[];
};

export type Player = {
  id: string;
  displayName: string;
  isTeacher: boolean;
};

export type RoleAssignment = {
  userId: string;
  countryId: string;
  role: WorldGovernanceRole;
  assignedAt: string;
};

export type NationalState = {
  countryId: string;
  condition: NationalCondition;
  simulatedAt: string;
  simulationDay: number;
  resources: SharedResource[];
  indicators: EconomicIndicator[];
};

export type CabinetProposal = {
  id: string;
  countryId: string;
  title: string;
  problem: string;
  objective: string;
  policyIds: string[];
  requiredRoles: WorldGovernanceRole[];
  status:
    | "draft"
    | "requested"
    | "under_review"
    | "revision_requested"
    | "minister_approved"
    | "captain_approved"
    | "rejected"
    | "published"
    | "active"
    | "completed";
};

export type Approval = {
  id: string;
  proposalId: string;
  role: WorldGovernanceRole;
  status: "pending" | "approved" | "rejected";
  actorId?: string;
  note?: string;
};

export type BudgetRequest = {
  id: string;
  countryId: string;
  requestingRole: WorldGovernanceRole;
  programme: string;
  amountPctGdp: number;
  durationDays: number;
  expectedReturn: string;
  risk: string;
  status: "pending" | "partially_approved" | "approved" | "rejected";
};

export type InternationalContract = {
  id: string;
  template: string;
  exporterCountryId: string;
  importerCountryId: string;
  status:
    | "draft"
    | "sent"
    | "counteroffer"
    | "awaiting_approval"
    | "approved"
    | "active"
    | "delayed"
    | "disputed"
    | "defaulted"
    | "completed"
    | "terminated";
  terms: Record<string, string | number | boolean>;
};

export type ContractNegotiation = {
  id: string;
  contractId: string;
  authorCountryId: string;
  message: string;
  createdAt: string;
};

export type TradeRelationship = {
  partnerCountryId: string;
  bilateralTrade: number;
  balance: number;
  relation: number;
  reliability: number;
  strategicDependence: number;
};

export type InfrastructureProject = {
  id: string;
  countryId: string;
  title: string;
  type: string;
  budgetPctGdp: number;
  completion: number;
  expectedCompletion: string;
  productivityEffect: number;
  environmentalCost: number;
  delayRisk: number;
  status: "planned" | "procurement" | "building" | "delayed" | "completed";
};

export type WelfareProgramme = {
  id: string;
  title: string;
  eligibility: string;
  nominalCoverage: number;
  effectiveCoverage: number;
  leakage: number;
  paymentDelayDays: number;
  fiscalCostPctGdp: number;
};

export type BankInstitution = {
  id: string;
  name: string;
  assets: number;
  deposits: number;
  capitalRatio: number;
  liquidityRatio: number;
  nplRatio: number;
  stress: "low" | "moderate" | "high";
};

export type HouseholdGroup = {
  id: string;
  label: string;
  disposableIncome: number;
  consumption: number;
  housingBurden: number;
  foodEnergyBurden: number;
  unemploymentRisk: number;
  governmentSupport: number;
  protestRisk: number;
};

export type Crisis = {
  id: string;
  title: string;
  severity: "watch" | "warning" | "critical";
  remainingDays: number;
  offices: WorldGovernanceRole[];
  immediateRisk: string;
  longTermRisk: string;
  requiredApprovals: WorldGovernanceRole[];
};

export type Alert = {
  id: string;
  title: string;
  severity: "watch" | "warning" | "critical";
  trigger: string;
  offices: WorldGovernanceRole[];
  escalation: string;
  suggestion: string;
};

export type CabinetReport = {
  id: string;
  countryId: string;
  simulationDay: number;
  snapshot: Record<string, number>;
  risks: string[];
  questions: string[];
  createdAt: string;
};

export type RoleScore = {
  role: WorldGovernanceRole;
  score: number;
  components: Record<string, number>;
};
export type NationalScore = {
  countryId: string;
  score: number;
  components: Record<string, number>;
};
export type WorldEvent = {
  id: string;
  countryId?: string;
  type: string;
  summary: string;
  createdAt: string;
};
