import type { School } from "@/lib/league/types";
import {
  requireSupabaseBrowserClient as client,
  throwIfSupabaseError as fail,
} from "./client";

export type PublicLeagueSchool = {
  school_id: string;
  school_name: string;
  club_name: string | null;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  member_count: number;
  team_count: number;
  current_season_points: number;
  official_challenge_count: number;
  official_wins: number;
  achievements: string[];
  location_status: "missing" | "verified" | "needs_correction";
  location_source: "verified_roster_backfill" | "application_review" | "admin_review" | null;
  location_key: string | null;
  location_city: string | null;
  location_area_key: string | null;
  location_area_label: string | null;
  location_administrative_area: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
};

export type PublicLeagueTeam = {
  team_id: string;
  team_name: string;
  team_slug: string;
  school_id: string;
  school_name: string;
  captain_name: string | null;
  member_count: number;
  current_season_points: number;
  official_challenge_count: number;
  official_wins: number;
  continuous_world_country: string | null;
};

type PublicLeagueSchoolRpcRow = Omit<PublicLeagueSchool, "member_count" | "team_count" | "current_season_points" | "official_challenge_count" | "official_wins" | "achievements"> & {
  member_count: number | string | null;
  team_count: number | string | null;
  current_season_points: number | string | null;
  official_challenge_count: number | string | null;
  official_wins: number | string | null;
  achievements: unknown;
};

type PublicLeagueTeamRpcRow = Omit<PublicLeagueTeam, "member_count" | "current_season_points" | "official_challenge_count" | "official_wins"> & {
  member_count: number | string | null;
  current_season_points: number | string | null;
  official_challenge_count: number | string | null;
  official_wins: number | string | null;
};

export async function listPublicLeagueSchools() {
  const supabase = client();
  let { data, error } = await supabase.rpc("get_public_league_directory_v2");
  let legacyResponse = false;
  if (error) {
    const legacy = await supabase.rpc("get_public_league_directory");
    data = legacy.data;
    error = legacy.error;
    legacyResponse = true;
  }
  fail(error);
  const rows = (data ?? []) as PublicLeagueSchoolRpcRow[];
  return rows.map((row) => {
    const achievementValues: unknown[] = Array.isArray(row.achievements) ? row.achievements : [];
    return {
    ...row,
    member_count: Number(row.member_count ?? 0),
    team_count: Number(row.team_count ?? 0),
    current_season_points: Number(row.current_season_points ?? 0),
    official_challenge_count: Number(row.official_challenge_count ?? 0),
    official_wins: Number(row.official_wins ?? 0),
    achievements: achievementValues.filter((item): item is string => typeof item === "string"),
    location_status: legacyResponse ? "missing" : row.location_status,
    location_source: legacyResponse ? null : row.location_source,
    location_key: legacyResponse ? null : row.location_key,
    location_city: legacyResponse ? null : row.location_city,
    location_area_key: legacyResponse ? null : row.location_area_key,
    location_area_label: legacyResponse ? null : row.location_area_label,
    location_administrative_area: legacyResponse ? null : row.location_administrative_area,
    location_latitude: legacyResponse || row.location_latitude == null ? null : Number(row.location_latitude),
    location_longitude: legacyResponse || row.location_longitude == null ? null : Number(row.location_longitude),
  };
  }) as PublicLeagueSchool[];
}

export async function listPublicLeagueTeams() {
  const { data, error } = await client().rpc("get_public_league_teams");
  fail(error);
  const rows = (data ?? []) as PublicLeagueTeamRpcRow[];
  return rows.map((row) => ({
    ...row,
    member_count: Number(row.member_count ?? 0),
    current_season_points: Number(row.current_season_points ?? 0),
    official_challenge_count: Number(row.official_challenge_count ?? 0),
    official_wins: Number(row.official_wins ?? 0),
  })) as PublicLeagueTeam[];
}

export async function updateLeagueSchoolProfile(input: {
  schoolId: string;
  description: string;
  logoUrl: string | null;
}) {
  const { data, error } = await client().rpc("update_league_school_profile", {
    p_school_id: input.schoolId,
    p_description: input.description,
    p_logo_url: input.logoUrl,
  });
  fail(error);
  return data as School;
}
