import type { CrisisMetrics, CrisisPolicies, CrisisResultType, CrisisScores } from "./crisis-engine";

export type LeaguePlatformRole = "user" | "team_member" | "school_leader" | "platform_admin";
export type SchoolStatus = "pending" | "approved" | "rejected";
export type LeagueApplicationStatus = "submitted" | "under_review" | "approved" | "rejected";

export type LeagueProfile = {
  user_id: string;
  display_name: string | null;
  role?: "student" | "teacher" | "professor";
  platform_role: LeaguePlatformRole;
  school_id: string | null;
  graduation_year: number | null;
  economics_club_name: string | null;
  role_preference: "participant" | "team_lead" | "school_liaison" | null;
  created_at: string;
  updated_at: string;
};

export type School = {
  id: string;
  name: string;
  club_name: string | null;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  status: SchoolStatus;
  liaison_user_id: string | null;
  created_at: string;
  updated_at: string;
};
export type TeamStatus = "active" | "inactive" | "archived";
export type Team = {
  id: string;
  school_id: string;
  name: string;
  slug: string;
  invite_code: string;
  captain_user_id: string;
  created_by: string | null;
  status: TeamStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
export type TeamMember = { id: string; team_id: string; user_id: string; team_role: "captain" | "member"; joined_at: string; team?: Team & { school?: School | null }; profile?: Pick<LeagueProfile, "user_id" | "display_name"> | null };

export type LeagueApplication = {
  id: string; applicant_user_id: string; school_name: string; club_name: string | null; contact_person: string; expected_teams: number; expected_members: number;
  preferred_language: "English" | "Chinese" | "Bilingual"; preferred_format: "online" | "offline" | "either"; organising_committee_interest: boolean; notes: string | null;
  status: LeagueApplicationStatus; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string;
};

export type CrisisRun = {
  id: string; user_id: string; team_id: string | null; scenario_id: string; current_round: number; initial_metrics: CrisisMetrics; final_metrics: CrisisMetrics; dimension_scores: CrisisScores;
  total_score: number; result_type: CrisisResultType; result_summary: Record<string, unknown>; completed_at: string; created_at: string; updated_at: string;
  team?: Pick<Team, "id" | "name" | "school_id"> | null;
};

export type CrisisDecision = {
  id?: string; crisis_run_id?: string; round_number: number; monetary_policy: CrisisPolicies["monetary"]; fiscal_policy: CrisisPolicies["fiscal"]; energy_policy: CrisisPolicies["energy"];
  shock_id: "oil-price-spike" | null; metrics_before: CrisisMetrics; metrics_after: CrisisMetrics; explanation: Record<string, unknown>; created_at?: string;
};

export type LeagueContext = { profile: LeagueProfile | null; school: School | null; membership: TeamMember | null };
