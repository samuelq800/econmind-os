import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const simulationHome = readFileSync("components/simulation/simulation-home.tsx", "utf8");
const simulationNavigation = readFileSync("components/simulation/simulation-navigation.tsx", "utf8");
const worldPage = readFileSync("app/simulation/world/page.tsx", "utf8");
const oilShockPage = readFileSync("app/simulation/arena/[slug]/workspace/page.tsx", "utf8");
const leagueWorld = readFileSync("app/league/world/page.tsx", "utf8");
const legacyWorld = readFileSync("app/simulation/legacy-world/page.tsx", "utf8");
const legacyCompetitionPages = readFileSync("components/simulation/legacy-competition-pages.tsx", "utf8");
const quickChallenge = readFileSync("app/simulation/quick-challenge/page.tsx", "utf8");
const commandCentre = readFileSync("app/simulation/command-centre/page.tsx", "utf8");
const scenarioStudio = readFileSync("app/simulation/scenario-studio/page.tsx", "utf8");

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

  it("restores the pre-season workspaces under Simulation without changing League routes", () => {
    expect(simulationHome).toContain('href="/simulation/legacy-world"');
    expect(simulationNavigation).toContain('href: "/simulation/legacy-world"');
    expect(legacyWorld).toContain("LegacyCompetitionDirectory");
    expect(legacyCompetitionPages).toContain("LegacyCompetitionSurface");
    expect(legacyCompetitionPages).toContain("/simulation/legacy-world/lobby");
    expect(legacyCompetitionPages).toContain("/simulation/legacy-world/replay");
    expect(quickChallenge).toContain('commandCentrePath="/simulation/command-centre"');
    expect(commandCentre).toContain('basePath="/simulation/command-centre"');
    expect(scenarioStudio).toContain('basePath="/simulation/scenario-studio"');
  });
});
