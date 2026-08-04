import { createClient } from "npm:@supabase/supabase-js@2";
import {
  advanceContinuousWorld,
  type CalibratedPolicyDefinition,
  type ContinuousPolicyAction,
  type ContinuousWorldShock,
  type ContinuousWorldState,
} from "../../../lib/economics/continuous-world/index.ts";

type Json = Record<string, unknown>;
const SIMULATION_DAY_MS = 2 * 60 * 60 * 1000;
type ClaimedWorld = {
  world_id: string;
  calibration_version: string;
  calibration_manifest: Json;
  current_state: Json;
  state_version: number;
};
type ActionRow = {
  id: string;
  country_key: string;
  action_key: string;
  parameters: Json;
  status: "scheduled" | "active" | "expired" | "cancelled";
  effective_at: string;
  expires_at: string | null;
};
type ShockRow = {
  id: string;
  shock_key: string;
  country_key: string | null;
  effects: Json;
  status: "scheduled" | "active" | "expired" | "cancelled";
  starts_at: string;
  ends_at: string;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const asRecord = (value: unknown): Json =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];
const numberPair = (value: unknown): [number, number] | null => {
  const items = asArray<unknown>(value).map(Number);
  return items.length === 2 && items.every(Number.isFinite)
    ? [items[0], items[1]]
    : null;
};

function policyDefinitions(
  payload: Json,
): Record<string, CalibratedPolicyDefinition> {
  return Object.fromEntries(
    asArray<Json>(payload.policies).flatMap((policy) => {
      const id = typeof policy.id === "string" ? policy.id : "";
      const allowed = numberPair(policy.allowed_range);
      const lag = numberPair(policy.implementation_lag_days);
      const ramp = numberPair(policy.ramp_days);
      const peak = numberPair(policy.peak_days);
      const decay = numberPair(policy.decay_half_life_days);
      const duration = Number(policy.max_duration_days);
      const effects = Object.fromEntries(
        Object.entries(asRecord(policy.effects_per_impulse)).flatMap(
          ([metric, value]) => {
            const range = asArray<unknown>(value).map(Number);
            return range.length === 3 && range.every(Number.isFinite)
              ? [[metric, range as [number, number, number]]]
              : [];
          },
        ),
      );
      if (
        !id ||
        !allowed ||
        !lag ||
        !ramp ||
        !peak ||
        !decay ||
        !Number.isFinite(duration)
      )
        return [];
      return [
        [
          id,
          {
            id,
            allowed_range: allowed,
            implementation_lag_days: lag,
            ramp_days: ramp,
            peak_days: peak,
            decay_half_life_days: decay,
            max_duration_days: duration,
            effects_per_impulse: effects,
          },
        ],
      ];
    }),
  );
}

const EFFECT_ORDER = [
  "growth_pp",
  "inflation_pp",
  "unemployment_pp",
  "debt_gdp_pp",
  "deficit_gdp_pp",
  "fx_appreciation_percent",
  "reserves_import_months",
  "trade_gdp_pp",
  "productivity_percent",
  "emissions_percent",
  "poverty_pp",
  "public_support_pp",
  "stability_points",
];
const triple = (value: unknown): [number, number, number] | null => {
  const values =
    typeof value === "string"
      ? value.split("/").map(Number)
      : asArray<unknown>(value).map(Number);
  return values.length === 3 && values.every(Number.isFinite)
    ? (values as [number, number, number])
    : null;
};

/** Normalises the supplied long-running teaching policy library to the common engine contract. */
function extendedPolicyDefinitions(
  payload: Json,
): Record<string, CalibratedPolicyDefinition> {
  const library = asRecord(payload.extended_policy_effect_library);
  return Object.fromEntries(
    asArray<Json>(library.policies).flatMap((policy) => {
      const id = typeof policy.policy_id === "string" ? policy.policy_id : "";
      const allowed = numberPair(policy.allowed_range);
      const lifecycle = asRecord(policy.lifecycle_days);
      const values = asArray<unknown>(policy.effects);
      const effects = Object.fromEntries(
        EFFECT_ORDER.flatMap((metric, index) => {
          const range = triple(values[index]);
          return range ? [[metric, range]] : [];
        }),
      );
      const lag = Number(lifecycle.lag);
      const ramp = Number(lifecycle.ramp);
      const peak = Number(lifecycle.peak);
      const decay = Number(lifecycle.decay);
      const duration = Number(lifecycle.duration_max);
      if (
        !id ||
        !allowed ||
        ![lag, ramp, peak, decay, duration].every(Number.isFinite)
      )
        return [];
      return [
        [
          id,
          {
            id,
            allowed_range: allowed,
            implementation_lag_days: [lag, lag],
            ramp_days: [ramp, ramp],
            peak_days: [peak, peak],
            decay_half_life_days: [decay, decay],
            max_duration_days: duration,
            effects_per_impulse: effects,
          },
        ],
      ];
    }),
  );
}

function lifecycleStatus(
  definition: CalibratedPolicyDefinition,
  effectiveAt: string,
  processedAt: string,
) {
  const elapsed = Math.max(
    0,
    (Date.parse(processedAt) - Date.parse(effectiveAt)) / SIMULATION_DAY_MS,
  );
  const lag = definition.implementation_lag_days[0];
  const rampEnd = lag + Math.max(1, definition.ramp_days[0]);
  const peakEnd = Math.max(rampEnd, definition.peak_days[0]);
  const finalDay = Math.min(
    definition.max_duration_days,
    peakEnd + Math.max(1, definition.decay_half_life_days[0] * 4),
  );
  if (elapsed >= finalDay) return "expired";
  if (elapsed < lag) return "waiting";
  if (elapsed < rampEnd) return "ramping_up";
  if (elapsed < peakEnd) return "full_effect";
  return "fading";
}

function shockEffects(shock: Json): Json {
  const scope = asRecord(shock.scope);
  const central = (key: string) => {
    const values = asArray<unknown>(scope[key]).map(Number);
    return values.length >= 2 && Number.isFinite(values[1]) ? values[1] : 0;
  };
  const energyPrice = central("energy_price_index_pct");
  const foodPrice = central("food_price_index_pct");
  const supply = central("energy_supply_pct") + central("food_supply_pct");
  const burden = central("food_energy_burden_pp");
  const pressure = central("currency_pressure_index");
  const bank = central("bank_stability_points");
  return {
    inflation_pp: Number(
      (energyPrice * 0.02 + foodPrice * 0.025 + pressure * 0.03).toFixed(4),
    ),
    real_gdp_growth_pp: Number((supply * 0.04).toFixed(4)),
    poverty_pp: Number((burden * 0.12).toFixed(4)),
    stability_points: Number(
      (supply * 0.06 - burden * 0.18 + bank * 0.25).toFixed(4),
    ),
  };
}

function dailyRoll(seed: string) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_296;
}

function automaticShock(
  payload: Json,
  worldId: string,
  processedAt: string,
): { key: string; durationDays: number; effects: Json } | null {
  const day = processedAt.slice(0, 10);
  const shocks = asArray<Json>(payload.shocks).filter(
    (shock) =>
      typeof shock.id === "string" &&
      Number(shock.annual_probability_prior) > 0,
  );
  const totalDailyProbability = Math.min(
    0.025,
    shocks.reduce(
      (sum, shock) => sum + Number(shock.annual_probability_prior) / 365,
      0,
    ),
  );
  if (!shocks.length || dailyRoll(`${worldId}:${day}`) >= totalDailyProbability)
    return null;
  const selected =
    shocks[Math.floor(dailyRoll(`${day}:${worldId}:select`) * shocks.length)] ??
    shocks[0];
  const duration = asArray<unknown>(selected.direct_duration_days).map(Number);
  return {
    key: String(selected.id),
    durationDays: Math.max(1, Math.round(duration[1] ?? duration[0] ?? 14)),
    effects: shockEffects(selected),
  };
}

function stateForTick(
  row: ClaimedWorld,
  shocks: ContinuousWorldShock[],
): ContinuousWorldState {
  const state = row.current_state;
  const lastProcessedAt =
    typeof state.lastProcessedAt === "string" ? state.lastProcessedAt : "";
  if (
    !lastProcessedAt ||
    !Array.isArray(state.countries) ||
    !Array.isArray(state.markets)
  )
    throw new Error(
      `${row.world_id} does not yet contain a launch-ready continuous world state.`,
    );
  return {
    worldId: row.world_id,
    calibrationVersion: row.calibration_version,
    lastProcessedAt,
    stateVersion: row.state_version,
    countries: asArray<ContinuousWorldState["countries"][number]>(
      state.countries,
    ),
    markets: asArray<ContinuousWorldState["markets"][number]>(state.markets),
    activeShocks: shocks,
  };
}

async function settleContracts(
  admin: ReturnType<typeof createClient>,
  worldId: string,
  processedAt: string,
) {
  const { data, error } = await admin
    .from("continuous_world_contracts")
    .select("id,status,terms,starts_at,next_settlement_at")
    .eq("world_id", worldId)
    .in("status", [
      "scheduled",
      "in_transit_or_performing",
      "invoice_due",
      "late",
    ]);
  if (error) throw new Error(error.message);
  const changes: Json[] = [];
  for (const contract of data ?? []) {
    const terms = asRecord(contract.terms);
    const cycle = Math.max(
      1,
      Math.min(180, Number(terms.payment_cycle_days) || 30),
    );
    const due =
      typeof contract.next_settlement_at === "string"
        ? Date.parse(contract.next_settlement_at)
        : 0;
    const starts =
      typeof contract.starts_at === "string"
        ? Date.parse(contract.starts_at)
        : 0;
    const now = Date.parse(processedAt);
    let nextStatus: string | null = null;
    let nextSettlement: string | null = null;
    if (contract.status === "scheduled" && starts <= now) {
      nextStatus = "in_transit_or_performing";
      nextSettlement = new Date(now + cycle * SIMULATION_DAY_MS).toISOString();
    } else if (contract.status === "in_transit_or_performing" && due <= now) {
      nextStatus = "invoice_due";
      nextSettlement = new Date(now + 10 * SIMULATION_DAY_MS).toISOString();
    } else if (contract.status === "invoice_due" && due <= now) {
      nextStatus = "late";
      nextSettlement = new Date(now + 20 * SIMULATION_DAY_MS).toISOString();
    } else if (contract.status === "late" && due <= now)
      nextStatus = "default_notice";
    if (!nextStatus) continue;
    const { error: updateError } = await admin
      .from("continuous_world_contracts")
      .update({ status: nextStatus, next_settlement_at: nextSettlement })
      .eq("id", contract.id);
    if (updateError) throw new Error(updateError.message);
    changes.push({ contractId: contract.id, status: nextStatus });
  }
  return changes;
}

async function authorised(
  request: Request,
  admin: ReturnType<typeof createClient>,
) {
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("CONTINUOUS_WORLD_CRON_SECRET");
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return false;
  const { data: role } = await admin
    .from("profile_platform_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .in("role", ["league_admin", "platform_admin"]);
  const { data: legacy } = await admin
    .from("profiles")
    .select("platform_role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return Boolean(
    role?.length ||
    legacy?.platform_role === "platform_admin" ||
    legacy?.platform_role === "school_leader",
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST")
    return reply({ ok: false, message: "POST only" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole)
    return reply(
      {
        ok: false,
        message:
          "Protected Supabase Edge Function configuration is incomplete.",
      },
      500,
    );
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
  if (!(await authorised(request, admin)))
    return reply(
      {
        ok: false,
        message:
          "League administrator or protected cron authorization is required.",
      },
      401,
    );

  const payload = (await request.json().catch(() => ({}))) as {
    limit?: number;
  };
  const claimToken = crypto.randomUUID();
  const limit = Math.min(12, Math.max(1, Number(payload.limit) || 4));
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_due_continuous_world_ticks",
    { p_claim_token: claimToken, p_limit: limit },
  );
  if (claimError) return reply({ ok: false, message: claimError.message }, 500);

  const { data: packageRows, error: packageError } = await admin
    .from("calibration_packages")
    .select("package_key,payload")
    .in("package_key", [
      "policy_effect_library",
      "shock_library",
      "final_world_teaching",
    ])
    .eq("status", "active");
  if (packageError)
    return reply({ ok: false, message: packageError.message }, 500);
  const packages = Object.fromEntries(
    (packageRows ?? []).map((entry) => [
      entry.package_key,
      asRecord(entry.payload),
    ]),
  );
  const definitions = {
    ...policyDefinitions(packages.policy_effect_library ?? {}),
    ...extendedPolicyDefinitions(packages.final_world_teaching ?? {}),
  };
  if (!Object.keys(definitions).length)
    return reply(
      {
        ok: false,
        message: "No active policy calibration package is available.",
      },
      409,
    );
  const outcomes: Json[] = [];

  for (const row of (claimed ?? []) as ClaimedWorld[]) {
    try {
      const processedAt = new Date().toISOString();
      await admin
        .from("continuous_world_shocks")
        .update({ status: "active" })
        .eq("world_id", row.world_id)
        .eq("status", "scheduled")
        .lte("starts_at", processedAt);
      await admin
        .from("continuous_world_shocks")
        .update({ status: "expired" })
        .eq("world_id", row.world_id)
        .eq("status", "active")
        .lte("ends_at", processedAt);
      const { data: existingToday, error: existingTodayError } = await admin
        .from("continuous_world_shocks")
        .select("id")
        .eq("world_id", row.world_id)
        .eq("source", "automatic")
        .gte("starts_at", `${processedAt.slice(0, 10)}T00:00:00.000Z`)
        .limit(1);
      if (existingTodayError) throw new Error(existingTodayError.message);
      const auto = existingToday?.length
        ? null
        : automaticShock(
            packages.shock_library ?? {},
            row.world_id,
            processedAt,
          );
      if (auto) {
        const { error: insertShockError } = await admin
          .from("continuous_world_shocks")
          .insert({
            world_id: row.world_id,
            shock_key: auto.key,
            source: "automatic",
            effects: auto.effects,
            status: "active",
            starts_at: processedAt,
            ends_at: new Date(
              Date.parse(processedAt) + auto.durationDays * SIMULATION_DAY_MS,
            ).toISOString(),
          });
        if (insertShockError) throw new Error(insertShockError.message);
      }
      const { data: shockRows, error: shocksError } = await admin
        .from("continuous_world_shocks")
        .select("id,shock_key,country_key,effects,status,starts_at,ends_at")
        .eq("world_id", row.world_id)
        .eq("status", "active")
        .gt("ends_at", processedAt);
      if (shocksError) throw new Error(shocksError.message);
      const shocks = (shockRows ?? []).map(
        (shock: ShockRow): ContinuousWorldShock => ({
          id: shock.id,
          shockId: shock.shock_key,
          countryId: shock.country_key,
          effects: asRecord(shock.effects) as Record<string, number>,
          status: shock.status,
          startsAt: shock.starts_at,
          endsAt: shock.ends_at,
        }),
      );
      const { data: actionRows, error: actionError } = await admin
        .from("continuous_world_actions")
        .select(
          "id,country_key,action_key,parameters,status,effective_at,expires_at",
        )
        .eq("world_id", row.world_id)
        .eq("action_type", "policy")
        .in("status", ["scheduled", "active"])
        .lte("effective_at", processedAt);
      if (actionError) throw new Error(actionError.message);
      const actions = (actionRows ?? []).flatMap(
        (action: ActionRow): ContinuousPolicyAction[] => {
          const change = Number(action.parameters.change);
          return Number.isFinite(change)
            ? [
                {
                  id: action.id,
                  countryId: action.country_key,
                  policyId: action.action_key,
                  change,
                  startsAt: action.effective_at,
                  endsAt: action.expires_at,
                  status: action.status,
                },
              ]
            : [];
        },
      );
      const contractChanges = await settleContracts(
        admin,
        row.world_id,
        processedAt,
      );
      const tick = advanceContinuousWorld(
        stateForTick(row, shocks),
        actions,
        definitions,
        processedAt,
        SIMULATION_DAY_MS,
      );
      const persistedState = { ...tick.state, lastProcessedAt: processedAt };
      const { error: completeError } = await admin.rpc(
        "complete_continuous_world_tick",
        {
          p_world_id: row.world_id,
          p_claim_token: claimToken,
          p_previous_state_version: row.state_version,
          p_state_after: persistedState,
          p_effect_summary: [
            ...tick.appliedEffects,
            ...tick.stateChanges.map((change) => ({
              type: "governance_state_change",
              ...change,
            })),
            ...contractChanges.map((change) => ({
              type: "contract_settlement",
              ...change,
            })),
          ],
        },
      );
      if (completeError) throw new Error(completeError.message);
      for (const action of actionRows ?? []) {
        const definition = definitions[action.action_key];
        if (!definition) continue;
        const lifecycle = lifecycleStatus(
          definition,
          action.effective_at,
          processedAt,
        );
        const { error: lifecycleError } = await admin
          .from("continuous_world_actions")
          .update({
            status: lifecycle === "expired" ? "expired" : "active",
            lifecycle_status: lifecycle,
          })
          .eq("id", action.id);
        if (lifecycleError) throw new Error(lifecycleError.message);
      }
      if (tick.stateChanges.length)
        await admin
          .from("continuous_world_events")
          .insert(
            tick.stateChanges.map((change) => ({
              world_id: row.world_id,
              country_key: change.countryId,
              event_type: "state_change",
              payload: change,
            })),
          );
      if (contractChanges.length)
        await admin
          .from("continuous_world_events")
          .insert(
            contractChanges.map((change) => ({
              world_id: row.world_id,
              event_type: "contract",
              payload: change,
            })),
          );
      outcomes.push({
        worldId: row.world_id,
        ok: true,
        stateVersion: tick.state.stateVersion,
        processedDays: tick.processedDays,
        shocks: shocks.length + (auto ? 1 : 0),
        contractChanges: contractChanges.length,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown continuous-world processing error.";
      await admin.rpc("fail_continuous_world_tick", {
        p_world_id: row.world_id,
        p_claim_token: claimToken,
        p_reason: message,
      });
      outcomes.push({ worldId: row.world_id, ok: false, message });
    }
  }
  return reply({ ok: true, claimed: (claimed ?? []).length, outcomes });
});
