import { describe, expect, it } from "vitest";
import {
  FINAL_WORLD_TEACHING,
  asArray,
  asRecord,
} from "@/lib/economics/final-world-teaching/catalog";
import {
  practiceFormula,
  practiceInputLatex,
  practiceSymbol,
} from "@/lib/models/practice-formulas";

type Binding = { model_id: string };

const bindings = asArray<Binding>(
  asRecord(FINAL_WORLD_TEACHING.extendedPracticeQuestionBank).model_bindings,
);

describe("Model Practice formula presentation", () => {
  it("provides a renderable equation for every versioned practice model", () => {
    expect(bindings).not.toHaveLength(0);

    for (const binding of bindings) {
      expect(practiceFormula(binding.model_id), binding.model_id).not.toContain(
        "Use the versioned model equation",
      );
    }
  });

  it("renders supplied values with mathematical notation instead of raw JSON keys", () => {
    expect(
      practiceInputLatex({ M_over_P: 100, k: 0.5, Y: 240, h: 10 }),
    ).toContain("\\frac{M}{P}=100");
    expect(practiceSymbol("dY")).toBe("\\Delta Y");
    expect(practiceSymbol("output_gap_pct")).toBe("y_{gap}");
  });
});
