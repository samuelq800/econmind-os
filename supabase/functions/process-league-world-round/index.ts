import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_WORLD_SCENARIO, TWELVE_COUNTRY_WORLD_SCENARIO, createWorldState, settleWorldRound } from "../../../lib/economics/world/index.ts";
import type { CountrySubmission, InternationalAgreement, ScenarioConfig, WorldState } from "../../../lib/economics/world/types.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type Json = Record<string, unknown>;
type DbCountry = { id: string; country_template_id: string; display_name: string; assigned_team_id: string | null };
type DbTemplate = { id: string; slug: string; name: string; specialisation: string; config: Json; balance_score: number };
type DbAgreement = { id: string; agreement_type: InternationalAgreement["type"]; proposer_country_id: string; status: InternationalAgreement["status"]; terms: Json; starts_round: number; ends_round: number };
type DbParticipant = { agreement_id: string; country_id: string; required_role: string; approval_status: string };

const reply = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const asRecord = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const asArray = <T>(value: unknown) => Array.isArray(value) ? value as T[] : [];

function scenarioConfig(scenario: { id: string; config: unknown }, templates: DbTemplate[]): ScenarioConfig {
  const saved = asRecord(scenario.config);
  const baseline = Number(saved.numberOfCountries ?? DEFAULT_WORLD_SCENARIO.numberOfCountries) === 12
    ? TWELVE_COUNTRY_WORLD_SCENARIO
    : DEFAULT_WORLD_SCENARIO;
  return {
    ...baseline,
    ...saved,
    version: Number(saved.version ?? baseline.version),
    type: "league_world",
    countryTemplates: templates.map((template) => ({
      id: template.id,
      slug: template.slug,
      name: template.name,
      specialisation: template.specialisation,
      config: template.config as ScenarioConfig["countryTemplates"][number]["config"],
      balanceScore: Number(template.balance_score),
    })),
    markets: asArray<ScenarioConfig["markets"][number]>(saved.markets).length ? asArray(saved.markets) : baseline.markets,
    shocks: asArray<ScenarioConfig["shocks"][number]>(saved.shocks).length ? asArray(saved.shocks) : baseline.shocks,
    scoringWeights: { ...baseline.scoringWeights, ...asRecord(saved.scoringWeights) } as ScenarioConfig["scoringWeights"],
  };
}

function initialOrPriorState(prior: unknown, config: ScenarioConfig, countries: DbCountry[], scenarioId: string): WorldState {
  if (prior && typeof prior === "object") return prior as WorldState;
  const templateById = new Map(config.countryTemplates.map((template) => [template.id, template]));
  const initial = createWorldState(config);
  return {
    ...initial,
    scenarioId,
    countries: countries.map((country) => {
      const base = initial.countries.find((entry) => entry.templateId === country.country_template_id)
        ?? createWorldState({ ...config, countryTemplates: [templateById.get(country.country_template_id)!], numberOfCountries: 1 }).countries[0];
      return { ...base, countryId: country.id, countryName: country.display_name, templateId: country.country_template_id };
    }),
  };
}

function agreementsFromRows(rows: DbAgreement[], participants: DbParticipant[]): InternationalAgreement[] {
  return rows.map((agreement) => {
    const members = participants.filter((participant) => participant.agreement_id === agreement.id);
    return {
      id: agreement.id,
      type: agreement.agreement_type,
      proposerCountryId: agreement.proposer_country_id,
      participantCountryIds: [...new Set(members.map((member) => member.country_id))],
      status: agreement.status,
      terms: agreement.terms,
      startsRound: agreement.starts_round as 1 | 2 | 3,
      endsRound: agreement.ends_round as 1 | 2 | 3,
      approvals: members.map((member) => ({ countryId: member.country_id, requiredRole: member.required_role as InternationalAgreement["approvals"][number]["requiredRole"], approved: member.approval_status === "approved" })),
    };
  });
}

async function requireDirector(request: Request, admin: ReturnType<typeof createClient>) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication is required.");
  const { data: auth, error } = await admin.auth.getUser(token);
  if (error || !auth.user) throw new Error("Your session is invalid.");
  const { data: profile } = await admin.from("profiles").select("platform_role").eq("user_id", auth.user.id).maybeSingle();
  if (profile?.platform_role !== "platform_admin") throw new Error("Competition director permission is required.");
  return { userId: auth.user.id, token };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ ok: false, message: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceRole || !anonKey) return reply({ ok: false, message: "Protected Supabase Edge Function configuration is incomplete." }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  let competitionId = "";
  let roundId = "";
  try {
    const actor = await requireDirector(request, admin);
    const payload = await request.json().catch(() => ({})) as { competitionId?: string; roundId?: string; idempotencyKey?: string };
    competitionId = payload.competitionId?.trim() ?? "";
    roundId = payload.roundId?.trim() ?? "";
    if (!competitionId || !roundId) return reply({ ok: false, message: "competitionId and roundId are required." }, 400);

    // The caller-scoped RPC takes the database row lock. The service client is
    // used only after that lock succeeds, never from browser code.
    const caller = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${actor.token}` } } });
    const idempotencyKey = payload.idempotencyKey?.trim() || crypto.randomUUID();
    const { data: claim, error: claimError } = await caller.rpc("claim_world_processing", { p_competition_id: competitionId, p_round_id: roundId, p_idempotency_key: idempotencyKey });
    if (claimError) throw new Error(claimError.message);
    if (!asRecord(claim).claimed) {
      if (asRecord(claim).reason === "already_processing") return reply({ ok: false, message: "This round is already being processed. Refresh shortly for the recorded result." }, 409);
      const { data: existing } = await admin.from("world_states").select("settlement_hash,created_at").eq("round_id", roundId).eq("processing_status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return reply({ ok: true, idempotent: true, settlementHash: existing?.settlement_hash ?? null });
    }

    const [{ data: competition, error: competitionError }, { data: round, error: roundError }, { data: countries, error: countriesError }, { data: submissions, error: submissionsError }] = await Promise.all([
      admin.from("competitions").select("id,scenario_id,current_round,status,config").eq("id", competitionId).single(),
      admin.from("competition_rounds").select("id,round_number,status").eq("id", roundId).eq("competition_id", competitionId).single(),
      admin.from("competition_countries").select("id,country_template_id,display_name,assigned_team_id").eq("competition_id", competitionId).order("id"),
      admin.from("country_submissions").select("country_id,policy_package,agreement_actions,status,finalised_by").eq("competition_id", competitionId).eq("round_id", roundId).eq("status", "finalised"),
    ]);
    if (competitionError || roundError || countriesError || submissionsError || !competition || !round) throw new Error(competitionError?.message ?? roundError?.message ?? countriesError?.message ?? submissionsError?.message ?? "Competition data could not be loaded.");
    const { data: scenarioMeta, error: scenarioMetaError } = await admin.from("scenario_definitions").select("config").eq("id", competition.scenario_id).single();
    if (scenarioMetaError || !scenarioMeta) throw new Error(scenarioMetaError?.message ?? "Scenario configuration could not be loaded.");
    const expectedCountries = Number(asRecord(scenarioMeta.config).numberOfCountries ?? 4);
    const isOpenIndividualWorld = Boolean(asRecord(competition.config).openIndividualRegistration);
    if ((countries as DbCountry[]).length !== expectedCountries || (!isOpenIndividualWorld && (countries as DbCountry[]).some((country) => !country.assigned_team_id)) || (submissions ?? []).length !== expectedCountries) {
      throw new Error(`All ${expectedCountries} countries must have finalised a submission before clearing.`);
    }

    const [{ data: scenario, error: scenarioError }, { data: templates, error: templatesError }, { data: prior }, { data: agreements }] = await Promise.all([
      admin.from("scenario_definitions").select("id,config").eq("id", competition.scenario_id).single(),
      admin.from("country_templates").select("id,slug,name,specialisation,config,balance_score").eq("scenario_id", competition.scenario_id),
      admin.from("world_states").select("state_after").eq("competition_id", competitionId).eq("processing_status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("international_agreements").select("id,agreement_type,proposer_country_id,status,terms,starts_round,ends_round").eq("competition_id", competitionId),
    ]);
    if (scenarioError || templatesError || !scenario) throw new Error(scenarioError?.message ?? templatesError?.message ?? "Scenario data could not be loaded.");
    const agreementRows = (agreements ?? []) as DbAgreement[];
    const { data: allParticipants, error: participantError } = agreementRows.length
      ? await admin.from("agreement_participants").select("agreement_id,country_id,required_role,approval_status").in("agreement_id", agreementRows.map((agreement) => agreement.id))
      : { data: [] as DbParticipant[], error: null };
    if (participantError) throw new Error(participantError.message);
    const config = scenarioConfig(scenario, (templates ?? []) as DbTemplate[]);
    let world = initialOrPriorState(prior?.state_after, config, countries as DbCountry[], scenario.id);
    world = { ...world, agreements: agreementsFromRows(agreementRows, allParticipants ?? []) };
    if (world.round !== round.round_number) throw new Error("The requested round is not the next deterministic world state.");
    const settlement = settleWorldRound(world, (submissions ?? []).map((submission) => ({ countryId: submission.country_id, round: round.round_number as 1 | 2 | 3, decisions: asRecord(submission.policy_package).decisions as CountrySubmission["decisions"], agreementActions: asArray<string>(submission.agreement_actions), finalised: true, finalisedBy: submission.finalised_by })) as CountrySubmission[], config);

    const { error: stateError } = await admin.from("world_states").insert({ competition_id: competitionId, round_id: roundId, version: settlement.state.settlementVersion, state_before: world, state_after: settlement.state, settlement_hash: settlement.result.settlementHash, processing_status: "completed", processed_by: actor.userId });
    if (stateError) throw new Error(stateError.message);
    const { error: resultError } = await admin.from("country_round_results").insert(settlement.result.countryResults.map((result) => ({ competition_id: competitionId, round_id: roundId, country_id: result.countryId, state_before: result.stateBefore, decisions: result.decisions, domestic_effects: result.domesticEffects, international_effects: result.internationalEffects, state_after: result.stateAfter, scores: result.scores, explanations: result.explanations })));
    if (resultError) throw new Error(resultError.message);
    if (settlement.result.tradeFlows.length) {
      const { error: flowError } = await admin.from("trade_flows").insert(settlement.result.tradeFlows.map((flow) => ({ competition_id: competitionId, round_id: roundId, exporter_country_id: flow.exporterCountryId, importer_country_id: flow.importerCountryId, commodity: flow.commodity, quantity: flow.quantity, base_price: flow.basePrice, tariff: flow.tariff, transport_cost: flow.transportCost, agreement_id: flow.agreementId, fulfilment_ratio: flow.fulfilmentRatio, status: flow.status })));
      if (flowError) throw new Error(flowError.message);
    }
    const { error: finalizeError } = await admin.from("competition_rounds").update({ status: "processed", processed_at: new Date().toISOString(), processing_error: null }).eq("id", roundId);
    if (finalizeError) throw new Error(finalizeError.message);
    await Promise.all([
      admin.from("country_submissions").update({ status: "processed" }).eq("round_id", roundId),
      admin.from("competitions").update({ status: "round_results" }).eq("id", competitionId),
      admin.from("competition_events").insert({ competition_id: competitionId, round_id: roundId, event_type: "processing", payload: { settlementHash: settlement.result.settlementHash, round: round.round_number }, created_by: actor.userId }),
    ]);
    return reply({ ok: true, idempotent: false, settlementHash: settlement.result.settlementHash, round: round.round_number });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown world-processing error.";
    if (roundId) await admin.from("competition_rounds").update({ status: "failed", processing_error: message }).eq("id", roundId).eq("competition_id", competitionId);
    return reply({ ok: false, message }, 400);
  }
});
