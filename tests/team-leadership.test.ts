import { describe, expect, it } from "vitest";
import { FOUNDING_TEAM, REGIONAL_LEADERS } from "@/lib/team/team-data";

describe("team leadership presentation", () => {
  it("lists Richard first among regional leaders as Co-Founder", () => {
    expect(REGIONAL_LEADERS[0]).toMatchObject({ name: "Richard", role: "Co-Founder" });
  });

  it("identifies Samuel and Yale as Initial Founders", () => {
    expect(FOUNDING_TEAM).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Samuel", role: "Initial Founder" }),
      expect.objectContaining({ name: "Yale", role: "Initial Founder" }),
    ]));
  });
});
