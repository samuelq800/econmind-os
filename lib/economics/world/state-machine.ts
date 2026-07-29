import type { CompetitionStatus } from "./types.ts";

const transitions: Record<CompetitionStatus, CompetitionStatus[]> = {
  draft: ["registration", "cancelled"],
  registration: ["country_assignment", "paused", "cancelled"],
  country_assignment: ["role_assignment", "paused", "cancelled"],
  role_assignment: ["briefing", "paused", "cancelled"],
  briefing: ["internal_planning", "paused", "cancelled"],
  internal_planning: ["negotiation", "submission_open", "paused", "cancelled"],
  negotiation: ["submission_open", "paused", "cancelled"],
  submission_open: ["submission_locked", "paused", "cancelled"],
  submission_locked: ["domestic_processing", "paused", "cancelled"],
  domestic_processing: ["world_processing", "paused", "cancelled"],
  world_processing: ["round_results", "paused", "cancelled"],
  round_results: ["shock", "next_round", "completed", "paused", "cancelled"],
  shock: ["next_round", "paused", "cancelled"],
  next_round: ["briefing", "completed", "paused", "cancelled"],
  completed: [],
  paused: ["registration", "country_assignment", "role_assignment", "briefing", "internal_planning", "negotiation", "submission_open", "submission_locked", "domestic_processing", "world_processing", "round_results", "shock", "next_round", "cancelled"],
  cancelled: [],
};

export function canTransitionCompetition(from: CompetitionStatus, to: CompetitionStatus) {
  return transitions[from].includes(to);
}

export function assertCompetitionTransition(from: CompetitionStatus, to: CompetitionStatus) {
  if (!canTransitionCompetition(from, to)) throw new Error(`Illegal competition transition: ${from} → ${to}.`);
}

export function statusAllowsDraft(status: CompetitionStatus) {
  return status === "internal_planning" || status === "negotiation" || status === "submission_open";
}

export function statusShowsLeaderboard(status: CompetitionStatus) {
  return status === "round_results" || status === "shock" || status === "next_round" || status === "completed";
}
