import { describe, expect, it } from "vitest";
import { calculateAdAs, DEFAULT_AD_AS } from "../lib/economics/ad-as";
import { calculateExternality, DEFAULT_EXTERNALITY } from "../lib/economics/externalities";
import { calculateMonopoly, DEFAULT_MONOPOLY } from "../lib/economics/monopoly";
import { calculatePpf, DEFAULT_PPF } from "../lib/economics/ppf";
import { AVAILABLE_MODELS, getAvailableModel } from "../lib/models/registry";
import { recommendNext } from "../lib/recommendations";

describe("externalities", () => {
  it("finds the efficient quantity and corrective tax for an external cost", () => {
    expect(calculateExternality(DEFAULT_EXTERNALITY)).toMatchObject({
      valid: true,
      marketPrice: 20,
      marketQuantity: 60,
      efficientConsumerPrice: 25,
      efficientProducerPrice: 15,
      efficientQuantity: 50,
      correctivePolicy: 10,
      externalImpactAtMarket: 600,
      welfareGain: 50,
    });
  });

  it("treats a negative external cost as a benefit and recommends a subsidy", () => {
    expect(calculateExternality({ ...DEFAULT_EXTERNALITY, externalCost: -10 })).toMatchObject({
      efficientQuantity: 70,
      correctivePolicy: -10,
      welfareGain: 50,
    });
  });
});

describe("monopoly", () => {
  it("uses MR = MC and compares the result with competition", () => {
    expect(calculateMonopoly(DEFAULT_MONOPOLY)).toMatchObject({
      valid: true,
      monopolyPrice: 30,
      monopolyQuantity: 40,
      competitivePrice: 10,
      competitiveQuantity: 80,
      profit: 700,
      markup: 20,
      deadweightLoss: 400,
      lernerIndex: 0.667,
    });
  });

  it("keeps fixed cost out of the output decision", () => {
    const low = calculateMonopoly({ ...DEFAULT_MONOPOLY, fixedCost: 0 });
    const high = calculateMonopoly({ ...DEFAULT_MONOPOLY, fixedCost: 500 });
    expect(high.monopolyQuantity).toBe(low.monopolyQuantity);
    expect(high.profit).toBe(low.profit - 500);
  });
});

describe("production possibility frontier", () => {
  it("classifies the baseline point as efficient", () => {
    expect(calculatePpf(DEFAULT_PPF)).toMatchObject({
      valid: true,
      outputX: 50,
      outputY: 75,
      opportunityCost: 1,
      status: "Efficient",
    });
  });

  it("distinguishes inefficient and unattainable bundles", () => {
    expect(calculatePpf({ ...DEFAULT_PPF, capacityUse: 80 }).status).toBe("Inefficient");
    expect(calculatePpf({ ...DEFAULT_PPF, capacityUse: 110 }).status).toBe("Unattainable");
  });

  it("shifts both productive limits with growth", () => {
    expect(calculatePpf({ ...DEFAULT_PPF, growthRate: 20 })).toMatchObject({ shiftedCapacityX: 120, shiftedCapacityY: 120 });
  });
});

describe("aggregate demand and supply", () => {
  it("returns the indexed baseline", () => {
    expect(calculateAdAs(DEFAULT_AD_AS)).toMatchObject({ output: 100, priceLevel: 100, outputGap: 0, inflationPressure: 0, condition: "Near potential" });
  });

  it("separates demand expansion from adverse supply pressure", () => {
    expect(calculateAdAs({ ...DEFAULT_AD_AS, demandShock: 16 })).toMatchObject({ output: 108, priceLevel: 110, outputGap: 8, unemploymentGap: -4, condition: "Expansionary gap" });
    expect(calculateAdAs({ ...DEFAULT_AD_AS, supplyShock: -16 })).toMatchObject({ output: 92, priceLevel: 110, outputGap: -8, unemploymentGap: 4, condition: "Recessionary gap" });
  });
});

describe("phase two registry and recommendations", () => {
  it("registers all four phase two models as available", () => {
    for (const slug of ["externalities", "monopoly", "ppf", "ad-as"] as const) expect(getAvailableModel(slug)?.status).toBe("available");
    expect(AVAILABLE_MODELS.length).toBe(9);
  });

  it("never recommends a coming-soon model", () => {
    for (const completed of [["ppf"], ["policy"], ["elasticity"], ["ad-as"]]) {
      expect(recommendNext(completed).every((item) => item.model.status === "available")).toBe(true);
    }
  });
});
