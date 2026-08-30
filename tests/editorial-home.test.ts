import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync("components/home/editorial-home.tsx", "utf8");
const schoolDirectory = readFileSync("components/home/home-league-school-directory.tsx", "utf8");
const mappedSchoolRegister = readFileSync("components/home/home-mapped-school-register.tsx", "utf8");
const schoolNetworkMap = readFileSync("components/home/home-school-network-map.tsx", "utf8");
const schoolLedger = readFileSync("components/league/school-directory-ledger.tsx", "utf8");
const leagueSchools = readFileSync("components/league/league-schools.tsx", "utf8");
const schoolDirectoryModel = readFileSync("lib/league/school-directory.ts", "utf8");
const schoolRoster = readFileSync("lib/league/participating-schools.ts", "utf8");
const worldLand = readFileSync("public/league/maps/world-land.svg", "utf8");
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

  it("combines the live League directory with its complete public roster", () => {
    expect(home).toContain("HomeLeagueSchoolDirectory");
    expect(home).not.toContain("PARTICIPATING_SCHOOLS");
    expect(schoolDirectory).toContain("listPublicLeagueSchools");
    expect(schoolDirectoryModel).toContain("PARTICIPATING_SCHOOLS");
    expect(schoolDirectory).toContain("mergeLeagueDirectory([])");
    expect(schoolDirectory).toContain("verified city key");
    expect(schoolNetworkMap).toContain("school.school_name");
    expect(schoolRoster).toContain("HD Ningbo School");
    expect(schoolRoster).toContain("MalvernCollegeQingdao");
    expect(schoolRoster).toContain("SUZHOU SCIENCE&TECHNOLOGY TOWN FOREIGN LANGUAGE SCHOOL");
    expect(schoolRoster).toContain("suzhouscientificforeignlanguagehighschool");
    expect(schoolDirectory).toContain("withDirectorySyncTimeout");
    expect(home.indexOf("HomeLeagueSchoolDirectory")).toBeLessThan(home.indexOf("Platform thesis"));
  });

  it("uses a land-only world distribution plate instead of a school-card wall", () => {
    expect(schoolDirectory).toContain("HomeSchoolNetworkMap");
    expect(schoolDirectory).toContain("HomeMappedSchoolRegister");
    expect(mappedSchoolRegister).toContain("Mapped school register");
    expect(mappedSchoolRegister).toContain("Every school with a reviewed city coordinate");
    expect(schoolDirectory).not.toContain("home-schools-grid");
    expect(schoolNetworkMap).toContain("/league/maps/world-land.svg");
    expect(schoolNetworkMap).toContain("buildSchoolNetworkModel");
    expect(schoolNetworkMap).toContain("Partner network");
    expect(schoolNetworkMap).not.toContain("SchoolDirectoryLedger");
    expect(schoolNetworkMap).toContain('href="/league/schools/"');
    expect(schoolLedger).toContain("Complete school register");
    expect(leagueSchools).toContain("SchoolDirectoryLedger");
    expect(leagueSchools).not.toContain("decodeURIComponent");
    expect(leagueSchools).toContain("school.isEditorialOnly");
    expect(leagueSchools).toContain('teamsStatus === "fallback"');
    expect(schoolNetworkMap).toContain("National borders are intentionally omitted");
    expect(schoolNetworkMap).toContain("not campus addresses");
    expect(worldLand).toContain('viewBox="0 0 360 180"');
    expect(worldLand).toContain('id="world-land"');
    expect(worldLand).not.toMatch(/<(?:line|polyline)\b/i);
    expect(worldLand).not.toMatch(/\bstroke\s*=/i);
  });

  it("keeps the League panel free from the old hand-positioned China map", () => {
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
