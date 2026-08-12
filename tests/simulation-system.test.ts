import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const simulationHome = readFileSync("components/simulation/simulation-home.tsx", "utf8");
const simulationNavigation = readFileSync("components/simulation/simulation-navigation.tsx", "utf8");
const worldPage = readFileSync("app/simulation/world/page.tsx", "utf8");
const oilShockPage = readFileSync("app/simulation/arena/[slug]/workspace/page.tsx", "utf8");
const leagueWorld = readFileSync("app/league/world/page.tsx", "utf8");

describe("standalone Simulation system", () => {
  it("keeps League intact while exposing a separate 12-country, six-office entrypoint", () => {
    expect(leagueWorld).toContain("WorldExperience");
    expect(worldPage).toContain("WorldSimulationOverview");
    expect(worldPage).toContain('basePath="/simulation/world"');
    expect(simulationHome).toContain('value="12"');
    expect(simulationHome).toContain('value="6"');
    expect(simulationNavigation).toContain('href: "/simulation/world"');
  });

  it("keeps the Oil Shock workspace inside Simulation", () => {
    expect(simulationHome).toContain("time-machine-1973-oil-shock");
    expect(oilShockPage).toContain('arenaPath="/simulation/arena"');
    expect(oilShockPage).toContain('replayPath="/simulation/replay"');
  });
});
