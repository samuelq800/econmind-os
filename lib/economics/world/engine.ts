import {
  advanceQuarter,
  calculateScores as calculateDomesticScores,
  type CommandCentreState,
  type FiscalAllocation,
  type SectorKey,
} from "../command-centre/index.ts";
import {
  DEFAULT_COUNTRY_TEMPLATES,
  DEFAULT_MARKETS,
  DEFAULT_WORLD_SCENARIO,
  EMPTY_GLOBAL_INDICATORS,
  createCountryFromTemplate,
} from "./config.ts";
import type {
  AgreementType,
  Commodity,
  CommodityMarket,
  ConstraintReport,
  CountryRoundExplanation,
  CountryRoundResult,
  CountryRoundScore,
  CountrySubmission,
  InstitutionDecisions,
  InstitutionType,
  InternationalAgreement,
  ScenarioConfig,
  ScenarioValidation,
  TradeFlow,
  WorldCountryState,
  WorldRoundResult,
  WorldShock,
  WorldState,
} from "./types.ts";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const ordered = <T extends { countryId: string }>(values: T[]) => [...values].sort((left, right) => left.countryId.localeCompare(right.countryId));

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
}

export function settlementHash(value: unknown) {
  let hash = 2166136261;
  for (const char of stable(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `w${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export const defaultInstitutionDecisions = (): InstitutionDecisions => ({
  central_bank_governor: { policyRate: 4.5, reserveRequirement: 8, liquiditySupport: 0, currencyIntervention: 0, reserveDeployment: 0, emergencyFinancialSupport: 0 },
  economic_policy_minister: { governmentSpending: 15, incomeTax: 20, businessTax: 25, welfare: 10, employmentSupport: 5, energySupport: 5, fiscalReserve: 15, publicServices: 5 },
  trade_minister: { tariff: 5, exportSupport: 3, importRestriction: 0, strategicSupplySpend: 2, sanctionsIntensity: 0 },
  investment_resources_minister: { infrastructure: 10, researchAndDevelopment: 8, landAllocation: 15, energyCapacityInvestment: 8, industrialZones: 5, renewableInvestment: 8, housingInvestment: 5 },
});

export function createWorldState(config: ScenarioConfig = DEFAULT_WORLD_SCENARIO): WorldState {
  const countries = config.countryTemplates.slice(0, config.numberOfCountries).map(createCountryFromTemplate);
  return {
    scenarioId: "global-league-four",
    round: 1,
    countries,
    markets: config.markets.map((market) => ({ ...market })),
    agreements: [],
    activeShockIds: [],
    globalIndicators: { ...EMPTY_GLOBAL_INDICATORS },
    history: [],
    settlementVersion: 0,
    randomSeed: "econmind-global-league-v1",
  };
}

export function validateScenario(config: ScenarioConfig): ScenarioValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const totalWeight = Object.values(config.scoringWeights).reduce((sum, value) => sum + value, 0);
  if (totalWeight !== 100) errors.push("Scoring weights must total exactly 100.");
  if (config.numberOfCountries < 3 || config.numberOfCountries > 6) errors.push("A league world scenario needs between three and six countries.");
  if (config.numberOfRounds < 3) errors.push("At least three rounds are required for delayed policies to matter.");
  if (config.markets.length !== 4) errors.push("The first world-economy version requires all four commodity markets.");
  const power = config.countryTemplates.map((template) => template.balanceScore);
  const fiscal = config.countryTemplates.map((template) => template.config.fiscalModifier);
  const powerGap = Math.max(...power) - Math.min(...power);
  const fiscalGap = Math.max(...fiscal) - Math.min(...fiscal);
  const advantages = config.countryTemplates.flatMap((template) => [...Object.values(template.config.sectorAdvantages), ...Object.values(template.config.commodityAdvantages ?? {})]);
  if (powerGap > 12) errors.push("Country starting-power gap exceeds the 12% balance threshold.");
  if (fiscalGap > 12) warnings.push("Fiscal starting-space gap should remain within the 12% balance band.");
  if (!config.shocks.some((shock) => shock.triggerRound === 2) || !config.shocks.some((shock) => shock.triggerRound === 3)) warnings.push("Default teaching pacing expects one shock in round two and one in round three.");
  if (config.countryTemplates.some((template) => Object.keys(template.config.sectorAdvantages).length === 0)) errors.push("Every country needs at least one structural strength.");
  return { status: errors.length ? "invalid" : "ready_for_test", errors, warnings, metrics: { powerGap, fiscalGap, averageAdvantage: round(average(advantages)), viableStrategies: config.countryTemplates.length * 2 } };
}

function requestedResources(decisions: InstitutionDecisions) {
  const fiscal = decisions.economic_policy_minister.governmentSpending + decisions.economic_policy_minister.welfare + decisions.economic_policy_minister.employmentSupport + decisions.economic_policy_minister.energySupport + decisions.economic_policy_minister.publicServices + decisions.trade_minister.exportSupport + decisions.trade_minister.strategicSupplySpend + decisions.investment_resources_minister.infrastructure + decisions.investment_resources_minister.researchAndDevelopment + decisions.investment_resources_minister.energyCapacityInvestment + decisions.investment_resources_minister.industrialZones + decisions.investment_resources_minister.renewableInvestment + decisions.investment_resources_minister.housingInvestment;
  const reserves = decisions.central_bank_governor.currencyIntervention + decisions.central_bank_governor.reserveDeployment + decisions.central_bank_governor.emergencyFinancialSupport;
  const land = decisions.investment_resources_minister.landAllocation + decisions.investment_resources_minister.industrialZones * 0.7 + decisions.investment_resources_minister.housingInvestment * 0.5;
  const energy = decisions.economic_policy_minister.energySupport * 0.35 + decisions.investment_resources_minister.energyCapacityInvestment + decisions.investment_resources_minister.renewableInvestment;
  const majorReforms = [decisions.central_bank_governor.currencyIntervention > 15, decisions.economic_policy_minister.governmentSpending > 50, decisions.trade_minister.tariff > 20, decisions.investment_resources_minister.infrastructure > 40, decisions.investment_resources_minister.renewableInvestment > 35].filter(Boolean).length;
  return { fiscalCapacity: round(fiscal), foreignReserves: round(reserves), landCapacity: round(land), energyCapacity: round(energy), administrativeCapacity: majorReforms * 22 };
}

export function detectInstitutionConstraints(country: WorldCountryState, decisions: InstitutionDecisions): ConstraintReport {
  const requested = requestedResources(decisions);
  const blocking: string[] = [];
  const warnings: string[] = [];
  for (const [resource, value] of Object.entries(requested) as Array<[keyof typeof requested, number]>) {
    if (value > country.resources[resource]) blocking.push(`${resource} is over-committed (${round(value)} requested; ${round(country.resources[resource])} available).`);
  }
  if (decisions.central_bank_governor.policyRate >= 6 && decisions.economic_policy_minister.governmentSpending >= 50) warnings.push("Tight monetary policy conflicts with an extreme fiscal expansion.");
  if (decisions.economic_policy_minister.businessTax <= 14 && decisions.economic_policy_minister.governmentSpending >= 48) warnings.push("Large spending with a deep business-tax cut weakens fiscal sustainability.");
  if (decisions.economic_policy_minister.energySupport >= 35 && decisions.investment_resources_minister.renewableInvestment <= 8) warnings.push("High energy support without green investment increases dependency risk.");
  if (decisions.trade_minister.tariff >= 25 && decisions.trade_minister.exportSupport <= 3) warnings.push("Protection without productivity or export support risks higher domestic costs.");
  if (decisions.central_bank_governor.currencyIntervention >= 25 && country.external.tradeBalance < -12) warnings.push("Reserve intervention cannot indefinitely offset a large trade deficit.");
  const coherence = clamp(100 - warnings.length * 12 - Math.max(0, requested.administrativeCapacity - country.resources.administrativeCapacity) * 0.7, 0, 100);
  return { blocking, warnings, requestedResources: requested, coherence: round(coherence) };
}

function fullDecisions(submission: CountrySubmission): InstitutionDecisions {
  const defaults = defaultInstitutionDecisions();
  return {
    central_bank_governor: { ...defaults.central_bank_governor, ...submission.decisions.central_bank_governor },
    economic_policy_minister: { ...defaults.economic_policy_minister, ...submission.decisions.economic_policy_minister },
    trade_minister: { ...defaults.trade_minister, ...submission.decisions.trade_minister },
    investment_resources_minister: { ...defaults.investment_resources_minister, ...submission.decisions.investment_resources_minister },
  };
}

function domesticPolicy(decisions: InstitutionDecisions) {
  const fiscal = decisions.economic_policy_minister;
  const investment = decisions.investment_resources_minister;
  const raw: FiscalAllocation = {
    infrastructure: fiscal.governmentSpending * 0.32 + investment.infrastructure * 0.45 + investment.industrialZones * 0.23,
    welfare: fiscal.welfare + fiscal.employmentSupport * 0.55 + fiscal.publicServices * 0.35,
    energySupport: fiscal.energySupport,
    greenTransition: investment.renewableInvestment + investment.energyCapacityInvestment * 0.55 + investment.researchAndDevelopment * 0.18,
    fiscalReserve: fiscal.fiscalReserve,
  };
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  const allocation = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, round(value / total * 100)])) as FiscalAllocation;
  const adjustment = 100 - Object.values(allocation).reduce((sum, value) => sum + value, 0);
  allocation.fiscalReserve = clamp(allocation.fiscalReserve + adjustment, 0, 100);
  return { interestRate: clamp(decisions.central_bank_governor.policyRate, 0, 15), businessTaxRate: clamp(fiscal.businessTax, 5, 50), allocation };
}

function worldShockForRound(config: ScenarioConfig, round: number) {
  return config.shocks.filter((shock) => shock.triggerRound === round);
}

function applyWorldShock(country: WorldCountryState, shocks: WorldShock[]): WorldCountryState {
  const next = structuredClone(country);
  for (const shock of shocks) {
    if (shock.affectedCountries.length && !shock.affectedCountries.includes(next.countryId)) continue;
    if (shock.id === "global-energy-shock") next.domestic.activeShockIds = [...new Set([...next.domestic.activeShockIds, "global-energy-shock"])] as CommandCentreState["activeShockIds"];
    if (shock.id === "global-capital-outflow") next.domestic.activeShockIds = [...new Set([...next.domestic.activeShockIds, "capital-outflow"])] as CommandCentreState["activeShockIds"];
    next.domestic.macro.inflation += shock.domesticEffects.inflation ?? 0;
    next.domestic.macro.growth += shock.domesticEffects.growth ?? 0;
    next.domestic.resources.foreignReserves += shock.domesticEffects.reserves ?? 0;
    next.resources.foreignReserves += shock.domesticEffects.reserves ?? 0;
    next.external.exchangePressure += shock.domesticEffects.capitalPressure ?? 0;
    for (const [sector, effect] of Object.entries(shock.sectorEffects)) next.domestic.sectors[sector as SectorKey].output_index += effect ?? 0;
    for (const commodity of shock.affectedCommodities) {
      const supplyReduction = shock.id === "global-energy-shock" ? 0.14 : 0.04;
      next.external.productionCapacity[commodity] *= 1 - supplyReduction;
    }
  }
  return next;
}

function applyRoleSpecificEffects(country: WorldCountryState, decisions: InstitutionDecisions) {
  const next = structuredClone(country);
  const investment = decisions.investment_resources_minister;
  const trade = decisions.trade_minister;
  const bank = decisions.central_bank_governor;
  next.domestic.macro.productivity += investment.researchAndDevelopment * 0.045 + investment.infrastructure * 0.025 + investment.industrialZones * 0.018;
  next.domestic.macro.emissions -= investment.renewableInvestment * 0.035;
  next.domestic.sectors.energy.investment_index += investment.energyCapacityInvestment * 0.12 + investment.renewableInvestment * 0.12;
  next.domestic.sectors.manufacturing.output_index += investment.industrialZones * 0.08 + trade.exportSupport * 0.05;
  next.domestic.sectors.technology.investment_index += investment.researchAndDevelopment * 0.1;
  next.domestic.macro.inflation += trade.tariff * 0.018 + trade.importRestriction * 0.012;
  next.external.exchangePressure -= bank.currencyIntervention * 0.18;
  next.resources.foreignReserves = clamp(next.resources.foreignReserves - bank.reserveDeployment - bank.currencyIntervention * 0.35, 0, 200);
  next.domestic.resources.foreignReserves = next.resources.foreignReserves;
  next.external.productionCapacity.energy += investment.energyCapacityInvestment * 0.18 + investment.renewableInvestment * 0.2;
  next.external.productionCapacity.manufactured_goods += investment.industrialZones * 0.14;
  next.external.productionCapacity.technology_services += investment.researchAndDevelopment * 0.16;
  return next;
}

function agreementIsActive(agreement: InternationalAgreement, round: number) {
  return (agreement.status === "active" || agreement.status === "accepted") && agreement.startsRound <= round && agreement.endsRound >= round && agreement.approvals.every((approval) => approval.approved);
}

function matchingAgreement(agreements: InternationalAgreement[], exporter: string, importer: string, commodity: Commodity, round: number) {
  return agreements.find((agreement) => agreementIsActive(agreement, round) && agreement.participantCountryIds.includes(exporter) && agreement.participantCountryIds.includes(importer) && (agreement.terms.commodity === commodity || agreement.type === "trade" && !agreement.terms.commodity)) ?? null;
}

function clearMarkets(countries: WorldCountryState[], markets: CommodityMarket[], agreements: InternationalAgreement[], roundNumber: number, tariffs: Map<string, number>) {
  const nextMarkets = markets.map((market) => ({ ...market }));
  const flows: TradeFlow[] = [];
  for (const market of nextMarkets) {
    const commodity = market.commodity;
    const supply = countries.reduce((sum, country) => sum + country.external.productionCapacity[commodity] + country.external.commodityStocks[commodity] * 0.15, 0);
    const demand = countries.reduce((sum, country) => sum + country.external.domesticDemand[commodity], 0);
    market.totalSupply = round(supply);
    market.totalDemand = round(demand);
    market.globalPrice = round(clamp(market.baselinePrice * (1 + market.priceElasticity * (demand - supply) / Math.max(supply, 1)), market.baselinePrice * 0.55, market.baselinePrice * 2.8));
    const availability = new Map(countries.map((country) => [country.countryId, Math.max(0, country.external.productionCapacity[commodity] - country.external.domesticDemand[commodity] * 0.65)]));
    const importNeed = new Map(countries.map((country) => [country.countryId, Math.max(0, country.external.domesticDemand[commodity] - country.external.productionCapacity[commodity] * 0.65)]));
    for (const importer of ordered(countries)) {
      let remaining = importNeed.get(importer.countryId) ?? 0;
      for (const exporter of ordered(countries)) {
        if (!remaining || exporter.countryId === importer.countryId) continue;
        const available = availability.get(exporter.countryId) ?? 0;
        if (!available) continue;
        const agreement = matchingAgreement(agreements, exporter.countryId, importer.countryId, commodity, roundNumber);
        const quantity = round(Math.min(remaining, available, agreement?.terms.quantity ?? Number.POSITIVE_INFINITY));
        if (!quantity) continue;
        const tariff = clamp((tariffs.get(importer.countryId) ?? 5) - (agreement?.terms.tariffReduction ?? 0), 0, 40);
        const fulfilmentRatio = round(quantity / Math.max(importNeed.get(importer.countryId) ?? 1, 1), 3);
        flows.push({ exporterCountryId: exporter.countryId, importerCountryId: importer.countryId, commodity, quantity, basePrice: market.globalPrice, tariff, transportCost: market.transportCost, agreementId: agreement?.id ?? null, duration: agreement ? agreement.endsRound - roundNumber + 1 : 1, status: fulfilmentRatio < 0.999 ? "partial" : "fulfilled", fulfilmentRatio });
        availability.set(exporter.countryId, available - quantity);
        remaining -= quantity;
      }
    }
  }
  return { markets: nextMarkets, flows };
}

function applyTradeFlows(countries: WorldCountryState[], flows: TradeFlow[]) {
  const next = countries.map((country) => structuredClone(country));
  const byId = new Map(next.map((country) => [country.countryId, country]));
  for (const flow of flows) {
    const exporter = byId.get(flow.exporterCountryId)!;
    const importer = byId.get(flow.importerCountryId)!;
    const cost = flow.quantity * (flow.basePrice + flow.transportCost) * (1 + flow.tariff / 100) / 100;
    const revenue = flow.quantity * flow.basePrice / 100;
    exporter.external.tradeBalance += revenue;
    exporter.external.currentAccount += revenue;
    exporter.resources.foreignReserves = clamp(exporter.resources.foreignReserves + revenue * 0.45, 0, 220);
    exporter.external.partnerTrust += flow.status === "fulfilled" ? 0.7 : -0.8;
    exporter.external.commodityStocks[flow.commodity] = Math.max(0, exporter.external.commodityStocks[flow.commodity] - flow.quantity * 0.15);
    importer.external.tradeBalance -= cost;
    importer.external.currentAccount -= cost;
    importer.resources.foreignReserves = clamp(importer.resources.foreignReserves - cost * 0.5, 0, 220);
    importer.domestic.macro.inflation += cost * 0.025;
    importer.domestic.stakeholders.firms.cost_pressure += flow.commodity === "energy" || flow.commodity === "manufactured_goods" ? cost * 0.35 : cost * 0.12;
    importer.external.partnerTrust += flow.status === "fulfilled" ? 0.35 : -0.5;
    importer.external.commodityStocks[flow.commodity] += flow.quantity * 0.2;
  }
  return next;
}

function applyCapitalAndExchange(countries: WorldCountryState[]) {
  const next = countries.map((country) => structuredClone(country));
  const attractiveness = next.map((country) => country.domestic.macro.growth * 1.4 + country.domestic.lastPolicy.interestRate * 1.1 - country.domestic.macro.inflation * 0.9 - country.domestic.macro.debt * 0.045 + country.external.investorConfidence * 0.12 - country.external.exchangePressure * 0.16);
  const mean = average(attractiveness);
  const averageInflation = average(next.map((country) => country.domestic.macro.inflation));
  const averageRate = average(next.map((country) => country.domestic.lastPolicy.interestRate));
  return next.map((country, index) => {
    const capitalFlow = clamp((attractiveness[index] - mean) * 0.75, -12, 12);
    country.external.capitalAccount = round(capitalFlow);
    country.resources.foreignReserves = clamp(country.resources.foreignReserves + capitalFlow * 0.75, 0, 220);
    const rateSupport = (country.domestic.lastPolicy.interestRate - averageRate) * 0.38;
    const inflationPressure = (country.domestic.macro.inflation - averageInflation) * 0.52;
    const currencyChange = country.external.tradeBalance * 0.09 + capitalFlow * 0.55 + rateSupport - inflationPressure - country.external.exchangePressure * 0.12;
    country.external.currencyIndex = round(clamp(country.external.currencyIndex + currencyChange, 55, 155));
    country.external.exchangePressure = round(clamp(country.external.exchangePressure - capitalFlow * 0.4 - country.external.tradeBalance * 0.07, -50, 80));
    country.domestic.macro.inflation = round(clamp(country.domestic.macro.inflation - currencyChange * 0.035, -3, 25));
    country.external.investorConfidence = round(clamp(country.external.investorConfidence + capitalFlow * 0.6 - Math.max(0, country.domestic.macro.inflation - 7) * 0.7, 0, 100));
    country.domestic.resources.foreignReserves = country.resources.foreignReserves;
    return country;
  });
}

function scoreCountry(country: WorldCountryState, constraint: ConstraintReport, cooperation: number, weights: ScenarioConfig["scoringWeights"]): CountryRoundScore {
  const domestic = calculateDomesticScores(country.domestic).totalScore;
  const institutional = clamp(constraint.coherence * 0.72 + (100 - Math.max(0, (constraint.requestedResources.administrativeCapacity ?? 0) - country.resources.administrativeCapacity)) * 0.28, 0, 100);
  const international = clamp(55 + country.external.tradeBalance * 2.1 + (country.external.currencyIndex - 100) * 0.45 + country.external.investorConfidence * 0.25, 0, 100);
  const resilience = clamp(35 + country.resources.foreignReserves * 0.28 + country.resources.energyCapacity * 0.16 + country.resources.landCapacity * 0.08 - country.domestic.macro.debt * 0.15, 0, 100);
  const longTerm = clamp(country.domestic.macro.productivity * 0.48 + country.domestic.sectors.technology.investment_index * 0.2 + country.domestic.sectors.energy.investment_index * 0.15 - country.domestic.macro.emissions * 0.12, 0, 100);
  const global = clamp(cooperation * 0.65 + country.external.partnerTrust * 0.35, 0, 100);
  const total = domestic * weights.domesticEconomicPerformance / 100
    + institutional * weights.institutionalGovernance / 100
    + international * weights.internationalEconomicPosition / 100
    + resilience * weights.crisisResilience / 100
    + longTerm * weights.longTermDevelopment / 100
    + global * weights.globalContribution / 100;
  return {
    domesticEconomicPerformance: round(domestic), institutionalGovernance: round(institutional), internationalEconomicPosition: round(international), crisisResilience: round(resilience), longTermDevelopment: round(longTerm), globalContribution: round(global), total: round(total),
    roleScores: {
      central_bank_governor: round(clamp(100 - Math.abs(country.domestic.macro.inflation - 3.5) * 9 - Math.abs(country.external.currencyIndex - 100) * 0.8 + country.resources.foreignReserves * 0.15, 0, 100)),
      economic_policy_minister: round(clamp(domestic * 0.55 + (100 - country.domestic.macro.debt) * 0.2 + country.domestic.macro.approval * 0.25, 0, 100)),
      trade_minister: round(clamp(international * 0.65 + country.external.partnerTrust * 0.35, 0, 100)),
      investment_resources_minister: round(clamp(longTerm * 0.7 + resilience * 0.3, 0, 100)),
    },
  };
}

function explanationFor(country: WorldCountryState, before: WorldCountryState, constraint: ConstraintReport, flows: TradeFlow[], shocks: WorldShock[]): CountryRoundExplanation {
  const ownFlows = flows.filter((flow) => flow.exporterCountryId === country.countryId || flow.importerCountryId === country.countryId);
  const exports = ownFlows.filter((flow) => flow.exporterCountryId === country.countryId).reduce((sum, flow) => sum + flow.quantity, 0);
  const imports = ownFlows.filter((flow) => flow.importerCountryId === country.countryId).reduce((sum, flow) => sum + flow.quantity, 0);
  const currencyDirection = country.external.currencyIndex >= before.external.currencyIndex ? "strengthened" : "weakened";
  return {
    domesticOutcome: [`Growth moved to ${country.domestic.macro.growth.toFixed(1)}% and inflation to ${country.domestic.macro.inflation.toFixed(1)}%.`, `Productivity is ${country.domestic.macro.productivity.toFixed(1)} and debt is ${country.domestic.macro.debt.toFixed(1)}% of GDP.`],
    internationalTransmission: shocks.length ? shocks.map((shock) => `${shock.title} transmitted through ${shock.affectedCommodities.length ? shock.affectedCommodities.join(", ") : "financial conditions"}.`) : ["No new global shock was scheduled this quarter."],
    spilloverCreated: [`Your trade and policy stance changed partner trust to ${country.external.partnerTrust.toFixed(1)}.`, `The currency ${currencyDirection}, affecting partner demand and imported-cost transmission.`],
    tradeOutcome: [`Exports settled at ${exports.toFixed(1)} units and imports at ${imports.toFixed(1)} units.`, `Trade balance is ${country.external.tradeBalance.toFixed(1)}.`],
    capitalAndCurrencyOutcome: [`Capital account is ${country.external.capitalAccount.toFixed(1)} and foreign reserves are ${country.resources.foreignReserves.toFixed(1)}.`, `Currency index is ${country.external.currencyIndex.toFixed(1)} with exchange pressure ${country.external.exchangePressure.toFixed(1)}.`],
    institutionalTradeOff: constraint.warnings[0] ?? "The four institutions remained broadly aligned this quarter.",
    strongestCoordination: constraint.coherence >= 80 ? "Shared resource requests stayed within capacity and the package remained coherent." : "The country finalised a complete cross-institution package under visible trade-offs.",
    unintendedConsequence: country.domestic.macro.inflation > before.domestic.macro.inflation ? "International costs added inflation pressure despite domestic stabilisation efforts." : "Lower short-run price pressure may be offset by delayed fiscal and investment effects next quarter.",
    forwardRisk: country.resources.foreignReserves < 55 ? "Foreign-reserve pressure is the primary next-quarter risk." : country.domestic.macro.debt > 95 ? "Debt sustainability is the primary next-quarter risk." : "Policy lags and partner responses remain the primary next-quarter risk.",
  };
}

function globalIndicators(countries: WorldCountryState[], markets: CommodityMarket[], agreements: InternationalAgreement[]) {
  const growth = average(countries.map((country) => country.domestic.macro.growth));
  const inflation = average(countries.map((country) => country.domestic.macro.inflation));
  const totalTrade = countries.reduce((sum, country) => sum + Math.abs(country.external.tradeBalance), 0);
  const financial = average(countries.map((country) => country.external.investorConfidence - Math.abs(country.external.exchangePressure) * 0.35));
  const climate = average(countries.map((country) => 150 - country.domestic.macro.emissions));
  const commodityStress = average(markets.map((market) => Math.max(0, market.globalPrice / market.baselinePrice * 100 - 100)));
  const cooperation = clamp(35 + agreements.filter((agreement) => agreement.status === "active" || agreement.status === "accepted").length * 8 + average(countries.map((country) => country.external.partnerTrust)) * 0.3, 0, 100);
  return { globalGrowth: round(growth), globalInflation: round(inflation), tradeOpenness: round(totalTrade), financialStability: round(clamp(financial, 0, 100)), climateIndex: round(clamp(climate, 0, 100)), commodityStress: round(commodityStress), internationalCooperation: round(cooperation) };
}

/**
 * The deterministic world-clearing function. It never mutates its input and
 * sorts countries before every aggregate calculation, so country array order
 * cannot change market clearing, currencies, rankings or settlement hashes.
 */
export function settleWorldRound(state: WorldState, submissions: CountrySubmission[], config: ScenarioConfig = DEFAULT_WORLD_SCENARIO): { state: WorldState; result: WorldRoundResult } {
  if (state.round > config.numberOfRounds) throw new Error("The competition is already complete.");
  const sortedCountries = ordered(state.countries);
  const submissionByCountry = new Map(submissions.map((submission) => [submission.countryId, submission]));
  if (submissionByCountry.size !== sortedCountries.length || sortedCountries.some((country) => !submissionByCountry.get(country.countryId)?.finalised)) throw new Error("Every country must finalise one complete submission before world processing.");
  const shocks = worldShockForRound(config, state.round);
  const constraints = new Map<string, ConstraintReport>();
  const before = new Map(sortedCountries.map((country) => [country.countryId, structuredClone(country)]));
  let countries = sortedCountries.map((country) => {
    const submission = submissionByCountry.get(country.countryId)!;
    const decisions = fullDecisions(submission);
    const constraint = detectInstitutionConstraints(country, decisions);
    if (constraint.blocking.length) throw new Error(`${country.countryName} has blocking resource conflicts: ${constraint.blocking.join(" ")}`);
    constraints.set(country.countryId, constraint);
    const shocked = applyWorldShock(country, shocks);
    const domestic = advanceQuarter(shocked.domestic, domesticPolicy(decisions), { scheduledShock: null }).stateAfter;
    return applyRoleSpecificEffects({ ...shocked, domestic }, decisions);
  });
  const activeAgreements = state.agreements.map((agreement) => agreement.status === "accepted" && agreement.approvals.every((approval) => approval.approved) ? { ...agreement, status: "active" as const } : structuredClone(agreement));
  const tariffs = new Map(sortedCountries.map((country) => [country.countryId, fullDecisions(submissionByCountry.get(country.countryId)!).trade_minister.tariff]));
  const clearing = clearMarkets(countries, state.markets, activeAgreements, state.round, tariffs);
  countries = applyTradeFlows(countries, clearing.flows);
  countries = applyCapitalAndExchange(countries);
  const indicators = globalIndicators(countries, clearing.markets, activeAgreements);
  const results: CountryRoundResult[] = ordered(countries).map((country) => {
    const constraint = constraints.get(country.countryId)!;
    const decisions = fullDecisions(submissionByCountry.get(country.countryId)!);
    const score = scoreCountry(country, constraint, indicators.internationalCooperation, config.scoringWeights);
    const previous = before.get(country.countryId)!;
    const updated = structuredClone(country);
    updated.institutionalHistory = [...updated.institutionalHistory, { round: state.round, coherence: constraint.coherence, participation: 100 }];
    updated.activeAgreements = activeAgreements.filter((agreement) => agreementIsActive(agreement, state.round) && agreement.participantCountryIds.includes(country.countryId)).map((agreement) => agreement.id);
    return { countryId: country.countryId, stateBefore: previous, stateAfter: updated, decisions, domesticEffects: [`Domestic Command Centre processed the coordinated policy package.`, ...constraint.warnings], internationalEffects: [`World clearing produced ${clearing.flows.filter((flow) => flow.exporterCountryId === country.countryId || flow.importerCountryId === country.countryId).length} bilateral trade flows.`, ...shocks.map((shock) => shock.title)], scores: score, explanations: explanationFor(updated, previous, constraint, clearing.flows, shocks) };
  });
  const resultBase = { round: state.round, countryResults: results, tradeFlows: clearing.flows, markets: clearing.markets, activeShockIds: shocks.map((shock) => shock.id), globalIndicators: indicators };
  const result: WorldRoundResult = { ...resultBase, settlementHash: settlementHash(resultBase) };
  const nextRound = (state.round < config.numberOfRounds ? state.round + 1 : config.numberOfRounds) as WorldState["round"];
  const resultCountryMap = new Map(results.map((item) => [item.countryId, item.stateAfter]));
  return { state: { ...state, round: nextRound, countries: ordered(state.countries).map((country) => resultCountryMap.get(country.countryId)!), markets: clearing.markets, agreements: activeAgreements, activeShockIds: [...new Set([...state.activeShockIds, ...shocks.map((shock) => shock.id)])], globalIndicators: indicators, history: [...state.history, result], settlementVersion: state.settlementVersion + 1 }, result };
}

export function agreementRequiresRoles(type: AgreementType): InstitutionType[] {
  if (type === "trade" || type === "energy_supply") return ["trade_minister"];
  if (type === "technology_partnership") return ["investment_resources_minister"];
  if (type === "investment") return ["investment_resources_minister", "economic_policy_minister"];
  if (type === "currency_swap") return ["central_bank_governor"];
  return ["investment_resources_minister", "economic_policy_minister"];
}

export function assertAgreementCanActivate(agreement: InternationalAgreement, config: ScenarioConfig = DEFAULT_WORLD_SCENARIO) {
  if (!config.enabledAgreements.includes(agreement.type)) throw new Error(`${agreement.type} agreements are disabled for this scenario.`);
  if (!agreement.participantCountryIds.includes(agreement.proposerCountryId)) throw new Error("The proposing country must be an agreement participant.");
  const roles = agreementRequiresRoles(agreement.type);
  for (const countryId of agreement.participantCountryIds) for (const role of roles) if (!agreement.approvals.some((approval) => approval.countryId === countryId && approval.requiredRole === role && approval.approved)) throw new Error("All required country-role approvals are needed before an agreement becomes active.");
}

export function defaultWorldStateForTesting() {
  return createWorldState({ ...DEFAULT_WORLD_SCENARIO, countryTemplates: DEFAULT_COUNTRY_TEMPLATES, markets: DEFAULT_MARKETS });
}
