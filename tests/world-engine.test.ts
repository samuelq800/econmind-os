import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_SCENARIO,
  assertAgreementCanActivate,
  canTransitionCompetition,
  createWorldState,
  defaultInstitutionDecisions,
  detectInstitutionConstraints,
  settleWorldRound,
  validateScenario,
  type CountrySubmission,
  type InternationalAgreement,
} from "@/lib/economics/world";

function submissions(state = createWorldState(), amend?: (countryId: string, decisions: ReturnType<typeof defaultInstitutionDecisions>) => void): CountrySubmission[] {
  return state.countries.map((country) => {
    const decisions = defaultInstitutionDecisions();
    amend?.(country.countryId, decisions);
    return { countryId: country.countryId, round: state.round, decisions, agreementActions: [], finalised: true, finalisedBy: "test-user" };
  });
}

describe("League Infrastructure world engine", () => {
  it("allows only declared competition state transitions", () => {
    expect(canTransitionCompetition("registration", "country_assignment")).toBe(true);
    expect(canTransitionCompetition("paused", "submission_open")).toBe(true);
    expect(canTransitionCompetition("completed", "next_round")).toBe(false);
    expect(canTransitionCompetition("submission_open", "world_processing")).toBe(false);
  });

  it("validates the seeded four-country scenario within the balance band", () => {
    const validation = validateScenario(DEFAULT_WORLD_SCENARIO);
    expect(validation.status).toBe("ready_for_test");
    expect(validation.metrics.powerGap).toBeLessThanOrEqual(12);
    expect(validation.metrics.viableStrategies).toBeGreaterThanOrEqual(8);
  });

  it("models Agritania's food advantage as a world-market strength", () => {
    const state = createWorldState();
    const agritania = state.countries.find((country) => country.countryId === "agritania")!;
    const peers = state.countries.filter((country) => country.countryId !== "agritania");
    expect(agritania.external.productionCapacity.food).toBeGreaterThan(Math.max(...peers.map((country) => country.external.productionCapacity.food)));
  });

  it("blocks real shared-resource overspend and flags policy contradictions", () => {
    const country = createWorldState().countries[0];
    const decisions = defaultInstitutionDecisions();
    decisions.economic_policy_minister.governmentSpending = 90;
    decisions.economic_policy_minister.welfare = 80;
    decisions.investment_resources_minister.infrastructure = 90;
    decisions.central_bank_governor.policyRate = 7;
    const report = detectInstitutionConstraints(country, decisions);
    expect(report.blocking.length).toBeGreaterThan(0);
    expect(report.warnings.some((warning) => warning.includes("Tight monetary"))).toBe(true);
  });

  it("clears the same world identically regardless of country-array order", () => {
    const normal = createWorldState();
    const reversed = { ...createWorldState(), countries: [...createWorldState().countries].reverse() };
    const first = settleWorldRound(normal, submissions(normal));
    const second = settleWorldRound(reversed, submissions(reversed));
    expect(first.result.settlementHash).toBe(second.result.settlementHash);
    expect(first.result.countryResults.map((result) => result.countryId)).toEqual(second.result.countryResults.map((result) => result.countryId));
  });

  it("never exports more than available production capacity", () => {
    const state = createWorldState();
    const settled = settleWorldRound(state, submissions(state));
    for (const country of settled.state.countries) {
      for (const commodity of ["energy", "food", "manufactured_goods", "technology_services"] as const) {
        const exported = settled.result.tradeFlows.filter((flow) => flow.exporterCountryId === country.countryId && flow.commodity === commodity).reduce((sum, flow) => sum + flow.quantity, 0);
        const available = Math.max(0, country.external.productionCapacity[commodity] - country.external.domesticDemand[commodity] * 0.65);
        expect(exported).toBeLessThanOrEqual(available + 0.01);
      }
    }
  });

  it("applies tariffs to bilateral flows and caps capital reallocation", () => {
    const state = createWorldState();
    const settled = settleWorldRound(state, submissions(state, (countryId, decision) => {
      if (countryId === "techoria") decision.trade_minister.tariff = 32;
      if (countryId === "financora") decision.central_bank_governor.policyRate = 8;
    }));
    const techoriaImports = settled.result.tradeFlows.filter((flow) => flow.importerCountryId === "techoria");
    expect(techoriaImports.some((flow) => flow.tariff === 32)).toBe(true);
    for (const country of settled.state.countries) expect(Math.abs(country.external.capitalAccount)).toBeLessThanOrEqual(12);
  });

  it("raises energy-market stress in the scheduled second-quarter shock", () => {
    const state = createWorldState();
    const first = settleWorldRound(state, submissions(state));
    const second = settleWorldRound(first.state, submissions(first.state));
    const firstPrice = first.result.markets.find((market) => market.commodity === "energy")!.globalPrice;
    const secondPrice = second.result.markets.find((market) => market.commodity === "energy")!.globalPrice;
    expect(secondPrice).toBeGreaterThan(firstPrice);
    expect(second.result.activeShockIds).toContain("global-energy-shock");
  });

  it("requires the correct country-role approvals before an agreement can activate", () => {
    const agreement: InternationalAgreement = {
      id: "trade-1", type: "trade", proposerCountryId: "techoria", participantCountryIds: ["techoria", "manufactura"], status: "accepted", terms: { commodity: "technology_services", tariffReduction: 5, duration: 2 }, startsRound: 1, endsRound: 2,
      approvals: [{ countryId: "techoria", requiredRole: "trade_minister", approved: true }, { countryId: "manufactura", requiredRole: "trade_minister", approved: false }],
    };
    expect(() => assertAgreementCanActivate(agreement)).toThrow(/approvals/i);
    agreement.approvals[1].approved = true;
    expect(() => assertAgreementCanActivate(agreement)).not.toThrow();
  });

  it("keeps legacy domestic rate transmission available to the world package", () => {
    const state = createWorldState();
    const lowRate = settleWorldRound(state, submissions(state, (_, decision) => { decision.central_bank_governor.policyRate = 2; }));
    const highRate = settleWorldRound(createWorldState(), submissions(createWorldState(), (_, decision) => { decision.central_bank_governor.policyRate = 8; }));
    const lowTechInvestment = lowRate.state.countries.reduce((sum, country) => sum + country.domestic.sectors.technology.investment_index, 0);
    const highTechInvestment = highRate.state.countries.reduce((sum, country) => sum + country.domestic.sectors.technology.investment_index, 0);
    expect(highTechInvestment).toBeLessThan(lowTechInvestment);
  });

  it("uses the scenario's scoring weights instead of hard-coding leaderboard weights", () => {
    const config = { ...DEFAULT_WORLD_SCENARIO, scoringWeights: { domesticEconomicPerformance: 100, institutionalGovernance: 0, internationalEconomicPosition: 0, crisisResilience: 0, longTermDevelopment: 0, globalContribution: 0 } };
    const state = createWorldState(config);
    const settled = settleWorldRound(state, submissions(state), config);
    for (const result of settled.result.countryResults) expect(result.scores.total).toBe(result.scores.domesticEconomicPerformance);
  });
});
