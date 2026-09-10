import {
  getSupabaseBrowserClient,
  requireSupabaseBrowserClient,
  throwIfSupabaseError,
} from "./client";

const MAX_YALE_RUN_SCORE = 99_999;

function parseScore(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
}

function validateScore(score: number) {
  if (!Number.isInteger(score) || score < 0 || score > MAX_YALE_RUN_SCORE) {
    throw new RangeError(`Yale Run scores must be whole numbers between 0 and ${MAX_YALE_RUN_SCORE}.`);
  }
}

/** Returns null only when this static deployment has no Supabase configuration. */
export async function getYaleRunGlobalHighScore() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_yale_run_global_high_score");
  throwIfSupabaseError(error);
  return parseScore(data);
}

/**
 * Records a signed-in player's new run atomically. The RPC returns whichever
 * score is globally highest after this attempt, so concurrent finishes cannot
 * lower the platform record.
 */
export async function submitYaleRunGlobalHighScore(score: number) {
  validateScore(score);
  const { data, error } = await requireSupabaseBrowserClient().rpc(
    "submit_yale_run_score",
    { p_score: score },
  );
  throwIfSupabaseError(error);
  return parseScore(data);
}
