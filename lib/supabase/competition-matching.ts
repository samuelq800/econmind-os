import { requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";

export type CompetitionRule = {
  competition: "NEC" | "IEO";
  division: string;
  min_team_size: number;
  max_team_size: number;
  active: boolean;
  stages: string[];
  awards: string[];
  season: string;
};
export type AcademicProfile = {
  country: string;
  location: string;
  curriculum: string;
  curriculum_detail: Record<string, unknown>;
  graduation_year: number | null;
  gpa: number | null;
  gpa_scale: string;
  gpa_system: string;
  english_tests: unknown[];
  standardized_tests: unknown[];
  amc_records: unknown[];
  competition_records: unknown[];
  visibility: Record<string, "public" | "matches" | "private">;
  bio: string;
};
export type MatchingProfile = {
  id: string;
  user_id: string;
  competition: string;
  division: string;
  status: string;
  target: string;
  strengths: string[];
  needs: string[];
  preferences: Record<string, unknown>;
  updated_at: string;
};
export type Team = {
  id: string;
  name: string;
  introduction: string;
  target: string;
  ownerId: string;
  ownerName?: string;
  school?: string;
  recruiting: boolean;
  members: number;
  placeholders: number;
  capacity: number;
  needs: string[][];
};
export type Player = {
  id: string;
  name: string;
  avatar?: string;
  school?: string;
  curriculum: string;
  bio: string;
  strengths: string[];
  target: string;
  academicDetails: {
    gpa: number | null;
    gpaScale: string | null;
    economics: Record<string, unknown>;
    englishTests: unknown[];
    standardizedTests: unknown[];
    amcRecords: unknown[];
    competitionRecords: unknown[];
  };
};
export type MyTeam = {
  id: string;
  name: string;
  introduction: string;
  target: string;
  ownerId: string;
  recruiting: boolean;
  competition: string;
  division: string;
  capacity: number;
  members: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
    school?: string;
  }[];
  placeholders: { id: string; name: string; school: string }[];
  needs: { id: string; tags: string[]; note: string }[];
  messages: { id: number; name: string; body: string; at: string }[];
};
export type TeamRequest = {
  id: string;
  teamId: string;
  teamName: string;
  userId: string;
  userName: string;
  initiatedBy: string;
  kind: "application" | "invitation";
  status: string;
  message: string;
  createdAt: string;
};
export type CompetitionHome = {
  identity: {
    name: string;
    school?: string;
    city?: string;
    grade?: string;
    avatar?: string;
  };
  academic: AcademicProfile | null;
  rules: CompetitionRule[];
  profiles: MatchingProfile[];
  context: MatchingProfile | null;
  stats: { players: number; teams: number; recruiting: number } | null;
  teams: Team[];
  players: Player[];
  myTeam: MyTeam | null;
  requests: TeamRequest[];
  notifications: { id: number; kind: string }[];
};

async function call<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await requireSupabaseBrowserClient().rpc(name, args);
  throwIfSupabaseError(error);
  return data as T;
}
export const getCompetitionHome = (
  competition?: string,
  division?: string,
  offset = 0,
  query = "",
) =>
  call<CompetitionHome>("get_competition_home", {
    p_competition: competition ?? null,
    p_division: division ?? null,
    p_offset: offset,
    p_query: query,
  });
export const saveAcademicProfile = (data: AcademicProfile) =>
  call<void>("save_competition_academic_profile", { p_data: data });
export const saveMatchingProfile = (
  competition: string,
  division: string,
  status: string,
  target: string,
  strengths: string[],
  needs: string[],
  preferences: Record<string, unknown> = {},
) =>
  call<string>("save_competition_matching_profile", {
    p_competition: competition,
    p_division: division,
    p_status: status,
    p_target: target,
    p_strengths: strengths,
    p_needs: needs,
    p_preferences: preferences,
  });
export const openCompetitionContext = (competition: string, division: string) =>
  call<void>("open_competition_context", {
    p_competition: competition,
    p_division: division,
  });
export const createCompetitionTeam = (
  competition: string,
  division: string,
  name: string,
  introduction: string,
  target: string,
) =>
  call<string>("create_competition_team", {
    p_competition: competition,
    p_division: division,
    p_name: name,
    p_intro: introduction,
    p_target: target,
  });
export const applyToCompetitionTeam = (teamId: string, message: string) =>
  call<string>("request_competition_team", {
    p_team_id: teamId,
    p_kind: "application",
    p_message: message,
  });
export const inviteCompetitionPlayer = (
  teamId: string,
  userId: string,
  message: string,
  placeholderId?: string,
) =>
  call<string>("invite_competition_player", {
    p_team_id: teamId,
    p_user_id: userId,
    p_message: message,
    p_placeholder_id: placeholderId ?? null,
  });
export const resolveCompetitionRequest = (
  requestId: string,
  action: "accepted" | "declined",
) =>
  call<void>("resolve_competition_request", {
    p_request_id: requestId,
    p_action: action,
  });
export const withdrawCompetitionRequest = (requestId: string) =>
  call<void>("withdraw_competition_request", { p_request_id: requestId });
export const leaveCompetitionTeam = (teamId: string, userId?: string) =>
  call<void>("leave_competition_team", {
    p_team_id: teamId,
    p_user_id: userId ?? null,
  });
export const transferCompetitionTeam = (teamId: string, newOwnerId: string) =>
  call<void>("transfer_competition_team", {
    p_team_id: teamId,
    p_new_owner: newOwnerId,
  });
export const postCompetitionMessage = (teamId: string, body: string) =>
  call<void>("post_competition_team_message", {
    p_team_id: teamId,
    p_body: body,
  });
export type CompetitionLounge = {
  posts: {
    id: string;
    name: string;
    school: string | null;
    note: string;
    teamId: string | null;
    teamName: string | null;
    strengths: string[];
    needs: string[];
    createdAt: string;
  }[];
  messages: { id: number; name: string; body: string; createdAt: string }[];
};
export const getCompetitionLounge = (competition: string, division: string) =>
  call<CompetitionLounge>("get_competition_lounge", {
    p_competition: competition,
    p_division: division,
  });
export const postCompetitionRecruitment = (
  competition: string,
  division: string,
  body: string,
  teamId?: string,
) =>
  call<void>("post_competition_recruitment", {
    p_competition: competition,
    p_division: division,
    p_body: body,
    p_team_id: teamId ?? null,
  });
export const postCompetitionLobbyMessage = (
  competition: string,
  division: string,
  body: string,
) =>
  call<void>("post_competition_lobby_message", {
    p_competition: competition,
    p_division: division,
    p_body: body,
  });
export const markCompetitionNotificationsRead = () =>
  call<void>("mark_competition_notifications_read", {});
export const addCompetitionPlaceholder = (
  teamId: string,
  name: string,
  school: string,
) =>
  call<void>("add_competition_placeholder", {
    p_team_id: teamId,
    p_name: name,
    p_school: school,
  });
export const removeCompetitionPlaceholder = (placeholderId: string) =>
  call<void>("remove_competition_placeholder", {
    p_placeholder_id: placeholderId,
  });
export const addCompetitionNeed = (
  teamId: string,
  tags: string[],
  note: string,
) =>
  call<void>("add_competition_need", {
    p_team_id: teamId,
    p_tags: tags,
    p_note: note,
  });
export const setCompetitionRecruiting = (teamId: string, recruiting: boolean) =>
  call<void>("set_competition_recruiting", {
    p_team_id: teamId,
    p_recruiting: recruiting,
  });
export const reportCompetitionContent = (
  userId: string | null,
  teamId: string | null,
  reason: string,
) =>
  call<void>("report_competition_content", {
    p_user_id: userId,
    p_team_id: teamId,
    p_reason: reason,
  });
export const blockCompetitionUser = (userId: string) =>
  call<void>("block_competition_user", { p_user_id: userId });
export type CompetitionAdminData = {
  rules: CompetitionRule[];
  reports: {
    id: number;
    reporter_id: string;
    target_user_id: string | null;
    target_team_id: string | null;
    reason: string;
    status: string;
    created_at: string;
  }[];
  teams: {
    id: string;
    name: string;
    competition: string;
    division: string;
    active: boolean;
  }[];
  profiles: {
    id: string;
    userId: string;
    competition: string;
    division: string;
    active: boolean;
  }[];
  posts: { id: string; body: string; active: boolean }[];
};
export const getCompetitionAdmin = () =>
  call<CompetitionAdminData>("get_competition_admin", {});
export const moderateCompetition = (
  action: string,
  id: string,
  data: Record<string, unknown> = {},
) =>
  call<void>("moderate_competition", {
    p_action: action,
    p_id: id,
    p_data: data,
  });
