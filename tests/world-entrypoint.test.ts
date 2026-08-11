import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORLD_GOVERNANCE_ROLES } from "@/lib/world-governance/types";

const entrypoint = readFileSync("components/world/world-experience.tsx", "utf8");
const overview = readFileSync("components/world-governance/world-simulation.tsx", "utf8");

describe("World Simulation entrypoint", () => {
  it("restores the persistent twelve-country overview", () => {
    expect(entrypoint).toContain("WorldSimulationOverview");
    expect(entrypoint).not.toContain("ContinuousWorldDashboard");
    expect(overview).toContain('["12", "countries"]');
    expect(overview).toContain('["6", "offices / country"]');
  });

  it("keeps the original six-office country cabinet", () => {
    expect(WORLD_GOVERNANCE_ROLES).toEqual([
      "captain",
      "central-bank",
      "finance",
      "trade",
      "industry",
      "social",
    ]);
  });
});
