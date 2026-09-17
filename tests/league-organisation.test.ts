import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navigation = readFileSync("components/league/league-navigation.tsx", "utf8");
const workspace = readFileSync("components/league/league-challenge-workspace.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260810000000_league_organisation_directory.sql", "utf8");

describe("League organisation layer", () => {
  it("presents organisation pages without Season or standings", () => {
    for (const label of ["Home", "Schools", "Teams", "About"]) {
      expect(navigation).toContain(`label: "${label}"`);
    }
    expect(navigation).not.toContain('label: "Season"');
    expect(navigation).not.toContain('label: "Standings"');
    expect(navigation).not.toContain('label: "Replay"');
  });

  it("shows the League Dashboard entry to School Leaders as well as Platform Admins", () => {
    expect(navigation).toContain('platformRole === "school_leader"');
    expect(navigation).toContain('href="/league/dashboard"');
    expect(navigation).toContain("Dashboard");
  });

  it("keeps simulations open without a League season dependency", () => {
    expect(workspace).toContain("START SIMULATION");
    expect(workspace).toContain("ADVANCE SIMULATION");
    expect(workspace).not.toContain("Official opens with Season 1");
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
