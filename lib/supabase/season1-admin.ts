import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RoomRealtimeStatus } from "@/lib/live-room/refresh-controller";
import type { Season1LobbyData, Season1Team } from "./season1";
import { requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";
import { getCountryPreferences } from "./season1-countries";
import { season1TeamMetrics } from "@/lib/admin/season1-metrics";

export type Season1AdminTeam = {
  id: string;
  name: string;
  code: string;
  description: string;
  focus: string;
  capacity: number;
  status: string;
  recruiting: boolean;
  recruitmentLocked: boolean;
  recruitmentMode: Season1Team["recruitmentMode"];
  teamStyle: string;
  preferredLanguage: string;
  schoolName: string | null;
  createdAt: string;
  memberCount: number;
  readyCount: number;
  applicationCount: number;
  members: Array<Season1LobbyData["members"][number] & { joinedAt: string }>;
};
export type Season1AdminOverview = {
  seasonId: string;
  snapshotAt: string;
  countrySnapshotAt: string;
  stats: {
    registeredPlayers: number;
    participants: number;
    teamMembers: number;
    teams: number;
    freeAgents: number;
    readyMembers: number;
    lockedTeams: number;
    teamsAtLeastThree: number;
    selectedCountryTeams: number;
  };
  teams: Season1AdminTeam[];
};

export async function getSeason1AdminOverview(): Promise<Season1AdminOverview> {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "get_world_preseason_admin_overview",
  );
  throwIfSupabaseError(error);
  if (
    !data ||
    !Array.isArray(data.teams) ||
    !data.stats ||
    !data.seasonId ||
    !data.snapshotAt
  ) {
    throw new Error("The administrator overview is unavailable. Please retry.");
  }
  // Only read country availability after admin authority has been verified.
  // Unique active reservations are one-to-one with teams; released choices
  // are already excluded by this existing, read-only participant RPC.
  const countries = await getCountryPreferences();
  if (countries.seasonId !== data.seasonId || !countries.serverNow)
    throw new Error(
      "Country statistics do not match the administrator season.",
    );
  return {
    ...data,
    countrySnapshotAt: countries.serverNow,
    stats: {
      ...data.stats,
      ...season1TeamMetrics(data.teams, countries.countries),
    },
  } as Season1AdminOverview;
}

export async function subscribeToSeason1AdminOverview(
  seasonId: string,
  change: () => void,
  status: (value: RoomRealtimeStatus) => void,
  disposed: () => boolean,
): Promise<RealtimeChannel | null> {
  const client = requireSupabaseBrowserClient();
  const { data, error } = await client.auth.getSession();
  throwIfSupabaseError(error);
  if (disposed()) return null;
  if (!data.session)
    throw new Error("Sign in to view the administrator overview.");
  const channel = client.channel(
    `season1-admin:${seasonId}:${crypto.randomUUID()}`,
  );
  for (const table of [
    "world_preseason_teams",
    "world_preseason_team_members",
    "world_preseason_free_agents",
    "world_preseason_team_applications",
  ]) {
    for (const event of ["INSERT", "UPDATE"] as const) {
      channel.on(
        "postgres_changes",
        { event, schema: "public", table, filter: `season_id=eq.${seasonId}` },
        change,
      );
    }
    // DELETE's old row may contain only its primary key. Do not filter on a
    // missing season_id or retain the payload; invalidate the authorized RPC.
    channel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table },
      change,
    );
  }
  channel.subscribe(status);
  return channel;
}

export const unsubscribeSeason1AdminOverview = (channel: RealtimeChannel) =>
  requireSupabaseBrowserClient().removeChannel(channel);
