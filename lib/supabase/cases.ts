import type { CaseRunDraft } from "@/lib/cases/types";
import {
  requireSupabaseBrowserClient as client,
  throwIfSupabaseError as fail,
} from "@/lib/supabase/client";

export type CaseRunRow = {
  id: string; user_id: string; case_slug: string; title: string; current_stage: string; problem_answer: Record<string, unknown>; predictions: Record<string, string>;
  policy_settings: Record<string, number>; scenarios: Record<string, unknown>; results: Record<string, unknown>; evaluation: Record<string, unknown>; recommendation: Record<string, unknown>; completed: boolean; created_at: string; updated_at: string;
};

export async function saveCaseRun(input: { id?: string; title: string; draft: CaseRunDraft; results: Record<string, unknown> }) {
  const payload = {
    ...(input.id ? { id: input.id } : {}), case_slug: input.draft.caseSlug, title: input.title.trim() || "Untitled case run", current_stage: input.draft.currentStage,
    problem_answer: input.draft.problemAnswer ?? {}, predictions: input.draft.predictions, policy_settings: input.draft.settings, scenarios: input.draft.scenarios,
    results: input.results, evaluation: input.draft.evaluation ?? {}, recommendation: input.draft.recommendation ?? {}, completed: input.draft.completed,
  };
  const { data, error } = await client().from("case_runs").upsert(payload).select().single(); fail(error); return data as CaseRunRow;
}

export async function listMyCaseRuns() { const { data, error } = await client().from("case_runs").select("*").order("updated_at", { ascending: false }); fail(error); return (data ?? []) as CaseRunRow[]; }
export async function deleteCaseRun(id: string) { const { error } = await client().from("case_runs").delete().eq("id", id); fail(error); }
