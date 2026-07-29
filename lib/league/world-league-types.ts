import type { AgreementStatus, AgreementType, CompetitionRole, CompetitionStatus, InstitutionType } from "@/lib/economics/world";

export type ScenarioLifecycle = "draft" | "validating" | "invalid" | "ready_for_test" | "testing" | "published" | "archived";
export type CompetitionRoundStatus = "pending" | "briefing" | "planning" | "negotiation" | "submission_open" | "locked" | "processing" | "processed" | "published" | "failed";

export type LeagueScenario = {
  id: string; title: string; slug: string; description: string; scenario_type: "domestic" | "league_world" | "command_centre";
  status: ScenarioLifecycle; config: Record<string, unknown>; created_by: string | null; published_at: string | null; archived_at: string | null; created_at: string; updated_at: string;
};

export type LeagueCountryTemplate = {
  id: string; scenario_id: string; slug: string; name: string; display_name: string; short_code: string; category: string; tagline: string; description: string; specialisation: string;
  config: Record<string, unknown>; sector_shares: Record<string, number>; macro_modifiers: Record<string, number>; commodity_capacity: Record<string, number>; policy_sensitivities: Record<string, number>; shock_sensitivities: Record<string, number>; viable_strategies: string[]; visual_identity: Record<string, string>;
  balance_score: number; version: number; status: "draft" | "published" | "archived"; published_at: string | null; config_hash: string; is_active: boolean; created_at: string; updated_at: string;
};
export type LeagueCompetition = {
  id: string; scenario_id: string; name: string; description: string; status: CompetitionStatus; current_round: number; round_duration_seconds: number | null;
  leaderboard_visibility: "hidden" | "after_round" | "always"; config: Record<string, unknown>; created_by: string | null; started_at: string | null; completed_at: string | null; state_changed_at: string; created_at: string; updated_at: string;
  scenario?: LeagueScenario | null;
};
export type LeagueCompetitionRound = { id: string; competition_id: string; round_number: number; status: CompetitionRoundStatus; opens_at: string | null; locks_at: string | null; processing_started_at: string | null; processed_at: string | null; published_at: string | null; processing_error: string | null; created_at: string; updated_at: string };
export type LeagueCompetitionCountry = { id: string; competition_id: string; country_template_id: string; template_version: number; immutable_template_snapshot: Record<string, unknown>; assigned_school_id: string | null; assigned_team_id: string | null; display_name: string; status: "unassigned" | "assigned" | "ready" | "active" | "completed"; template?: LeagueCountryTemplate | null; school?: { id: string; name: string } | null; team?: { id: string; name: string; school_id: string } | null };
export type LeagueCompetitionRole = { id: string; competition_id: string; country_id: string | null; user_id: string; role_type: CompetitionRole; is_captain: boolean; assigned_at: string; assigned_by: string | null; profile?: { user_id: string; display_name: string | null } | null };
export type LeagueInstitutionDraft = { id: string; competition_id: string; round_id: string; country_id: string; institution_type: InstitutionType; created_by: string; draft_state: Record<string, unknown>; locked_state: Record<string, unknown> | null; status: "draft" | "locked" | "unlocked"; locked_at: string | null; updated_at: string; created_at: string };
export type LeagueCountrySubmission = { id: string; competition_id: string; round_id: string; country_id: string; policy_package: Record<string, unknown>; agreement_actions: string[]; status: "draft" | "finalised" | "locked" | "processed"; finalised_by: string | null; finalised_at: string | null; updated_at: string };
export type LeagueAgreement = { id: string; competition_id: string; agreement_type: AgreementType; proposer_country_id: string; status: AgreementStatus; terms: Record<string, unknown>; starts_round: number; ends_round: number; created_at: string; updated_at: string; participants?: LeagueAgreementParticipant[] };
export type LeagueAgreementParticipant = { id: string; agreement_id: string; country_id: string; required_role: InstitutionType; approval_status: "pending" | "approved" | "rejected"; approved_by: string | null; approved_at: string | null };
export type LeagueCountryResult = { id: string; competition_id: string; round_id: string; country_id: string; state_before: Record<string, unknown>; decisions: Record<string, unknown>; domestic_effects: string[]; international_effects: string[]; state_after: Record<string, unknown>; scores: Record<string, number>; explanations: Record<string, unknown>; created_at: string };
export type LeagueTradeFlow = { id: string; competition_id: string; round_id: string; exporter_country_id: string; importer_country_id: string; commodity: string; quantity: number; base_price: number; tariff: number; transport_cost: number; agreement_id: string | null; fulfilment_ratio: number; status: string; created_at: string };
export type LeagueEvent = { id: string; competition_id: string; round_id: string | null; event_type: "announcement" | "state_change" | "shock" | "round_published" | "processing" | "recovery"; payload: Record<string, unknown>; created_by: string | null; created_at: string };
export type CompetitionSnapshot = { competition: LeagueCompetition; countries: LeagueCompetitionCountry[]; roles: LeagueCompetitionRole[]; rounds: LeagueCompetitionRound[]; drafts: LeagueInstitutionDraft[]; submissions: LeagueCountrySubmission[]; agreements: LeagueAgreement[]; results: LeagueCountryResult[]; tradeFlows: LeagueTradeFlow[]; events: LeagueEvent[] };
