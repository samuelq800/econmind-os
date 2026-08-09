import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PARTICIPATING_SCHOOLS } from "@/lib/league/participating-schools";

const home = readFileSync("components/home/editorial-home.tsx", "utf8");
const nav = readFileSync("components/layout/navbar.tsx", "utf8");
const gate = readFileSync("components/auth/registered-app-gate.tsx", "utf8");
const explore = readFileSync("app/explore/page.tsx", "utf8");

describe("editorial public architecture", () => {
  it("keeps the requested public front door while preserving the account gate for tools", () => {
    expect(gate).toContain('normalisedPath === "/" || normalisedPath === "/explore"');
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

  it("uses one central 15-school public roster, including the new Chengdu school", () => {
    expect(PARTICIPATING_SCHOOLS).toHaveLength(15);
    expect(PARTICIPATING_SCHOOLS[0]?.name).toBe("Suzhou High School-International Division");
    expect(PARTICIPATING_SCHOOLS.map((school) => school.name)).toContain("Chengdu Jiaxiang Foreign Language School");
  });

  it("turns Explore into a grouped operating-system directory", () => {
    for (const label of ["Real World", "Models", "Simulation & Policy", "Practice & Assessment", "Evidence & Research", "Network"]) {
      expect(explore).toContain(`title: "${label}"`);
    }
  });
});
