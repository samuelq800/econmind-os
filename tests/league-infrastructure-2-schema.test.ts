import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260729020000_league_infrastructure_2.sql", "utf8");
const edgeFunction = readFileSync("supabase/functions/process-league-world-round/index.ts", "utf8");
const browserData = readFileSync("lib/supabase/league-infrastructure.ts", "utf8");

describe("League Infrastructure 2.0 persistence and settlement boundary", () => {
  it("creates every collaborative record with RLS", () => {
    for (const table of ["scenario_definitions", "country_templates", "scenario_validations", "competitions", "competition_schools", "competition_countries", "competition_roles", "competition_rounds", "institution_drafts", "country_submissions", "world_states", "country_round_results", "trade_flows", "international_agreements", "agreement_participants", "audit_logs", "competition_events"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps country finalisation, state transition and processing server validated", () => {
    expect(migration).toContain("create or replace function public.finalise_country_submission");
    expect(migration).toContain("jsonb_object_agg(institution_type, locked_state)");
    expect(migration).toContain("create or replace function public.transition_competition_state");
    expect(migration).toContain("Illegal competition state transition");
    expect(migration).toContain("create or replace function public.claim_world_processing");
    expect(migration).toContain("World processing is already locked");
  });

  it("seeds only the long-running default league and its four country templates", () => {
    expect(migration).toContain("EconMind Global League");
    for (const country of ["techoria", "manufactura", "greenovia", "agritania"]) expect(migration).toContain(`'${country}'`);
    expect(migration).toContain("No fictional");
  });

  it("uses a protected Edge Function for final settlement and never exposes a service key to browser code", () => {
    expect(edgeFunction).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeFunction).toContain("claim_world_processing");
    expect(edgeFunction).toContain("settleWorldRound");
    expect(edgeFunction).toContain("country_round_results");
    expect(browserData).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("enables durable Realtime synchronization and public-after-release result access", () => {
    expect(migration).toContain("alter publication supabase_realtime add table");
    expect(migration).toContain("create policy country_round_results_member_or_published");
    expect(migration).toContain("create policy trade_flows_member_or_published");
    expect(browserData).toContain("subscribeToLeagueCompetition");
  });
});
