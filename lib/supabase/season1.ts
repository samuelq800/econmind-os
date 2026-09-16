import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";

export type Season1RolePreference = string;
export type Season1Team = { id: string; name: string; description: string; focus: string; capacity: number; recruiting: boolean; recruitmentMode: "open" | "application_required" | "invite_only"; teamStyle: "competitive" | "balanced" | "learning"; preferredLanguage: string; status: string; memberCount: number; readyCount: number; applicationCount: number; teamType: "SCHOOL TEAM" | "CROSS-SCHOOL TEAM" | "OPEN TEAM"; schools: string[] };
export type Season1Message = { id: string; content: string; messageType: "TEXT" | "TEAM_CARD" | "SYSTEM"; metadata: Record<string, unknown>; createdAt: string; deletedAt: string | null; authorName: string; authorId: string };
export type Season1LobbyData = {
  season: { id: string; code: string; displayName: string; registrationOpen: boolean; simulationLocked: boolean; config: { minimumTeamSize: number; maximumTeamSize: number; roles: string[]; languages: string[] } };
  stats: { players: number; teams: number; freeAgents: number; recruitingTeams: number };
  teams: Season1Team[];
  freeAgents: Array<{ userId: string; displayName: string; schoolName: string | null; rolePreferences: string[]; interests: string; preferredLanguage: string; teamStylePreference: string }>;
  membership: { teamId: string; memberRole: "captain" | "member"; rolePreferences: string[]; isReady: boolean } | null;
  members: Array<{ userId: string; displayName: string; schoolName: string | null; memberRole: "captain" | "member"; rolePreferences: string[]; isReady: boolean }>;
  applications: Array<{ id: string; teamId: string; teamName: string; applicantName: string; note: string }>;
  invites: Array<{ id: string; teamId: string; teamName: string; code: string; status: string; invitedUserId: string | null }>;
  messages: Season1Message[]; teamMessages: Season1Message[];
  currentMembership: { teamId: string; memberRole: "captain" | "member"; rolePreferences: string[]; isReady: boolean } | null;
  applicationTeamIds: string[]; pendingApplications: Array<{ id: string; teamId: string; teamName: string; applicantName: string }>;
};

async function rpc<T>(name: string, args: Record<string, unknown> = {}) { const { data, error } = await requireSupabaseBrowserClient().rpc(name, args); throwIfSupabaseError(error); return data as T; }
export const getSeason1Lobby = async () => { const data = await rpc<Omit<Season1LobbyData, "currentMembership" | "applicationTeamIds" | "pendingApplications">>("get_world_preseason_lobby"); return { ...data, currentMembership: data.membership, applicationTeamIds: [], pendingApplications: data.applications.map(({ id, teamId, teamName, applicantName }) => ({ id, teamId, teamName, applicantName })) }; };
export const createSeason1Team = (input: { name: string; description?: string; focus?: string; capacity?: number; recruitmentMode?: "open" | "application_required" | "invite_only"; teamStyle?: "competitive" | "balanced" | "learning"; preferredLanguage?: string; preferences: string[] }) => rpc<string>("world_preseason_create_team", { p_name: input.name, p_description: input.description ?? input.focus ?? "", p_recruitment_mode: input.recruitmentMode ?? "open", p_team_style: input.teamStyle ?? "balanced", p_preferred_language: input.preferredLanguage ?? "English", p_role_preferences: input.preferences });
export const applyToSeason1Team = (teamId: string, note = "") => rpc<string>("world_preseason_apply_to_team", { p_team_id: teamId, p_note: note });
export const reviewSeason1Application = (applicationId: string, accept: boolean) => rpc<void>("world_preseason_review_application", { p_application_id: applicationId, p_accept: accept });
export const setSeason1FreeAgent = (input: { enabled: boolean; interests?: string; preferredLanguage?: string; teamStylePreference?: string }) => rpc<void>("world_preseason_set_free_agent", { p_enabled: input.enabled, p_interests: input.interests ?? "", p_preferred_language: input.preferredLanguage ?? "English", p_team_style_preference: input.teamStylePreference ?? "open" });
export const createSeason1Invite = (teamId: string, userId?: string) => rpc<{ id: string; code: string; teamId: string }>("world_preseason_create_invite", { p_team_id: teamId, p_invited_user_id: userId ?? null, p_expires_at: null });
export const respondToSeason1Invite = (code: string, accept: boolean) => rpc<string>("world_preseason_respond_to_invite", { p_code: code, p_accept: accept });
export const setSeason1Preferences = (preferences: string[]) => rpc<void>("world_preseason_set_my_preferences", { p_role_preferences: preferences });
export const setSeason1Readiness = (ready: boolean) => rpc<void>("world_preseason_set_my_readiness", { p_ready: ready });
export const postSeason1Message = (teamId: string | null, content: string, messageType: "TEXT" | "TEAM_CARD" = "TEXT", metadata: Record<string, unknown> = {}) => rpc<string>("world_preseason_post_message", { p_team_id: teamId, p_content: content, p_message_type: messageType, p_metadata: metadata });
export const deleteSeason1Message = (messageId: string) => rpc<void>("world_preseason_delete_own_message", { p_message_id: messageId });
export const reportSeason1Message = (messageId: string, reason: string) => rpc<void>("world_preseason_report_message", { p_message_id: messageId, p_reason: reason });

export function subscribeToSeason1Lobby(onChange: () => void): RealtimeChannel | null { const client = getSupabaseBrowserClient(); if (!client) return null; return client.channel("world-preseason-season-1").on("postgres_changes", { event: "*", schema: "public", table: "world_preseason_chat_messages" }, onChange).on("postgres_changes", { event: "*", schema: "public", table: "world_preseason_team_members" }, onChange).on("postgres_changes", { event: "*", schema: "public", table: "world_preseason_team_applications" }, onChange).on("postgres_changes", { event: "*", schema: "public", table: "world_preseason_team_invites" }, onChange).on("postgres_changes", { event: "*", schema: "public", table: "world_preseason_free_agents" }, onChange).subscribe(); }
export function unsubscribeSeason1Lobby(channel: RealtimeChannel | null) { const client = getSupabaseBrowserClient(); if (client && channel) void client.removeChannel(channel); }

// Compatibility aliases keep the initial admin-only surface functional while
// the richer participant Team Lobby is progressively rendered from the same
// season-scoped read model.
export const SEASON_1_ROLE_PREFERENCES: readonly string[] = [];
export async function getSeason1AdminLobby() { const data = await getSeason1Lobby(); return { ...data, currentMembership: data.membership, applicationTeamIds: [], pendingApplications: data.applications.map(({ id, teamId, teamName, applicantName }) => ({ id, teamId, teamName, applicantName })) }; }
export const acceptSeason1Application = (id: string) => reviewSeason1Application(id, true);
export const postSeason1LobbyMessage = (content: string) => postSeason1Message(null, content);
export const postSeason1TeamMessage = (teamId: string, content: string) => postSeason1Message(teamId, content);
