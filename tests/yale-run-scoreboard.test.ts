import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: mocks.getClient,
  requireSupabaseBrowserClient: () => {
    const client = mocks.getClient();
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  },
  throwIfSupabaseError: (error: { message: string } | null | undefined) => {
    if (error) throw new Error(error.message);
  },
}));

import {
  getYaleRunGlobalHighScore,
  submitYaleRunGlobalHighScore,
} from "@/lib/supabase/yale-run";

const migration = readFileSync(
  "supabase/migrations/20260910010000_yale_run_global_high_score.sql",
  "utf8",
);
const runner = readFileSync("components/games/tiao-runner.tsx", "utf8");
const workflow = readFileSync(
  ".github/workflows/apply-yale-run-scoreboard-migration.yml",
  "utf8",
);

describe("Yale Run global scoreboard", () => {
  beforeEach(() => mocks.getClient.mockReset());

  it("reads the public high score and leaves an unconfigured static build playable", async () => {
    mocks.getClient.mockReturnValue(null);
    await expect(getYaleRunGlobalHighScore()).resolves.toBeNull();

    const rpc = vi.fn().mockResolvedValue({ data: "431", error: null });
    mocks.getClient.mockReturnValue({ rpc });
    await expect(getYaleRunGlobalHighScore()).resolves.toBe(431);
    expect(rpc).toHaveBeenCalledWith("get_yale_run_global_high_score");
  });

  it("submits only normalized in-range scores through the atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 775, error: null });
    mocks.getClient.mockReturnValue({ rpc });

    await expect(submitYaleRunGlobalHighScore(612)).resolves.toBe(775);
    expect(rpc).toHaveBeenCalledWith("submit_yale_run_score", { p_score: 612 });
    await expect(submitYaleRunGlobalHighScore(-1)).rejects.toThrow("between 0 and 99999");
  });

  it("keeps the platform record behind RLS and signed-in RPC access", () => {
    expect(migration).toContain("create table if not exists public.yale_run_global_scores");
    expect(migration).toContain("alter table public.yale_run_global_scores enable row level security");
    expect(migration).toContain("create or replace function public.get_yale_run_global_high_score()");
    expect(migration).toContain("create or replace function public.submit_yale_run_score(p_score integer)");
    expect(migration).toContain("on conflict (game_key) do update");
    expect(migration).toContain("where excluded.best_score > public.yale_run_global_scores.best_score");
    expect(migration).toContain("revoke all on table public.yale_run_global_scores from anon, authenticated");
    expect(migration).toContain("grant execute on function public.get_yale_run_global_high_score() to anon, authenticated");
    expect(migration).toContain("grant execute on function public.submit_yale_run_score(integer) to authenticated");
    expect(workflow).toContain("20260910010000_yale_run_global_high_score.sql");
    expect(workflow).toContain("group: supabase-production");
    expect(runner).toContain("Global high");
    expect(runner).toContain("submitYaleRunGlobalHighScore");
    expect(runner).toContain("drawBatFlock");
  });
});
