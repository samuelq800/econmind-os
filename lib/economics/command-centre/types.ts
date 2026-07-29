export type Quarter = 1 | 2 | 3;
export type SectorKey = "manufacturing" | "technology" | "services" | "energy";
export type StakeholderKey = "households" | "firms" | "investors";
export type MacroKey = "growth" | "inflation" | "unemployment" | "debt" | "approval" | "emissions" | "productivity" | "inequality";
export type ResourceKey = "fiscalSpace" | "politicalCapital" | "foreignReserves";

export type MacroState = Record<MacroKey, number>;
export type SectorState = {
  output_index: number;
  employment_index: number;
  investment_index: number;
  confidence: number;
  energy_dependency: number;
  emissions_index: number;
};
export type SectorsState = Record<SectorKey, SectorState>;
export type ResourcesState = {
  nominalBudget: number;
  fiscalSpace: number;
  politicalCapital: number;
  foreignReserves: number;
};
export type HouseholdState = { confidence: number; purchasing_power: number; cost_of_living_pressure: number; employment_security: number };
export type FirmState = { business_confidence: number; hiring_intention: number; investment_intention: number; cost_pressure: number };
export type InvestorState = { confidence: number; capital_flow_pressure: number; debt_concern: number; inflation_expectation: number };
export type StakeholdersState = { households: HouseholdState; firms: FirmState; investors: InvestorState };

export type FiscalAllocation = {
  infrastructure: number;
  welfare: number;
  energySupport: number;
  greenTransition: number;
  fiscalReserve: number;
};
export type PolicyPackage = { interestRate: number; businessTaxRate: number; allocation: FiscalAllocation };
export type PendingTarget = `macro.${MacroKey}` | `sector.${SectorKey}.${keyof SectorState}` | `resource.${ResourceKey}`;
export type PendingEffect = {
  id: string;
  source_policy: string;
  target_metric: PendingTarget;
  magnitude: number;
  rounds_remaining: number;
  duration: number;
  explanation: string;
};
export type ShockId = "global-energy-shock" | "capital-outflow";
export type ShockRecord = { id: ShockId; title: string; description: string; mechanisms: string[] };
export type CommandCentreState = {
  scenarioId: string;
  quarter: Quarter;
  completed: boolean;
  macro: MacroState;
  sectors: SectorsState;
  resources: ResourcesState;
  stakeholders: StakeholdersState;
  pendingEffects: PendingEffect[];
  activeShockIds: ShockId[];
  coherencePenalty: number;
  lastPolicy: PolicyPackage;
};
export type ScoreKey = "macroeconomicStability" | "growthProductivity" | "employment" | "fiscalSustainability" | "socialWelfare" | "environmentalTransition" | "crisisResilience" | "policyCoherence";
export type CommandCentreScores = Record<ScoreKey, number>;
export type CommandCentreResultType = "Balanced and Resilient" | "Inflation Fighter" | "Growth at All Costs" | "Socially Protective" | "Green Transition Leader" | "Fiscal Conservative" | "Stable but Stagnant" | "Politically Popular but Fragile" | "Crisis Mismanagement";
export type QuarterExplanation = {
  policySummary: string;
  transmission: string[];
  stakeholderReaction: string[];
  sectorWinners: string[];
  sectorLosers: string[];
  tradeOff: string;
  unintendedConsequence: string;
  forwardRisk: string;
};
export type AdvanceQuarterResult = {
  roundNumber: Quarter;
  stateBefore: CommandCentreState;
  stateAfter: CommandCentreState;
  policy: PolicyPackage;
  shock: ShockRecord | null;
  appliedPendingEffects: PendingEffect[];
  scheduledEffects: PendingEffect[];
  explanation: QuarterExplanation;
  scoreSnapshot: { scores: CommandCentreScores; totalScore: number; resultType: CommandCentreResultType };
};
