import type { AdvanceQuarterResult, CommandCentreState } from "@/lib/economics/command-centre";
import type { SandboxMode, SandboxRound, SandboxRun, SandboxScenario } from "@/lib/league/command-centre-types";
import { getSupabaseBrowserClient } from "./client";

function client() { const supabase = getSupabaseBrowserClient(); if (!supabase) throw new Error("Supabase is not configured."); return supabase; }
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function getCommandCentreScenario(slug = "energy-inflation-dilemma") {
  const { data, error } = await client().from("sandbox_scenarios").select("*").eq("slug", slug).maybeSingle();
  fail(error); return data as SandboxScenario | null;
}

export async function createCommandCentreRun(input: { scenarioId: string; mode: SandboxMode; teamId: string | null; initialState: CommandCentreState }) {
  const { data, error } = await client().rpc("create_sandbox_run", { p_scenario_id: input.scenarioId, p_mode: input.mode, p_team_id: input.teamId, p_initial_state: input.initialState });
  fail(error); return data as SandboxRun;
}

export async function getCommandCentreRun(runId: string) {
  const { data, error } = await client().from("sandbox_runs").select("*, team:teams(id,name,school_id,captain_user_id), scenario:sandbox_scenarios(slug,title), rounds:sandbox_rounds(*)").eq("id", runId).maybeSingle();
  fail(error);
  if (!data) return null;
  const row = data as SandboxRun & { rounds?: SandboxRound[] };
  return { ...row, rounds: [...(row.rounds ?? [])].sort((left, right) => left.round_number - right.round_number) };
}

export async function listAccessibleCommandCentreRuns(limit = 30) {
  const { data, error } = await client().from("sandbox_runs").select("*, team:teams(id,name,school_id,captain_user_id), scenario:sandbox_scenarios(slug,title)").order("updated_at", { ascending: false }).limit(limit);
  fail(error); return (data ?? []) as SandboxRun[];
}

export async function submitCommandCentreRound(runId: string, result: AdvanceQuarterResult) {
  const final = result.stateAfter.completed;
  const { data, error } = await client().rpc("submit_sandbox_round", {
    p_run_id: runId, p_round_number: result.roundNumber, p_state_before: result.stateBefore, p_policy_package: result.policy,
    p_shock_applied: result.shock, p_pending_before: result.stateBefore.pendingEffects, p_pending_after: result.stateAfter.pendingEffects,
    p_state_after: result.stateAfter, p_explanations: result.explanation, p_score_snapshot: result.scoreSnapshot,
    p_final_state: final ? result.stateAfter : null, p_final_score: final ? result.scoreSnapshot.totalScore : null, p_result_type: final ? result.scoreSnapshot.resultType : null,
  });
  fail(error); return data as SandboxRun;
}

export async function abandonCommandCentreRun(runId: string) {
  const { data, error } = await client().rpc("abandon_sandbox_run", { p_run_id: runId });
  fail(error); return data as SandboxRun;
}

export async function duplicateCommandCentreRun(input: { sourceRunId: string; mode: SandboxMode; teamId: string | null; state: CommandCentreState; startRound: number }) {
  const { data, error } = await client().rpc("duplicate_sandbox_run", { p_source_run_id: input.sourceRunId, p_mode: input.mode, p_team_id: input.teamId, p_state: input.state, p_start_round: input.startRound });
  fail(error); return data as SandboxRun;
}

export async function getCommandCentreAdminStats() {
  const [{ data, error }, { data: rounds, error: roundsError }, { data: scenarios, error: scenariosError }] = await Promise.all([
    client().from("sandbox_runs").select("id,status,mode,final_score,result_type,current_round,created_at,completed_at,scenario_id,team_id").order("created_at", { ascending: false }).limit(500),
    client().from("sandbox_rounds").select("policy_package").limit(1500),
    client().from("sandbox_scenarios").select("id,title,slug,is_active").order("title"),
  ]);
  fail(error); fail(roundsError); fail(scenariosError);
  const runs = data ?? [];
  const completed = runs.filter((run) => run.status === "completed");
  const averageFinalScore = completed.length ? Math.round(completed.reduce((sum, run) => sum + Number(run.final_score ?? 0), 0) / completed.length * 10) / 10 : null;
  const policyCounts = new Map<string, number>();
  for (const row of rounds ?? []) { const policy = row.policy_package as { interestRate?: number; businessTaxRate?: number }; const label = `Rate ${policy.interestRate ?? "—"}% · tax ${policy.businessTaxRate ?? "—"}%`; policyCounts.set(label, (policyCounts.get(label) ?? 0) + 1); }
  const resultCounts = new Map<string, number>();
  for (const row of completed) if (row.result_type) resultCounts.set(row.result_type, (resultCounts.get(row.result_type) ?? 0) + 1);
  const top = (counts: Map<string, number>) => [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "No data yet";
  return { runs, scenarios: scenarios ?? [], totalRuns: runs.length, completedRuns: completed.length, completionRate: runs.length ? Math.round(completed.length / runs.length * 100) : null, averageFinalScore, activeScenarioCount: new Set(runs.map((run) => run.scenario_id)).size, mostCommonPolicy: top(policyCounts), mostCommonResult: top(resultCounts) };
}
