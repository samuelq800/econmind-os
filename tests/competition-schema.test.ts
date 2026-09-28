import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260928000000_competition_matching.sql"),
  "utf8",
);

describe("competition matching database boundary", () => {
  it("keeps academic data and lobby data behind RLS and narrow RPC grants", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.%I from public, anon, authenticated");
    expect(migration).toContain("create policy academic_owner_read");
    expect(migration).toContain("revoke all on function public.visible_competition_academic(uuid,uuid,uuid)");
    expect(migration).toContain("if p_viewer is distinct from auth.uid()");
  });

  it("isolates divisions and checks available seats inside request acceptance", () => {
    expect(migration).toContain("unique(user_id,competition,division)");
    expect(migration).toContain("select * into v_team from public.competition_teams where id=v_request.team_id for update");
    expect(migration).toContain("if v_used>=v_max then raise exception 'Team is full'");
    expect(migration).toContain("where user_id=v_request.user_id and competition=v_team.competition and division=v_team.division and active");
  });

  it("does not give anonymous visitors mutation access", () => {
    expect(migration).not.toMatch(/grant execute on function[^;]+to anon/i);
    expect(migration).toContain("to authenticated;");
    expect(migration).toContain("public.require_member_profile_user()");
  });
});
