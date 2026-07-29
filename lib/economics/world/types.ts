import type {
  CommandCentreState,
  Quarter,
  SectorKey,
} from "../command-centre/index.ts";

export type CompetitionStatus =
  | "draft"
  | "registration"
  | "country_assignment"
  | "role_assignment"
  | "briefing"
  | "internal_planning"
  | "negotiation"
  | "submission_open"
  | "submission_locked"
  | "domestic_processing"
  | "world_processing"
  | "round_results"
  | "shock"
  | "next_round"
  | "completed"
  | "paused"
  | "cancelled";

export type CompetitionRole =
  | "country_captain"
  | "central_bank_governor"
  | "economic_policy_minister"
  | "trade_minister"
  | "investment_resources_minister"
  | "observer";

export type InstitutionType = Exclude<CompetitionRole, "country_captain" | "observer">;
export type Commodity = "energy" | "food" | "manufactured_goods" | "technology_services";
export type AgreementType = "trade" | "energy_supply" | "investment" | "technology_partnership" | "currency_swap" | "climate_fund";
export type AgreementStatus = "draft" | "proposed" | "countered" | "accepted" | "active" | "completed" | "breached" | "cancelled" | "expired";
export type ShockScope = "country" | "bilateral" | "regional" | "global" | "commodity" | "financial" | "climate" | "technology" | "trade";

export type NationalResources = {
  fiscalCapacity: number;
  politicalCapital: number;
  foreignReserves: number;
  administrativeCapacity: number;
  landCapacity: number;
  energyCapacity: number;
};

export type CentralBankDecision = {
  policyRate: number;
  reserveRequirement: number;
  liquiditySupport: number;
  currencyIntervention: number;
  reserveDeployment: number;
  emergencyFinancialSupport: number;
};

export type EconomicPolicyDecision = {
  governmentSpending: number;
  incomeTax: number;
  businessTax: number;
  welfare: number;
  employmentSupport: number;
  energySupport: number;
  fiscalReserve: number;
  publicServices: number;
};

export type TradeDecision = {
  tariff: number;
  exportSupport: number;
  importRestriction: number;
  strategicSupplySpend: number;
  sanctionsIntensity: number;
};

export type InvestmentDecision = {
  infrastructure: number;
  researchAndDevelopment: number;
  landAllocation: number;
  energyCapacityInvestment: number;
  industrialZones: number;
  renewableInvestment: number;
  housingInvestment: number;
};

export type InstitutionDecisions = {
  central_bank_governor: CentralBankDecision;
  economic_policy_minister: EconomicPolicyDecision;
  trade_minister: TradeDecision;
  investment_resources_minister: InvestmentDecision;
};

export type CountrySpecialisation = {
  sectorAdvantages: Partial<Record<SectorKey, number>>;
  /** Food is a world-market commodity rather than a domestic Command Centre sector. */
  commodityAdvantages?: Partial<Record<Commodity, number>>;
  vulnerabilities: Record<string, number>;
  productivityModifier: number;
  fiscalModifier: number;
  tradeModifier: number;
  resourceModifier: number;
  capitalAttractionModifier: number;
};

export type CountryTemplate = {
  id: string;
  slug: string;
  name: string;
  specialisation: string;
  config: CountrySpecialisation;
  balanceScore: number;
};

export type CommodityMarket = {
  commodity: Commodity;
  baselinePrice: number;
  globalPrice: number;
  totalSupply: number;
  totalDemand: number;
  priceElasticity: number;
  transportCost: number;
  storage: number;
  supplyShockSensitivity: number;
};

export type WorldShock = {
  id: string;
  title: string;
  description: string;
  scope: ShockScope;
  triggerRound: Quarter;
  duration: number;
  visibility: "public" | "private";
  affectedCountries: string[];
  affectedCommodities: Commodity[];
  domesticEffects: Record<string, number>;
  sectorEffects: Partial<Record<SectorKey, number>>;
  worldEffects: Partial<Record<"globalGrowth" | "globalInflation" | "financialStability" | "climateIndex" | "commodityStress", number>>;
  recoveryPath: number;
};

export type ScoringWeights = {
  domesticEconomicPerformance: number;
  institutionalGovernance: number;
  internationalEconomicPosition: number;
  crisisResilience: number;
  longTermDevelopment: number;
  globalContribution: number;
};

export type ScenarioConfig = {
  version: number;
  type: "league_world" | "domestic";
  numberOfCountries: number;
  numberOfRounds: number;
  roundDurationSeconds: number | null;
  enabledAgreements: AgreementType[];
  enabledMarkets: Commodity[];
  scoringWeights: ScoringWeights;
  assumptions: string[];
  countryTemplates: CountryTemplate[];
  markets: CommodityMarket[];
  shocks: WorldShock[];
};

export type CountryExternalState = {
  currencyIndex: number;
  exchangePressure: number;
  tradeBalance: number;
  currentAccount: number;
  capitalAccount: number;
  investorConfidence: number;
  partnerTrust: number;
  productionCapacity: Record<Commodity, number>;
  domesticDemand: Record<Commodity, number>;
  commodityStocks: Record<Commodity, number>;
};

export type WorldCountryState = {
  countryId: string;
  countryName: string;
  templateId: string;
  domestic: CommandCentreState;
  resources: NationalResources;
  external: CountryExternalState;
  activeAgreements: string[];
  institutionalHistory: Array<{ round: Quarter; coherence: number; participation: number }>;
};

export type TradeFlow = {
  exporterCountryId: string;
  importerCountryId: string;
  commodity: Commodity;
  quantity: number;
  basePrice: number;
  tariff: number;
  transportCost: number;
  agreementId: string | null;
  duration: number;
  status: "active" | "partial" | "fulfilled";
  fulfilmentRatio: number;
};

export type AgreementTerms = {
  commodity?: Commodity;
  tariffReduction?: number;
  quantity?: number;
  amount?: number;
  priceFormula?: number;
  targetSector?: SectorKey;
  productivityBenefit?: number;
  duration?: number;
  disruptionProtection?: number;
};

export type InternationalAgreement = {
  id: string;
  type: AgreementType;
  proposerCountryId: string;
  participantCountryIds: string[];
  status: AgreementStatus;
  terms: AgreementTerms;
  startsRound: Quarter;
  endsRound: Quarter;
  approvals: Array<{ countryId: string; requiredRole: InstitutionType; approved: boolean }>;
};

export type InstitutionDraft = {
  countryId: string;
  round: Quarter;
  institution: InstitutionType;
  decision: InstitutionDecisions[InstitutionType];
  requestedResources: Partial<NationalResources>;
  expectedBenefit: string;
  primaryRisk: string;
  targetIndicators: string[];
  timeHorizon: "immediate" | "delayed" | "long_term";
  status: "draft" | "locked";
};

export type CountrySubmission = {
  countryId: string;
  round: Quarter;
  decisions: Partial<InstitutionDecisions>;
  agreementActions: string[];
  finalised: boolean;
  finalisedBy: string | null;
};

export type CountryRoundScore = {
  domesticEconomicPerformance: number;
  institutionalGovernance: number;
  internationalEconomicPosition: number;
  crisisResilience: number;
  longTermDevelopment: number;
  globalContribution: number;
  total: number;
  roleScores: Record<InstitutionType, number>;
};

export type CountryRoundExplanation = {
  domesticOutcome: string[];
  internationalTransmission: string[];
  spilloverCreated: string[];
  tradeOutcome: string[];
  capitalAndCurrencyOutcome: string[];
  institutionalTradeOff: string;
  strongestCoordination: string;
  unintendedConsequence: string;
  forwardRisk: string;
};

export type CountryRoundResult = {
  countryId: string;
  stateBefore: WorldCountryState;
  stateAfter: WorldCountryState;
  decisions: InstitutionDecisions;
  domesticEffects: string[];
  internationalEffects: string[];
  scores: CountryRoundScore;
  explanations: CountryRoundExplanation;
};

export type GlobalIndicators = {
  globalGrowth: number;
  globalInflation: number;
  tradeOpenness: number;
  financialStability: number;
  climateIndex: number;
  commodityStress: number;
  internationalCooperation: number;
};

export type WorldRoundResult = {
  round: Quarter;
  countryResults: CountryRoundResult[];
  tradeFlows: TradeFlow[];
  markets: CommodityMarket[];
  activeShockIds: string[];
  globalIndicators: GlobalIndicators;
  settlementHash: string;
};

export type WorldState = {
  scenarioId: string;
  round: Quarter;
  countries: WorldCountryState[];
  markets: CommodityMarket[];
  agreements: InternationalAgreement[];
  activeShockIds: string[];
  globalIndicators: GlobalIndicators;
  history: WorldRoundResult[];
  settlementVersion: number;
  randomSeed: string;
};

export type ConstraintReport = {
  blocking: string[];
  warnings: string[];
  requestedResources: Partial<NationalResources>;
  coherence: number;
};

export type ScenarioValidation = {
  status: "invalid" | "ready_for_test";
  errors: string[];
  warnings: string[];
  metrics: { powerGap: number; fiscalGap: number; averageAdvantage: number; viableStrategies: number };
};
