import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateCalibrationPackage } from "@/lib/economics/calibration/validator";

const directory = resolve(process.cwd(), "data/economic-calibration");
const json = (file: string) => JSON.parse(readFileSync(resolve(directory, file), "utf8")) as unknown;
const text = (file: string) => readFileSync(resolve(directory, file), "utf8");

describe("released economic calibration package", () => {
  it("is complete and internally consistent before it can be launched", () => {
    const result = validateCalibrationPackage({
      "package_metadata.json": json("package_metadata.json"),
      "world_country_calibration.json": json("world_country_calibration.json"),
      "market_baselines.json": json("market_baselines.json"),
      "policy_effect_library.json": json("policy_effect_library.json"),
      "shock_library.json": json("shock_library.json"),
      "calibration_test_suite.json": json("calibration_test_suite.json"),
      "practice_question_bank.json": json("practice_question_bank.json"),
    }, {
      "variable_dictionary.csv": text("variable_dictionary.csv"),
      "stability_rules.md": text("stability_rules.md"),
      "sources.md": text("sources.md"),
      "model_formula_catalog.md": text("model_formula_catalog.md"),
    });
    expect(result.ready, result.issues.map((entry) => entry.message).join("\n")).toBe(true);
    expect(result.summary).toMatchObject({ countries: 12, markets: 5, policies: 13, shocks: 7 });
  });
});
