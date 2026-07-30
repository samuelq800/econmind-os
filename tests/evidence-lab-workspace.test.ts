import { describe, expect, it } from "vitest";
import {
  EVIDENCE_PROJECTS,
  EVIDENCE_STEPS,
  flexibleTeachingEstimates,
  getEvidenceProject,
  restaurantProfit,
} from "@/lib/evidence-lab/projects";

describe("Evidence Lab project workspaces", () => {
  it("exposes the three curated projects as independently routable six-step workspaces", () => {
    expect(EVIDENCE_PROJECTS).toHaveLength(3);
    expect(EVIDENCE_STEPS).toHaveLength(6);
    for (const project of EVIDENCE_PROJECTS) {
      expect(getEvidenceProject(project.slug)).toBe(project);
      expect(project.sampleRows.length).toBeGreaterThan(5);
      expect(project.sources.every((source) => Boolean(source.url))).toBe(true);
      expect(project.sampleReason.length).toBeGreaterThan(30);
    }
  });

  it("preserves the fixed teaching calculations and their evidence boundaries", () => {
    const estimates = flexibleTeachingEstimates();
    expect(estimates.ols.beta).toBeGreaterThan(0);
    expect(estimates.fe.beta).toBeGreaterThan(0);
    const restaurant = getEvidenceProject("restaurant-demand-food-waste");
    if (!restaurant) throw new Error("Restaurant project missing");
    expect(restaurantProfit(restaurant.sampleRows[0])).toBe(568);
    expect(
      getEvidenceProject(
        "oil-prices-inflation",
      )?.interpretation.doesNotShow.join(" "),
    ).toContain("core inflation");
  });
});
