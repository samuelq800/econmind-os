import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEAGUE_CHALLENGE_CATALOG,
  TIME_MACHINE_STAGES,
  advanceIndustryArenaState,
  advanceTimeMachineStage,
  advanceWorldArenaState,
  createIndustryArenaState,
  createTimeMachineState,
  createWorldArenaState,
  ghostDisplayName,
  replayGhostBehaviour,
  scoreIndustryArena,
  scoreTimeMachine,
  scoreWorldChallenge,
} from "@/lib/economics/league-arena";
import { CHALLENGE_COUNTRY_ROLES } from "@/lib/league/async-challenge-types";

const migration = readFileSync(
  "supabase/migrations/20260809000000_asynchronous_league_challenges.sql",
  "utf8",
);

describe("asynchronous League challenge foundation", () => {
  it("keeps four Challenge portfolios while allowing one participant to hold all of them", () => {
    expect(CHALLENGE_COUNTRY_ROLES).toEqual([
      "central_bank",
      "economic_policy",
      "trade",
      "investment_resources",
    ]);
    expect(new Set(CHALLENGE_COUNTRY_ROLES)).toHaveLength(4);
    expect(migration).toContain("unique(attempt_id, role_type, user_id)");
  });

  it("offers the three published Challenge formats with five official attempts", () => {
    expect(LEAGUE_CHALLENGE_CATALOG.map((challenge) => challenge.simulationType)).toEqual([
      "world",
      "time_machine",
      "industry",
    ]);
    expect(LEAGUE_CHALLENGE_CATALOG.every((challenge) => challenge.officialAttemptLimit === 5)).toBe(true);
    expect(migration).toContain("official_attempt_limit smallint not null default 5");
  });

  it("uses a visible capped 100-point World Economy formula", () => {
    const stable = scoreWorldChallenge({ growth: 2, inflation: 2, unemployment: 4, debtToGdp: 60 });
    const stressed = scoreWorldChallenge({ growth: -10, inflation: 30, unemployment: 30, debtToGdp: 200 });
    expect(stable.score).toBe(100);
    expect(stressed.score).toBe(0);
    expect(stressed.components).toHaveLength(4);
    expect(stressed.components.every((component) => component.points >= -25)).toBe(true);
  });

  it("keeps policy values active and exposes the two documented World interactions", () => {
    const state = createWorldArenaState();
    const controls = { interestRate: 6, governmentSpending: 26, generalTaxRate: 24, tariff: 16, publicInvestment: 18, strategicSubsidy: 6 };
    const afterFirstStage = advanceWorldArenaState(state, controls);
    const afterSecondStage = advanceWorldArenaState(afterFirstStage, controls);
    expect(afterFirstStage.policyInteractions.join(" ")).toContain("crowding out");
    expect(afterFirstStage.policyInteractions.join(" ")).toContain("domestic investment");
    expect(afterSecondStage.debtToGdp).toBeGreaterThan(afterFirstStage.debtToGdp);
  });

  it("locks historical information into five sequential Time Machine stages", () => {
    expect(TIME_MACHINE_STAGES).toHaveLength(5);
    expect(TIME_MACHINE_STAGES[0]?.date).toBe("1973-08-01");
    expect(TIME_MACHINE_STAGES.at(-1)?.date).toBe("1976-03-01");
    const state = advanceTimeMachineStage(createTimeMachineState(), { interestRate: 7, governmentSpending: 24, taxRelief: 4, energySubsidy: 10, publicInvestment: 16, strategicReserve: 9 }, 2);
    expect(state.interactions.join(" ")).toContain("crowding out");
    expect(scoreTimeMachine(state).score).toBeGreaterThanOrEqual(0);
    expect(scoreTimeMachine(state).score).toBeLessThanOrEqual(100);
  });

  it("replays a deterministic Ghost and computes the published Industry score", () => {
    const ghost = { type: "conditional" as const, conditions: [{ when: "inventory_high" as const, threshold: 30, action: { price: 35 } }] };
    const initial = createIndustryArenaState();
    expect(replayGhostBehaviour(ghost, initial, 1)).toEqual({ price: 35 });
    const first = advanceIndustryArenaState(initial, { price: 40, production: 240, research: 12, marketing: 10, capacity: 260 }, ghost, 1);
    const second = advanceIndustryArenaState(initial, { price: 40, production: 240, research: 12, marketing: 10, capacity: 260 }, ghost, 1);
    expect(first).toEqual(second);
    const score = scoreIndustryArena(first);
    expect(score.components.map((component) => component.label)).toEqual(["Profitability", "Market position", "Firm sustainability"]);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("keeps Ghost source identities anonymous until the Challenge closes", () => {
    expect(ghostDisplayName("public_after_unlock", true, "Team Alpha")).toBe("Anonymous League Ghost");
    expect(ghostDisplayName("public_after_unlock", false, "Team Alpha")).toBe("Team Alpha Ghost Strategy");
  });

  it("enforces save, stage locking, final submission and best-score leaderboard in the database", () => {
    for (const fragment of [
      "save_league_challenge_attempt",
      "lock_league_challenge_stage",
      "submit_league_challenge_attempt",
      "current_stage <> p_stage_number",
      "status = 'submitted'",
      "distinct on (attempt.team_id)",
      "order by attempt.team_id, attempt.final_score desc",
      "insert into public.league_ghost_strategies",
    ]) expect(migration).toContain(fragment);
  });
});
