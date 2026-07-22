import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ModelKey = "supply-demand" | "policy" | "elasticity";

export type ModelRunRow = {
  id: string;
  user_id: string;
  model_key: ModelKey;
  name: string;
  parameters: Record<string, number>;
  results: Record<string, number>;
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
  last_parameters: Record<string, number>;
  last_visited_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function saveModelRun(input: {
  userId: string;
  modelKey: ModelKey;
  name: string;
  parameters: Record<string, number>;
  results: Record<string, number>;
}) {
  const { data, error } = await client()
    .from("model_runs")
    .insert({
      user_id: input.userId,
      model_key: input.modelKey,
      name: input.name,
      parameters: input.parameters,
      results: input.results,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ModelRunRow;
}

export async function listModelRuns(userId: string) {
  const { data, error } = await client()
    .from("model_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ModelRunRow[];
}

export async function deleteModelRun(userId: string, runId: string) {
  const { error } = await client()
    .from("model_runs")
    .delete()
    .eq("user_id", userId)
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function isFavorite(userId: string, modelKey: ModelKey) {
  const { data, error } = await client()
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("model_key", modelKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function setFavorite(userId: string, modelKey: ModelKey, favorite: boolean) {
  if (favorite) {
    const { error } = await client()
      .from("favorites")
      .upsert({ user_id: userId, model_key: modelKey }, { onConflict: "user_id,model_key" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client()
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("model_key", modelKey);
    if (error) throw new Error(error.message);
  }
}

export async function listFavorites(userId: string) {
  const { data, error } = await client()
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FavoriteRow[];
}

export async function markModelVisited(userId: string, modelKey: ModelKey) {
  const { error } = await client().from("learning_progress").upsert(
    {
      user_id: userId,
      model_key: modelKey,
      status: "in_progress",
      progress_percent: 10,
      last_visited_at: new Date().toISOString(),
    },
    { onConflict: "user_id,model_key", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);

  const { error: updateError } = await client()
    .from("learning_progress")
    .update({ last_visited_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("model_key", modelKey);
  if (updateError) throw new Error(updateError.message);
}

export async function recordSavedProgress(
  userId: string,
  modelKey: ModelKey,
  parameters: Record<string, number>,
) {
  const { error } = await client().from("learning_progress").upsert(
    {
      user_id: userId,
      model_key: modelKey,
      status: "in_progress",
      progress_percent: 50,
      last_parameters: parameters,
      last_visited_at: new Date().toISOString(),
    },
    { onConflict: "user_id,model_key" },
  );
  if (error) throw new Error(error.message);
}

export async function listLearningProgress(userId: string) {
  const { data, error } = await client()
    .from("learning_progress")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LearningProgressRow[];
}
