import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260728010000_real_world_cases_daily_brief.sql"), "utf8");
describe("Real-World Cases schema safeguards", () => {
  it("uses structured jsonb case runs and enables RLS on every new user-facing table", () => {
    for (const table of ["economic_cases", "case_runs", "daily_brief_sources", "daily_brief_settings", "daily_brief_items", "daily_brief_jobs"]) expect(migration).toContain(`alter table public.${table} enable row level security`);
    for (const field of ["policy_settings jsonb", "scenarios jsonb", "results jsonb", "evaluation jsonb", "recommendation jsonb"]) expect(migration).toContain(field);
  });

  it("limits case runs to their owner and teacher editorial actions to teacher role", () => {
    expect(migration).toContain('create policy "case_runs_own_select"');
    expect(migration).toContain("(select auth.uid()) = user_id");
    expect(migration).toContain("public.is_teacher()");
  });
});
