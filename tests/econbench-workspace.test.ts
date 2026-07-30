import { describe, expect, it } from "vitest";
import {
  ECONBENCH_CHALLENGES,
  checkEconBenchCondition,
  getEconBenchChallenge,
  previewEconBenchOutcomes,
  slugForChallenge,
} from "@/lib/economics/econbench";

describe("EconBench challenge workspace", () => {
  it("exposes ten routable challenges with a complete student-facing brief", () => {
    expect(ECONBENCH_CHALLENGES).toHaveLength(10);
    for (const challenge of ECONBENCH_CHALLENGES) {
      expect(
        getEconBenchChallenge(slugForChallenge(challenge.challenge_id)),
      ).toBe(challenge);
      expect(challenge.meta.category).toBeTruthy();
      expect(challenge.meta.objective).toBeTruthy();
      expect(challenge.meta.constraint).toBeTruthy();
      expect(challenge.meta.maxModels).toBeGreaterThan(0);
    }
  });

  it("keeps the binary acceptance engine independent of the live outcome preview", () => {
    const challenge = getEconBenchChallenge("eb-01-oil-shock");
    expect(challenge).toBeDefined();
    if (!challenge) throw new Error("Oil-shock challenge missing");

    const safePackage = {
      policy_rate_change_pp: 2,
      reserve_release_pct: 20,
      targeted_voucher_pct: 15,
    };
    const forecast = previewEconBenchOutcomes(challenge, safePackage);
    expect(
      forecast.find((item) => item.key === "inflation_pct_max")?.value,
    ).toBeLessThanOrEqual(6.5);
    expect(
      forecast.find((item) => item.key === "reserve_release_pct_max")?.value,
    ).toBe(20);

    expect(
      checkEconBenchCondition("select supply_shock_ad_as", [], safePackage, {}),
    ).toBe(false);
    expect(
      checkEconBenchCondition(
        "select supply_shock_ad_as",
        ["supply_shock_ad_as"],
        safePackage,
        {},
      ),
    ).toBe(true);
  });

  it("makes the oil-shock forecast respond in the intended directions", () => {
    const challenge = getEconBenchChallenge("eb-01-oil-shock");
    if (!challenge) throw new Error("Oil-shock challenge missing");
    const lowSupport = previewEconBenchOutcomes(challenge, {
      policy_rate_change_pp: 0,
      reserve_release_pct: 0,
      targeted_voucher_pct: 0,
    });
    const highSupport = previewEconBenchOutcomes(challenge, {
      policy_rate_change_pp: 2,
      reserve_release_pct: 20,
      targeted_voucher_pct: 15,
    });
    const outcome = (set: typeof lowSupport, key: string) =>
      set.find((item) => item.key === key)?.value ?? Number.NaN;
    expect(outcome(highSupport, "inflation_pct_max")).toBeLessThan(
      outcome(lowSupport, "inflation_pct_max"),
    );
    expect(outcome(highSupport, "poverty_change_pp_max")).toBeLessThan(
      outcome(lowSupport, "poverty_change_pp_max"),
    );
    expect(outcome(highSupport, "output_growth_pp_min")).toBeGreaterThan(
      outcome(lowSupport, "output_growth_pp_min"),
    );
  });
});
