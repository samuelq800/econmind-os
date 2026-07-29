import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AgreementType, CompetitionRole, CompetitionStatus, InstitutionType } from "@/lib/economics/world";
import type { CompetitionSnapshot, LeagueAgreement, LeagueCompetition, LeagueCompetitionCountry, LeagueCompetitionRole, LeagueCompetitionRound, LeagueCountryResult, LeagueCountrySubmission, LeagueCountryTemplate, LeagueEvent, LeagueInstitutionDraft, LeagueScenario, LeagueTradeFlow } from "@/lib/league/world-league-types";
import { getSupabaseBrowserClient } from "./client";

function client() { const supabase = getSupabaseBrowserClient(); if (!supabase) throw new Error("Supabase is not configured."); return supabase; }
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function listLeagueCompetitions() {
  const { data, error } = await client().from("competitions").select("*, scenario:scenario_definitions(*)").order("updated_at", { ascending: false });
  fail(error); return (data ?? []) as LeagueCompetition[];
}

export async function getLeagueCompetition(competitionId: string): Promise<CompetitionSnapshot | null> {
  const supabase = client();
  const { data: competition, error } = await supabase.from("competitions").select("*, scenario:scenario_definitions(*)").eq("id", competitionId).maybeSingle();
  fail(error); if (!competition) return null;
  const [{ data: countries, error: countriesError }, { data: roles, error: rolesError }, { data: rounds, error: roundsError }, { data: drafts, error: draftsError }, { data: submissions, error: submissionsError }, { data: agreements, error: agreementsError }, { data: results, error: resultsError }, { data: tradeFlows, error: tradeFlowsError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("competition_countries").select("*, template:country_templates(*), school:schools(id,name), team:teams(id,name,school_id)").eq("competition_id", competitionId).order("display_name"),
    supabase.from("competition_roles").select("*, profile:profiles!competition_roles_user_id_fkey(user_id,display_name)").eq("competition_id", competitionId).order("assigned_at"),
    supabase.from("competition_rounds").select("*").eq("competition_id", competitionId).order("round_number"),
    supabase.from("institution_drafts").select("*").eq("competition_id", competitionId).order("updated_at", { ascending: false }),
    supabase.from("country_submissions").select("*").eq("competition_id", competitionId).order("updated_at", { ascending: false }),
    supabase.from("international_agreements").select("*, participants:agreement_participants(*)").eq("competition_id", competitionId).order("created_at", { ascending: false }),
    supabase.from("country_round_results").select("*").eq("competition_id", competitionId).order("created_at", { ascending: false }),
    supabase.from("trade_flows").select("*").eq("competition_id", competitionId).order("created_at", { ascending: false }),
    supabase.from("competition_events").select("*").eq("competition_id", competitionId).order("created_at", { ascending: false }).limit(60),
  ]);
  [countriesError, rolesError, roundsError, draftsError, submissionsError, agreementsError, resultsError, tradeFlowsError, eventsError].forEach(fail);
  return { competition: competition as LeagueCompetition, countries: (countries ?? []) as LeagueCompetitionCountry[], roles: (roles ?? []) as LeagueCompetitionRole[], rounds: (rounds ?? []) as LeagueCompetitionRound[], drafts: (drafts ?? []) as LeagueInstitutionDraft[], submissions: (submissions ?? []) as LeagueCountrySubmission[], agreements: (agreements ?? []) as LeagueAgreement[], results: (results ?? []) as LeagueCountryResult[], tradeFlows: (tradeFlows ?? []) as LeagueTradeFlow[], events: (events ?? []) as LeagueEvent[] };
}

export async function listLeagueScenarios(includeArchived = false) {
  const query = client().from("scenario_definitions").select("*").order("updated_at", { ascending: false });
  const { data, error } = includeArchived ? await query : await query.neq("status", "archived");
  fail(error); return (data ?? []) as LeagueScenario[];
}

export async function listMyScenarioEditorAccess(userId: string) {
  const { data, error } = await client().from("scenario_editor_access").select("scenario_id").eq("user_id", userId);
  fail(error); return new Set((data ?? []).map((item) => item.scenario_id as string));
}

export async function getLeagueScenario(scenarioId: string) {
  const [{ data: scenario, error }, { data: templates, error: templatesError }] = await Promise.all([
    client().from("scenario_definitions").select("*").eq("id", scenarioId).maybeSingle(),
    client().from("country_templates").select("*").eq("scenario_id", scenarioId).order("slug"),
  ]);
  fail(error); fail(templatesError); return { scenario: scenario as LeagueScenario | null, templates: (templates ?? []) as LeagueCountryTemplate[] };
}

export async function createLeagueScenario(input: Pick<LeagueScenario, "title" | "slug" | "description" | "scenario_type" | "config">) {
  const { data, error } = await client().from("scenario_definitions").insert({ ...input, status: "draft" }).select("*").single();
  fail(error); return data as LeagueScenario;
}

export async function updateLeagueScenario(scenarioId: string, patch: Partial<Pick<LeagueScenario, "title" | "slug" | "description" | "status" | "config" | "published_at" | "archived_at">>) {
  const { data, error } = await client().from("scenario_definitions").update(patch).eq("id", scenarioId).select("*").single();
  fail(error); return data as LeagueScenario;
}

export async function saveCountryTemplate(template: Partial<LeagueCountryTemplate> & Pick<LeagueCountryTemplate, "scenario_id" | "slug" | "name" | "specialisation" | "config">) {
  const payload = { ...template, balance_score: template.balance_score ?? 100 };
  const { data, error } = template.id ? await client().from("country_templates").update(payload).eq("id", template.id).select("*").single() : await client().from("country_templates").insert(payload).select("*").single();
  fail(error); return data as LeagueCountryTemplate;
}

export async function createLeagueCompetition(input: { scenarioId: string; name: string; description: string; assignmentMethod: "manual" | "random" | "balanced_random" | "snake_draft" }) {
  const { data, error } = await client().rpc("create_league_competition", { p_scenario_id: input.scenarioId, p_name: input.name, p_description: input.description, p_assignment_method: input.assignmentMethod });
  fail(error); return data as LeagueCompetition;
}

export async function transitionLeagueCompetition(competitionId: string, status: CompetitionStatus, note?: string) {
  const { data, error } = await client().rpc("transition_competition_state", { p_competition_id: competitionId, p_next_status: status, p_note: note ?? null });
  fail(error); return data as LeagueCompetition;
}

export async function claimCompetitionRole(competitionId: string, countryId: string, role: Exclude<CompetitionRole, "observer">, captain = false) {
  const { data, error } = await client().rpc("claim_competition_role", { p_competition_id: competitionId, p_country_id: countryId, p_role_type: role, p_is_captain: captain });
  fail(error); return data as LeagueCompetitionRole;
}

export async function saveInstitutionDraft(input: { competitionId: string; roundId: string; countryId: string; institution: InstitutionType; draftState: Record<string, unknown> }) {
  const { data, error } = await client().rpc("save_institution_draft", { p_competition_id: input.competitionId, p_round_id: input.roundId, p_country_id: input.countryId, p_institution_type: input.institution, p_draft_state: input.draftState });
  fail(error); return data as LeagueInstitutionDraft;
}

export async function lockInstitutionDraft(draftId: string) { const { data, error } = await client().rpc("lock_institution_draft", { p_draft_id: draftId }); fail(error); return data as LeagueInstitutionDraft; }
export async function finaliseCountrySubmission(input: { competitionId: string; roundId: string; countryId: string; agreementActions?: string[] }) {
  const { data, error } = await client().rpc("finalise_country_submission", { p_competition_id: input.competitionId, p_round_id: input.roundId, p_country_id: input.countryId, p_policy_package: {}, p_agreement_actions: input.agreementActions ?? [] });
  fail(error); return data as LeagueCountrySubmission;
}

export async function proposeAgreement(input: { competitionId: string; proposerCountryId: string; type: AgreementType; terms: Record<string, unknown>; participantCountryIds: string[]; requiredRoles: InstitutionType[]; startsRound: number; endsRound: number }) {
  const { data, error } = await client().rpc("propose_international_agreement", { p_competition_id: input.competitionId, p_proposer_country_id: input.proposerCountryId, p_agreement_type: input.type, p_terms: input.terms, p_participant_country_ids: input.participantCountryIds, p_required_roles: input.requiredRoles, p_starts_round: input.startsRound, p_ends_round: input.endsRound });
  fail(error); return data as LeagueAgreement;
}

export async function approveAgreement(participantId: string, approval: "approved" | "rejected") { const { data, error } = await client().rpc("approve_agreement_participant", { p_participant_id: participantId, p_approval: approval }); fail(error); return data; }
export async function publishCompetitionRound(competitionId: string, roundId: string) { const { data, error } = await client().rpc("publish_competition_round", { p_competition_id: competitionId, p_round_id: roundId }); fail(error); return data as LeagueCompetitionRound; }
export async function recoverWorldProcessing(competitionId: string, roundId: string, note: string) { const { data, error } = await client().rpc("recover_world_processing", { p_competition_id: competitionId, p_round_id: roundId, p_note: note }); fail(error); return data as LeagueCompetitionRound; }

export async function processLeagueWorldRound(competitionId: string, roundId: string) {
  const { data: session } = await client().auth.getSession();
  if (!session.session?.access_token) throw new Error("Please sign in again before settling a round.");
  const { data, error } = await client().functions.invoke("process-league-world-round", { body: { competitionId, roundId, idempotencyKey: crypto.randomUUID() }, headers: { Authorization: `Bearer ${session.session.access_token}` } });
  if (error) throw new Error(error.message); if (!data?.ok) throw new Error(data?.message ?? "World clearing did not complete."); return data as { ok: true; idempotent: boolean; settlementHash: string | null; round?: number };
}

export async function assignCompetitionCountry(input: { countryId: string; schoolId: string; teamId: string }) {
  const { data, error } = await client().from("competition_countries").update({ assigned_school_id: input.schoolId, assigned_team_id: input.teamId, status: "assigned" }).eq("id", input.countryId).select("*").single();
  fail(error); return data as LeagueCompetitionCountry;
}

export async function assignCompetitionRole(input: { competitionId: string; countryId: string; userId: string; role: Exclude<CompetitionRole, "observer">; isCaptain?: boolean }) {
  const { data: auth } = await client().auth.getUser();
  const { data, error } = await client().from("competition_roles").upsert({ competition_id: input.competitionId, country_id: input.countryId, user_id: input.userId, role_type: input.role, is_captain: input.isCaptain ?? input.role === "country_captain", assigned_by: auth.user?.id ?? null }, { onConflict: "competition_id,country_id,role_type" }).select("*").single();
  fail(error); return data as LeagueCompetitionRole;
}

export async function removeCompetitionRole(roleId: string) { const { error } = await client().from("competition_roles").delete().eq("id", roleId); fail(error); }

export function subscribeToLeagueCompetition(competitionId: string, onChange: () => void): RealtimeChannel | null {
  const supabase = getSupabaseBrowserClient(); if (!supabase) return null;
  return supabase.channel(`league-competition-${competitionId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "competitions", filter: `id=eq.${competitionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "competition_rounds", filter: `competition_id=eq.${competitionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "institution_drafts", filter: `competition_id=eq.${competitionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "country_submissions", filter: `competition_id=eq.${competitionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "international_agreements", filter: `competition_id=eq.${competitionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "trade_flows", filter: `competition_id=eq.${competitionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "competition_events", filter: `competition_id=eq.${competitionId}` }, onChange)
    .subscribe();
}

export function unsubscribeLeagueCompetition(channel: RealtimeChannel | null) { if (channel) void client().removeChannel(channel); }
