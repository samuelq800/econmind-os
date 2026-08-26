import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergeLeagueDirectory,
  withDirectorySyncTimeout,
} from "@/lib/league/school-directory";
import { buildSchoolNetworkModel, networkRegionForSchool } from "@/lib/league/school-network";
import type { PublicLeagueSchool } from "@/lib/supabase/league-directory";

function schoolRow(overrides: Partial<PublicLeagueSchool> = {}): PublicLeagueSchool {
  return {
    school_id: "school-extra",
    school_name: "Example School",
    club_name: null,
    city: null,
    description: null,
    logo_url: null,
    member_count: 0,
    team_count: 0,
    current_season_points: 0,
    official_challenge_count: 0,
    official_wins: 0,
    achievements: [],
    location_status: "missing",
    location_source: null,
    location_key: null,
    location_city: null,
    location_area_key: null,
    location_area_label: null,
    location_administrative_area: null,
    location_latitude: null,
    location_longitude: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("shared League school directory model", () => {
  it("conserves the complete roster across map, region and detailed-list totals", () => {
    const model = buildSchoolNetworkModel(mergeLeagueDirectory([]));
    const regionCounts = Object.fromEntries(
      model.regionGroups.map((group) => [group.label, group.entries.length]),
    );

    expect(model.schoolCount).toBe(28);
    expect(model.mappedSchoolCount).toBe(27);
    expect(model.mappedCityCount).toBe(16);
    expect(model.geographicRegionCount).toBe(6);
    expect(model.unclassifiedEntries).toHaveLength(1);
    expect(regionCounts).toEqual({
      "East China": 13,
      "North China": 5,
      "South China": 5,
      "West China": 2,
      "Central China": 1,
      "Other locations": 1,
    });
    expect(networkRegionForSchool(
      model.schools.find(({ school_name }) => school_name === "Victoria World Academy")!,
    )).toBe("Other locations");
    expect(model.directoryGroups.flatMap((group) => group.entries)).toHaveLength(model.schoolCount);
  });

  it.each([null, "", "   ", "Suzohu", "Singapore"])(
    "does not let an untrusted live city (%s) move a verified roster school",
    (city) => {
      const directory = mergeLeagueDirectory([
        schoolRow({
          school_id: "school-beijing",
          school_name: "Beijing Academy International Department",
          city,
        }),
      ]);
      const school = directory.find(({ school_id }) => school_id === "school-beijing");

      expect(school).toMatchObject({
        city: "Beijing",
        mapLocationKey: "geonames:1816670",
        locationSource: "verified-roster",
      });
    },
  );

  it("keeps a new free-text city in the register but off the strict map", () => {
    const directory = mergeLeagueDirectory([
      schoolRow({ school_id: "school-new", school_name: "New Suzhou School", city: "Suzhou" }),
    ]);
    const model = buildSchoolNetworkModel(directory);
    const added = directory.find(({ school_id }) => school_id === "school-new");

    expect(added).toMatchObject({ city: "Suzhou", mapLocationKey: null, locationSource: "unverified" });
    expect(model.schoolCount).toBe(29);
    expect(model.mappedSchoolCount).toBe(27);
    expect(model.unclassifiedEntries.map(({ school }) => school.school_id)).toContain("school-new");
  });

  it("plots a new school only when the public directory supplies a verified canonical place", () => {
    const directory = mergeLeagueDirectory([
      schoolRow({
        school_id: "school-verified-new",
        school_name: "Verified New School",
        city: "Rotterdam",
        location_status: "verified",
        location_source: "admin_review",
        location_key: "geonames:2747891",
        location_city: "Rotterdam",
        location_area_key: "geoarea:NL",
        location_area_label: "Netherlands",
        location_administrative_area: "South Holland",
        location_latitude: 51.9225,
        location_longitude: 4.47917,
      }),
    ]);
    const model = buildSchoolNetworkModel(directory);
    const added = directory.find(({ school_id }) => school_id === "school-verified-new");

    expect(added).toMatchObject({
      mapLocationKey: "geonames:2747891",
      locationSource: "verified-directory",
    });
    expect(model.mappedSchoolCount).toBe(28);
    expect(model.regionGroups.find(({ label }) => label === "Other locations")?.entries).toHaveLength(2);
    expect(networkRegionForSchool(added!)).toBe("Other locations");
  });

  it("lets a verified directory location resolve the one pending editorial roster school", () => {
    const pendingRosterName = "International Department of The Affliated High School of South Normal University";
    const directory = mergeLeagueDirectory([
      schoolRow({
        school_id: "school-pending-roster",
        school_name: pendingRosterName,
        city: "Guangzhou",
        location_status: "verified",
        location_source: "admin_review",
        location_key: "geonames:1809858",
        location_city: "Guangzhou",
        location_area_key: "geoarea:CN",
        location_area_label: "China — mainland areas",
        location_administrative_area: "Guangdong",
        location_latitude: 23.11667,
        location_longitude: 113.25,
      }),
    ]);
    const model = buildSchoolNetworkModel(directory);
    const school = directory.find(({ school_id }) => school_id === "school-pending-roster");

    expect(model.schoolCount).toBe(28);
    expect(model.mappedSchoolCount).toBe(28);
    expect(model.unclassifiedEntries).toHaveLength(0);
    expect(school).toMatchObject({
      city: "Guangzhou",
      mapLocationKey: "geonames:1809858",
      locationSource: "verified-directory",
    });
    expect(networkRegionForSchool(school!)).toBe("South China");
  });

  it("keeps the pending editorial roster school off-map when canonical data is malformed", () => {
    const directory = mergeLeagueDirectory([
      schoolRow({
        school_id: "school-pending-roster-malformed",
        school_name: "International Department of The Affliated High School of South Normal University",
        city: "Guangzhou",
        location_status: "verified",
        location_source: "admin_review",
        location_key: "geonames:1809858",
        location_city: "Guangzhou",
        location_area_key: "geoarea:CN",
        location_area_label: "China — mainland areas",
        location_administrative_area: "Guangdong",
        location_latitude: 190,
        location_longitude: 113.25,
      }),
    ]);
    const model = buildSchoolNetworkModel(directory);

    expect(model.schoolCount).toBe(28);
    expect(model.mappedSchoolCount).toBe(27);
    expect(model.unclassifiedEntries.map(({ school }) => school.school_id))
      .toEqual(["school-pending-roster-malformed"]);
  });

  it("does not let a conflicting dynamic location move a reviewed roster school", () => {
    const directory = mergeLeagueDirectory([
      schoolRow({
        school_id: "school-beijing-canonical-conflict",
        school_name: "Beijing Academy International Department",
        city: "Rotterdam",
        location_status: "verified",
        location_source: "admin_review",
        location_key: "geonames:2747891",
        location_city: "Rotterdam",
        location_area_key: "geoarea:NL",
        location_area_label: "Netherlands",
        location_administrative_area: "South Holland",
        location_latitude: 51.9225,
        location_longitude: 4.47917,
      }),
    ]);
    const school = directory.find(({ school_id }) => school_id === "school-beijing-canonical-conflict");

    expect(school).toMatchObject({
      city: "Beijing",
      mapLocationKey: "geonames:1816670",
      locationSource: "verified-roster",
    });
    expect(networkRegionForSchool(school!)).toBe("North China");
  });

  it("withholds malformed canonical data even when a row claims to be verified", () => {
    const directory = mergeLeagueDirectory([
      schoolRow({
        school_id: "school-malformed-location",
        school_name: "Malformed Location School",
        location_status: "verified",
        location_source: "admin_review",
        location_key: "geonames:1234",
        location_city: "Somewhere",
        location_area_key: "geoarea:ZZ",
        location_area_label: "Other or not listed area — manual review",
        location_latitude: 190,
        location_longitude: 4,
      }),
    ]);
    const model = buildSchoolNetworkModel(directory);
    const added = directory.find(({ school_id }) => school_id === "school-malformed-location");

    expect(added).toMatchObject({ mapLocationKey: null, locationSource: "unverified" });
    expect(model.unclassifiedEntries.map(({ school }) => school.school_id)).toContain("school-malformed-location");
  });

  it.each([
    ["non-string key", { location_key: 1234 as unknown as string }],
    ["unsafe GeoNames ID", { location_key: "geonames:9999999999999999999" }],
    ["one-character city", { location_city: "X" }],
    ["missing area label", { location_area_label: null }],
    ["overlong administrative area", { location_administrative_area: "A".repeat(101) }],
    ["NaN latitude", { location_latitude: Number.NaN }],
    ["infinite longitude", { location_longitude: Number.POSITIVE_INFINITY }],
  ])("fails closed for runtime-malformed canonical data: %s", (_label, malformed) => {
    const directory = mergeLeagueDirectory([
      schoolRow({
        school_id: "school-runtime-malformed",
        school_name: "Runtime Malformed School",
        location_status: "verified",
        location_source: "admin_review",
        location_key: "geonames:2747891",
        location_city: "Rotterdam",
        location_area_key: "geoarea:NL",
        location_area_label: "Netherlands",
        location_administrative_area: "South Holland",
        location_latitude: 51.9225,
        location_longitude: 4.47917,
        ...malformed,
      }),
    ]);
    const school = directory.find(({ school_id }) => school_id === "school-runtime-malformed");

    expect(school).toMatchObject({ mapLocationKey: null, locationSource: "unverified" });
    expect(() => buildSchoolNetworkModel(directory)).not.toThrow();
  });

  it("accepts valid coordinate boundary values without coercion", () => {
    const directory = mergeLeagueDirectory([
      schoolRow({
        school_id: "school-boundary-location",
        school_name: "Boundary Location School",
        location_status: "verified",
        location_source: "admin_review",
        location_key: "geonames:1",
        location_city: "Boundary City",
        location_area_key: "geoarea:ZZ",
        location_area_label: "Other or not listed area — manual review",
        location_administrative_area: null,
        location_latitude: -90,
        location_longitude: 180,
      }),
    ]);

    expect(directory.find(({ school_id }) => school_id === "school-boundary-location"))
      .toMatchObject({ mapLocationKey: "geonames:1", locationSource: "verified-directory" });
  });

  it("deduplicates repeated RPC rows and reviewed school aliases before counting", () => {
    const repeated = schoolRow({ school_id: "school-new", school_name: "New School", city: "Beijing" });
    const alias = schoolRow({ school_id: "school-baid", school_name: "BAID", city: "Beijing" });
    const directory = mergeLeagueDirectory([repeated, repeated, alias]);
    const model = buildSchoolNetworkModel(directory);

    expect(directory).toHaveLength(29);
    expect(model.schoolCount).toBe(29);
    expect(directory.filter(({ school_id }) => school_id === "school-baid")).toHaveLength(1);
    expect(directory.find(({ school_id }) => school_id === "school-baid")?.school_name)
      .toBe("Beijing Academy International Department");
    expect(directory.find(({ school_id }) => school_id === "school-baid")?.isEditorialOnly).toBe(false);
  });

  it("distinguishes static roster placeholders from persisted roster profiles", () => {
    const staticRoster = mergeLeagueDirectory([]);
    const registeredRoster = mergeLeagueDirectory([
      schoolRow({
        school_id: "school-beijing",
        school_name: "Beijing Academy International Department",
        city: "Beijing",
      }),
    ]);

    expect(staticRoster.find(({ school_name }) => school_name === "Beijing Academy International Department")?.isEditorialOnly)
      .toBe(true);
    expect(registeredRoster.find(({ school_id }) => school_id === "school-beijing")?.isEditorialOnly)
      .toBe(false);
  });

  it("retains distinct same-name schools while ignoring duplicate IDs and malformed rows", () => {
    const duplicateNameA = schoolRow({ school_id: "school-a", school_name: "Duplicate School" });
    const duplicateNameB = schoolRow({ school_id: "school-b", school_name: "Duplicate School" });
    const malformed = schoolRow({ school_id: "school-bad", school_name: null as unknown as string });
    const directory = mergeLeagueDirectory([duplicateNameA, duplicateNameA, duplicateNameB, malformed]);

    expect(directory).toHaveLength(30);
    expect(directory.filter(({ school_name }) => school_name === "Duplicate School")).toHaveLength(2);
  });

  it("times out a stalled live sync without waiting forever", async () => {
    vi.useFakeTimers();
    const stalled = new Promise<never>(() => undefined);
    const result = withDirectorySyncTimeout(stalled, 50);
    const rejection = expect(result).rejects.toThrow("League directory sync timed out.");

    await vi.advanceTimersByTimeAsync(50);
    await rejection;
  });
});
