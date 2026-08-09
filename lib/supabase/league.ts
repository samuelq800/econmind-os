import type { CrisisDecision, CrisisRun, LeagueApplication, LeagueContext, LeaguePlatformRole, LeagueProfile, School, Team, TeamMember } from "@/lib/league/types";
import { getSupabaseBrowserClient } from "./client";

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function getLeagueContext(userId: string): Promise<LeagueContext> {
  const supabase = client();
  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from("profiles").select("user_id,display_name,platform_role,school_id,graduation_year,economics_club_name,role_preference,created_at,updated_at").eq("user_id", userId).maybeSingle(),
    supabase
      .from("team_members")
      .select("*, team:teams(*, school:schools(*))")
      .eq("user_id", userId)
      .order("joined_at")
      .limit(1),
  ]);
  fail(profileError); fail(membershipError);
  const typedProfile = profile as LeagueProfile | null;
  const typedMembership = (membership?.[0] ?? null) as TeamMember | null;
  let school: School | null = typedMembership?.team?.school ?? null;
  if (!school && typedProfile?.school_id) {
    const { data, error } = await supabase.from("schools").select("*").eq("id", typedProfile.school_id).maybeSingle();
    fail(error); school = data as School | null;
  }
  return { profile: typedProfile, school, membership: typedMembership };
}

export async function updateLeagueProfile(input: Pick<LeagueProfile, "display_name" | "graduation_year" | "economics_club_name" | "role_preference">) {
  const { data, error } = await client().from("profiles").update(input).eq("user_id", (await client().auth.getUser()).data.user?.id ?? "").select("user_id,display_name,platform_role,school_id,graduation_year,economics_club_name,role_preference,created_at,updated_at").single();
  fail(error); return data as LeagueProfile;
}

export async function listMyLeagueApplications() {
  const { data, error } = await client().from("league_applications").select("*").order("created_at", { ascending: false });
  fail(error); return (data ?? []) as LeagueApplication[];
}

export async function submitLeagueApplication(input: Omit<LeagueApplication, "id" | "applicant_user_id" | "status" | "reviewed_by" | "reviewed_at" | "created_at" | "updated_at">, userId: string) {
  const { data, error } = await client().from("league_applications").insert({ ...input, applicant_user_id: userId }).select("*").single();
  fail(error); return data as LeagueApplication;
}

export async function joinLeagueTeam(inviteCode: string) {
  const { data, error } = await client().rpc("join_team_by_invite", { p_invite_code: inviteCode });
  fail(error); return data as { team_id: string; team_name: string; school_id: string };
}

export async function createLeagueTeam(input: { schoolId: string; name: string }) {
  const { data, error } = await client().rpc("create_school_team", {
    p_school_id: input.schoolId,
    p_name: input.name,
  });
  fail(error); return data as Team;
}

export async function renameLeagueTeam(teamId: string, name: string) {
  const { data, error } = await client().rpc("rename_school_team", {
    p_team_id: teamId,
    p_name: name,
  });
  fail(error); return data as Team;
}

export async function setLeagueTeamStatus(teamId: string, status: Team["status"]) {
  const { data, error } = await client().rpc("set_school_team_status", {
    p_team_id: teamId,
    p_status: status,
  });
  fail(error); return data as Team;
}

export async function moveLeagueTeamMember(input: { userId: string; fromTeamId: string; toTeamId: string }) {
  const { error } = await client().rpc("move_school_team_member", {
    p_user_id: input.userId,
    p_from_team_id: input.fromTeamId,
    p_to_team_id: input.toTeamId,
  });
  fail(error);
}

export async function listSchoolTeams(schoolId: string) {
  const { data, error } = await client().from("teams").select("*, members:team_members(*, profile:profiles(user_id,display_name))").eq("school_id", schoolId).order("created_at");
  fail(error); return (data ?? []) as Array<Team & { members: TeamMember[] }>;
}

export async function saveCrisisRun(input: Omit<CrisisRun, "id" | "created_at" | "updated_at" | "completed_at" | "team">, decisions: CrisisDecision[]) {
  const { data: run, error: runError } = await client().from("crisis_runs").insert(input).select("*").single();
  fail(runError);
  const typedRun = run as CrisisRun;
  const { error: decisionsError } = await client().from("crisis_decisions").insert(decisions.map((decision) => ({ ...decision, crisis_run_id: typedRun.id })));
  fail(decisionsError);
  return typedRun;
}

export async function listMyCrisisRuns(userId: string, limit = 10) {
  const { data, error } = await client().from("crisis_runs").select("*, team:teams(id,name,school_id)").eq("user_id", userId).order("completed_at", { ascending: false }).limit(limit);
  fail(error); return (data ?? []) as CrisisRun[];
}

export async function listSchoolCrisisRuns(schoolId: string) {
  const { data, error } = await client().from("crisis_runs").select("*, team:teams!inner(id,name,school_id)").eq("teams.school_id", schoolId).order("completed_at", { ascending: false }).limit(50);
  fail(error); return (data ?? []) as CrisisRun[];
}

export async function listAdminLeagueApplications() {
  const { data, error } = await client().from("league_applications").select("*").order("created_at", { ascending: false });
  fail(error); return (data ?? []) as LeagueApplication[];
}

export async function reviewLeagueApplication(applicationId: string, status: "approved" | "rejected" | "under_review") {
  const { data, error } = await client().rpc("review_league_application", { p_application_id: applicationId, p_status: status });
  fail(error); return data as { application_id: string; status: LeagueApplication["status"]; school_id: string | null };
}

export async function listLeagueProfiles() {
  const { data, error } = await client().from("profiles").select("user_id,display_name,platform_role,school_id,graduation_year,economics_club_name,role_preference,created_at,updated_at").order("created_at", { ascending: false }).limit(100);
  fail(error); return (data ?? []) as LeagueProfile[];
}

export async function setLeaguePlatformRole(userId: string, role: LeaguePlatformRole) {
  const { error } = await client().rpc("set_league_platform_role", { p_user_id: userId, p_platform_role: role });
  fail(error);
}

export async function listLeagueSchools() {
  const { data, error } = await client().from("schools").select("*").order("created_at", { ascending: false });
  fail(error); return (data ?? []) as School[];
}

export async function listAdminCrisisRuns() {
  const { data, error } = await client().from("crisis_runs").select("id,user_id,team_id,total_score,completed_at").order("completed_at", { ascending: false }).limit(500);
  fail(error); return (data ?? []) as Array<Pick<CrisisRun, "id" | "user_id" | "team_id" | "total_score" | "completed_at">>;
}
