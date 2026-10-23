import { describe, expect, it } from "vitest";
import {
  COMMUNICATIONS_TEAM,
  FOUNDING_TEAM,
  REGIONAL_LEADERS,
  REGIONAL_NETWORK,
} from "@/lib/team/team-data";

describe("team leadership presentation", () => {
  it("adds Olivia as a Beijing lead while preserving her communications appointment and photo", () => {
    const comms = COMMUNICATIONS_TEAM.find(
      (member) => member.name === "Olivia",
    );
    const leader = REGIONAL_LEADERS.find((member) => member.name === "Olivia");
    expect(comms?.role).toBe("Bilibili, Douyin & Video Editing");
    expect(leader).toEqual({ ...comms, role: "Beijing Regional Lead" });
    expect(
      REGIONAL_NETWORK.find((region) => region.region === "Beijing")?.leads,
    ).toEqual(["Emma", "Sophia Liu", "Olivia"]);
    expect(
      REGIONAL_LEADERS.filter((member) => member.name === "Olivia"),
    ).toHaveLength(1);
  });
  it("lists Richard first among regional leaders as Co-Founder", () => {
    expect(REGIONAL_LEADERS[0]).toMatchObject({
      name: "Richard",
      role: "Co-Founder",
    });
  });

  it("identifies Samuel and Yale as Initial Founders", () => {
    expect(FOUNDING_TEAM).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Samuel", role: "Initial Founder" }),
        expect.objectContaining({ name: "Yale", role: "Initial Founder" }),
      ]),
    );
  });
});
