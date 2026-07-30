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
};

export type WorldPolicyDefinition = { id: string; instrument: string; allowed_range: [number, number]; unit: string };

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
    .select("id,slug,name,description,status,calibration_version,current_state,state_version,next_tick_at,updated_at")
    .in("status", ["running", "paused", "faulted"])
    .order("updated_at", { ascending: false });
  fail(error);
  return (data ?? []) as ContinuousWorldRecord[];
}

export async function listMyContinuousWorldRoles(userId: string) {
  const { data, error } = await client()
    .from("continuous_world_role_assignments")
    .select("id,world_id,country_key,role_type")
    .eq("user_id", userId);
  fail(error);
  return (data ?? []) as ContinuousWorldRoleAssignment[];
}

export async function getActiveWorldPolicies() {
  const { data, error } = await client()
    .from("calibration_packages")
    .select("payload")
    .eq("package_key", "policy_effect_library")
    .eq("status", "active")
    .maybeSingle();
  fail(error);
  const policies = data?.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
    ? (data.payload as { policies?: unknown }).policies
    : [];
  return Array.isArray(policies)
    ? policies.flatMap((value): WorldPolicyDefinition[] => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const policy = value as Record<string, unknown>;
      const range = Array.isArray(policy.allowed_range) ? policy.allowed_range.map(Number) : [];
      return typeof policy.id === "string" && typeof policy.instrument === "string" && typeof policy.unit === "string" && range.length === 2 && range.every(Number.isFinite)
        ? [{ id: policy.id, instrument: policy.instrument, allowed_range: [range[0], range[1]], unit: policy.unit }]
        : [];
    })
    : [];
}

export async function submitContinuousWorldPolicy(input: { worldId: string; countryKey: string; policyId: string; change: number }) {
  const { data, error } = await client().rpc("submit_continuous_world_action", {
    p_world_id: input.worldId,
    p_country_key: input.countryKey,
    p_action_type: "policy",
    p_action_key: input.policyId,
    p_parameters: { change: input.change },
  });
  fail(error);
  return data;
}
