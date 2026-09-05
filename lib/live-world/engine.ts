import {
  LIVE_WORLD_COUNTRIES,
  LIVE_WORLD_POLICY_CONTROLS,
  liveWorldCountry,
} from "./config";
import type {
  LiveWorldAgreement,
  LiveWorldCountryId,
  LiveWorldDimensions,
  LiveWorldRoomState,
} from "./types";

const clamp = (value: number, low = 0, high = 100) =>
  Math.min(high, Math.max(low, value));
const round = (value: number) => Number(value.toFixed(1));
const value = (policies: Record<string, number> | undefined, key: string, fallback: number) =>
  Number.isFinite(policies?.[key]) ? Number(policies?.[key]) : fallback;

type MutableDimensions = Record<keyof LiveWorldDimensions, number>;

function add(target: MutableDimensions, effects: Partial<LiveWorldDimensions>, multiplier = 1) {
  for (const [dimension, effect] of Object.entries(effects)) {
    target[dimension as keyof LiveWorldDimensions] += Number(effect) * multiplier;
  }
}

function policyEffects(countryId: LiveWorldCountryId, state: LiveWorldRoomState) {
  const country = liveWorldCountry(countryId);
  const policies = state.publishedPolicies[countryId] ?? {};
  const central = policies.central_bank_governor;
  const finance = policies.finance_domestic_minister;
  const trade = policies.trade_industry_investment_minister;
  const labour = policies.labour_social_development_minister;
  const energy = policies.energy_climate_minister;
  const effects: MutableDimensions = { ...country.baseline };
  const rate = value(central, "policy_rate", 5) - 5;
  const liquidity = value(central, "liquidity_support", 8) - 8;
  const reserves = value(central, "reserve_requirement", 10) - 10;
  const spending = value(finance, "government_spending", 32) - 32;
  const tax = value(finance, "tax_rate", 22) - 22;
  const welfare = value(finance, "welfare", 14) - 14;
  const infrastructure = value(finance, "infrastructure", 18) - 18;
  const tariff = value(trade, "tariff", 8) - 8;
  const exports = value(trade, "export_support", 10) - 10;
  const subsidy = value(trade, "industrial_subsidy", 10) - 10;
  const fdi = value(trade, "fdi_openness", 12) - 12;
  const activation = value(labour, "labour_market_activation", 12) - 12;
  const skills = value(labour, "skills_investment", 14) - 14;
  const wageSupport = value(labour, "wage_support", 8) - 8;
  const energyReserve = value(energy, "strategic_energy_reserve", 8) - 8;
  const cleanEnergy = value(energy, "clean_energy_investment", 16) - 16;
  const efficiency = value(energy, "efficiency_standard", 10) - 10;
  const structure = country.structure;

  add(effects, { activity: -rate * (0.28 + structure.financialDepth / 600), prices: rate * 0.48, financial: rate * 0.16, stability: rate * 0.1 });
  add(effects, { activity: liquidity * (0.2 + structure.financialDepth / 900), financial: liquidity * 0.26, prices: -liquidity * 0.12, stability: liquidity * 0.05 });
  add(effects, { financial: reserves * 0.26, stability: reserves * 0.16, activity: -reserves * 0.14 });
  add(effects, { activity: spending * (0.16 + structure.domesticMarket / 800), livelihoods: spending * 0.12, fiscal: -spending * 0.24, stability: spending * 0.04 });
  add(effects, { fiscal: tax * 0.18, activity: -tax * (0.1 + structure.domesticMarket / 1400), livelihoods: -tax * 0.06 });
  add(effects, { livelihoods: welfare * 0.26, stability: welfare * 0.16, fiscal: -welfare * 0.2 });
  add(effects, { activity: infrastructure * (0.13 + structure.manufacturing / 1100), financial: infrastructure * 0.05, fiscal: -infrastructure * 0.17, stability: infrastructure * 0.09 });
  add(effects, { activity: tariff * (structure.manufacturing / 1800 - structure.exportDependence / 1300), prices: -tariff * (0.13 + structure.energyDependence / 1600), stability: -tariff * 0.04 });
  add(effects, { activity: exports * (0.1 + structure.exportDependence / 950), fiscal: -exports * 0.08, livelihoods: exports * 0.07 });
  add(effects, { activity: subsidy * (0.08 + structure.manufacturing / 1000), fiscal: -subsidy * 0.17, financial: subsidy * 0.03 });
  add(effects, { activity: fdi * (0.07 + structure.capitalDependence / 1000), financial: fdi * (0.08 + structure.financialDepth / 1400), stability: -fdi * (structure.capitalDependence / 1800) });
  add(effects, { activity: activation * 0.12, livelihoods: activation * 0.2, fiscal: -activation * 0.08, stability: activation * 0.04 });
  add(effects, { activity: skills * (0.08 + structure.technology / 1400), livelihoods: skills * 0.1, fiscal: -skills * 0.09, financial: skills * 0.03 });
  add(effects, { livelihoods: wageSupport * 0.2, stability: wageSupport * 0.1, fiscal: -wageSupport * 0.16, activity: wageSupport * 0.04 });
  add(effects, { prices: energyReserve * (0.08 + structure.energyDependence / 1500), stability: energyReserve * 0.11, fiscal: -energyReserve * 0.1 });
  add(effects, { activity: cleanEnergy * (0.06 + structure.resources / 1500), prices: cleanEnergy * 0.08, stability: cleanEnergy * 0.1, fiscal: -cleanEnergy * 0.12 });
  add(effects, { prices: efficiency * (0.1 + structure.energyDependence / 1300), activity: efficiency * 0.05, fiscal: -efficiency * 0.05, financial: efficiency * 0.03 });
  return effects;
}

function complementarity(from: LiveWorldCountryId, to: LiveWorldCountryId) {
  const exporter = liveWorldCountry(from).structure;
  const importer = liveWorldCountry(to).structure;
  const resourceLink = exporter.resources * importer.energyDependence / 10_000;
  const industrialLink = exporter.manufacturing * importer.domesticMarket / 10_000;
  const technologyLink = exporter.technology * (100 - importer.technology) / 10_000;
  const competitiveOverlap = (exporter.manufacturing * importer.manufacturing + exporter.resources * importer.resources) / 20_000;
  return resourceLink + industrialLink + technologyLink - competitiveOverlap * 0.62;
}

function addAgreementEffects(targetCountry: LiveWorldCountryId, state: LiveWorldRoomState, effects: MutableDimensions) {
  for (const agreement of state.agreements.filter((item) => item.status === "active" && (item.proposerCountry === targetCountry || item.receiverCountry === targetCountry))) {
    const other = agreement.proposerCountry === targetCountry ? agreement.receiverCountry : agreement.proposerCountry;
    const depth = agreement.depth === "limited" ? 0.55 : agreement.depth === "standard" ? 1 : 1.45;
    const fit = complementarity(targetCountry, other);
    const otherFit = complementarity(other, targetCountry);
    const country = liveWorldCountry(targetCountry);
    const externalExposure = country.structure.exportDependence / 100;
    add(effects, {
      activity: (2.4 + fit * 5) * depth,
      livelihoods: (0.8 + fit * 1.5) * depth,
      financial: (0.5 + Math.max(fit, 0) * 1.4) * depth,
      stability: (0.25 + fit * 0.65 - externalExposure * 0.28) * depth,
      prices: -(0.2 + Math.max(fit, 0) * 0.35) * depth,
    });
    if (agreement.depth === "deep") {
      add(effects, { stability: -Math.max(0, externalExposure - 0.45) * 1.8, financial: -Math.max(0, -otherFit) * 1.2 });
    }
  }
}

export function forecastLiveWorldCountry(countryId: LiveWorldCountryId, state: LiveWorldRoomState): LiveWorldDimensions {
  const effects = policyEffects(countryId, state);
  const country = liveWorldCountry(countryId);
  for (const crisis of state.crises.filter((item) => item.active && item.affectedCountries.includes(countryId))) {
    const resilience = (country.structure.resources + country.structure.financialDepth + (100 - country.structure.energyDependence)) / 300;
    add(effects, crisis.effects, 1 - resilience * 0.28);
  }
  for (const sanction of state.sanctions.filter((item) => item.status === "active")) {
    if (sanction.targetCountry === countryId) add(effects, { activity: -sanction.tariffRate * 0.16, livelihoods: -sanction.tariffRate * 0.06, prices: -sanction.tariffRate * 0.14, stability: -sanction.tariffRate * 0.05 });
    if (sanction.initiatorCountry === countryId) add(effects, { activity: -sanction.tariffRate * 0.04, prices: -sanction.tariffRate * 0.03, fiscal: -sanction.tariffRate * 0.02 });
  }
  addAgreementEffects(countryId, state, effects);
  return Object.fromEntries(Object.entries(effects).map(([key, amount]) => [key, round(clamp(amount))])) as LiveWorldDimensions;
}

export function forecastLiveWorld(state: LiveWorldRoomState) {
  return Object.fromEntries(LIVE_WORLD_COUNTRIES.map((country) => [country.id, forecastLiveWorldCountry(country.id, state)])) as Record<LiveWorldCountryId, LiveWorldDimensions>;
}

export function scoreLiveWorldCountry(dimensions: LiveWorldDimensions) {
  return round(
    dimensions.activity * 0.2 +
      dimensions.livelihoods * 0.18 +
      dimensions.prices * 0.15 +
      dimensions.fiscal * 0.15 +
      dimensions.financial * 0.16 +
      dimensions.stability * 0.16,
  );
}

export function rankLiveWorldCountries(state: LiveWorldRoomState) {
  return Object.entries(forecastLiveWorld(state))
    .map(([countryId, dimensions]) => ({ countryId: countryId as LiveWorldCountryId, dimensions, score: scoreLiveWorldCountry(dimensions) }))
    .sort((left, right) => right.score - left.score);
}

export function agreementPreview(agreement: Pick<LiveWorldAgreement, "proposerCountry" | "receiverCountry" | "depth">) {
  const multiplier = agreement.depth === "limited" ? 0.55 : agreement.depth === "standard" ? 1 : 1.45;
  const proposerFit = complementarity(agreement.proposerCountry, agreement.receiverCountry);
  const receiverFit = complementarity(agreement.receiverCountry, agreement.proposerCountry);
  return {
    proposer: round((2.4 + proposerFit * 5) * multiplier),
    receiver: round((2.4 + receiverFit * 5) * multiplier),
  };
}

export function initialLiveWorldRoomState(): LiveWorldRoomState {
  return { publishedPolicies: {}, agreements: [], crises: [], sanctions: [] };
}

export const LIVE_WORLD_POLICY_KEYS = new Set(LIVE_WORLD_POLICY_CONTROLS.map((control) => control.key));
