import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260916000000_world_preseason_team_lobby.sql",
  "utf8",
) + readFileSync("supabase/migrations/20260916010000_expand_world_preseason_team_lobby.sql", "utf8");
const browserData = readFileSync("lib/supabase/season1.ts", "utf8");
const page = readFileSync(
  "components/season1/season1-team-lobby.tsx",
  "utf8",
);

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

  it("renders live data and does not retain sample team or chat records", () => {
    expect(page).toContain("getSeason1AdminLobby");
    expect(page).toContain("Platform Admin accounts");
    expect(page).toContain("This is the real, persistent Pre-Season layer");
    expect(page).not.toContain("Sample team");
  });
});
