import { describe, expect, it } from "vitest";
import { checkBracesPatch } from "../scripts/check-braces-patch.mjs";
import { checkMinimatchSafety } from "../scripts/check-minimatch-safety.mjs";
import { assessDependencyAdvisories } from "../scripts/check-dependency-security.mjs";

describe("CVE-2026-93687 local parser patch", () => {
  it("bounds balanced, unbalanced and mixed nesting while preserving normal glob patterns", () => {
    expect(() => checkBracesPatch()).not.toThrow();
  });
});

describe("GHSA-g3hv-75wg-m249 actual installed dependency paths", () => {
  it("bounds modern optimizer amplification and preserves both legacy and current caller APIs", () => {
    const result = checkMinimatchSafety();
    expect(result.modern.version).toBe("11.0.1");
    expect(result.modern.generatedPatterns).toBe(8);
    expect(result.modern.alternateGeneratedPatterns).toBe(16);
    expect(result.modern.largeNonQuadraticSet).toBe(2000);
    expect(result.modern.normalControls.every(Boolean)).toBe(true);
  });

  it("limits legacy non-applicability to exact installed source without the advisory's optimizer", () => {
    const result = checkMinimatchSafety();
    expect(result.legacy.version).toBe("3.1.5");
    expect(result.legacy.sha256).toBe(
      "746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d",
    );
    expect(result.legacy.copies.length).toBeGreaterThan(0);
    expect(result.legacy.hasAggressiveOptimizer).toBe(false);
    expect(result.legacy.oneToOnePartsMap).toBe(true);
    expect(result.legacy.globPartsCount).toBe(result.legacy.globSetCount);
    expect(result.legacy.globPartsCount).toBe(1);
    expect(result.legacy.normalControls.every(Boolean)).toBe(true);
  });

  it("does not accept affected modern versions, other legacy versions, production findings or new advisories", () => {
    const finding = {
      github_advisory_id: "GHSA-g3hv-75wg-m249",
      module_name: "minimatch",
      findings: [{ version: "3.1.5", dev: true }],
    };
    expect(
      assessDependencyAdvisories([finding]).notApplicable[0]?.sourceSha256,
    ).toBe("746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d");
    for (const value of [
      { ...finding, findings: [{ version: "10.2.6", dev: true }] },
      { ...finding, findings: [{ version: "3.1.4", dev: true }] },
      { ...finding, findings: [{ version: "3.1.5", dev: false }] },
      { ...finding, github_advisory_id: "GHSA-unknown-new-risk" },
      { ...finding, module_name: "other-package" },
    ])
      expect(() => assessDependencyAdvisories([value])).toThrow();
  });
});
