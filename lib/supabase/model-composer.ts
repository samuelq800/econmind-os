import { getSupabaseBrowserClient } from "./client";

export type ModelComposition = { id: string; user_id: string; title: string; model_chain: string[]; links: Array<{ from: string; to: string; relation: string }>; status: "draft" | "published"; published_at: string | null; created_at: string; updated_at: string };

function client() { const supabase = getSupabaseBrowserClient(); if (!supabase) throw new Error("Supabase is not configured."); return supabase; }
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function listReusableModelCompositions() {
  const { data, error } = await client().from("model_compositions").select("id,user_id,title,model_chain,links,status,published_at,created_at,updated_at").eq("status", "published").order("published_at", { ascending: false }).limit(24);
  fail(error); return (data ?? []) as ModelComposition[];
}

export async function saveModelComposition(input: { title: string; modelChain: string[]; links: Array<{ from: string; to: string; relation: string }> }) {
  const { data, error } = await client().rpc("save_model_composition", { p_title: input.title, p_model_chain: input.modelChain, p_links: input.links });
  fail(error); return data as ModelComposition;
}

export async function publishModelComposition(id: string) {
  const { data, error } = await client().rpc("publish_model_composition", { p_composition_id: id });
  fail(error); return data as ModelComposition;
}
