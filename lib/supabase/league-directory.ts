import type { School } from "@/lib/league/types";
import { getSupabaseBrowserClient } from "./client";

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

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listPublicLeagueSchools() {
  const { data, error } = await client().rpc("get_public_league_directory");
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
