import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageAccessForPath } from "@/lib/platform/access-control";
import { liveAuctionRoomPath, liveAuctionRoomUrl } from "@/lib/live-auction/links";

const migration = readFileSync("supabase/migrations/20260920000000_live_auction.sql", "utf8");
const auditFixes = readFileSync("supabase/migrations/20260920000100_live_auction_audit_fixes.sql", "utf8");

describe("Live Auction", () => {
  it("uses a standalone invitation route and temporary room identity", () => {
    const shell = readFileSync("components/layout/application-shell.tsx", "utf8");
    const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
    const service = readFileSync("lib/supabase/live-auction.ts", "utf8");
    expect(liveAuctionRoomPath("room-1")).toBe("/live-auction/?room=room-1");
    expect(liveAuctionRoomUrl("https://econmind.group", "room-1")).toBe("https://econmind.group/live-auction/?room=room-1");
    expect(pageAccessForPath("/live-auction").audience).toBe("public");
    expect(pageAccessForPath("/admin/live-auction").platformRoles).toContain("platform_admin");
    expect(shell).toContain('pathname === "/live-auction"');
    expect(navbar).toContain('href="/admin/live-auction"');
    expect(service).toContain('storageKey: "econmind-live-auction-session"');
    expect(service).toContain('econmind_session_scope: "live_auction"');
  });

  it("keeps bids, values, settlement, and room control server authoritative", () => {
    for (const table of ["live_auction_rooms", "live_auction_participants", "auction_items", "auction_item_values", "auction_bids", "auction_price_history", "auction_results"]) expect(migration).toContain(`public.${table}`);
    for (const fn of ["create_live_auction_room", "join_live_auction_room", "create_live_auction_item", "submit_live_auction_bid", "submit_live_auction_sealed_bid", "close_live_auction_item", "get_live_auction_view"]) expect(migration).toContain(`function public.${fn}`);
    expect(migration).toContain("for update");
    expect(migration).toContain("Your bid must be at least the next legal bid");
    expect(migration).toContain("Your bid cannot exceed your current balance");
    expect(migration).toContain("auction_sealed_bid_per_participant");
    expect(migration).toContain("current_balance=current_balance-final_price");
    expect(migration).toContain("alter table public.auction_item_values enable row level security");
    expect(migration).toContain("'myPrivateValue'");
    expect(migration).toContain("case when is_admin");
  });

  it("serializes starts, publishes room events, and keeps host controls scoped to buyers", () => {
    const room = readFileSync("components/live-auction/live-auction-room.tsx", "utf8");
    const service = readFileSync("lib/supabase/live-auction.ts", "utf8");
    expect(auditFixes).toContain("from public.live_auction_rooms where id=item_row.room_id for update");
    expect(auditFixes).toContain("alter publication supabase_realtime add table public.live_auction_events");
    expect(auditFixes).toContain("p.access_type='player'");
    expect(auditFixes).toContain("revoke all on function public.live_auction_code");
    expect(auditFixes).toContain("preview_live_auction_settlement");
    expect(service).toContain("previewLiveAuctionSettlement");
    expect(room).toContain("Confirm settlement");
    expect(room).not.toContain('entry.status === "LIVE") ?? view.items[0]');
  });

  it("keeps the player surface deliberately small and removes online bidding for offline calling", () => {
    const room = readFileSync("components/live-auction/live-auction-room.tsx", "utf8");
    expect(room).toContain("Bids are being called aloud");
    expect(room).toContain("there is no online bid button");
    expect(room).toContain("Your sealed bid");
    expect(room).toContain("Reveal values");
    expect(room).toContain("Private information");
  });
});
