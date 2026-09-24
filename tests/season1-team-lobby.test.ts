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

  it("lets signed-in members use the direct lobby link without a main-site entry", () => {
    expect(page).toContain("getSeason1Lobby");
    expect(page).toContain("if (user) void refresh()");
    expect(page).toContain("open to registered EconMind members");
    expect(page).not.toContain("if (!user || !worldSupervisor)");
    expect(navbar).not.toContain('href="/season1"');
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

  it("centers the supplied connected-world visual with a live Season 1 countdown", () => {
    expect(page).toContain("70-COUNTRY WORLD");
    expect(page).toContain("2026-09-24T16:00:00.000Z");
    expect(page).toContain("season1-connected-world-globe.png");
    expect(globalStyles).toContain(".season1-world-visual");
    expect(globalStyles).toContain(".season1-world-countdown");
    expect(
      existsSync("public/images/season1/season1-connected-world-globe.png"),
    ).toBe(true);
  });
});
