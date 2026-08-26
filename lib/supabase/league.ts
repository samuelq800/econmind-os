import type { CrisisDecision, CrisisRun, LeagueApplication, LeagueContext, LeaguePlatformRole, LeagueProfile, School, Team, TeamMember } from "@/lib/league/types";
import type { CurriculumSystem } from "@/lib/league/curriculum";
import type { CanonicalSchoolLocationInput, SchoolLocationSubmission } from "@/lib/league/geographic-areas";
import { getSupabaseBrowserClient } from "./client";

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

function normaliseLeagueApplication(row: Partial<LeagueApplication>): LeagueApplication {
  return {
    ...row,
    submitted_area_key: row.submitted_area_key ?? null,
    submitted_area_label: row.submitted_area_label ?? null,
    submitted_administrative_area: row.submitted_administrative_area ?? null,
    submitted_city: row.submitted_city ?? null,
    location_status: row.location_status ?? "missing",
    location_key: row.location_key ?? null,
    location_source: row.location_source ?? null,
    location_public_note: row.location_public_note ?? null,
    location_reviewed_by: row.location_reviewed_by ?? null,
    location_reviewed_at: row.location_reviewed_at ?? null,
  } as LeagueApplication;
}

export async function getLeagueContext(userId: string): Promise<LeagueContext> {
  const supabase = client();
  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from("profiles").select("user_id,display_name,role,platform_role,school_id,graduation_year,economics_club_name,role_preference,created_at,updated_at").eq("user_id", userId).maybeSingle(),
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
  const { data, error } = await client().from("profiles").update(input).eq("user_id", (await client().auth.getUser()).data.user?.id ?? "").select("user_id,display_name,role,platform_role,school_id,graduation_year,economics_club_name,role_preference,created_at,updated_at").single();
  fail(error); return data as LeagueProfile;
}

export async function listMyLeagueApplications() {
  const { data, error } = await client().from("league_applications").select("*").order("created_at", { ascending: false });
  fail(error); return (data ?? []).map((row) => normaliseLeagueApplication(row as Partial<LeagueApplication>));
}

export type SubmitLeagueApplicationInput = Pick<
  LeagueApplication,
  "school_name" | "club_name" | "contact_person" | "curriculum_system" | "expected_teams" | "expected_members" | "preferred_language" | "preferred_format" | "organising_committee_interest" | "notes"
> & { location: SchoolLocationSubmission };

export async function submitLeagueApplication(input: SubmitLeagueApplicationInput) {
  const { data, error } = await client().rpc("submit_league_application", {
    p_school_name: input.school_name,
    p_club_name: input.club_name,
    p_contact_person: input.contact_person,
    p_curriculum_system: input.curriculum_system,
    p_expected_teams: input.expected_teams,
    p_expected_members: input.expected_members,
    p_preferred_language: input.preferred_language,
    p_preferred_format: input.preferred_format,
    p_organising_committee_interest: input.organising_committee_interest,
    p_notes: input.notes,
    p_submitted_area_key: input.location.areaKey,
    p_submitted_area_label: input.location.areaLabel,
    p_submitted_administrative_area: input.location.administrativeArea || null,
    p_submitted_city: input.location.city,
  });
  fail(error); return data as LeagueApplication;
}

export async function resubmitLeagueApplicationLocation(applicationId: string, location: SchoolLocationSubmission) {
  const { data, error } = await client().rpc("resubmit_league_application_location", {
    p_application_id: applicationId,
    p_submitted_area_key: location.areaKey,
    p_submitted_area_label: location.areaLabel,
    p_submitted_administrative_area: location.administrativeArea || null,
    p_submitted_city: location.city,
  });
  fail(error);
  return data as { application_id: string; location_status: LeagueApplication["location_status"] };
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

export async function saveCrisisRun(teamId: string | null, decisions: CrisisDecision[]) {
  const { data, error } = await client().rpc("submit_crisis_run", {
    p_team_id: teamId,
    p_decisions: decisions.map((decision) => ({
      round_number: decision.round_number,
      monetary_policy: decision.monetary_policy,
      fiscal_policy: decision.fiscal_policy,
      energy_policy: decision.energy_policy,
    })),
  });
  fail(error);
  return data as CrisisRun;
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
  fail(error); return (data ?? []).map((row) => normaliseLeagueApplication(row as Partial<LeagueApplication>));
}

export async function reviewLeagueApplication(applicationId: string, status: "approved" | "rejected" | "under_review") {
  const { data, error } = await client().rpc("review_league_application", { p_application_id: applicationId, p_status: status });
  fail(error); return data as { application_id: string; status: LeagueApplication["status"]; school_id: string | null };
}

export async function matchLeagueApplicationLocation(applicationId: string, evidenceUrl: string, note: string) {
  const { data, error } = await client().rpc("match_league_application_location", {
    p_application_id: applicationId,
    p_evidence_url: evidenceUrl,
    p_note: note || null,
  });
  fail(error);
  return data as { application_id: string; location_status: "verified"; location_key: string; city: string };
}

export async function verifyLeagueApplicationLocation(applicationId: string, location: CanonicalSchoolLocationInput) {
  const { data, error } = await client().rpc("verify_league_application_location", {
    p_application_id: applicationId,
    p_geoname_id: location.geonameId,
    p_city: location.city,
    p_area_key: location.areaKey,
    p_area_label: location.areaLabel,
    p_administrative_area: location.administrativeArea || null,
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_evidence_url: location.evidenceUrl,
    p_note: location.note || null,
  });
  fail(error);
  return data as { application_id: string; location_status: "verified"; location_key: string };
}

export async function requestLeagueApplicationLocationCorrection(applicationId: string, publicNote: string) {
  const { data, error } = await client().rpc("request_league_application_location_correction", {
    p_application_id: applicationId,
    p_public_note: publicNote,
  });
  fail(error);
  return data as { application_id: string; location_status: "needs_correction" };
}

export async function verifyLeagueSchoolLocation(schoolId: string, location: CanonicalSchoolLocationInput) {
  const { data, error } = await client().rpc("verify_league_school_location", {
    p_school_id: schoolId,
    p_geoname_id: location.geonameId,
    p_city: location.city,
    p_area_key: location.areaKey,
    p_area_label: location.areaLabel,
    p_administrative_area: location.administrativeArea || null,
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_evidence_url: location.evidenceUrl,
    p_note: location.note || null,
  });
  fail(error);
  return data as { school_id: string; location_status: "verified"; location_key: string };
}

export async function requestLeagueSchoolLocationCorrection(schoolId: string, publicNote: string) {
  const { data, error } = await client().rpc("request_league_school_location_correction", {
    p_school_id: schoolId,
    p_public_note: publicNote,
  });
  fail(error);
  return data as { school_id: string; location_status: "needs_correction" };
}

export async function updateLeagueSchoolCurriculum(input: { schoolId: string; curriculumSystem: CurriculumSystem }) {
  const { data, error } = await client().rpc("update_league_school_curriculum", {
    p_school_id: input.schoolId,
    p_curriculum_system: input.curriculumSystem,
  });
  fail(error);
  return data as School;
}

export async function listLeagueProfiles() {
  const { data, error } = await client().from("profiles").select("user_id,display_name,role,platform_role,school_id,graduation_year,economics_club_name,role_preference,created_at,updated_at").order("created_at", { ascending: false }).limit(100);
  fail(error); return (data ?? []) as LeagueProfile[];
}

export async function setLeaguePlatformRole(userId: string, role: LeaguePlatformRole) {
  const { error } = await client().rpc("set_league_platform_role", { p_user_id: userId, p_platform_role: role });
  fail(error);
}

export async function setAcademicRole(userId: string, role: "student" | "teacher" | "professor") {
  const { error } = await client().rpc("set_econmind_academic_role", { p_user_id: userId, p_role: role });
  fail(error);
}

export async function listLeagueSchools() {
  const { data, error } = await client().from("schools").select("*").order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map((school) => ({
    ...school,
    location_status: school.location_status ?? "missing",
    location_key: school.location_key ?? null,
    location_source: school.location_source ?? null,
    location_public_note: school.location_public_note ?? null,
    location_verified_by: school.location_verified_by ?? null,
    location_verified_at: school.location_verified_at ?? null,
  })) as School[];
}

export async function listAdminCrisisRuns() {
  const { data, error } = await client().from("crisis_runs").select("id,user_id,team_id,total_score,completed_at").order("completed_at", { ascending: false }).limit(500);
  fail(error); return (data ?? []) as Array<Pick<CrisisRun, "id" | "user_id" | "team_id" | "total_score" | "completed_at">>;
}
