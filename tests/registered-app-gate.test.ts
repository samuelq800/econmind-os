import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync("components/auth/registered-app-gate.tsx", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

describe("registered individual account gate", () => {
  it("permits either an individual session or a verified view-only invitation", () => {
    expect(gate).toContain("if (!user && !viewerAccess)");
    expect(gate).toContain("An individual account enables saved work");
    expect(gate).toContain('openAuth("sign-up")');
    expect(gate).toContain('openAuth("sign-in")');
    expect(gate).toContain('openAuth("invitation")');
  });

  it("wraps every static route in the root application gate", () => {
    expect(layout).toContain("<RegisteredAppGate><Navbar />{children}<Footer /></RegisteredAppGate>");
    expect(layout).toContain("<AuthDialog />");
  });
});
