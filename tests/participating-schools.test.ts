import { describe, expect, it } from "vitest";
import { PARTICIPATING_SCHOOLS, participatingSchoolKey } from "@/lib/league/participating-schools";

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
});
