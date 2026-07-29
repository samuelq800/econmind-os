import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260729020000_league_infrastructure_2.sql", "utf8");
const twelveNationMigration = readFileSync("supabase/migrations/20260729040000_twelve_country_world_league.sql", "utf8");
const rlsFixMigration = readFileSync("supabase/migrations/20260729030000_fix_agreement_participant_rls_recursion.sql", "utf8");
const teacherAdminMigration = readFileSync("supabase/migrations/20260729050000_teacher_administrator_operation.sql", "utf8");
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

  it("uses the role holder foreign key when embedding profiles", () => {
    expect(browserData).toContain("profiles!competition_roles_user_id_fkey(user_id,display_name)");
  });

  it("adds a versioned, immutable twelve-country world without replacing the legacy world", () => {
    expect(twelveNationMigration).toContain("Twelve Nations: Interconnected World Economy");
    expect(twelveNationMigration).toContain("immutable_template_snapshot");
    expect(twelveNationMigration).toContain("openIndividualRegistration");
    expect(twelveNationMigration).toContain("Fiscal deficits are permitted");
    for (const country of ["techoria", "meditoria", "culturia", "manufactura", "materia", "agritania", "greenovia", "energea", "constructa", "financora", "logistica", "centravia"]) expect(twelveNationMigration).toContain(`\"slug\":\"${country}\"`);
  });

  it("removes mutual agreement-policy recursion and keeps browser code free of service keys", () => {
    expect(rlsFixMigration).toContain("create or replace function public.can_view_agreement");
    expect(rlsFixMigration).toContain("public.can_view_agreement");
    expect(browserData).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("lets teacher administrators operate every country panel without weakening ordinary role boundaries", () => {
    expect(teacherAdminMigration).toContain("create or replace function public.can_edit_institution_draft");
    expect(teacherAdminMigration).toContain("public.is_competition_director(p_competition_id, p_user_id)");
    expect(teacherAdminMigration).toContain("role.role_type = p_institution");
    expect(teacherAdminMigration).toContain("create or replace function public.approve_agreement_participant");
    expect(teacherAdminMigration).toContain("create or replace function public.propose_international_agreement");
    expect(teacherAdminMigration).toContain("teacher administrator can approve this agreement");
  });
});
