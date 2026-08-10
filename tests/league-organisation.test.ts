import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEAGUE_CHALLENGES_COMING_SOON,
  LEAGUE_RANKING_CATEGORIES,
  LEAGUE_SEASON,
} from "@/lib/league/league-season";

const navigation = readFileSync("components/league/league-navigation.tsx", "utf8");
const workspace = readFileSync("components/league/league-challenge-workspace.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260810000000_league_organisation_directory.sql", "utf8");

describe("League organisation layer", () => {
  it("presents six organisation pages and no longer promotes Replay", () => {
    for (const label of ["Home", "Schools", "Teams", "Season", "Standings", "About"]) {
      expect(navigation).toContain(`label: "${label}"`);
    }
    expect(navigation).not.toContain('label: "Replay"');
  });

  it("keeps Season 1 and all four Official Challenges in a coming-soon state", () => {
    expect(LEAGUE_SEASON.status).toBe("coming_soon");
    expect(LEAGUE_CHALLENGES_COMING_SOON).toHaveLength(4);
    expect(LEAGUE_CHALLENGES_COMING_SOON.every((challenge) => challenge.seasonStatus === "coming_soon")).toBe(true);
  });

  it("keeps multiple ranking lenses while deferring individual standings", () => {
    expect(LEAGUE_RANKING_CATEGORIES).toEqual([
      "Overall",
      "Economic Performance",
      "Consistency",
      "Official Wins",
    ]);
  });

  it("makes the next Challenge action visually explicit without changing its engine", () => {
    expect(workspace).toContain("START PRACTICE");
    expect(workspace).toContain("LOCK DECISION");
    expect(workspace).toContain("Official opens with Season 1");
  });

  it("adds only the directory/profile data necessary for public League identity", () => {
    for (const fragment of [
      "add column if not exists description",
      "add column if not exists logo_url",
      "update_league_school_profile",
      "get_public_league_directory",
      "get_public_league_teams",
      "does not make profiles, emails, invite codes",
    ]) expect(migration).toContain(fragment);
    expect(migration).toContain("security definer");
  });
});
