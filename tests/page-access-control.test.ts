import { describe, expect, it } from "vitest";
import { hasRequiredPageRole, normalisePagePath, pageAccessForPath } from "@/lib/platform/access-control";

describe("central frontend page access policy", () => {
  it("exposes editorial reading and released League directory pages", () => {
    for (const path of [
      "/",
      "/about",
      "/community",
      "/legal",
      "/privacy",
      "/terms",
      "/community-guidelines",
      "/integrity",
      "/explore",
      "/daily-brief",
      "/daily-brief/read",
      "/cases",
      "/cases/food-waste",
      "/league",
      "/league/about",
      "/simulation",
      "/simulation/arena/time-machine-1973-oil-shock",
      "/league/schools/profile",
      "/tiao-run",
    ]) {
      expect(pageAccessForPath(path).audience, path).toBe("public");
    }
  });

  it("keeps personal case history behind an individual account", () => {
    expect(pageAccessForPath("/cases/history").audience).toBe("account");
    expect(pageAccessForPath("/cases/history/older").audience).toBe("account");
  });

  it("keeps the support form and governance workspace behind the intended account boundaries", () => {
    expect(pageAccessForPath("/contact").audience).toBe("account");
    expect(pageAccessForPath("/admin/governance").audience).toBe("account");
    expect(pageAccessForPath("/admin/governance").platformRoles).toEqual(["platform_admin"]);
    expect(pageAccessForPath("/season1").audience).toBe("account");
    expect(pageAccessForPath("/season1").platformRoles).toBeUndefined();
    expect(hasRequiredPageRole(pageAccessForPath("/season1"), "student", "platform_admin")).toBe(true);
    expect(hasRequiredPageRole(pageAccessForPath("/season1"), "student", "school_leader")).toBe(true);
  });

  it("keeps unlisted tools account-or-viewer gated while Simulation is open", () => {
    expect(pageAccessForPath("/sandbox").audience).toBe("account-or-viewer");
    expect(pageAccessForPath("/simulation").audience).toBe("public");
    expect(pageAccessForPath("/simulation/dashboard").audience).toBe("account");
    expect(pageAccessForPath("/simulation/legacy-world/admin").platformRoles).toEqual(["platform_admin"]);
  });

  it("supports academic and platform roles in the shared policy model", () => {
    const professorPolicy = pageAccessForPath("/professor/projects");
    expect(hasRequiredPageRole(professorPolicy, "professor", "user")).toBe(true);
    expect(hasRequiredPageRole(professorPolicy, "teacher", "platform_admin")).toBe(false);
    expect(hasRequiredPageRole({ audience: "account", platformRoles: ["school_leader"] }, "student", "school_leader")).toBe(true);
  });

  it("normalises the configured base path and trailing slashes", () => {
    expect(normalisePagePath("/econmind-os/about/")).toBe("/about");
  });
});
