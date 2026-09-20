"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";
import type { AuctionValueAssignment, LiveAuctionRoomView, LiveAuctionSettlementPreview } from "@/lib/live-auction/types";

let auctionClient: SupabaseClient | null = null;
const LIVE_AUCTION_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

function roomClient() {
  if (!isSupabaseConfigured()) throw new Error("Live Auction is not configured yet.");
  if (!auctionClient) auctionClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { storageKey: "econmind-live-auction-session", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
  );
  return auctionClient;
}

async function ensureLiveAuctionSession() {
  const supabase = roomClient();
  const { data, error } = await supabase.auth.getSession();
  throwIfSupabaseError(error);
  const expiresAt = Date.parse(String(data.session?.user.user_metadata?.econmind_expires_at ?? ""));
  if (data.session && Number.isFinite(expiresAt) && expiresAt > Date.now()) return supabase;
  if (data.session) {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    throwIfSupabaseError(signOutError);
  }
  const { error: signInError } = await supabase.auth.signInAnonymously({ options: { data: {
    econmind_session_scope: "live_auction",
    econmind_expires_at: new Date(Date.now() + LIVE_AUCTION_SESSION_TTL_MS).toISOString(),
  } } });
  if (signInError) throw new Error("The temporary Live Auction session could not start. Ask a platform administrator to enable anonymous sign-ins.");
  return supabase;
}

async function roomRpc<T>(name: string, args: Record<string, unknown>) {
  const supabase = await ensureLiveAuctionSession();
  const { data, error } = await supabase.rpc(name, args);
  throwIfSupabaseError(error);
  return data as T;
}

export type CreatedLiveAuctionRoom = { room: { id: string; name: string; participantCapacity: number; startingBalance: number; createdAt: string }; playerCode: string; adminCode: string };

export async function createLiveAuctionRoom(name: string, participantCapacity: number, startingBalance: number) {
  const { data, error } = await requireSupabaseBrowserClient().rpc("create_live_auction_room", { p_name: name, p_participant_capacity: participantCapacity, p_starting_balance: startingBalance });
  throwIfSupabaseError(error); return data as CreatedLiveAuctionRoom;
}
export async function listLiveAuctionRoomsForAdmin() {
  const { data, error } = await requireSupabaseBrowserClient().rpc("list_live_auction_rooms_for_admin");
  throwIfSupabaseError(error); return (data ?? []) as Array<{ id: string; name: string; participant_count: number; participant_capacity: number; item_count: number; created_at: string }>;
}
export const joinLiveAuctionRoom = (roomId: string, code: string, displayName: string) => roomRpc("join_live_auction_room", { p_room_id: roomId, p_code: code, p_display_name: displayName });
export const getLiveAuctionView = (roomId: string) => roomRpc<LiveAuctionRoomView>("get_live_auction_view", { p_room_id: roomId });
export const setLiveAuctionBalance = (participantId: string, balance: number) => roomRpc("set_live_auction_balance", { p_participant_id: participantId, p_balance: balance });
export const removeLiveAuctionParticipant = (participantId: string) => roomRpc("remove_live_auction_participant", { p_participant_id: participantId });
export const createLiveAuctionItem = (roomId: string, data: { name: string; description: string; startingPrice: number; bidIncrement: number; auctionType: "OPEN" | "SEALED"; openBiddingMode: "ONLINE" | "OFFLINE" | null; assignment: AuctionValueAssignment; imageUrl?: string | null; presetId?: string | null }) => roomRpc("create_live_auction_item", { p_room_id: roomId, p_name: data.name, p_description: data.description || null, p_starting_price: data.startingPrice, p_bid_increment: data.bidIncrement, p_auction_type: data.auctionType, p_open_bidding_mode: data.openBiddingMode, p_value_assignment: data.assignment, p_image_url: data.imageUrl ?? null, p_preset_id: data.presetId ?? null });
export const startLiveAuctionItem = (itemId: string) => roomRpc("start_live_auction_item", { p_item_id: itemId });
export const updateLiveAuctionOfflinePrice = (itemId: string, price: number, leaderId: string | null) => roomRpc("update_live_auction_offline_price", { p_item_id: itemId, p_price: price, p_leader_id: leaderId });
export const submitLiveAuctionBid = (itemId: string, amount: number) => roomRpc("submit_live_auction_bid", { p_item_id: itemId, p_amount: amount });
export const submitLiveAuctionSealedBid = (itemId: string, amount: number) => roomRpc("submit_live_auction_sealed_bid", { p_item_id: itemId, p_amount: amount });
export const closeLiveAuctionItem = (itemId: string, winnerId: string | null = null) => roomRpc("close_live_auction_item", { p_item_id: itemId, p_winner_id: winnerId });
export const previewLiveAuctionSettlement = (itemId: string, winnerId: string | null = null) => roomRpc<LiveAuctionSettlementPreview>("preview_live_auction_settlement", { p_item_id: itemId, p_winner_id: winnerId });
export const enterLiveAuctionDebrief = (itemId: string) => roomRpc("enter_live_auction_debrief", { p_item_id: itemId });
export async function subscribeToLiveAuctionRoom(roomId: string, onChange: () => void) {
  const supabase = await ensureLiveAuctionSession();
  return supabase.channel(`live-auction:${roomId}`).on("postgres_changes", { event: "*", schema: "public", table: "live_auction_events", filter: `room_id=eq.${roomId}` }, onChange).subscribe();
}
export async function unsubscribeFromLiveAuctionRoom(channel: RealtimeChannel) { await roomClient().removeChannel(channel); }
