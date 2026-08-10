import { LEAGUE_CHALLENGE_CATALOG } from "@/lib/economics/league-arena";

/**
 * The organisational layer has a deliberately separate launch calendar from
 * the reusable simulations. Keeping this in code means the public League can
 * say "coming soon" without changing a working simulation, attempt or score.
 */
export const LEAGUE_SEASON = {
  number: 1,
  title: "Season 1",
  theme: "Global Inflation",
  status: "coming_soon" as const,
  durationDays: 30,
  startDate: null as string | null,
  endDate: null as string | null,
  currentDay: null as number | null,
  summary: "The first monthly Official Season will open after participating schools and teams have completed their League setup.",
};

export const LEAGUE_CHALLENGES_COMING_SOON = LEAGUE_CHALLENGE_CATALOG.map((challenge) => ({
  ...challenge,
  seasonStatus: "coming_soon" as const,
  availabilityLabel: "Coming soon",
  remainingDays: null as number | null,
}));

export const LEAGUE_ACHIEVEMENTS = [
  "Official Win",
  "Top Season Rank",
  "Official Participation",
] as const;

export const LEAGUE_RANKING_CATEGORIES = [
  "Overall",
  "Economic Performance",
  "Consistency",
  "Official Wins",
] as const;

export type LeagueRankingCategory = (typeof LEAGUE_RANKING_CATEGORIES)[number];

export function seasonLabel() {
  return `${LEAGUE_SEASON.title} · ${LEAGUE_SEASON.theme}`;
}
