import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260729010000_economic_command_centre.sql", "utf8");

describe("Command Centre persistence and permissions", () => {
  it("creates a distinct full-sandbox record with RLS", () => {
    for (const table of ["sandbox_scenarios", "sandbox_runs", "sandbox_rounds"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("uses database functions to prevent unauthorised team submissions", () => {
    expect(migration).toContain("create or replace function public.can_submit_team_sandbox");
    expect(migration).toContain("Only a team captain or school leader can create a team run");
    expect(migration).toContain("create or replace function public.submit_sandbox_round");
    expect(migration).toContain("This sandbox round is already locked or out of sequence");
  });

  it("seeds the deterministic scenario without fictional competition results", () => {
    expect(migration).toContain("energy-inflation-dilemma");
    expect(migration).toContain("global-energy-shock");
    expect(migration).toContain("capital-outflow");
    expect(migration).not.toContain("fictional school results");
  });
});
