import { describe, expect, it } from "vitest";
import { TWELVE_COUNTRY_TEMPLATES, TWELVE_COUNTRY_WORLD_SCENARIO, createWorldState, defaultInstitutionDecisions, detectInstitutionConstraints, settleWorldRound, validateScenario } from "@/lib/economics/world";

describe("twelve-country interconnected world", () => {
  it("keeps all twelve named countries and complete sector profiles", () => {
    expect(TWELVE_COUNTRY_TEMPLATES).toHaveLength(12);
    expect(new Set(TWELVE_COUNTRY_TEMPLATES.map((country) => country.slug)).size).toBe(12);
    for (const country of TWELVE_COUNTRY_TEMPLATES) {
      expect(Object.values(country.config.sectorShares).reduce((total, share) => total + share, 0)).toBe(100);
      expect(country.config.viableStrategies).toHaveLength(2);
      expect(Object.values(country.config.commodityCapacity).every((capacity) => capacity > 0)).toBe(true);
    }
  });

  it("passes its balance, market concentration and strategy checks", () => {
    const validation = validateScenario(TWELVE_COUNTRY_WORLD_SCENARIO);
    expect(validation.status).toBe("ready_for_test");
    expect(validation.metrics.powerGap).toBeLessThanOrEqual(8);
    expect(validation.metrics.minimumCommodityProducers).toBeGreaterThanOrEqual(4);
    expect(validation.metrics.commodityConcentration).toBeLessThanOrEqual(45);
  });

  it("allows fiscal deficits while forecasting lower or tax-adjusted next-quarter space", () => {
    const techoria = createWorldState(TWELVE_COUNTRY_WORLD_SCENARIO).countries.find((country) => country.countryId === "techoria")!;
    const decisions = defaultInstitutionDecisions();
    decisions.economic_policy_minister.governmentSpending = 65;
    decisions.economic_policy_minister.welfare = 40;
    decisions.economic_policy_minister.incomeTax = 36;
    decisions.economic_policy_minister.businessTax = 38;
    const report = detectInstitutionConstraints(techoria, decisions);
    expect(report.fiscalDeficit).toBeGreaterThan(0);
    expect(report.blocking.some((item) => item.includes("fiscalCapacity"))).toBe(false);
    expect(report.nextQuarterFiscalCapacity).toBeGreaterThan(techoria.resources.fiscalCapacity - report.fiscalDeficit * 0.18);
  });

  it("feeds country structure into different production and policy outcomes", () => {
    const world = createWorldState(TWELVE_COUNTRY_WORLD_SCENARIO);
    const techoria = world.countries.find((country) => country.countryId === "techoria")!;
    const energea = world.countries.find((country) => country.countryId === "energea")!;
    expect(techoria.external.productionCapacity.technology_services).toBeGreaterThan(energea.external.productionCapacity.technology_services);
    expect(energea.external.productionCapacity.energy).toBeGreaterThan(techoria.external.productionCapacity.energy);
    const submissions = world.countries.map((country) => ({ countryId: country.countryId, round: 1 as const, decisions: defaultInstitutionDecisions(), agreementActions: [], finalised: true, finalisedBy: "test" }));
    const settled = settleWorldRound(world, submissions, TWELVE_COUNTRY_WORLD_SCENARIO);
    expect(settled.state.countries).toHaveLength(12);
    expect(settled.result.countryResults).toHaveLength(12);
  });
});
