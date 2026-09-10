import { describe, expect, it } from "vitest";
import {
  isParticipatingUniversity,
  PARTICIPATING_SCHOOLS,
  PARTICIPATING_UNIVERSITY_NAMES,
  participatingSchoolKey,
} from "@/lib/league/participating-schools";

describe("participating school identities", () => {
  it("keeps the reviewed aliases within their agreed canonical school identities", () => {
    expect(participatingSchoolKey("BAID")).toBe(participatingSchoolKey("Beijing Academy International Department"));
    expect(participatingSchoolKey("南外仙林分校")).toBe(participatingSchoolKey("Nanjing Foreign Language School, Xianlin Campus"));
    expect(participatingSchoolKey("苏州一中")).toBe(participatingSchoolKey("Suzhou No.1 High School"));
    expect(participatingSchoolKey("Suzhou Scientific Foreign Language High School")).toBe(participatingSchoolKey("SUZHOU SCIENCE&TECHNOLOGY TOWN FOREIGN LANGUAGE SCHOOL"));
  });

  it("retains one canonical roster entry for each reviewed school identity", () => {
    const keys = PARTICIPATING_SCHOOLS.map((school) => participatingSchoolKey(school.name));
    expect(new Set(keys).size).toBe(PARTICIPATING_SCHOOLS.length);
  });

  it("keeps the university partners as an explicit public category", () => {
    expect(PARTICIPATING_UNIVERSITY_NAMES).toEqual([
      "Shanghai International Studies University",
      "The University of Melbourne",
      "Duke University",
      "University of Cambridge",
      "UCLA",
    ]);
    expect(PARTICIPATING_UNIVERSITY_NAMES.every((name) => isParticipatingUniversity(name))).toBe(true);
    expect(PARTICIPATING_SCHOOLS.filter((school) => isParticipatingUniversity(school.name))).toHaveLength(5);
  });
});
