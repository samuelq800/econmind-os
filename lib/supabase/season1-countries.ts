import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RoomRealtimeStatus } from "@/lib/live-room/refresh-controller";
import type { CountryPreferenceView } from "@/lib/season1/countries";
import { requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";

export async function getCountryPreferences(): Promise<CountryPreferenceView> {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "get_world_preseason_country_preferences",
  );
  throwIfSupabaseError(error);
  if (!data?.seasonId || !Array.isArray(data.countries))
    throw new Error("Country preferences are unavailable. Please retry.");
  return data as CountryPreferenceView;
}

export async function saveCountryPreference(
  teamId: string,
  code: string,
  expected: string | null,
): Promise<CountryPreferenceView> {
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "set_world_preseason_country_preference",
    {
      p_team_id: teamId,
      p_country_code: code,
      p_expected_country_code: expected,
    },
  );
  throwIfSupabaseError(error);
  if (
    !data?.seasonId ||
    !Array.isArray(data.countries) ||
    data.myTeam?.id !== teamId ||
    data.myTeam?.preference?.code !== code
  )
    throw new Error(
      "The server did not confirm this country preference. Refresh before retrying.",
    );
  return data as CountryPreferenceView;
}

export async function subscribeCountryPreferences(
  seasonId: string,
  change: () => void,
  status: (status: RoomRealtimeStatus) => void,
  disposed: () => boolean,
): Promise<RealtimeChannel | null> {
  const client = requireSupabaseBrowserClient();
  const { data, error } = await client.auth.getSession();
  throwIfSupabaseError(error);
  if (disposed()) return null;
  if (!data.session) throw new Error("Sign in to view country preferences.");
  const channel = client.channel(
    `season1-countries:${seasonId}:${crypto.randomUUID()}`,
  );
  for (const table of [
    "world_preseason_teams",
    "world_preseason_team_members",
  ]) {
    for (const event of ["INSERT", "UPDATE"] as const)
      channel.on(
        "postgres_changes",
        { event, schema: "public", table, filter: `season_id=eq.${seasonId}` },
        change,
      );
    channel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table },
      change,
    );
  }
  channel.subscribe(status);
  return channel;
}
export const unsubscribeCountryPreferences = (channel: RealtimeChannel) =>
  requireSupabaseBrowserClient().removeChannel(channel);
