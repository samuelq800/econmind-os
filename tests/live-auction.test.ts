import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageAccessForPath } from "@/lib/platform/access-control";
import { liveAuctionRoomPath, liveAuctionRoomUrl } from "@/lib/live-auction/links";
import { canHostLiveSession } from "@/lib/platform/live-session-access";

const migration = readFileSync("supabase/migrations/20260920000000_live_auction.sql", "utf8");
const auditFixes = readFileSync("supabase/migrations/20260920000100_live_auction_audit_fixes.sql", "utf8");
const presetFixes = readFileSync("supabase/migrations/20260920000400_live_auction_preset_items.sql", "utf8");

describe("Live Auction", () => {
  it("uses a standalone invitation route and temporary room identity", () => {
    const shell = readFileSync("components/layout/application-shell.tsx", "utf8");
    const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
    const service = readFileSync("lib/supabase/live-auction.ts", "utf8");
    expect(liveAuctionRoomPath("room-1")).toBe("/live-auction/?room=room-1");
    expect(liveAuctionRoomUrl("https://econmind.group", "room-1")).toBe("https://econmind.group/live-auction/?room=room-1");
    expect(pageAccessForPath("/live-auction").audience).toBe("public");
    const policy = pageAccessForPath("/admin/live-auction");
    expect(policy.platformRoles).toContain("platform_admin");
    expect(policy.appRoles).toContain("teacher");
    expect(policy.roleMatch).toBe("any");
    expect(shell).toContain('pathname === "/live-auction"');
    expect(navbar).toContain('href="/admin/live-auction"');
    expect(service).toContain('storageKey: "econmind-live-auction-session"');
    expect(service).toContain('econmind_session_scope: "live_auction"');
  });

  it("opens host access to teachers and school leaders without granting other room visibility", () => {
    const hostMigration = readFileSync("supabase/migrations/20260920000300_live_session_host_access.sql", "utf8");
    expect(canHostLiveSession("teacher", "user")).toBe(true);
    expect(canHostLiveSession("student", "school_leader")).toBe(true);
    expect(canHostLiveSession("student", "platform_admin")).toBe(true);
    expect(canHostLiveSession("student", "user")).toBe(false);
    expect(hostMigration).toContain("p.role = 'teacher'");
    expect(hostMigration).toContain("p.platform_role = 'school_leader'");
    expect(hostMigration).toContain("r.created_by = auth.uid()");
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
    expect(auditFixes).toContain("to_regprocedure('public.get_live_auction_view_legacy(uuid)') is null");
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

  it("ships twenty sourced items plus the fictional Yale's Egg and preserves assets with item records", () => {
    const presets = readFileSync("lib/live-auction/auction-presets-source.ts", "utf8");
    const imageFiles = readdirSync("public/images/live-auction").filter((name) => name.endsWith(".jpg"));
    const room = readFileSync("components/live-auction/live-auction-room.tsx", "utf8");
    expect((presets.match(/"id":/g) ?? []).length).toBe(21);
    for (const category of ["porcelain", "painting", "bronze", "jade"]) expect((presets.match(new RegExp(`"category": "${category}"`, "g")) ?? []).length).toBe(5);
    expect((presets.match(/"category": "special"/g) ?? []).length).toBe(1);
    expect(presets).toContain('"id": "special_yales_egg"');
    expect(presets).toContain('"starting_price_usd": 500000');
    expect(presets).toContain('"starting_price_basis": "ECONMIND_GAME_PRICE"');
    expect(imageFiles).toHaveLength(21);
    for (const imageFile of imageFiles) expect(statSync(`public/images/live-auction/${imageFile}`).size).toBeGreaterThan(0);
    expect(presetFixes).toContain("add column if not exists image_url");
    expect(presetFixes).toContain("p_preset_id");
    expect(room).toContain("Choose preset");
    expect(room).toContain("YOU&apos;VE BEEN OUTBID");
    expect(room).toContain("MY COLLECTION");
    expect(room).toContain("● WATCHING");
    expect(room).toContain("BID LOCKED IN");
    expect(room).toContain("SOLD");
    expect(room).toContain("object-contain");
    expect(room).toContain("PURCHASE COMPLETE");
    expect(room).toContain("The item has been added to your collection.");
    expect(room).toContain("artifact-fallback.svg");
    expect(room).toContain('item.presetId === YALES_EGG_PRESET_ID');
    expect(room).toContain("<YaleEggHatch />");
    expect(room).toContain("<YaleTigerPortrait />");
    const hatch = readFileSync("components/live-auction/yale-egg-hatch.tsx", "utf8");
    const hatchStyles = readFileSync("components/live-auction/yale-egg-hatch.module.css", "utf8");
    expect(hatch).toContain('/games/tiao/spritesheet.webp');
    expect(hatchStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
