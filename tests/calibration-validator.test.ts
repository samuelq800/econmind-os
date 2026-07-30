import { describe, expect, it } from "vitest";
import { validateCalibrationPackage } from "@/lib/economics/calibration/validator";

const files = {
  "package_metadata.json": { files: {} },
  "world_country_calibration.json": { countries: Array.from({ length: 12 }, (_, index) => ({ id: `country-${index}`, values: { gdp_per_capita: 1000, gdp_current: 1, population: 1, overall_fiscal_balance: 0, total_revenue: 10, total_expenditure: 10, primary_balance: 1, interest_cost: 1, current_account: 0, trade_balance: 1, net_primary_secondary_income: -1, agriculture_share: 20, manufacturing_share: 30, services_share: 50, renewable_share: 20, nuclear_share: 20, fossil_share: 60 } })) },
  "market_baselines.json": { markets: [{ id: "energy", price: { floor: 50, initial: 100, ceiling: 150 } }, { id: "food", price: { floor: 50, initial: 100, ceiling: 150 } }] },
  "policy_effect_library.json": { policies: [{ id: "policy", allowed_range: [-1, 1], implementation_lag_days: [1, 2], ramp_days: [1, 2], peak_days: [2, 3], decay_half_life_days: [4, 5], max_duration_days: 10, effects_per_impulse: { growth: [-1, 0, 1] } }] },
  "shock_library.json": { shocks: [{ id: "shock", annual_probability_prior: 0.2 }] },
};

describe("calibration package validation", () => {
  it("accepts a coherent minimal package", () => {
    const result = validateCalibrationPackage(files, { "variable_dictionary.csv": "variable_id,label\ngrowth,Growth", "stability_rules.md": "rules", "sources.md": "sources" });
    expect(result.ready).toBe(true);
  });

  it("rejects a country with inconsistent accounting identities", () => {
    const broken = structuredClone(files);
    (broken["world_country_calibration.json"] as { countries: Array<{ values: Record<string, number> }> }).countries[0].values.total_expenditure = 11;
    const result = validateCalibrationPackage(broken, { "variable_dictionary.csv": "variable_id,label\ngrowth,Growth", "stability_rules.md": "rules", "sources.md": "sources" });
    expect(result.ready).toBe(false);
    expect(result.issues.some((entry) => entry.code === "COUNTRY_IDENTITY")).toBe(true);
  });
});
