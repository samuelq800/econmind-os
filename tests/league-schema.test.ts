import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260729000000_inter_school_economic_league.sql", "utf8");

describe("Inter-School League schema and permissions", () => {
  it("creates the League data model with RLS for every user-facing table", () => {
    for (const table of ["schools", "teams", "team_members", "league_applications", "crisis_runs", "crisis_decisions"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps platform roles in the database and exposes secure workflow functions", () => {
    expect(migration).toContain("platform_role in ('user', 'team_member', 'school_leader', 'platform_admin')");
    expect(migration).toContain("create or replace function public.join_team_by_invite");
    expect(migration).toContain("create or replace function public.review_league_application");
    expect(migration).toContain("create or replace function public.set_league_platform_role");
    expect(migration).toContain("Platform administrator role required");
  });

  it("limits school and team data to the correct membership boundary", () => {
    expect(migration).toContain("create policy schools_select_members");
    expect(migration).toContain("create policy teams_insert_school_leaders");
    expect(migration).toContain("create policy crisis_runs_select_visible");
    expect(migration).toContain("create policy crisis_decisions_insert_owner");
  });
});
