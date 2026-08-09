import type {
  ChallengeCountryRole,
  LeagueAttemptMode,
  LeagueChallenge,
  LeagueChallengeAttempt,
  LeagueChallengeRoleAssignment,
  LeagueChallengeStageDecision,
  LeagueChallengeStatus,
  LeagueGhostStrategy,
  LeagueLeaderboardRow,
} from "@/lib/league/async-challenge-types";
import { getSupabaseBrowserClient } from "./client";

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listLeagueChallenges() {
  const { data, error } = await client()
    .from("league_challenges")
    .select("*")
    .order("created_at");
  fail(error);
  return (data ?? []) as LeagueChallenge[];
}

export async function startLeagueChallengeAttempt(input: {
  challengeSlug: string;
  mode: LeagueAttemptMode;
  teamId?: string | null;
}) {
  const { data, error } = await client().rpc("start_league_challenge_attempt", {
    p_challenge_slug: input.challengeSlug,
    p_mode: input.mode,
    p_team_id: input.teamId ?? null,
  });
  fail(error);
  return data as LeagueChallengeAttempt;
}

export async function saveLeagueChallengeAttempt(
  attemptId: string,
  policyState: Record<string, unknown>,
  simulationState: Record<string, unknown>,
) {
  const { data, error } = await client().rpc("save_league_challenge_attempt", {
    p_attempt_id: attemptId,
    p_policy_state: policyState,
    p_simulation_state: simulationState,
  });
  fail(error);
  return data as LeagueChallengeAttempt;
}

export async function lockLeagueChallengeStage(input: {
  attemptId: string;
  stageNumber: number;
  policyState: Record<string, unknown>;
  simulationState: Record<string, unknown>;
  result: Record<string, unknown>;
}) {
  const { data, error } = await client().rpc("lock_league_challenge_stage", {
    p_attempt_id: input.attemptId,
    p_stage_number: input.stageNumber,
    p_policy_state: input.policyState,
    p_simulation_state: input.simulationState,
    p_result: input.result,
  });
  fail(error);
  return data as LeagueChallengeAttempt;
}

export async function submitLeagueChallengeAttempt(input: {
  attemptId: string;
  scoreBreakdown: Record<string, unknown>;
  finalResult: Record<string, unknown>;
}) {
  const { data, error } = await client().rpc("submit_league_challenge_attempt", {
    p_attempt_id: input.attemptId,
    p_score_breakdown: input.scoreBreakdown,
    p_final_result: input.finalResult,
  });
  fail(error);
  return data as LeagueChallengeAttempt;
}

export async function listMyChallengeAttempts(teamId: string, challengeId?: string) {
  let query = client()
    .from("league_challenge_attempts")
    .select("*")
    .eq("team_id", teamId)
    .order("started_at", { ascending: false });
  if (challengeId) query = query.eq("challenge_id", challengeId);
  const { data, error } = await query;
  fail(error);
  return (data ?? []) as LeagueChallengeAttempt[];
}

export async function listChallengeAttemptDecisions(attemptId: string) {
  const { data, error } = await client()
    .from("league_challenge_stage_decisions")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("stage_number");
  fail(error);
  return (data ?? []) as LeagueChallengeStageDecision[];
}

export async function listChallengeRoleAssignments(attemptId: string) {
  const { data, error } = await client()
    .from("league_challenge_role_assignments")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("created_at");
  fail(error);
  return (data ?? []) as LeagueChallengeRoleAssignment[];
}

export async function assignChallengeRole(input: {
  attemptId: string;
  userId: string;
  role: ChallengeCountryRole;
  isPrimary?: boolean;
}) {
  const { data, error } = await client().rpc("assign_league_challenge_role", {
    p_attempt_id: input.attemptId,
    p_user_id: input.userId,
    p_role_type: input.role,
    p_is_primary: input.isPrimary ?? true,
  });
  fail(error);
  return data as LeagueChallengeRoleAssignment;
}

export async function getLeagueChallengeLeaderboard(challengeSlug: string) {
  const { data, error } = await client().rpc("get_league_challenge_leaderboard", {
    p_challenge_slug: challengeSlug,
  });
  fail(error);
  return (data ?? []) as LeagueLeaderboardRow[];
}

export async function listLeagueChallengeGhosts(challengeSlug: string) {
  const { data, error } = await client().rpc("get_league_challenge_ghosts", {
    p_challenge_slug: challengeSlug,
  });
  fail(error);
  return (data ?? []) as Array<
    Pick<
      LeagueGhostStrategy,
      "id" | "name" | "simulation_type" | "visibility" | "behaviour_type"
    > & { source_name: string | null; source_revealed: boolean }
  >;
}

export async function resetLeagueChallengeAttempt(attemptId: string) {
  const { data, error } = await client().rpc("reset_league_challenge_attempt", {
    p_attempt_id: attemptId,
  });
  fail(error);
  return data as LeagueChallengeAttempt;
}

export async function setLeagueChallengeStatus(
  challengeId: string,
  status: LeagueChallengeStatus,
) {
  const { data, error } = await client().rpc("set_league_challenge_status", {
    p_challenge_id: challengeId,
    p_status: status,
  });
  fail(error);
  return data as LeagueChallenge;
}
