import { createClient } from "npm:@supabase/supabase-js@2";
import { advanceContinuousWorld, type CalibratedPolicyDefinition, type ContinuousPolicyAction, type ContinuousWorldState } from "../../../lib/economics/continuous-world/index.ts";

type Json = Record<string, unknown>;
type ClaimedWorld = { world_id: string; calibration_version: string; calibration_manifest: Json; current_state: Json; state_version: number };
type ActionRow = { id: string; country_key: string; action_key: string; parameters: Json; status: "scheduled" | "active" | "expired" | "cancelled"; effective_at: string; expires_at: string | null };

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const asRecord = (value: unknown): Json => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const numberPair = (value: unknown): [number, number] | null => {
  const items = asArray<unknown>(value).map(Number);
  return items.length === 2 && items.every(Number.isFinite) ? [items[0], items[1]] : null;
};

function policyDefinitions(payload: Json): Record<string, CalibratedPolicyDefinition> {
  return Object.fromEntries(asArray<Json>(payload.policies).flatMap((policy) => {
    const id = typeof policy.id === "string" ? policy.id : "";
    const allowed = numberPair(policy.allowed_range);
    const lag = numberPair(policy.implementation_lag_days);
    const ramp = numberPair(policy.ramp_days);
    const peak = numberPair(policy.peak_days);
    const decay = numberPair(policy.decay_half_life_days);
    const duration = Number(policy.max_duration_days);
    const effects = Object.fromEntries(Object.entries(asRecord(policy.effects_per_impulse)).flatMap(([metric, value]) => {
      const range = asArray<unknown>(value).map(Number);
      return range.length === 3 && range.every(Number.isFinite) ? [[metric, range as [number, number, number]]] : [];
    }));
    if (!id || !allowed || !lag || !ramp || !peak || !decay || !Number.isFinite(duration)) return [];
    return [[id, { id, allowed_range: allowed, implementation_lag_days: lag, ramp_days: ramp, peak_days: peak, decay_half_life_days: decay, max_duration_days: duration, effects_per_impulse: effects }]];
  }));
}

function stateForTick(row: ClaimedWorld): ContinuousWorldState {
  const state = row.current_state;
  const lastProcessedAt = typeof state.lastProcessedAt === "string" ? state.lastProcessedAt : "";
  if (!lastProcessedAt || !Array.isArray(state.countries) || !Array.isArray(state.markets)) throw new Error(`${row.world_id} does not yet contain a launch-ready continuous world state.`);
  return {
    worldId: row.world_id,
    calibrationVersion: row.calibration_version,
    lastProcessedAt,
    stateVersion: row.state_version,
    countries: asArray<ContinuousWorldState["countries"][number]>(state.countries),
    markets: asArray<ContinuousWorldState["markets"][number]>(state.markets),
  };
}

async function authorised(request: Request, admin: ReturnType<typeof createClient>) {
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("CONTINUOUS_WORLD_CRON_SECRET");
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return false;
  const { data: role } = await admin.from("profile_platform_roles").select("role").eq("user_id", auth.user.id).in("role", ["league_admin", "platform_admin"]);
  const { data: legacy } = await admin.from("profiles").select("platform_role").eq("user_id", auth.user.id).maybeSingle();
  return Boolean(role?.length || legacy?.platform_role === "platform_admin" || legacy?.platform_role === "school_leader");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ ok: false, message: "POST only" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return reply({ ok: false, message: "Protected Supabase Edge Function configuration is incomplete." }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  if (!await authorised(request, admin)) return reply({ ok: false, message: "League administrator or protected cron authorization is required." }, 401);

  const payload = await request.json().catch(() => ({})) as { limit?: number };
  const claimToken = crypto.randomUUID();
  const limit = Math.min(12, Math.max(1, Number(payload.limit) || 4));
  const { data: claimed, error: claimError } = await admin.rpc("claim_due_continuous_world_ticks", { p_claim_token: claimToken, p_limit: limit });
  if (claimError) return reply({ ok: false, message: claimError.message }, 500);

  const { data: packageRows, error: packageError } = await admin.from("calibration_packages").select("package_key,payload").eq("package_key", "policy_effect_library").eq("status", "active").limit(1);
  if (packageError || !packageRows?.[0]) return reply({ ok: false, message: packageError?.message ?? "No active policy calibration package is available." }, 409);
  const definitions = policyDefinitions(asRecord(packageRows[0].payload));
  const outcomes: Json[] = [];

  for (const row of (claimed ?? []) as ClaimedWorld[]) {
    try {
      const { data: actionRows, error: actionError } = await admin
        .from("continuous_world_actions")
        .select("id,country_key,action_key,parameters,status,effective_at,expires_at")
        .eq("world_id", row.world_id)
        .in("status", ["scheduled", "active"])
        .lte("effective_at", new Date().toISOString());
      if (actionError) throw new Error(actionError.message);
      const actions = (actionRows ?? []).flatMap((action: ActionRow): ContinuousPolicyAction[] => {
        const change = Number(action.parameters.change);
        return Number.isFinite(change) ? [{ id: action.id, countryId: action.country_key, policyId: action.action_key, change, startsAt: action.effective_at, endsAt: action.expires_at, status: action.status }] : [];
      });
      const processedAt = new Date().toISOString();
      const tick = advanceContinuousWorld(stateForTick(row), actions, definitions, processedAt);
      const persistedState = { ...tick.state, lastProcessedAt: processedAt };
      const { error: completeError } = await admin.rpc("complete_continuous_world_tick", {
        p_world_id: row.world_id,
        p_claim_token: claimToken,
        p_previous_state_version: row.state_version,
        p_state_after: persistedState,
        p_effect_summary: tick.appliedEffects,
      });
      if (completeError) throw new Error(completeError.message);
      if (actions.length) await admin.from("continuous_world_actions").update({ status: "active" }).in("id", actions.map((action) => action.id));
      outcomes.push({ worldId: row.world_id, ok: true, stateVersion: tick.state.stateVersion, processedDays: tick.processedDays });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown continuous-world processing error.";
      await admin.rpc("fail_continuous_world_tick", { p_world_id: row.world_id, p_claim_token: claimToken, p_reason: message });
      outcomes.push({ worldId: row.world_id, ok: false, message });
    }
  }
  return reply({ ok: true, claimed: (claimed ?? []).length, outcomes });
});
