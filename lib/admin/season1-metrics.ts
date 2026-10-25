import type { Season1AdminTeam } from "@/lib/supabase/season1-admin";
import type { CountryPreferenceView } from "@/lib/season1/countries";

/** Use the complete authorized roster, never the search-filtered cards. */
export function season1TeamMetrics(
  teams: Pick<
    Season1AdminTeam,
    "status" | "recruitmentLocked" | "memberCount"
  >[],
  countries: CountryPreferenceView["countries"],
) {
  const currentTeams = teams.filter((team) => team.status !== "dissolved");
  return {
    lockedTeams: currentTeams.filter((team) => team.recruitmentLocked).length,
    teamsAtLeastThree: currentTeams.filter((team) => team.memberCount >= 3)
      .length,
    selectedCountryTeams: new Set(
      countries
        .filter((country) => country.reserved)
        .map((country) => country.code),
    ).size,
  };
}
