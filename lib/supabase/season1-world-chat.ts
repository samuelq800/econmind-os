import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";
import type { Season1Message } from "./season1";

/** Bounded channel reads preserve display names without widening profile RLS. */
export async function getSeason1WorldMessages(): Promise<Season1Message[]> {
  const { data, error } = await requireSupabaseBrowserClient()
    .rpc("get_world_preseason_world_messages", { p_message_limit: 100 });
  throwIfSupabaseError(error);
  return (data ?? []) as Season1Message[];
}

export function subscribeToSeason1WorldChat(onChange: () => void): RealtimeChannel | null {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  return client.channel("season1-world-chat")
    .on("postgres_changes", { event: "*", schema: "public", table: "world_preseason_chat_messages" }, onChange)
    .subscribe();
}
