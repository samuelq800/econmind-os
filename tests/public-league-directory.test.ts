import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => {
    const client = mocks.getClient();
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  },
  throwIfSupabaseError: (error: { message: string } | null | undefined) => {
    if (error) throw new Error(error.message);
  },
}));

import { mergeLeagueDirectory } from "@/lib/league/school-directory";
import { buildSchoolNetworkModel } from "@/lib/league/school-network";
import { listPublicLeagueSchools } from "@/lib/supabase/league-directory";

const legacySchool = {
  school_id: "school-reviewed-rotterdam",
  school_name: "Reviewed Rotterdam School",
  club_name: null,
  city: "Rotterdam",
  description: null,
  logo_url: null,
  member_count: "12",
  team_count: "3",
  current_season_points: "42.5",
  official_challenge_count: "7",
  official_wins: "2",
  achievements: ["first-challenge", null, 123],
};

function directoryRow(overrides: Record<string, unknown> = {}) {
  return {
    ...legacySchool,
    location_status: "verified",
    location_source: "admin_review",
    location_key: "geonames:2747891",
    location_city: "Rotterdam",
    location_area_key: "geoarea:NL",
    location_area_label: "Netherlands",
    location_administrative_area: "South Holland",
    location_latitude: "51.9225",
    location_longitude: "4.47917",
    ...overrides,
  };
}

const unavailable = {
  code: "503",
  message: "Service temporarily unavailable",
};

const missingDirectoryRpc = {
  code: "PGRST202",
  message: "Could not find the function public.get_public_league_directory_v2 without parameters in the schema cache",
};

describe("public League directory RPC", () => {
  beforeEach(() => mocks.getClient.mockReset());

  it("normalizes v2 numeric fields and preserves the reviewed canonical location", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [directoryRow()], error: null });
    mocks.getClient.mockReturnValue({ rpc });

    const schools = await listPublicLeagueSchools();

    expect(rpc.mock.calls).toEqual([["get_public_league_directory_v2"]]);
    expect(schools).toEqual([expect.objectContaining({
      school_id: legacySchool.school_id,
      member_count: 12,
      team_count: 3,
      current_season_points: 42.5,
      official_challenge_count: 7,
      official_wins: 2,
      achievements: ["first-challenge"],
      location_status: "verified",
      location_source: "admin_review",
      location_key: "geonames:2747891",
      location_city: "Rotterdam",
      location_area_key: "geoarea:NL",
      location_area_label: "Netherlands",
      location_administrative_area: "South Holland",
      location_latitude: 51.9225,
      location_longitude: 4.47917,
    })]);
  });

  it("retries a transient 503 without turning a reviewed school into Location pending", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: unavailable, status: 503 })
      .mockResolvedValueOnce({ data: [directoryRow()], error: null });
    mocks.getClient.mockReturnValue({ rpc });

    const schools = await listPublicLeagueSchools();
    const model = buildSchoolNetworkModel(mergeLeagueDirectory(schools));
    const reviewedSchool = model.schools.find(({ school_id }) => school_id === legacySchool.school_id);

    expect(rpc.mock.calls).toEqual([
      ["get_public_league_directory_v2"],
      ["get_public_league_directory_v2"],
    ]);
    expect(reviewedSchool).toMatchObject({
      location_status: "verified",
      locationSource: "verified-directory",
      mapLocationKey: "geonames:2747891",
    });
    expect(model.hubs.find(({ location }) => location.locationKey === "geonames:2747891")?.schools)
      .toContainEqual(reviewedSchool);
    expect(model.unclassifiedEntries.some(({ school }) => school.school_id === legacySchool.school_id))
      .toBe(false);
  });

  it.each([
    ["persistent service error", unavailable],
    ["permission error", { code: "42501", message: "permission denied for table school_location_catalog" }],
    ["missing internal function", {
      code: "PGRST202",
      message: "Could not find the function public.some_internal_directory_helper without parameters in the schema cache",
    }],
    ["similarly named missing function", {
      code: "PGRST202",
      message: "Could not find the function public.get_public_league_directory_v2_helper without parameters in the schema cache",
    }],
  ])("surfaces a %s after one retry without falling back to location-less data", async (_label, error) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    mocks.getClient.mockReturnValue({ rpc });

    await expect(listPublicLeagueSchools()).rejects.toThrow(error.message);

    expect(rpc.mock.calls).toEqual([
      ["get_public_league_directory_v2"],
      ["get_public_league_directory_v2"],
    ]);
  });

  it("supports legacy rows only when the v2 RPC itself is missing after a retry", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: missingDirectoryRpc })
      .mockResolvedValueOnce({ data: null, error: missingDirectoryRpc })
      .mockResolvedValueOnce({ data: [legacySchool], error: null });
    mocks.getClient.mockReturnValue({ rpc });

    const schools = await listPublicLeagueSchools();

    expect(rpc.mock.calls).toEqual([
      ["get_public_league_directory_v2"],
      ["get_public_league_directory_v2"],
      ["get_public_league_directory"],
    ]);
    expect(schools).toEqual([expect.objectContaining({
      school_id: legacySchool.school_id,
      city: "Rotterdam",
      member_count: 12,
      team_count: 3,
      location_status: "missing",
      location_source: null,
      location_key: null,
      location_city: null,
      location_area_key: null,
      location_area_label: null,
      location_administrative_area: null,
      location_latitude: null,
      location_longitude: null,
    })]);
    const model = buildSchoolNetworkModel(mergeLeagueDirectory(schools));
    expect(model.unclassifiedEntries.some(({ school }) => school.school_id === legacySchool.school_id))
      .toBe(true);
  });

  it("removes a withdrawn location after a later successful response marks it missing", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [directoryRow()], error: null })
      .mockResolvedValueOnce({ data: [directoryRow({
        location_status: "missing",
        location_source: null,
        location_key: null,
        location_city: null,
        location_area_key: null,
        location_area_label: null,
        location_administrative_area: null,
        location_latitude: null,
        location_longitude: null,
      })], error: null });
    mocks.getClient.mockReturnValue({ rpc });

    const beforeReview = buildSchoolNetworkModel(mergeLeagueDirectory(await listPublicLeagueSchools()));
    const afterReview = buildSchoolNetworkModel(mergeLeagueDirectory(await listPublicLeagueSchools()));

    expect(beforeReview.unclassifiedEntries.some(({ school }) => school.school_id === legacySchool.school_id))
      .toBe(false);
    expect(afterReview.unclassifiedEntries.find(({ school }) => school.school_id === legacySchool.school_id)?.school)
      .toMatchObject({ location_status: "missing", locationSource: "unverified", mapLocationKey: null });
    expect(afterReview.mappedSchoolCount).toBe(beforeReview.mappedSchoolCount - 1);
    expect(afterReview.hubs.some(({ schools }) => schools.some(({ school_id }) => school_id === legacySchool.school_id)))
      .toBe(false);
    expect(rpc.mock.calls).toEqual([
      ["get_public_league_directory_v2"],
      ["get_public_league_directory_v2"],
    ]);
  });
});
