import type {
  LiveWorldCountry,
  LiveWorldCountryId,
  LiveWorldCrisis,
  LiveWorldPolicyControl,
  LiveWorldRoleId,
} from "./types";

export const LIVE_WORLD_COUNTRIES: readonly LiveWorldCountry[] = [
  {
    id: "aurora",
    name: "Aurora",
    shortDescription: "Advanced technology and finance economy",
    structure: { technology: 92, manufacturing: 48, resources: 22, domesticMarket: 62, financialDepth: 94, exportDependence: 56, energyDependence: 66, capitalDependence: 18 },
    baseline: { activity: 72, livelihoods: 70, prices: 68, fiscal: 66, financial: 86, stability: 74 },
  },
  {
    id: "borealis",
    name: "Borealis",
    shortDescription: "Manufacturing and export economy",
    structure: { technology: 62, manufacturing: 94, resources: 36, domesticMarket: 54, financialDepth: 58, exportDependence: 92, energyDependence: 58, capitalDependence: 46 },
    baseline: { activity: 74, livelihoods: 64, prices: 62, fiscal: 62, financial: 60, stability: 68 },
  },
  {
    id: "cyrenia",
    name: "Cyrenia",
    shortDescription: "Resource and energy economy",
    structure: { technology: 38, manufacturing: 42, resources: 96, domesticMarket: 48, financialDepth: 44, exportDependence: 78, energyDependence: 16, capitalDependence: 58 },
    baseline: { activity: 65, livelihoods: 58, prices: 56, fiscal: 72, financial: 52, stability: 59 },
  },
  {
    id: "demeria",
    name: "Demeria",
    shortDescription: "Emerging consumer economy",
    structure: { technology: 46, manufacturing: 58, resources: 46, domesticMarket: 94, financialDepth: 38, exportDependence: 38, energyDependence: 72, capitalDependence: 76 },
    baseline: { activity: 68, livelihoods: 66, prices: 50, fiscal: 54, financial: 45, stability: 60 },
  },
] as const;

export const LIVE_WORLD_ROLE_LABELS: Record<LiveWorldRoleId, string> = {
  central_bank_governor: "Central Bank Governor",
  finance_domestic_minister: "Finance & Domestic Minister",
  trade_industry_investment_minister: "Trade, Industry & Investment Minister",
  labour_social_development_minister: "Labour & Social Development Minister",
  energy_climate_minister: "Energy & Climate Minister",
};

export const LIVE_WORLD_POLICY_CONTROLS: readonly LiveWorldPolicyControl[] = [
  { key: "policy_rate", role: "central_bank_governor", label: "Policy rate", description: "Balances price control against credit and activity.", impact: "Higher rates cool prices and strengthen financial resilience, but can slow activity.", min: 0, max: 15, step: 0.5, defaultValue: 5, unit: "%" },
  { key: "liquidity_support", role: "central_bank_governor", label: "Liquidity support", description: "Temporary credit support for the financial system.", impact: "Supports activity and bank liquidity, with some inflation pressure if overused.", min: 0, max: 30, step: 1, defaultValue: 8 },
  { key: "reserve_requirement", role: "central_bank_governor", label: "Reserve requirement", description: "Bank reserve buffer that moderates lending risk.", impact: "Improves financial stability but can restrain lending and activity.", min: 0, max: 25, step: 1, defaultValue: 10, unit: "%" },
  { key: "government_spending", role: "finance_domestic_minister", label: "Government spending", description: "Near-term demand and public-service capacity.", impact: "Lifts activity and livelihoods now, while using fiscal capacity.", min: 0, max: 65, step: 1, defaultValue: 32 },
  { key: "tax_rate", role: "finance_domestic_minister", label: "Tax rate", description: "Revenue resilience versus household and business demand.", impact: "Raises fiscal resources but can weigh on demand and household income.", min: 5, max: 50, step: 1, defaultValue: 22, unit: "%" },
  { key: "welfare", role: "finance_domestic_minister", label: "Welfare support", description: "Protects livelihoods while using fiscal room.", impact: "Strengthens livelihoods and stability at a direct fiscal cost.", min: 0, max: 40, step: 1, defaultValue: 14 },
  { key: "infrastructure", role: "finance_domestic_minister", label: "Infrastructure", description: "Builds capacity with a delayed fiscal trade-off.", impact: "Builds activity and resilience over time, financed from the public budget.", min: 0, max: 50, step: 1, defaultValue: 18 },
  { key: "tariff", role: "trade_industry_investment_minister", label: "Tariff", description: "Protects domestic producers but raises import costs.", impact: "Can shelter domestic industry, but raises prices and can weaken trade stability.", min: 0, max: 40, step: 1, defaultValue: 8, unit: "%" },
  { key: "export_support", role: "trade_industry_investment_minister", label: "Export support", description: "Helps firms reach external markets.", impact: "Supports activity and jobs in export sectors, with a budget cost.", min: 0, max: 30, step: 1, defaultValue: 10 },
  { key: "industrial_subsidy", role: "trade_industry_investment_minister", label: "Industrial subsidy", description: "Raises strategic capacity at a fiscal cost.", impact: "Raises industrial capacity and activity while reducing fiscal room.", min: 0, max: 35, step: 1, defaultValue: 10 },
  { key: "fdi_openness", role: "trade_industry_investment_minister", label: "FDI openness", description: "Attracts capital and expertise with exposure to external conditions.", impact: "Brings activity and capital, but increases exposure to external shocks.", min: 0, max: 30, step: 1, defaultValue: 12 },
  { key: "labour_market_activation", role: "labour_social_development_minister", label: "Labour-market activation", description: "Employment matching and support for people seeking work.", impact: "Improves employment and livelihoods, with a modest budget cost.", min: 0, max: 40, step: 1, defaultValue: 12 },
  { key: "skills_investment", role: "labour_social_development_minister", label: "Skills investment", description: "Training capacity that raises productivity over the session.", impact: "Builds productive capacity and financial depth, with a delayed fiscal trade-off.", min: 0, max: 40, step: 1, defaultValue: 14 },
  { key: "wage_support", role: "labour_social_development_minister", label: "Wage support", description: "Targeted income support during labour-market adjustment.", impact: "Protects wages and stability while increasing public spending.", min: 0, max: 30, step: 1, defaultValue: 8 },
  { key: "strategic_energy_reserve", role: "energy_climate_minister", label: "Strategic energy reserve", description: "Buffer reserves against energy supply shocks.", impact: "Reduces energy-price risk and improves stability, at a fiscal cost.", min: 0, max: 30, step: 1, defaultValue: 8 },
  { key: "clean_energy_investment", role: "energy_climate_minister", label: "Clean-energy investment", description: "Invest in cleaner domestic power capacity.", impact: "Builds activity and resilience while easing price pressure over time.", min: 0, max: 45, step: 1, defaultValue: 16 },
  { key: "efficiency_standard", role: "energy_climate_minister", label: "Efficiency standard", description: "Efficiency requirements that reduce energy exposure.", impact: "Lowers energy-price exposure and supports resilience, with implementation costs.", min: 0, max: 30, step: 1, defaultValue: 10 },
] as const;

export const LIVE_WORLD_CRISIS_LIBRARY: readonly LiveWorldCrisis[] = [
  { id: "energy-price-spike", label: "Energy price spike", description: "Global energy costs rise sharply, testing import dependence and resource buffers.", affectedCountries: ["aurora", "borealis", "demeria"], effects: { activity: -4, prices: -8, fiscal: -2, stability: -3 }, active: true, impactSummary: "Energy-importing economies face weaker activity, higher price pressure and lower fiscal room.", responseHint: "Coordinate energy reserves, efficiency measures and targeted household support." },
  { id: "capital-flight", label: "Capital flight", description: "External investors reduce risk exposure, testing financial depth and capital dependence.", affectedCountries: ["cyrenia", "demeria"], effects: { financial: -9, activity: -4, stability: -4 }, active: true, impactSummary: "Financial conditions tighten and countries reliant on external capital lose activity and stability.", responseHint: "Combine liquidity protection with credible macroeconomic and investment measures." },
  { id: "supply-chain-disruption", label: "Supply-chain disruption", description: "Trade logistics slow, challenging export-oriented manufacturing systems.", affectedCountries: ["borealis", "aurora"], effects: { activity: -7, livelihoods: -3, prices: -3 }, active: true, impactSummary: "Production and employment weaken while supply bottlenecks add price pressure.", responseHint: "Use trade coordination, industrial support and logistics resilience." },
  { id: "commodity-boom", label: "Commodity boom", description: "Resource prices rise, creating gains but inflation and concentration risks.", affectedCountries: ["cyrenia"], effects: { activity: 7, fiscal: 6, prices: -3, stability: -1 }, active: true, impactSummary: "Resource revenues and activity rise, but prices and reliance on one sector become more fragile.", responseHint: "Use the fiscal windfall to diversify capacity and protect price stability." },
] as const;

export function liveWorldCountry(countryId: LiveWorldCountryId) {
  return LIVE_WORLD_COUNTRIES.find((country) => country.id === countryId) ?? LIVE_WORLD_COUNTRIES[0];
}

export function controlsForLiveWorldRole(role: LiveWorldRoleId) {
  return LIVE_WORLD_POLICY_CONTROLS.filter((control) => control.role === role);
}

export function liveWorldDefaultPolicies(role: LiveWorldRoleId) {
  return Object.fromEntries(
    controlsForLiveWorldRole(role).map((control) => [control.key, control.defaultValue]),
  );
}
