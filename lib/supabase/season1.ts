import { requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";

export const SEASON_1_ROLE_PREFERENCES = [
  "Finance & Economy",
  "Trade & Foreign Affairs",
  "Industry & Technology",
  "Labour & Social Development",
  "Central Bank",
] as const;

export type Season1RolePreference = (typeof SEASON_1_ROLE_PREFERENCES)[number];

export type Season1Team = {
  id: string;
  name: string;
  focus: string;
  capacity: number;
  recruiting: boolean;
  memberCount: number;
  readyCount: number;
  applicationCount: number;
};

export type Season1LobbyData = {
  season: {
    code: string;
    displayName: string;
    registrationOpen: boolean;
    simulationLocked: boolean;
  };
  teams: Season1Team[];
  messages: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorName: string;
  }>;
  teamMessages: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorName: string;
  }>;
  freeAgents: Array<{
    userId: string;
    displayName: string;
    schoolName: string | null;
  }>;
  currentMembership: {
    teamId: string;
    memberRole: "captain" | "member";
    rolePreferences: Season1RolePreference[];
    isReady: boolean;
  } | null;
  applicationTeamIds: string[];
  pendingApplications: Array<{
    id: string;
    teamId: string;
    teamName: string;
    applicantName: string;
  }>;
};

export async function getSeason1AdminLobby() {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "get_world_preseason_admin_lobby",
  );
  throwIfSupabaseError(error);
  return data as Season1LobbyData;
}

export async function createSeason1Team(input: {
  name: string;
  focus: string;
  capacity: number;
  preferences: Season1RolePreference[];
}) {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "world_preseason_create_team",
    {
      p_season_code: "season-1",
      p_name: input.name,
      p_recruitment_focus: input.focus,
      p_capacity: input.capacity,
      p_role_preferences: input.preferences,
    },
  );
  throwIfSupabaseError(error);
  return data as string;
}

export async function applyToSeason1Team(teamId: string) {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "world_preseason_apply_to_team",
    { p_team_id: teamId, p_note: "" },
  );
  throwIfSupabaseError(error);
  return data as string;
}

export async function acceptSeason1Application(applicationId: string) {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "world_preseason_accept_application",
    { p_application_id: applicationId },
  );
  throwIfSupabaseError(error);
  return data as string;
}

export async function setSeason1Preferences(
  preferences: Season1RolePreference[],
) {
  const { error } = await requireSupabaseBrowserClient().rpc(
    "world_preseason_set_my_preferences",
    { p_role_preferences: preferences },
  );
  throwIfSupabaseError(error);
}

export async function setSeason1Readiness(ready: boolean) {
  const { error } = await requireSupabaseBrowserClient().rpc(
    "world_preseason_set_my_readiness",
    { p_ready: ready },
  );
  throwIfSupabaseError(error);
}

export async function postSeason1LobbyMessage(content: string) {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "world_preseason_post_message",
    { p_team_id: null, p_content: content },
  );
  throwIfSupabaseError(error);
  return data as string;
}

export async function postSeason1TeamMessage(teamId: string, content: string) {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "world_preseason_post_message",
    { p_team_id: teamId, p_content: content },
  );
  throwIfSupabaseError(error);
  return data as string;
}
