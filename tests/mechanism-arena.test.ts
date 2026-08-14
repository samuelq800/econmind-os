import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultAuctionParameters, runRepeatedAuctionTrials, settleAuction, valuesFromSeed } from "@/lib/mechanism-arena/auction-engine";
import { mechanismScenarios } from "@/lib/mechanism-arena/catalog";

describe("Mechanism Design Arena", () => {
  it("keeps ten typed preset mechanisms with separate experiment routes", () => {
    expect(mechanismScenarios).toHaveLength(10);
    expect(mechanismScenarios.map((scenario) => scenario.scenario_id)).toContain("MA-01-FIRST-PRICE");
    expect(mechanismScenarios.map((scenario) => scenario.scenario_id)).toContain("MA-10-REPEATED-PD");
    expect(readFileSync("app/mechanism-arena/page.tsx", "utf8")).toContain("MechanismArenaLibrary");
    expect(readFileSync("app/activities/page.tsx", "utf8")).toContain("MechanismArenaLibrary");
    expect(readFileSync("app/mechanism-arena/[mechanismId]/page.tsx", "utf8")).toContain("generateStaticParams");
  });

  it("draws private values deterministically from the fixed seed", () => {
    const first = valuesFromSeed(24031, defaultAuctionParameters);
    const replay = valuesFromSeed(24031, defaultAuctionParameters);
    const changed = valuesFromSeed(24032, defaultAuctionParameters);
    expect(replay).toEqual(first);
    expect(changed).not.toEqual(first);
  });

  it("settles first-price allocation, payment, payoff and tie-break deterministically", () => {
    const result = settleAuction({ rule: "first-price", values: [30, 60, 90], bids: [20, 40, 60] });
    expect(result.winnerId).toBe(3);
    expect(result.payment).toBe(60);
    expect(result.sellerRevenue).toBe(60);
    expect(result.winnerSurplus).toBe(30);
    expect(result.allocativeEfficiency).toBe(1);
    expect(result.participants.map((participant) => participant.payoff)).toEqual([0, 0, 30]);

    const tied = settleAuction({ rule: "first-price", values: [50, 50, 10], bids: [30, 30, 5] });
    expect(tied.winnerId).toBe(1);
    expect(tied.tieBreakUsed).toBe(true);
  });

  it("uses the second-highest bid under the second-price rule", () => {
    const result = settleAuction({ rule: "second-price", values: [30, 60, 90], bids: [20, 40, 60] });
    expect(result.winnerId).toBe(3);
    expect(result.payment).toBe(40);
    expect(result.winnerSurplus).toBe(50);
  });

  it("produces repeated-trial summaries from matched deterministic seeds", () => {
    const first = runRepeatedAuctionTrials({ seed: 24031, parameters: defaultAuctionParameters, strategy: "equilibrium", count: 10 });
    const replay = runRepeatedAuctionTrials({ seed: 24031, parameters: defaultAuctionParameters, strategy: "equilibrium", count: 10 });
    expect(replay).toEqual(first);
    expect(first.revenueSeries).toHaveLength(10);
    expect(first.meanAllocativeEfficiency).toBeGreaterThanOrEqual(0);
    expect(first.meanAllocativeEfficiency).toBeLessThanOrEqual(1);
  });
});
