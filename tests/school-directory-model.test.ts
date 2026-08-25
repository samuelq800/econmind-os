import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergeLeagueDirectory,
  withDirectorySyncTimeout,
} from "@/lib/league/school-directory";
import { buildSchoolNetworkModel } from "@/lib/league/school-network";
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
      International: 1,
    });
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
