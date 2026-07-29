import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync("components/auth/registered-app-gate.tsx", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

describe("registered individual account gate", () => {
  it("does not render application content until a user session exists", () => {
    expect(gate).toContain("if (!user)");
    expect(gate).toContain("All models, cases, news and League activities");
    expect(gate).toContain('openAuth("sign-up")');
    expect(gate).toContain('openAuth("sign-in")');
  });

  it("wraps every static route in the root application gate", () => {
    expect(layout).toContain("<RegisteredAppGate><Navbar />{children}<Footer /></RegisteredAppGate>");
    expect(layout).toContain("<AuthDialog />");
  });
});
