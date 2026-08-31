"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  requireSupabaseBrowserClient,
  throwIfSupabaseError,
} from "./client";
import type {
  LiveWorldAccessType,
  LiveWorldRoomView,
} from "@/lib/live-world/types";

let liveWorldClient: SupabaseClient | null = null;

function roomClient() {
  if (!isSupabaseConfigured()) throw new Error("Live World is not configured yet.");
  if (!liveWorldClient) {
    liveWorldClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storageKey: "econmind-live-world-session",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return liveWorldClient;
}

async function ensureLiveWorldSession() {
  const supabase = roomClient();
  const { data: current, error: currentError } = await supabase.auth.getSession();
  throwIfSupabaseError(currentError);
  if (current.session) return supabase;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(
      "The temporary Live World session could not start. Please ask a platform administrator to enable anonymous sign-ins for this project.",
    );
  }
  return supabase;
}

function asRoomView(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The Live World room returned an invalid response.");
  }
  return value as LiveWorldRoomView;
}

export type CreatedLiveWorldRoom = {
  room: { id: string; name: string; status: string; durationSeconds: number; createdAt: string };
  playerCode: string;
  adminCode: string;
};

export async function createLiveWorldRoom(name: string, durationSeconds: number) {
  const { data, error } = await requireSupabaseBrowserClient().rpc("create_live_world_room", {
    p_name: name,
    p_duration_seconds: durationSeconds,
  });
  throwIfSupabaseError(error);
  return data as CreatedLiveWorldRoom;
}

export async function listLiveWorldRoomsForAdmin() {
  const { data, error } = await requireSupabaseBrowserClient().rpc("list_live_world_rooms_for_admin");
  throwIfSupabaseError(error);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    duration_seconds: number;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
    participant_count: number;
  }>;
}

export async function joinLiveWorldRoom(roomId: string, code: string, displayName: string) {
  const supabase = await ensureLiveWorldSession();
  const { data, error } = await supabase.rpc("join_live_world_room", {
    p_room_id: roomId,
    p_code: code,
    p_display_name: displayName,
  });
  throwIfSupabaseError(error);
  return data as { accessType: LiveWorldAccessType; countryId: string | null; role: string | null };
}

export async function getLiveWorldView(roomId: string) {
  const supabase = await ensureLiveWorldSession();
  const { data, error } = await supabase.rpc("get_live_world_view", { p_room_id: roomId });
  throwIfSupabaseError(error);
  return asRoomView(data);
}

export async function claimLiveWorldSeat(roomId: string, countryId: string, role: string) {
  const supabase = await ensureLiveWorldSession();
  const { error } = await supabase.rpc("claim_live_world_seat", {
    p_room_id: roomId,
    p_country_key: countryId,
    p_role_key: role,
  });
  throwIfSupabaseError(error);
}

export async function releaseLiveWorldSeat(roomId: string) {
  const supabase = await ensureLiveWorldSession();
  const { error } = await supabase.rpc("release_live_world_seat", { p_room_id: roomId });
  throwIfSupabaseError(error);
}

export async function saveLiveWorldDraft(roomId: string, policy: Record<string, number>) {
  const supabase = await ensureLiveWorldSession();
  const { error } = await supabase.rpc("save_live_world_draft", { p_room_id: roomId, p_policy: policy });
  throwIfSupabaseError(error);
}

export async function publishLiveWorldPolicy(roomId: string) {
  const supabase = await ensureLiveWorldSession();
  const { error } = await supabase.rpc("publish_live_world_policy", { p_room_id: roomId });
  throwIfSupabaseError(error);
}

export async function proposeLiveWorldAgreement(roomId: string, receiverCountryId: string, depth: string) {
  const supabase = await ensureLiveWorldSession();
  const { error } = await supabase.rpc("propose_live_world_agreement", {
    p_room_id: roomId,
    p_receiver_country_key: receiverCountryId,
    p_depth: depth,
  });
  throwIfSupabaseError(error);
}

export async function decideLiveWorldAgreement(agreementId: string, accept: boolean) {
  const supabase = await ensureLiveWorldSession();
  const { error } = await supabase.rpc("decide_live_world_agreement", {
    p_agreement_id: agreementId,
    p_accept: accept,
  });
  throwIfSupabaseError(error);
}

export async function setLiveWorldStatus(roomId: string, status: "live" | "paused" | "ended") {
  const supabase = await ensureLiveWorldSession();
  const { error } = await supabase.rpc("live_world_set_status", { p_room_id: roomId, p_status: status });
  throwIfSupabaseError(error);
}

export async function injectLiveWorldCrisis(roomId: string, crisisKey: string, active: boolean) {
  const supabase = await ensureLiveWorldSession();
  const { error } = await supabase.rpc("inject_live_world_crisis", {
    p_room_id: roomId,
    p_crisis_key: crisisKey,
    p_active: active,
  });
  throwIfSupabaseError(error);
}

export async function subscribeToLiveWorldRoom(roomId: string, onChange: () => void) {
  const supabase = await ensureLiveWorldSession();
  const channel = supabase
    .channel(`live-world:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_world_events", filter: `room_id=eq.${roomId}` },
      onChange,
    )
    .subscribe();
  return channel;
}

export async function unsubscribeFromLiveWorldRoom(channel: RealtimeChannel) {
  const supabase = roomClient();
  await supabase.removeChannel(channel);
}
