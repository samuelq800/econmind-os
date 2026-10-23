import { describe, expect, it } from "vitest";
import { checkBracesPatch } from "../scripts/check-braces-patch.mjs";

describe("CVE-2026-93687 local parser patch", () => {
  it("bounds balanced, unbalanced and mixed nesting while preserving normal glob patterns", () => {
    expect(() => checkBracesPatch()).not.toThrow();
  });
});
