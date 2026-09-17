import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260917000000_superme_platform_admins.sql",
  "utf8",
);
const dashboard = readFileSync("components/league/league-dashboard.tsx", "utf8");
const leagueClient = readFileSync("lib/supabase/league.ts", "utf8");

describe("Superme Platform Admin hierarchy", () => {
  it("bootstraps the two designated accounts as protected platform administrators", () => {
    expect(migration).toContain("private.superme_platform_admins");
    expect(migration).toContain("ffc87a95-f535-4781-9c2d-c2fac962ea9e");
    expect(migration).toContain("1396ed21-aef3-4827-a2b9-dd25d4be21a7");
    expect(migration).toContain("set platform_role = 'platform_admin'");
    expect(migration).toContain("Both designated Superme Platform Admin profiles must exist");
  });

  it("keeps administrator visibility and role changes server-enforced", () => {
    expect(migration).toContain("create or replace function public.is_superme_platform_admin");
    expect(migration).toContain("create or replace function public.can_view_admin_dashboard_profile");
    expect(migration).toContain("and public.can_view_admin_dashboard_profile(user_id)");
    expect(migration).toContain("Only a Superme Platform Admin can view or change administrator roles");
    expect(migration).toContain("The Superme Platform Admin designation is protected");
    expect(migration).toContain("action <> 'platform_role_changed'");
  });

  it("does not leave the multi-role helper table as a platform-admin bypass", () => {
    expect(migration).toContain("when p_role = 'platform_admin' then public.is_platform_admin(p_user_id)");
    expect(migration).toContain("perform public.set_league_platform_role(");
    expect(migration).toContain("role in ('student', 'teacher', 'league_participant', 'league_admin', 'platform_admin')");
  });

  it("exposes administrator role controls only to the database-confirmed Superme tier", () => {
    expect(leagueClient).toContain('rpc("is_superme_platform_admin")');
    expect(dashboard).toContain("setSupermePlatformAdmin(nextSupermePlatformAdmin)");
    expect(dashboard).toContain("Superme Platform Admin");
    expect(dashboard).toContain("Other administrators are intentionally hidden from this dashboard");
    expect(dashboard).toContain("isProtectedSupermePlatformAdmin(profile.user_id)");
    expect(dashboard).toContain("supermePlatformAdmin || profile.platform_role === \"platform_admin\"");
  });
});
