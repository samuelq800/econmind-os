import { describe, expect, it } from "vitest";
import { FINAL_WORLD_ROLE_PORTFOLIOS, policyPortfolio } from "@/lib/economics/final-world-teaching/catalog";
import { validateFinalWorldTeachingPackage } from "@/lib/economics/final-world-teaching/validator";

describe("final world teaching package", () => {
  it("is internally consistent and complete", () => {
    const validation = validateFinalWorldTeachingPackage();
    expect(validation.errors).toEqual([]);
    expect(validation.summary).toMatchObject({ countries: 12, econBenchChallenges: 10, mechanisms: 10, evidenceProjects: 3 });
  });

  it("keeps the confirmed seven portfolios while mapping supplied policy ownership", () => {
    expect(FINAL_WORLD_ROLE_PORTFOLIOS).toHaveLength(7);
    expect(policyPortfolio({ role: "Finance & Fiscal Minister" })).toBe("economic_policy_minister");
    expect(policyPortfolio({ policy_id: "POL-RES-STRATEGIC-RESERVE-RELEASE" })).toBe("infrastructure_investment_minister");
  });
});
