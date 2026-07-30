import { getSupabaseBrowserClient } from "./client";

export type ContinuousWorldRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: "draft" | "running" | "paused" | "faulted" | "archived";
  calibration_version: string;
  current_state: Record<string, unknown>;
  state_version: number;
  next_tick_at: string | null;
  updated_at: string;
};

export type ContinuousWorldRoleAssignment = {
  id: string;
  world_id: string;
  country_key: string;
  role_type: string;
  user_id: string;
};

export type ContinuousWorldCountryTeam = {
  id: string;
  world_id: string;
  country_key: string;
  team_id: string;
  claimed_by: string;
  claimed_at: string;
};
export type ContinuousWorldAction = {
  id: string;
  world_id: string;
  country_key: string;
  action_type: "policy" | "contract" | "project" | "announcement";
  action_key: string;
  parameters: Record<string, unknown>;
  status: string;
  effective_at: string;
  expires_at: string | null;
  created_at: string;
  submitted_by: string;
};
export type ContinuousWorldContract = {
  id: string;
  world_id: string;
  template_id: string;
  exporter_country_key: string;
  importer_country_key: string;
  terms: Record<string, unknown>;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  next_settlement_at: string | null;
  exporter_captain_approved_at: string | null;
  importer_approved_at: string | null;
  created_at: string;
};
export type ContinuousWorldEvent = {
  id: string;
  world_id: string;
  country_key: string | null;
  event_type: string;
  visibility: string;
  payload: Record<string, unknown>;
  created_at: string;
};
export type WorldPolicyDefinition = {
  id: string;
  instrument: string;
  allowed_range: [number, number];
  unit: string;
  role: string;
  lifecycleDays?: { lag: number; ramp: number; peak: number; duration: number };
  sideEffects: string[];
  preconditions: string[];
  /** Central values from the published 13-channel teaching vector. */
  effectVector: number[];
};

function centralEffect(value: unknown) {
  if (typeof value !== "string") return 0;
  const parts = value.split("/").map(Number);
  return Number.isFinite(parts[1]) ? parts[1] : 0;
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listContinuousWorlds() {
  const { data, error } = await client()
    .from("continuous_worlds")
    .select(
      "id,slug,name,description,status,calibration_version,current_state,state_version,next_tick_at,updated_at",
    )
    .in("status", ["running", "paused", "faulted"])
    .order("updated_at", { ascending: false });
  fail(error);
  return (data ?? []) as ContinuousWorldRecord[];
}

export async function listMyContinuousWorldRoles(userId: string) {
  const { data, error } = await client()
    .from("continuous_world_role_assignments")
    .select("id,world_id,country_key,role_type,user_id")
    .eq("user_id", userId);
  fail(error);
  return (data ?? []) as ContinuousWorldRoleAssignment[];
}

export async function listContinuousWorldRoles(worldId: string) {
  const { data, error } = await client()
    .from("continuous_world_role_assignments")
    .select("id,world_id,country_key,role_type,user_id")
    .eq("world_id", worldId);
  fail(error);
  return (data ?? []) as ContinuousWorldRoleAssignment[];
}

export async function getActiveWorldPolicies() {
  const { data, error } = await client()
    .from("calibration_packages")
    .select("package_key,payload")
    .in("package_key", ["policy_effect_library", "final_world_teaching"])
    .eq("status", "active")
    .order("package_key");
  fail(error);
  const finalPackage = (data ?? []).find(
    (row) => row.package_key === "final_world_teaching",
  )?.payload;
  const extended =
    finalPackage &&
    typeof finalPackage === "object" &&
    !Array.isArray(finalPackage)
      ? (
          finalPackage as {
            extended_policy_effect_library?: { policies?: unknown };
          }
        ).extended_policy_effect_library?.policies
      : [];
  if (Array.isArray(extended) && extended.length)
    return extended.flatMap((value): WorldPolicyDefinition[] => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return [];
      const policy = value as Record<string, unknown>;
      const range = Array.isArray(policy.allowed_range)
        ? policy.allowed_range.map(Number)
        : [];
      const lifecycle =
        policy.lifecycle_days && typeof policy.lifecycle_days === "object"
          ? (policy.lifecycle_days as Record<string, unknown>)
          : {};
      return typeof policy.policy_id === "string" &&
        typeof policy.parameter_unit === "string" &&
        typeof policy.role === "string" &&
        range.length === 2 &&
        range.every(Number.isFinite)
        ? [
            {
              id: policy.policy_id,
              instrument: policy.policy_id
                .replace(/^POL-[A-Z]+-/, "")
                .replaceAll("-", " ")
                .toLowerCase(),
              allowed_range: [range[0], range[1]],
              unit: policy.parameter_unit,
              role: policy.role,
              lifecycleDays: {
                lag: Number(lifecycle.lag) || 0,
                ramp: Number(lifecycle.ramp) || 0,
                peak: Number(lifecycle.peak) || 0,
                duration: Number(lifecycle.duration_max) || 0,
              },
              sideEffects: Array.isArray(policy.side_effects)
                ? policy.side_effects.filter(
                    (item): item is string => typeof item === "string",
                  )
                : [],
              preconditions: Array.isArray(policy.preconditions)
                ? policy.preconditions.filter(
                    (item): item is string => typeof item === "string",
                  )
                : [],
              effectVector: Array.isArray(policy.effects)
                ? policy.effects.map(centralEffect)
                : [],
            },
          ]
        : [];
    });
  const base = (data ?? []).find(
    (row) => row.package_key === "policy_effect_library",
  )?.payload;
  const policies =
    base && typeof base === "object" && !Array.isArray(base)
      ? (base as { policies?: unknown }).policies
      : [];
  return Array.isArray(policies)
    ? policies.flatMap((value): WorldPolicyDefinition[] => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return [];
        const policy = value as Record<string, unknown>;
        const range = Array.isArray(policy.allowed_range)
          ? policy.allowed_range.map(Number)
          : [];
        return typeof policy.id === "string" &&
          typeof policy.instrument === "string" &&
          typeof policy.unit === "string" &&
          range.length === 2 &&
          range.every(Number.isFinite)
          ? [
              {
                id: policy.id,
                instrument: policy.instrument,
                allowed_range: [range[0], range[1]],
                unit: policy.unit,
                role:
                  policy.category === "monetary"
                    ? "Central Bank Governor"
                    : "Economic Policy Minister",
                sideEffects: Array.isArray(policy.side_effects)
                  ? policy.side_effects.filter(
                      (item): item is string => typeof item === "string",
                    )
                  : [],
                preconditions: Array.isArray(policy.conditions)
                  ? policy.conditions.filter(
                      (item): item is string => typeof item === "string",
                    )
                  : [],
                effectVector: [],
              },
            ]
          : [];
      })
    : [];
}

export async function submitContinuousWorldPolicy(input: {
  worldId: string;
  countryKey: string;
  policyId: string;
  change: number;
}) {
  const { data, error } = await client().rpc("submit_continuous_world_action", {
    p_world_id: input.worldId,
    p_country_key: input.countryKey,
    p_action_type: "policy",
    p_action_key: input.policyId,
    p_parameters: { change: input.change, reversible: true },
  });
  fail(error);
  return data;
}

export async function joinContinuousWorld(worldId: string) {
  const { data, error } = await client().rpc("join_continuous_world", {
    p_world_id: worldId,
  });
  fail(error);
  return data;
}

export async function claimContinuousWorldCountry(
  worldId: string,
  countryKey: string,
) {
  const { data, error } = await client().rpc("claim_continuous_world_country", {
    p_world_id: worldId,
    p_country_key: countryKey,
  });
  fail(error);
  return data as ContinuousWorldCountryTeam;
}

export async function claimContinuousWorldRole(
  worldId: string,
  countryKey: string,
  roleType: string,
) {
  const { data, error } = await client().rpc("claim_continuous_world_role", {
    p_world_id: worldId,
    p_country_key: countryKey,
    p_role_type: roleType,
  });
  fail(error);
  return data as ContinuousWorldRoleAssignment;
}

export async function amendContinuousWorldPolicy(
  actionId: string,
  change: number,
) {
  const { data, error } = await client().rpc("amend_continuous_world_policy", {
    p_action_id: actionId,
    p_change: change,
  });
  fail(error);
  return data as ContinuousWorldAction;
}

export async function cancelContinuousWorldAction(actionId: string) {
  const { error } = await client().rpc("cancel_continuous_world_action", {
    p_action_id: actionId,
  });
  fail(error);
}

export async function listContinuousWorldCountryTeams(worldId: string) {
  const { data, error } = await client()
    .from("continuous_world_country_teams")
    .select("id,world_id,country_key,team_id,claimed_by,claimed_at")
    .eq("world_id", worldId);
  fail(error);
  return (data ?? []) as ContinuousWorldCountryTeam[];
}

export async function listContinuousWorldActions(worldId: string) {
  const { data, error } = await client()
    .from("continuous_world_actions")
    .select(
      "id,world_id,country_key,action_type,action_key,parameters,status,effective_at,expires_at,created_at,submitted_by",
    )
    .eq("world_id", worldId)
    .order("created_at", { ascending: false })
    .limit(80);
  fail(error);
  return (data ?? []) as ContinuousWorldAction[];
}

export async function listContinuousWorldContracts(worldId: string) {
  const { data, error } = await client()
    .from("continuous_world_contracts")
    .select(
      "id,world_id,template_id,exporter_country_key,importer_country_key,terms,status,starts_at,ends_at,next_settlement_at,exporter_captain_approved_at,importer_approved_at,created_at",
    )
    .eq("world_id", worldId)
    .order("created_at", { ascending: false })
    .limit(80);
  fail(error);
  return (data ?? []) as ContinuousWorldContract[];
}

export async function listContinuousWorldEvents(worldId: string) {
  const { data, error } = await client()
    .from("continuous_world_events")
    .select("id,world_id,country_key,event_type,visibility,payload,created_at")
    .eq("world_id", worldId)
    .order("created_at", { ascending: false })
    .limit(120);
  fail(error);
  return (data ?? []) as ContinuousWorldEvent[];
}

export async function createContinuousWorldContract(input: {
  worldId: string;
  exporterCountryKey: string;
  importerCountryKey: string;
  templateId: string;
  terms: Record<string, unknown>;
}) {
  const { data, error } = await client().rpc(
    "create_continuous_world_contract",
    {
      p_world_id: input.worldId,
      p_exporter_country_key: input.exporterCountryKey,
      p_importer_country_key: input.importerCountryKey,
      p_template_id: input.templateId,
      p_terms: input.terms,
    },
  );
  fail(error);
  return data as ContinuousWorldContract;
}

export async function approveContinuousWorldContract(contractId: string) {
  const { data, error } = await client().rpc(
    "approve_continuous_world_contract",
    { p_contract_id: contractId },
  );
  fail(error);
  return data as ContinuousWorldContract;
}

export async function injectContinuousWorldShock(input: {
  worldId: string;
  shockKey: string;
  countryKey?: string;
  effects: Record<string, number>;
  durationDays: number;
}) {
  const { data, error } = await client().rpc("inject_continuous_world_shock", {
    p_world_id: input.worldId,
    p_shock_key: input.shockKey,
    p_country_key: input.countryKey ?? "",
    p_effects: input.effects,
    p_duration_days: input.durationDays,
  });
  fail(error);
  return data;
}
