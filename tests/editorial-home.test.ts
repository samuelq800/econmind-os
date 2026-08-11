import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PARTICIPATING_SCHOOLS } from "@/lib/league/participating-schools";

const home = readFileSync("components/home/editorial-home.tsx", "utf8");
const nav = readFileSync("components/layout/navbar.tsx", "utf8");
const gate = readFileSync("components/auth/registered-app-gate.tsx", "utf8");
const explore = readFileSync("app/explore/page.tsx", "utf8");

describe("editorial public architecture", () => {
  it("keeps the requested public front door while preserving the account gate for tools", () => {
    expect(gate).toContain("publicLeagueDirectoryPaths");
    expect(gate).toContain("if (!user)");
    expect(nav).toContain("MOBILE_NAVIGATION_GROUPS");
  });

  it("anchors the homepage in real world, models, simulation, evidence and league", () => {
    for (const label of ["Real World", "Models & Mechanisms", "Simulation", "Evidence", "League"]) {
      expect(home).toContain(`title: "${label}"`);
    }
    expect(home).toContain("Restaurant Food Waste");
    expect(home).toContain("A model is not the real world.");
    expect(home).toContain("How EconMind works");
  });

  it("uses one central 16-school public roster, including the new Beijing and Chengdu schools", () => {
    expect(PARTICIPATING_SCHOOLS).toHaveLength(16);
    expect(PARTICIPATING_SCHOOLS[0]?.name).toBe("Suzhou High School-International Division");
    expect(PARTICIPATING_SCHOOLS.map((school) => school.name)).toContain("Beijing Aidi International School");
    expect(PARTICIPATING_SCHOOLS.map((school) => school.name)).toContain("Chengdu Jiaxiang Foreign Language School");
    expect(home.indexOf("Participating schools")).toBeLessThan(home.indexOf("Platform thesis"));
  });

  it("uses a fixed city index instead of floating labels around dense map markers", () => {
    expect(home).toContain('className="home-city-map-index"');
    expect(home).toContain("School city locations");
    expect(home).not.toContain("home-city-label-left");
  });

  it("keeps Explore intentionally short and sends League organisation to its own home", () => {
    for (const label of ["Start from the world", "Make a mechanism visible", "Run a controlled counterfactual", "Test the claim"]) {
      expect(explore).toContain(`title: "${label}"`);
    }
    expect(explore).toContain("League is where schools and Teams compete");
  });
});
