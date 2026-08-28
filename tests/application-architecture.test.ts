import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { throwIfSupabaseError } from "@/lib/supabase/client";

const normalizedServices = [
  "account-onboarding",
  "cases",
  "command-centre",
  "continuous-world",
  "daily-brief",
  "data",
  "econbench",
  "experiments",
  "league",
  "league-challenges",
  "league-directory",
  "league-infrastructure",
  "model-composer",
  "professor-studio",
  "viewer-invitations",
];

describe("application architecture boundaries", () => {
  it("keeps Supabase client creation and error translation in one shared boundary", () => {
    const clientSource = readFileSync("lib/supabase/client.ts", "utf8");
    expect(clientSource).toContain("requireSupabaseBrowserClient");
    expect(clientSource).toContain("throwIfSupabaseError");

    for (const service of normalizedServices) {
      const source = readFileSync(`lib/supabase/${service}.ts`, "utf8");
      expect(source).not.toMatch(/function client\s*\(/);
      expect(source).toContain("requireSupabaseBrowserClient");
    }
  });

  it("keeps the protected Simulation implementation and its legacy routes available", () => {
    for (const path of [
      "components/simulation/simulation-navigation.tsx",
      "components/simulation/legacy-competition-pages.tsx",
      "components/world-governance/world-simulation.tsx",
      "app/simulation/page.tsx",
      "app/simulation/world/page.tsx",
      "app/simulation/legacy-world/page.tsx",
    ]) {
      expect(existsSync(path)).toBe(true);
    }
  });

  it("uses one filtered query to calculate Team challenge totals", () => {
    const service = readFileSync("lib/supabase/league-challenges.ts", "utf8");
    const teamPage = readFileSync("components/league/league-teams.tsx", "utf8");
    expect(service).toContain("listSubmittedChallengeAttemptCounts");
    expect(service).toContain('.in("team_id", [...teamIds])');
    expect(teamPage).toContain("listSubmittedChallengeAttemptCounts");
    expect(teamPage).not.toContain("listMyChallengeAttempts");
  });

  it("keeps error translation stable for callers", () => {
    expect(() => throwIfSupabaseError(null)).not.toThrow();
    expect(() => throwIfSupabaseError({ message: "Access denied" })).toThrow("Access denied");
  });
});
