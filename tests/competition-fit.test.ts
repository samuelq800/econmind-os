import { describe, expect, it } from "vitest";
import { competitionFit } from "@/lib/competition/fit";

describe("competition fit", () => {
  it("rewards complementary skills and explains the match", () => {
    const match = competitionFit(
      ["Quantitative", "Microeconomics"],
      ["Quantitative"],
    );
    expect(match.score).toBe(62);
    expect(match.reasons[0]).toContain("Quantitative");
  });
  it("does not inflate duplicate tags or use academic scores", () => {
    expect(
      competitionFit(["Quantitative", "quantitative"], ["Quantitative"]).score,
    ).toBe(62);
    expect(competitionFit([], []).score).toBe(48);
  });
  it("can explain a stated curriculum preference without using grades", () => {
    const match = competitionFit(
      ["Quantitative"],
      ["Quantitative"],
      "IB",
      "IB",
    );
    expect(match.score).toBe(70);
    expect(match.reasons).toContain("IB matches the preferred curriculum");
  });
});
