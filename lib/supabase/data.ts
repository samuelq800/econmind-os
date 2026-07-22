import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ModelSlug } from "@/lib/models/registry";

export type ModelKey = ModelSlug;
export type JsonObject = Record<string, unknown>;

export type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferred_theme: "light" | "dark" | "system";
  role: "student" | "teacher";
  created_at: string;
  updated_at: string;
};

export type ModelRunRow = {
  id: string;
  user_id: string;
  model_key: ModelKey;
  name: string;
  parameters: JsonObject;
  results: JsonObject;
  metadata: JsonObject;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FavoriteRow = {
  id: string;
  user_id: string;
  model_key: ModelKey;
  created_at: string;
  updated_at: string;
};

export type LearningProgressRow = {
  id: string;
  user_id: string;
  model_key: ModelKey;
  status: "not_started" | "in_progress" | "completed";
  progress_percent: number;
  last_parameters: JsonObject;
  last_visited_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecentActivityRow = {
  id: string;
  user_id: string;
  module_slug: ModelKey;
  activity_type: "visit" | "simulation_run" | "save" | "completion";
  event_count: number;
  metadata: JsonObject;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function getProfile(userId: string) {
  const { data, error } = await client().from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
}

export async function saveModelRun(input: {
  userId: string;
  modelKey: ModelKey;
  name: string;
  parameters: JsonObject;
  results: JsonObject;
  metadata?: JsonObject;
}) {
  const { data, error } = await client()
    .from("model_runs")
    .insert({
      user_id: input.userId,
      model_key: input.modelKey,
      name: input.name,
      parameters: input.parameters,
      results: input.results,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ModelRunRow;
}

export async function getModelRun(userId: string, runId: string) {
  const { data, error } = await client()
    .from("model_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ModelRunRow | null;
}

export async function listModelRuns(userId: string, limit?: number) {
  let query = client().from("model_runs").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ModelRunRow[];
}

export async function duplicateModelRun(userId: string, run: ModelRunRow) {
  return saveModelRun({
    userId,
    modelKey: run.model_key,
    name: `${run.name} Copy`.slice(0, 120),
    parameters: run.parameters,
    results: run.results,
    metadata: { ...run.metadata, duplicated_from: run.id },
  });
}

export async function deleteModelRun(userId: string, runId: string) {
  const { error } = await client().from("model_runs").delete().eq("user_id", userId).eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function isFavorite(userId: string, modelKey: ModelKey) {
  const { data, error } = await client().from("favorites").select("id").eq("user_id", userId).eq("model_key", modelKey).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function setFavorite(userId: string, modelKey: ModelKey, favorite: boolean) {
  if (favorite) {
    const { error } = await client().from("favorites").upsert({ user_id: userId, model_key: modelKey }, { onConflict: "user_id,model_key" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client().from("favorites").delete().eq("user_id", userId).eq("model_key", modelKey);
    if (error) throw new Error(error.message);
  }
}

export async function listFavorites(userId: string) {
  const { data, error } = await client().from("favorites").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FavoriteRow[];
}

export async function markModelVisited(modelKey: ModelKey, parameters: JsonObject = {}) {
  const { error } = await client().rpc("record_module_visit", { p_module_slug: modelKey, p_parameters: parameters });
  if (error) throw new Error(error.message);
}

export async function recordModuleActivity(modelKey: ModelKey, activityType: "simulation_run", metadata: JsonObject = {}) {
  const { error } = await client().rpc("record_module_activity", {
    p_module_slug: modelKey,
    p_activity_type: activityType,
    p_metadata: metadata,
  });
  if (error) throw new Error(error.message);
}

export async function markModelComplete(modelKey: ModelKey) {
  const { error } = await client().rpc("mark_module_complete", { p_module_slug: modelKey });
  if (error) throw new Error(error.message);
}

export async function listLearningProgress(userId: string) {
  const { data, error } = await client().from("learning_progress").select("*").eq("user_id", userId).order("last_visited_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LearningProgressRow[];
}

export async function listRecentActivity(userId: string) {
  const { data, error } = await client().from("recent_activity").select("*").eq("user_id", userId).order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecentActivityRow[];
}
