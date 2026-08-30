import { describe, expect, it } from "vitest";
import { PARTICIPATING_SCHOOLS } from "@/lib/league/participating-schools";
import {
  SCHOOL_CITY_LOCATIONS,
  SCHOOL_LOCATION_SOURCE,
  resolveSchoolLocation,
} from "@/lib/league/school-locations";

describe("school city location catalog", () => {
  it("maps every geographic city in the existing roster and leaves placeholders unresolved", () => {
    const unresolved = PARTICIPATING_SCHOOLS.filter(
      (school) => resolveSchoolLocation(school.city).status === "unresolved",
    );

    expect(unresolved).toEqual([
      expect.objectContaining({
        city: "League partner",
        name: "International Department of The Affliated High School of South Normal University",
      }),
    ]);
    expect(resolveSchoolLocation("League partner")).toEqual({
      status: "unresolved",
      input: "League partner",
      reason: "non-geographic-label",
    });
  });

  it("uses stable GeoNames IDs as aggregation keys", () => {
    expect(
      Object.fromEntries(SCHOOL_CITY_LOCATIONS.map(({ city, locationKey }) => [city, locationKey])),
    ).toMatchObject({
      Melbourne: "geonames:2158177",
      Beijing: "geonames:1816670",
      Chengdu: "geonames:1815286",
      Chongqing: "geonames:1814906",
      Hangzhou: "geonames:1808926",
      Jinan: "geonames:1805753",
      Nanchang: "geonames:1800163",
      Nanjing: "geonames:1799962",
      Nanning: "geonames:1799869",
      Ningbo: "geonames:1799397",
      Qingdao: "geonames:1797929",
      Shanghai: "geonames:1796236",
      Shenzhen: "geonames:1795565",
      Singapore: "geonames:1880252",
      Suzhou: "geonames:1886760",
      Wuxi: "geonames:1790923",
      Zhuhai: "geonames:1790437",
    });

    const suzhouKeys = PARTICIPATING_SCHOOLS.filter(({ city }) => city === "Suzhou").map((school) => {
      const resolution = resolveSchoolLocation(school.city);
      return resolution.status === "resolved" ? resolution.location.locationKey : null;
    });

    expect(new Set(suzhouKeys)).toEqual(new Set(["geonames:1886760"]));
  });

  it("batch-resolves the current roster without per-school coordinate work", () => {
    const countsByCity = new Map<string, number>();
    let mappedSchoolCount = 0;

    for (const school of PARTICIPATING_SCHOOLS) {
      const resolution = resolveSchoolLocation(school.city);
      if (resolution.status !== "resolved") continue;

      mappedSchoolCount += 1;
      countsByCity.set(
        resolution.location.city,
        (countsByCity.get(resolution.location.city) ?? 0) + 1,
      );
    }

    expect(mappedSchoolCount).toBe(27);
    expect(countsByCity.size).toBe(16);
    expect(Object.fromEntries(countsByCity)).toMatchObject({
      Beijing: 5,
      Shenzhen: 3,
      Singapore: 1,
      Suzhou: 4,
    });
  });

  it("normalises harmless formatting but never fuzzy-matches an unknown city", () => {
    expect(resolveSchoolLocation("  SUZHOU  ")).toMatchObject({
      status: "resolved",
      location: { locationKey: "geonames:1886760" },
    });
    expect(resolveSchoolLocation("Suzohu")).toEqual({
      status: "unresolved",
      input: "Suzohu",
      reason: "unrecognised-city",
    });
    expect(resolveSchoolLocation(" ")).toEqual({
      status: "unresolved",
      input: " ",
      reason: "missing-city",
    });
  });

  it("keeps valid WGS84 coordinates and auditable source metadata", () => {
    expect(SCHOOL_CITY_LOCATIONS).toHaveLength(25);
    expect(new Set(SCHOOL_CITY_LOCATIONS.map(({ locationKey }) => locationKey)).size).toBe(25);

    for (const location of SCHOOL_CITY_LOCATIONS) {
      expect(location.locationKey).toBe(`geonames:${location.geonameId}`);
      expect(location.latitude).toBeGreaterThanOrEqual(-90);
      expect(location.latitude).toBeLessThanOrEqual(90);
      expect(location.longitude).toBeGreaterThanOrEqual(-180);
      expect(location.longitude).toBeLessThanOrEqual(180);
    }

    expect(SCHOOL_LOCATION_SOURCE).toMatchObject({
      name: "GeoNames",
      dataset: "cities15000",
      coordinateReferenceSystem: "WGS84",
      license: "CC BY 4.0",
    });
  });
});
