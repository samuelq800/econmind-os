import { describe, expect, it } from "vitest";
import {
  buildWorldEffectAxes,
  type PolicyEffectPreview,
  type WorldCountrySnapshot,
} from "@/lib/economics/continuous-world/predicted-effects";

const country: WorldCountrySnapshot = {
  baseline: {},
  outcomes: {},
  dynamics: {},
};

const policy: PolicyEffectPreview = {
  id: "POL-TRADE-TEACHING-TEST",
  allowedRange: [-10, 10],
  // growth, CPI, unemployment, debt, deficit, FX, reserves, trade,
  // productivity, emissions, poverty, public support, stability.
  effectVector: [
    0.6, 0.3, -0.2, -0.4, -0.5, 0, 0.2, 0.4, 0.3, 0, -0.5, 0.5, 0.6,
  ],
};

describe("world predicted-effects radar", () => {
  it("keeps all six axes neutral without recorded effects or a proposed policy", () => {
    expect(buildWorldEffectAxes(country)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "activity", current: 100, preview: 100 }),
        expect.objectContaining({
          id: "financial",
          current: 100,
          preview: 100,
        }),
        expect.objectContaining({
          id: "stability",
          current: 100,
          preview: 100,
        }),
      ]),
    );
  });

  it("maps the documented calibrated vector to all six directional dimensions", () => {
    const axes = Object.fromEntries(
      buildWorldEffectAxes(country, policy, 10).map((axis) => [axis.id, axis]),
    );
    expect(axes.activity.preview).toBeGreaterThan(axes.activity.current);
    expect(axes.livelihoods.preview).toBeGreaterThan(axes.livelihoods.current);
    expect(axes.prices.preview).toBeLessThan(axes.prices.current);
    expect(axes.fiscal.preview).toBeGreaterThan(axes.fiscal.current);
    expect(axes.financial.preview).toBeGreaterThan(axes.financial.current);
    expect(axes.stability.preview).toBeGreaterThan(axes.stability.current);
  });

  it("reverses a signed policy change and never escapes the visual guardrails", () => {
    const reverse = Object.fromEntries(
      buildWorldEffectAxes(country, policy, -10).map((axis) => [axis.id, axis]),
    );
    expect(reverse.activity.preview).toBeLessThan(reverse.activity.current);

    const stressed: WorldCountrySnapshot = {
      baseline: {},
      outcomes: {
        growth_pp: 100,
        inflation_pp: -100,
        unemployment_pp: -100,
        debt_gdp_pp: -100,
        deficit_gdp_pp: -100,
        reserves_import_months: 100,
        trade_gdp_pp: 100,
        productivity_percent: 100,
        poverty_pp: -100,
        public_support_pp: 100,
        stability_points: 100,
      },
      dynamics: {},
    };
    for (const axis of buildWorldEffectAxes(stressed, policy, 10)) {
      expect(axis.current).toBeGreaterThanOrEqual(70);
      expect(axis.current).toBeLessThanOrEqual(130);
      expect(axis.preview).toBeGreaterThanOrEqual(70);
      expect(axis.preview).toBeLessThanOrEqual(130);
    }
  });
});
