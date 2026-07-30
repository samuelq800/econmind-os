import { FINAL_WORLD_TEACHING, asArray, asRecord } from "@/lib/economics/final-world-teaching/catalog";

export type MechanismCategory = "Auctions" | "Matching" | "Collective Action" | "Environmental Markets" | "Insurance and Finance" | "Contracts" | "Strategic Games";
export type MechanismDifficulty = "Beginner" | "Intermediate" | "Advanced";

type SourceScenario = {
  scenario_id: string;
  title: string;
  participants: string[];
  information: string;
  rules: string;
  actions: Record<string, unknown>;
  timeline: string[];
  payoff: string;
  editable: Record<string, unknown>;
  defaults: Record<string, unknown>;
  outcomes: Record<string, string>;
  links: Record<string, string[]>;
};

export type MechanismScenario = SourceScenario & {
  number: number;
  category: MechanismCategory;
  difficulty: MechanismDifficulty;
  estimatedMinutes: number;
  institutionalProblem: string;
  typicalParticipants: string;
  informationStructure: string;
  concepts: string[];
  comparisonId?: string;
  preview: "first-price" | "second-price" | "matching" | "public-goods" | "common-pool" | "permits" | "insurance" | "bank" | "contract" | "pd";
};

const sourceScenarios = asArray<SourceScenario>(asRecord(FINAL_WORLD_TEACHING.mechanismArenaScenarios).scenarios);

const details: Record<string, Omit<MechanismScenario, keyof SourceScenario | "number">> = {
  "MA-01-FIRST-PRICE": {
    category: "Auctions", difficulty: "Intermediate", estimatedMinutes: 12,
    institutionalProblem: "Bidders compete under private information and the winner pays their own submitted bid.",
    typicalParticipants: "1 seller · 3–8 bidders", informationStructure: "Independent private values",
    concepts: ["Bid shading", "Expected value", "Allocative efficiency"], comparisonId: "MA-02-SECOND-PRICE", preview: "first-price",
  },
  "MA-02-SECOND-PRICE": {
    category: "Auctions", difficulty: "Intermediate", estimatedMinutes: 10,
    institutionalProblem: "The highest bidder wins but pays the second-highest submitted bid.",
    typicalParticipants: "1 seller · 3–8 bidders", informationStructure: "Independent private values",
    concepts: ["Truthful bidding", "Incentive compatibility", "Revenue"], comparisonId: "MA-01-FIRST-PRICE", preview: "second-price",
  },
  "MA-03-SCHOOL-MATCHING": {
    category: "Matching", difficulty: "Intermediate", estimatedMinutes: 14,
    institutionalProblem: "Students and schools must be assigned when preferences, priorities and capacity conflict.",
    typicalParticipants: "4 students · 2 schools", informationStructure: "Preferences and priorities",
    concepts: ["Stability", "Strategy-proofness", "Blocking pairs"], preview: "matching",
  },
  "MA-04-PUBLIC-GOODS": {
    category: "Collective Action", difficulty: "Beginner", estimatedMinutes: 10,
    institutionalProblem: "Individual contributions create a shared benefit, but each participant can free ride.",
    typicalParticipants: "2–10 contributors", informationStructure: "Public endowments and multiplier",
    concepts: ["Public goods", "Free riding", "Cooperation"], preview: "public-goods",
  },
  "MA-05-COMMON-POOL": {
    category: "Collective Action", difficulty: "Advanced", estimatedMinutes: 15,
    institutionalProblem: "Harvest decisions produce private gains while jointly depleting a regenerating resource.",
    typicalParticipants: "4 harvesters", informationStructure: "Public stock and growth rule",
    concepts: ["Common resources", "Externalities", "Sustainability"], preview: "common-pool",
  },
  "MA-06-CARBON-PERMITS": {
    category: "Environmental Markets", difficulty: "Advanced", estimatedMinutes: 15,
    institutionalProblem: "Firms trade compliance rights to meet an emissions target at lower total cost.",
    typicalParticipants: "Regulator · 2 firms", informationStructure: "Abatement costs and permits",
    concepts: ["Externalities", "Market clearing", "Cost effectiveness"], preview: "permits",
  },
  "MA-07-INSURANCE": {
    category: "Insurance and Finance", difficulty: "Advanced", estimatedMinutes: 14,
    institutionalProblem: "Risk pooling can fail when buyers know more about their risk or effort than insurers.",
    typicalParticipants: "1 insurer · 4 policyholders", informationStructure: "Private risk types",
    concepts: ["Adverse selection", "Moral hazard", "Risk pooling"], preview: "insurance",
  },
  "MA-08-BANK-RUN": {
    category: "Insurance and Finance", difficulty: "Advanced", estimatedMinutes: 14,
    institutionalProblem: "Depositors coordinate on early withdrawal when bank liquidity is limited.",
    typicalParticipants: "4 depositors · bank", informationStructure: "Noisy signals and observed withdrawals",
    concepts: ["Coordination failure", "Liquidity", "Deposit insurance"], preview: "bank",
  },
  "MA-09-PRINCIPAL-AGENT": {
    category: "Contracts", difficulty: "Advanced", estimatedMinutes: 13,
    institutionalProblem: "A contract must motivate hidden effort when output is observable but effort is not.",
    typicalParticipants: "1 principal · 1 agent", informationStructure: "Hidden action",
    concepts: ["Moral hazard", "Incentives", "Participation"], preview: "contract",
  },
  "MA-10-REPEATED-PD": {
    category: "Strategic Games", difficulty: "Intermediate", estimatedMinutes: 12,
    institutionalProblem: "Repeated interaction can sustain cooperation even when one-shot defection is tempting.",
    typicalParticipants: "2 players", informationStructure: "Observed action history",
    concepts: ["Repeated interaction", "Cooperation", "Punishment"], preview: "pd",
  },
};

export const mechanismScenarios: MechanismScenario[] = sourceScenarios.flatMap((scenario, index) => {
  const detail = details[scenario.scenario_id];
  return detail ? [{ ...scenario, ...detail, number: index + 1 }] : [];
});

export const MECHANISM_CATEGORIES: Array<"All" | MechanismCategory> = ["All", "Auctions", "Matching", "Collective Action", "Environmental Markets", "Insurance and Finance", "Contracts", "Strategic Games"];
export const MECHANISM_CONCEPTS = ["Private Information", "Incentive Compatibility", "Strategy-Proofness", "Externalities", "Moral Hazard", "Adverse Selection", "Coordination Failure", "Repeated Interaction", "Public Goods", "Common Resources"] as const;

export function getMechanismScenario(mechanismId: string) {
  return mechanismScenarios.find((scenario) => scenario.scenario_id === mechanismId);
}

export function mechanismPath(mechanismId: string) {
  return `/mechanism-arena/${mechanismId}`;
}

export function displayMechanismConcept(concept: string) {
  return concept.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
