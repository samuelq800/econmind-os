import type { AdvanceQuarterResult, CommandCentreResultType, CommandCentreState } from "@/lib/economics/command-centre";
import type { Team } from "./types";

export type SandboxMode = "personal" | "team";
export type SandboxRunStatus = "draft" | "active" | "completed" | "abandoned";
export type SandboxScenario = { id: string; slug: string; title: string; description: string; initial_state: Record<string, unknown>; round_config: Record<string, unknown>; is_active: boolean; created_at: string; updated_at: string };
export type SandboxRun = {
  id: string; user_id: string; team_id: string | null; scenario_id: string; mode: SandboxMode; status: SandboxRunStatus; current_round: 1 | 2 | 3;
  current_state: CommandCentreState; final_state: CommandCentreState; final_score: number | null; result_type: CommandCentreResultType | null;
  started_at: string; completed_at: string | null; created_at: string; updated_at: string; team?: Pick<Team, "id" | "name" | "school_id" | "captain_user_id"> | null; scenario?: Pick<SandboxScenario, "slug" | "title"> | null;
};
export type SandboxRound = {
  id: string; run_id: string; round_number: 1 | 2 | 3; state_before: CommandCentreState; policy_package: AdvanceQuarterResult["policy"];
  shock_applied: AdvanceQuarterResult["shock"] | null; pending_effects_before: CommandCentreState["pendingEffects"]; pending_effects_after: CommandCentreState["pendingEffects"];
  state_after: CommandCentreState; explanations: AdvanceQuarterResult["explanation"]; score_snapshot: AdvanceQuarterResult["scoreSnapshot"]; created_at: string;
};
