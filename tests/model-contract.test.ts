import { describe, expect, it } from "vitest";
import { FEATURE_FLAGS, PLATFORM_NAVIGATION, availableNavigation } from "@/lib/platform/feature-flags";
import { STANDARD_MODEL_CATALOG } from "@/lib/models/standard-catalog";
import { MODEL_REGISTRY } from "@/lib/models/registry";

describe("platform foundation", () => {
  it("keeps unfinished systems behind explicit feature flags", () => {
    expect(FEATURE_FLAGS.evidenceUpload).toBe(false);
    expect(FEATURE_FLAGS.modelPractice).toBe(false);
    expect(availableNavigation().some((item) => item.href === "/econbench")).toBe(false);
    expect(PLATFORM_NAVIGATION.some((item) => item.href === "/econbench")).toBe(true);
  });

  it("adapts every existing model to the common contract without inventing formulas", () => {
    expect(STANDARD_MODEL_CATALOG).toHaveLength(MODEL_REGISTRY.length);
    for (const model of STANDARD_MODEL_CATALOG) {
      expect(model.id).toMatch(/^[a-z0-9-]+$/);
      expect(model.version).toBeGreaterThan(0);
      expect(model.formulaReadiness).toBe("needs-calibration");
      expect(model.practiceReadiness).toBe("not-authored");
      expect(model.equations).toEqual([]);
    }
  });
});
