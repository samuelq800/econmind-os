import {
  requireSupabaseBrowserClient as client,
  throwIfSupabaseError,
} from "@/lib/supabase/client";

export type EconBenchProgressSnapshot = {
  selectedModels: string[];
  values: Record<string, number>;
  claims: Record<string, boolean>;
  activeStage: number;
  testHistory: Array<{ at: string; ready: boolean }>;
  submissionCount: number;
  finalResult: "correct" | "incorrect" | null;
  completedAt: string | null;
  lastErrorCategory?: string;
};

export type EconBenchProgressRow = {
  model_key: string;
  status: "not_started" | "in_progress" | "completed";
  progress_percent: number;
  last_parameters: EconBenchProgressSnapshot;
  completed_at: string | null;
  updated_at: string;
};

export const econBenchProgressKey = (challengeId: string) =>
  `econbench-${challengeId.toLowerCase()}`;

export async function listEconBenchProgress(userId: string) {
  const { data, error } = await client()
    .from("learning_progress")
    .select(
      "model_key,status,progress_percent,last_parameters,completed_at,updated_at",
    )
    .eq("user_id", userId)
    .like("model_key", "econbench-%");
  throwIfSupabaseError(error);
  return (data ?? []) as EconBenchProgressRow[];
}

export async function saveEconBenchProgress(input: {
  userId: string;
  challengeId: string;
  snapshot: EconBenchProgressSnapshot;
}) {
  const completed = input.snapshot.finalResult === "correct";
  const { error } = await client()
    .from("learning_progress")
    .upsert(
      {
        user_id: input.userId,
        model_key: econBenchProgressKey(input.challengeId),
        status: completed ? "completed" : "in_progress",
        progress_percent: completed
          ? 100
          : Math.max(20, input.snapshot.activeStage * 20),
        last_parameters: input.snapshot,
        last_visited_at: new Date().toISOString(),
        completed_at: completed
          ? (input.snapshot.completedAt ?? new Date().toISOString())
          : null,
      },
      { onConflict: "user_id,model_key" },
    );
  throwIfSupabaseError(error);
}
