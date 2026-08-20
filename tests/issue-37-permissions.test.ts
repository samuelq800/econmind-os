import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260820000000_harden_world_and_crisis_permissions.sql",
  "utf8",
);
const leagueClient = readFileSync("lib/supabase/league.ts", "utf8");

describe("issue #37 permission hardening", () => {
  it("limits full World state to eligible participants", () => {
    expect(migration).toContain(
      "create or replace function public.can_view_continuous_world",
    );
    expect(migration).toContain(
      "drop policy if exists continuous_worlds_read_authenticated",
    );
    expect(migration).toContain(
      "create policy continuous_worlds_read_participants",
    );
    expect(migration).toContain(
      "using (public.can_view_continuous_world(id))",
    );
  });

  it("does not reveal scheduled shocks to participants", () => {
    expect(migration).toContain(
      "drop policy if exists continuous_world_shocks_read_authenticated",
    );
    expect(migration).toContain(
      "create policy continuous_world_shocks_read_visible",
    );
    expect(migration).toContain("status in ('active', 'expired')");
    expect(migration).toContain("starts_at <= timezone('utc', now())");
  });

  it("replaces direct score writes with a server-calculated RPC", () => {
    expect(migration).toContain(
      "revoke insert, update, delete on public.crisis_runs from authenticated",
    );
    expect(migration).toContain(
      "revoke insert, update, delete on public.crisis_decisions from authenticated",
    );
    expect(migration).toContain(
      "create or replace function public.submit_crisis_run",
    );
    expect(migration).toContain("total_score := round(");
    expect(migration).toContain("'serverValidated', true");
    expect(leagueClient).toContain('.rpc("submit_crisis_run"');
    expect(leagueClient).not.toContain(
      '.from("crisis_runs").insert',
    );
    expect(leagueClient).not.toContain(
      '.from("crisis_decisions").insert',
    );
  });
});
