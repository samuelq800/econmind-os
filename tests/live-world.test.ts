import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageAccessForPath } from "@/lib/platform/access-control";
import { LIVE_WORLD_COUNTRIES } from "@/lib/live-world/config";
import {
  agreementPreview,
  forecastLiveWorldCountry,
  initialLiveWorldRoomState,
  rankLiveWorldCountries,
} from "@/lib/live-world/engine";
import {
  reconcileLiveWorldDeadline,
  reportedLiveWorldDeadline,
  secondsUntilLiveWorldDeadline,
} from "@/lib/live-world/timer";
import { liveWorldRoomPath, liveWorldRoomUrl } from "@/lib/live-world/links";

const migration = readFileSync(
  "supabase/migrations/20260831020000_live_world_simulation.sql",
  "utf8",
);
const timerMigration = readFileSync(
  "supabase/migrations/20260901000000_live_world_timer_deadline.sql",
  "utf8",
);
const anonymousExpiryMigration = readFileSync(
  "supabase/migrations/20260901010000_expire_live_world_anonymous_users.sql",
  "utf8",
);

describe("Live World", () => {
  it("keeps four structurally distinct fictional countries and twelve possible seats", () => {
    expect(LIVE_WORLD_COUNTRIES).toHaveLength(4);
    expect(new Set(LIVE_WORLD_COUNTRIES.map((country) => country.structure.technology)).size).toBe(4);
    expect(new Set(LIVE_WORLD_COUNTRIES.map((country) => country.structure.resources)).size).toBe(4);
    expect(migration).toContain("live_world_participants_unique_seat");
    expect(migration).toContain("central_bank_governor");
    expect(migration).toContain("finance_domestic_minister");
    expect(migration).toContain("trade_industry_investment_minister");
  });

  it("combines independently published policy packages into the six-dimensional forecast", () => {
    const state = initialLiveWorldRoomState();
    const baseline = forecastLiveWorldCountry("aurora", state);
    state.publishedPolicies.aurora = {
      central_bank_governor: { policy_rate: 9, liquidity_support: 2, reserve_requirement: 16 },
      finance_domestic_minister: { government_spending: 52, tax_rate: 25, welfare: 22, infrastructure: 34 },
      trade_industry_investment_minister: { tariff: 12, export_support: 22, industrial_subsidy: 20, fdi_openness: 24 },
    };
    const combined = forecastLiveWorldCountry("aurora", state);
    expect(combined.activity).not.toBe(baseline.activity);
    expect(combined.financial).not.toBe(baseline.financial);
    expect(combined.fiscal).not.toBe(baseline.fiscal);
  });

  it("applies active crises differently according to country structure", () => {
    const state = initialLiveWorldRoomState();
    state.crises = [{ id: "energy-price-spike", label: "Energy price spike", description: "", affectedCountries: ["aurora", "borealis", "demeria"], effects: { activity: -4, prices: -8, fiscal: -2, stability: -3 }, active: true }];
    const demeria = forecastLiveWorldCountry("demeria", state);
    const cyrenia = forecastLiveWorldCountry("cyrenia", state);
    expect(demeria.prices).toBeLessThan(cyrenia.prices);
  });

  it("makes trade gains asymmetric rather than copying the same benefit to both countries", () => {
    const preview = agreementPreview({ proposerCountry: "cyrenia", receiverCountry: "aurora", depth: "deep" });
    expect(preview.proposer).not.toBe(preview.receiver);
    const ranked = rankLiveWorldCountries(initialLiveWorldRoomState());
    expect(ranked).toHaveLength(4);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[3].score);
  });

  it("uses one absolute deadline and never moves the same timer run backwards", () => {
    const now = 1_000_000;
    const room = {
      id: "room-1",
      name: "Clock test",
      status: "live" as const,
      durationSeconds: 300,
      remainingSeconds: 280,
      timerEndsAt: new Date(now + 280_000).toISOString(),
      startedAt: new Date(now - 20_000).toISOString(),
      endedAt: null,
      createdAt: new Date(now - 30_000).toISOString(),
    };
    const deadline = reportedLiveWorldDeadline(room, now);
    expect(deadline).toBe(now + 280_000);
    expect(secondsUntilLiveWorldDeadline(deadline, 0, now + 1_001)).toBe(279);
    expect(reconcileLiveWorldDeadline({ ...room, timerEndsAt: undefined, remainingSeconds: 280 }, deadline, room.startedAt, now + 1_500)).toBe(deadline);
    expect(timerMigration).toContain("'timerEndsAt'");
    expect(timerMigration).toContain("room_row.started_at + make_interval(secs => room_row.remaining_seconds)");
  });

  it("enforces server-side room access, atomic seats, role-owned drafts and admin-only control", () => {
    for (const signature of [
      "create_live_world_room",
      "join_live_world_room",
      "claim_live_world_seat",
      "save_live_world_draft",
      "publish_live_world_policy",
      "decide_live_world_agreement",
      "live_world_set_status",
      "get_live_world_view",
    ]) expect(migration).toContain(`function public.${signature}`);
    expect(migration).toContain("where id = p_room_id for update");
    expect(migration).toContain("Only the receiving Trade, Industry & Investment Minister may decide this agreement");
    expect(migration).toContain("only save its own valid policy controls");
    expect(migration).toContain("invitation hashes never have a SELECT policy");
    expect(migration).toContain("alter table public.live_world_rooms enable row level security");
  });

  it("mounts a standalone public event route without ordinary application navigation", () => {
    const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
    const route = readFileSync("app/live-world/page.tsx", "utf8");
    const liveWorldRoute = readFileSync("components/live-world/live-world-route.tsx", "utf8");
    const room = readFileSync("components/live-world/live-world-room.tsx", "utf8");
    const admin = readFileSync("components/live-world/live-world-admin.tsx", "utf8");
    const applicationShell = readFileSync("components/layout/application-shell.tsx", "utf8");
    const roomService = readFileSync("lib/supabase/live-world.ts", "utf8");
    expect(navbar).toContain('path === "/live-world"');
    expect(route).toContain("LiveWorldRoute");
    expect(pageAccessForPath("/live-world").audience).toBe("public");
    expect(pageAccessForPath("/admin/live-world").platformRoles).toContain("platform_admin");
    expect(room).toContain('document.visibilityState === "visible"');
    expect(admin).toContain("grid items-start gap-6");
    expect(admin).toContain('state === "copied" ? "Copied"');
    expect(admin).toContain("active:scale-[.96]");
    expect(applicationShell).toContain("not initialise, read, or link the visitor's EconMind account session");
    expect(applicationShell.indexOf("if (isStandaloneLiveWorld(pathname))")).toBeLessThan(applicationShell.indexOf("<AuthProvider>"));
    expect(room).toContain("style={LIVE_WORLD_THEME}");
    expect(room).toContain('className="dark min-h-screen');
    expect(liveWorldRoute).toContain("style={LIVE_WORLD_THEME}");
    expect(roomService).toContain('storageKey: "econmind-live-world-session"');
    expect(roomService).toContain("signInAnonymously");
    expect(roomService).toContain('econmind_session_scope: "live_world"');
    expect(roomService).toContain("LIVE_WORLD_SESSION_TTL_MS");
    expect(room).toContain("No EconMind account is used, required, or linked");
  });

  it("keeps temporary room identities out of profiles and expires them after seven days", () => {
    expect(anonymousExpiryMigration).toContain("if new.is_anonymous is true");
    expect(anonymousExpiryMigration).toContain("interval '7 days'");
    expect(anonymousExpiryMigration).toContain("econmind-live-world-anonymous-cleanup");
    expect(anonymousExpiryMigration).toContain("on delete set null");
    expect(anonymousExpiryMigration).toContain("delete from public.profiles");
  });

  it("generates a random standalone room link from the server-created UUID", () => {
    expect(migration).toContain("id uuid primary key default extensions.gen_random_uuid()");
    expect(liveWorldRoomPath("f350897a-d6cb-46bd-b837-7a3d57a4a2d8")).toBe("/live-world/?room=f350897a-d6cb-46bd-b837-7a3d57a4a2d8");
    expect(liveWorldRoomUrl("https://econmind.group", "f350897a-d6cb-46bd-b837-7a3d57a4a2d8")).toBe("https://econmind.group/live-world/?room=f350897a-d6cb-46bd-b837-7a3d57a4a2d8");
  });
});
