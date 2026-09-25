import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260916000000_world_preseason_team_lobby.sql",
  "utf8",
) + readFileSync("supabase/migrations/20260916010000_expand_world_preseason_team_lobby.sql", "utf8") + readFileSync("supabase/migrations/20260916020000_fix_world_preseason_application_idempotency.sql", "utf8");
const browserData = readFileSync("lib/supabase/season1.ts", "utf8");
const memberAccess = readFileSync("supabase/migrations/20260924000000_season1_member_lobby_access.sql", "utf8");
const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
const memberAccessWorkflow = readFileSync(".github/workflows/apply-season1-member-access.yml", "utf8");
const pagesWorkflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
const page = readFileSync(
  "components/season1/season1-team-lobby.tsx",
  "utf8",
);
const globalStyles = readFileSync("app/globals.css", "utf8");
const entrance = readFileSync("components/season1/season1-entrance.tsx", "utf8");
const entranceStyles = readFileSync("components/season1/season1-entrance.module.css", "utf8");
const openingMigration = readFileSync("supabase/migrations/20260924010000_season1_opening_gate.sql", "utf8");
const openingWorkflow = readFileSync(".github/workflows/apply-season1-opening-gate.yml", "utf8");
const route = readFileSync("app/season1/page.tsx", "utf8");

describe("Season 1 pre-season team lobby", () => {
  it("persists only pre-season collaboration records with RLS", () => {
    for (const table of [
      "world_preseason_seasons",
      "world_preseason_teams",
      "world_preseason_team_members",
      "world_preseason_team_applications",
      "world_preseason_chat_channels",
      "world_preseason_chat_messages",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(migration).toContain("EconMind World · Season 1");
    expect(migration).toContain("simulation_locked boolean not null default true");
    expect(migration).not.toContain("simulation_event_ledger");
  });

  it("requires Platform Admin authorization and keeps browser writes behind RPCs", () => {
    expect(migration).toContain("create or replace function public.world_preseason_require_admin");
    expect(migration).toContain("public.is_platform_admin(auth.uid())");
    expect(migration).toContain("revoke all on table public.world_preseason_seasons");

    for (const rpc of [
      "get_world_preseason_lobby",
      "world_preseason_create_team",
      "world_preseason_apply_to_team",
      "world_preseason_review_application",
      "world_preseason_set_my_preferences",
      "world_preseason_set_my_readiness",
      "world_preseason_post_message",
      "world_preseason_create_invite",
      "world_preseason_respond_to_invite",
      "world_preseason_set_free_agent",
      "world_preseason_report_message",
    ]) {
      expect(migration).toContain(`function public.${rpc}`);
      expect(browserData).toContain(`"${rpc}"`);
    }
    expect(browserData).not.toContain(".from(");
  });

  it("lets signed-in members use the first-level Season 1 entry", () => {
    expect(page).toContain("getSeason1Lobby");
    expect(page).toContain("if (user) void refresh()");
    expect(page).toContain("open to registered EconMind members");
    expect(page).not.toContain("if (!user || !worldSupervisor)");
    expect(navbar).toContain('"season1"');
    expect(memberAccess).toContain("world_preseason_require_participant()");
    expect(memberAccess).toContain("applicant_user_id = auth.uid()");
    expect(memberAccess).toContain("grant execute on function public.get_world_preseason_my_pending_team_ids() to authenticated");
    expect(memberAccessWorkflow).toContain("20260924000000_season1_member_lobby_access.sql");
    expect(pagesWorkflow).toContain("Season 1 member access migration is required");
    expect(browserData).toContain('"get_world_preseason_my_pending_team_ids"');
    expect(browserData).not.toContain('rpc<{ applicationTeamIds?: string[] }>("get_world_preseason_admin_lobby")');
    expect(page).toContain("This is the real, persistent Pre-Season layer");
    expect(page).not.toContain("Sample team");
  });

  it("makes team applications retry-safe and avoids a full read after preference clicks", () => {
    expect(migration).toContain(
      "on conflict (season_id, team_id, applicant_user_id) where status = 'pending'",
    );
    expect(browserData).toContain("get_world_preseason_my_pending_team_ids");
    expect(browserData).toContain("world_preseason_one_pending_application_idx");
    expect(page).toContain("refresh: false");
    expect(page).toContain("rolePreferences: next");
  });

  it("keeps the existing Team Lobby behind a widescreen countdown entrance", () => {
    expect(page).toContain("70-COUNTRY WORLD");
    expect(page).toContain("season1-connected-world-globe.png");
    expect(globalStyles).toContain(".season1-world-visual");
    expect(route).toContain("<Season1Entrance />");
    expect(entrance).toContain("getSeason1Opening");
    expect(entrance).toContain("setSeason1Opening");
    expect(entrance).toContain("if (!ready || opening || checking) return");
    expect(entrance).toContain('"Open Lobby"');
    expect(entrance).toContain("if (confirmed.isOpen) setEntered(true)");
    expect(entrance).toContain("<Season1TeamLobby />");
    expect(entrance).toContain("getElementById(window.location.hash.slice(1))");
    expect(entranceStyles).toContain(".opening .doorLeft");
    expect(entranceStyles).toContain(".opening .doorRight");
    expect(entranceStyles).toContain("prefers-reduced-motion: reduce");
    expect(
      existsSync("public/images/season1/season1-connected-world-globe.png"),
    ).toBe(true);
    expect(existsSync("public/images/season1/season1-gateway-wide.jpg")).toBe(true);
  });

  it("stores the GMT+8 opening centrally and restricts edits to platform admins", () => {
    expect(new Date("2026-09-25T21:00+08:00").toISOString()).toBe("2026-09-25T13:00:00.000Z");
    expect(openingMigration).toContain("2026-09-25 13:00:00+00");
    expect(openingMigration).toContain("world_preseason_require_participant()");
    expect(openingMigration).toContain("world_preseason_gate_open()");
    expect(openingMigration).toContain("account_status = 'active'");
    expect(openingMigration).toContain("public.is_platform_admin(auth.uid())");
    for (const policy of ["public_team_discovery", "member_roster_read", "channel_read", "message_read", "free_agent_read"]) {
      expect(openingMigration).toContain(`alter policy world_preseason_${policy}`);
    }
    expect(openingMigration).toContain("grant execute on function public.get_world_preseason_opening() to authenticated");
    expect(openingMigration).toContain("grant execute on function public.set_world_preseason_opening(timestamptz) to authenticated");
    expect(openingWorkflow).toContain("20260924010000_season1_opening_gate.sql");
    expect(pagesWorkflow).toContain("Season 1 opening gate migration is required");
    expect(entrance).toContain('worldSupervisor && <div className={styles.adminArea}>');
    expect(entrance).toContain('timeZone: "Asia/Shanghai"');
    expect(browserData).toContain('"get_world_preseason_opening"');
    expect(browserData).toContain('"set_world_preseason_opening"');
  });
});
