import { describe, expect, it } from "vitest";
import { TWELVE_COUNTRY_TEMPLATES } from "@/lib/economics/world";
import { assignmentBalance, planBalancedCountryAssignment, snakeDraftOrder } from "@/lib/league/country-assignment";
import type { LeagueCompetitionCountry } from "@/lib/league/world-league-types";

const countries = TWELVE_COUNTRY_TEMPLATES.map((template) => ({ id: template.id, competition_id: "world", country_template_id: template.id, template_version: 1, immutable_template_snapshot: { category: template.config.category, balanceScore: template.balanceScore, commodityCapacity: template.config.commodityCapacity }, assigned_school_id: null, assigned_team_id: null, display_name: template.name, status: "unassigned", template: null, school: null, team: null })) as LeagueCompetitionCountry[];
const teams = Array.from({ length: 6 }, (_, index) => ({ id: `team-${index + 1}`, name: `School ${index + 1}`, school_id: `school-${index + 1}` }));

describe("country allocation", () => {
  it("creates one deterministic balanced allocation without duplicate countries", () => {
    const plan = planBalancedCountryAssignment(countries, teams);
    expect(plan).toHaveLength(12);
    expect(new Set(plan.map((item) => item.countryId)).size).toBe(12);
    expect(new Set(plan.map((item) => item.teamId)).size).toBe(6);
    const totals = [...assignmentBalance(plan, countries).values()];
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(6);
    expect(plan).toEqual(planBalancedCountryAssignment(countries, teams));
  });

  it("uses the requested forward-reverse snake sequence", () => {
    expect(snakeDraftOrder(["A", "B", "C"], 2)).toEqual(["A", "B", "C", "C", "B", "A"]);
  });
});
