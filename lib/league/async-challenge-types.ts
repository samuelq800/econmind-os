export type LeagueSimulationType = "world" | "time_machine" | "industry" | "financial";

export type LeagueChallengeStatus = "draft" | "open" | "closed" | "archived";
export type LeagueAttemptMode = "practice" | "official";
export type LeagueAttemptStatus = "active" | "submitted" | "abandoned" | "reset";
export type LeagueReplayVisibility =
  | "immediate_private"
  | "after_submit"
  | "after_challenge_close";

/**
 * These portfolios belong to the asynchronous Challenge layer. They are
 * intentionally separate from the seven portfolios used by the persistent
 * World Simulation, whose operating rules remain unchanged.
 */
export const CHALLENGE_COUNTRY_ROLES = [
  "central_bank",
  "economic_policy",
  "trade",
  "investment_resources",
] as const;

export type ChallengeCountryRole = (typeof CHALLENGE_COUNTRY_ROLES)[number];

export const CHALLENGE_ROLE_LABELS: Record<ChallengeCountryRole, string> = {
  central_bank: "Central Bank",
  economic_policy: "Economic Policy",
  trade: "Trade",
  investment_resources: "Investment & Resources",
};

/**
 * Challenge portfolios keep the same permission keys across the League, while
 * their public names match the system a team is operating. This lets one
 * member hold several portfolios without permanently attaching a job title to
 * their account.
 */
export function challengeRoleLabels(
  simulationType: LeagueSimulationType,
): Record<ChallengeCountryRole, string> {
  if (simulationType === "industry") {
    return {
      central_bank: "Pricing & market",
      economic_policy: "Operations",
      trade: "Brand & demand",
      investment_resources: "Innovation & capacity",
    };
  }
  if (simulationType === "financial") {
    return {
      central_bank: "Lending & credit",
      economic_policy: "Treasury & liquidity",
      trade: "Risk & capital",
      investment_resources: "Interbank & resilience",
    };
  }
  return CHALLENGE_ROLE_LABELS;
}

export type ChallengeControl = {
  key: string;
  label: string;
  role: ChallengeCountryRole;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  timing: "immediate" | "delayed";
  description: string;
};

export type LeagueChallengeDefinition = {
  slug: string;
  simulationType: LeagueSimulationType;
  title: string;
  eyebrow: string;
  summary: string;
  stageCount: number;
  officialAttemptLimit: number;
  replayVisibility: LeagueReplayVisibility;
  controls: ChallengeControl[];
  scoringLabels: Array<{ label: string; weight?: number; detail: string }>;
  stageLabels: string[];
};

export type LeagueChallenge = {
  id: string;
  season_id: string | null;
  slug: string;
  simulation_type: LeagueSimulationType;
  title: string;
  description: string;
  status: LeagueChallengeStatus;
  scenario_snapshot: Record<string, unknown>;
  scoring_config: Record<string, unknown>;
  allow_practice: boolean;
  official_attempt_limit: number | null;
  stage_count: number;
  replay_visibility: LeagueReplayVisibility;
  ghost_identity_unlock_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeagueChallengeAttempt = {
  id: string;
  challenge_id: string;
  team_id: string;
  school_id: string;
  mode: LeagueAttemptMode;
  attempt_number: number;
  status: LeagueAttemptStatus;
  current_stage: number;
  policy_state: Record<string, unknown>;
  simulation_state: Record<string, unknown>;
  score_breakdown: Record<string, unknown>;
  final_score: number | null;
  final_result: Record<string, unknown>;
  started_by: string;
  started_at: string;
  submitted_at: string | null;
  reset_by: string | null;
  reset_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeagueChallengeRoleAssignment = {
  id: string;
  attempt_id: string;
  user_id: string;
  role_type: ChallengeCountryRole;
  is_primary: boolean;
  assigned_by: string | null;
  created_at: string;
};

export type LeagueChallengeStageDecision = {
  id: string;
  attempt_id: string;
  stage_number: number;
  policy_state: Record<string, unknown>;
  simulation_state: Record<string, unknown>;
  result: Record<string, unknown>;
  locked_by: string;
  locked_at: string;
};

export type LeagueGhostVisibility =
  | "private"
  | "anonymous_league"
  | "public_after_unlock";

export type LeagueGhostStrategy = {
  id: string;
  source_attempt_id: string | null;
  source_challenge_id: string | null;
  source_team_id: string | null;
  source_school_id: string | null;
  simulation_type: LeagueSimulationType;
  name: string;
  visibility: LeagueGhostVisibility;
  strategy_version: number;
  behaviour_type: "historical_sequence" | "conditional";
  behaviour_data: Record<string, unknown>;
  source_revealed_at: string | null;
  created_at: string;
};

export type LeagueLeaderboardRow = {
  rank: number;
  team_id: string;
  team_name: string;
  school_id: string;
  school_name: string;
  challenges_completed: number;
  performance_score: number;
};
