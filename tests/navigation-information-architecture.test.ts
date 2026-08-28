import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { MOBILE_NAVIGATION_GROUPS, NAVIGATION_SECTIONS, availableNavigationSections, isNavigationSectionActive } from "@/lib/platform/feature-flags";

const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
const footer = readFileSync("components/layout/footer.tsx", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");
const teamPage = readFileSync("components/team/team-page.tsx", "utf8");
const simulationNavigation = readFileSync("components/simulation/simulation-navigation.tsx", "utf8");

const expectedTopLevelLabels = [
  "Explore",
  "Learn",
  "Lab",
  "Simulation",
  "League",
  "Teams",
  "Community & Legal",
  "Workspace",
];

function routeHasPage(route: string) {
  return existsSync(`app${route}/page.tsx`);
}

describe("Phase 2 information architecture", () => {
  it("uses the agreed eight primary navigation destinations in the agreed order", () => {
    expect(NAVIGATION_SECTIONS.map((section) => section.label)).toEqual(expectedTopLevelLabels);
    expect(availableNavigationSections().map((section) => section.label)).toEqual(expectedTopLevelLabels);
    expect(MOBILE_NAVIGATION_GROUPS.map((group) => group.label)).toEqual(expectedTopLevelLabels);
  });

  it("only presents existing application routes and keeps simulation as a first-level entry", () => {
    for (const section of NAVIGATION_SECTIONS) {
      expect(routeHasPage(section.href)).toBe(true);
      for (const item of section.children) expect(routeHasPage(item.href)).toBe(true);
    }
    expect(NAVIGATION_SECTIONS.find((section) => section.id === "simulation")?.children).toEqual([]);
  });

  it("uses one configuration for desktop, mobile and footer navigation", () => {
    expect(navbar).toContain("availableNavigationSections");
    expect(navbar).toContain("MOBILE_NAVIGATION_GROUPS");
    expect(navbar).toContain("isNavigationSectionActive");
    expect(footer).toContain("availableNavigationSections");
    expect(footer).toContain("primaryLinks");
  });

  it("resolves specific Team routes before the broad League root", () => {
    const league = NAVIGATION_SECTIONS.find((section) => section.id === "league");
    const teams = NAVIGATION_SECTIONS.find((section) => section.id === "teams");
    expect(league).toBeDefined();
    expect(teams).toBeDefined();
    expect(isNavigationSectionActive(league!, "/league/teams")).toBe(false);
    expect(isNavigationSectionActive(teams!, "/league/teams")).toBe(true);
    expect(isNavigationSectionActive(league!, "/league/world")).toBe(true);
  });

  it("keeps the global shell singular and leaves existing Simulation navigation intact", () => {
    expect(rootLayout).toContain("<RegisteredAppGate><Navbar />{children}<Footer /></RegisteredAppGate>");
    expect(teamPage).not.toContain("components/layout/navbar");
    expect(teamPage).not.toContain("<Navbar");
    for (const label of ["12-Country World", "1973 Oil Shock", "Scenario Studio", "Model Battle"]) {
      expect(simulationNavigation).toContain(label);
    }
  });
});
