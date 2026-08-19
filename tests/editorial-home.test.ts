import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync("components/home/editorial-home.tsx", "utf8");
const schoolDirectory = readFileSync("components/home/home-league-school-directory.tsx", "utf8");
const schoolRoster = readFileSync("lib/league/participating-schools.ts", "utf8");
const nav = readFileSync("components/layout/navbar.tsx", "utf8");
const gate = readFileSync("components/auth/registered-app-gate.tsx", "utf8");
const accessControl = readFileSync("lib/platform/access-control.ts", "utf8");
const explore = readFileSync("app/explore/page.tsx", "utf8");


describe("editorial public architecture", () => {
  it("keeps the requested public front door while preserving the account gate for tools", () => {
    expect(gate).toContain("pageAccessForPath");
    expect(gate).toContain("accountRequired");
    expect(accessControl).toContain('{ path: "/about", audience: "public" }');
    expect(accessControl).toContain('{ path: "/cases", match: "prefix", audience: "public" }');
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

  it("uses the approved League directory and its complete public roster", () => {
    expect(home).toContain("HomeLeagueSchoolDirectory");
    expect(home).not.toContain("PARTICIPATING_SCHOOLS");
    expect(schoolDirectory).toContain("listPublicLeagueSchools");
    expect(schoolDirectory).toContain("PARTICIPATING_SCHOOLS");
    expect(schoolDirectory).toContain("Once a school application is approved");
    expect(schoolDirectory).toContain("school.school_name");
    expect(schoolRoster).toContain("HD Ningbo School");
    expect(schoolRoster).toContain("MalvernCollegeQingdao");
    expect(schoolRoster).toContain("SUZHOU SCIENCE&TECHNOLOGY TOWN FOREIGN LANGUAGE SCHOOL");
    expect(schoolRoster).toContain("suzhouscientificforeignlanguagehighschool");
    expect(schoolDirectory).toContain("mergeHomeSchools");
    expect(home.indexOf("HomeLeagueSchoolDirectory")).toBeLessThan(home.indexOf("Platform thesis"));
  });

  it("keeps the League panel free from a second hand-positioned school map", () => {
    expect(home).toContain("LeagueNetworkMotif");
    expect(home).not.toContain("SchoolCityMap");
    expect(home).not.toContain("league-cities-map.png");
  });

  it("keeps Explore intentionally short and sends League organisation to its own home", () => {
    for (const label of ["Start from the world", "Make a mechanism visible", "Run a controlled counterfactual", "Test the claim"]) {
      expect(explore).toContain(`title: "${label}"`);
    }
    expect(explore).toContain("League is where schools and Teams compete");
  });
});
