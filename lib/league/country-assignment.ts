import type { LeagueCompetitionCountry } from "@/lib/league/world-league-types";

export type AssignableTeam = { id: string; name: string; school_id: string };
export type CountryAssignment = { countryId: string; teamId: string; schoolId: string };

type CountryProfile = {
  category?: string;
  balanceScore?: number;
  commodityCapacity?: Record<string, number>;
};

function profile(country: LeagueCompetitionCountry): CountryProfile {
  const snapshot = country.immutable_template_snapshot ?? {};
  return {
    category: String(snapshot.category ?? country.template?.category ?? ""),
    balanceScore: Number(snapshot.balanceScore ?? country.template?.balance_score ?? 100),
    commodityCapacity: (snapshot.commodityCapacity ?? country.template?.commodity_capacity ?? {}) as Record<string, number>,
  };
}

function complementScore(candidate: LeagueCompetitionCountry, assigned: LeagueCompetitionCountry[]) {
  const capacity = profile(candidate).commodityCapacity ?? {};
  return assigned.reduce((penalty, existing) => {
    const other = profile(existing).commodityCapacity ?? {};
    const overlap = Object.keys(capacity).reduce((sum, commodity) => sum + Math.min(Number(capacity[commodity] ?? 0), Number(other[commodity] ?? 0)), 0);
    return penalty + overlap;
  }, 0);
}

/**
 * A deterministic balanced allocator.  It deliberately uses no randomness,
 * so a director can preview the same plan before applying it.  Countries with
 * high and low balance scores are paired first; duplicate categories and
 * resource overlap are then used only as tie-breakers.
 */
export function planBalancedCountryAssignment(countries: LeagueCompetitionCountry[], teams: AssignableTeam[]): CountryAssignment[] {
  if (!teams.length) return [];
  const open = countries.filter((country) => !country.assigned_team_id);
  const group = new Map(teams.map((team) => [team.id, [] as LeagueCompetitionCountry[]]));
  const score = new Map(teams.map((team) => [team.id, 0]));
  const ordered = [...open].sort((left, right) => profile(right).balanceScore! - profile(left).balanceScore! || left.display_name.localeCompare(right.display_name));

  return ordered.map((country) => {
    const team = [...teams].sort((left, right) => {
      const leftCountries = group.get(left.id) ?? [];
      const rightCountries = group.get(right.id) ?? [];
      const leftCategoryPenalty = leftCountries.some((item) => profile(item).category === profile(country).category) ? 1 : 0;
      const rightCategoryPenalty = rightCountries.some((item) => profile(item).category === profile(country).category) ? 1 : 0;
      const comparison = (score.get(left.id) ?? 0) - (score.get(right.id) ?? 0)
        || leftCountries.length - rightCountries.length
        || leftCategoryPenalty - rightCategoryPenalty
        || complementScore(country, leftCountries) - complementScore(country, rightCountries)
        || left.name.localeCompare(right.name);
      return comparison;
    })[0];
    const assigned = group.get(team.id)!;
    assigned.push(country);
    score.set(team.id, (score.get(team.id) ?? 0) + (profile(country).balanceScore ?? 100));
    return { countryId: country.id, teamId: team.id, schoolId: team.school_id };
  });
}

/** A transparent two-round draft order: A→F, then F→A, repeated as needed. */
export function snakeDraftOrder<T>(items: T[], rounds = 2): T[] {
  const order: T[] = [];
  for (let round = 0; round < rounds; round += 1) order.push(...(round % 2 === 0 ? items : [...items].reverse()));
  return order;
}

export function assignmentBalance(assignments: CountryAssignment[], countries: LeagueCompetitionCountry[]) {
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const totals = new Map<string, number>();
  for (const assignment of assignments) {
    const country = countryById.get(assignment.countryId);
    totals.set(assignment.teamId, (totals.get(assignment.teamId) ?? 0) + (country ? profile(country).balanceScore ?? 100 : 0));
  }
  return totals;
}
