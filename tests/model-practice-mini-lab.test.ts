import { describe, expect, it } from "vitest";
import {
  EXTENDED_MODEL_SOURCE_TESTS,
  getExtendedModelDefinitionBySourceId,
} from "@/lib/economics/extended-models";
import {
  getPracticeMiniModel,
  miniModelDefaults,
} from "@/lib/models/practice-mini-models";

describe("Model Practice mini calculators", () => {
  it("gives every practice model a browser-side interactive calculator", () => {
    for (const source of EXTENDED_MODEL_SOURCE_TESTS) {
      const extended = getExtendedModelDefinitionBySourceId(source.id);
      const fallback = getPracticeMiniModel(source.id);
      expect(extended ?? fallback, source.id).not.toBeNull();

      if (extended) {
        const values = Object.fromEntries(
          extended.controls.map((control) => [
            control.id,
            control.defaultValue,
          ]),
        );
        const outcome = extended.calculate(values);
        expect(outcome.results[outcome.primaryKey], source.id).toBeTypeOf(
          "number",
        );
      } else if (fallback) {
        const outcome = fallback.calculate(miniModelDefaults(fallback));
        expect(outcome.results[outcome.primaryKey], source.id).toBeTypeOf(
          "number",
        );
      }
    }
  });

  it("keeps selected compact calculators faithful to their teaching equations", () => {
    const quota = getPracticeMiniModel("quotas")!;
    expect(quota.calculate(miniModelDefaults(quota)).results.quotaRent).toBe(
      200,
    );

    const did = getPracticeMiniModel("difference_in_differences")!;
    expect(did.calculate(miniModelDefaults(did)).results.did).toBe(3);

    const interval = getPracticeMiniModel("confidence_intervals")!;
    expect(
      interval.calculate(miniModelDefaults(interval)).results,
    ).toMatchObject({
      lowerBound: 1.02,
      upperBound: 2.98,
    });
  });
});
