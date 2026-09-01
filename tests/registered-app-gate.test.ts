import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync("components/auth/registered-app-gate.tsx", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const applicationShell = readFileSync("components/layout/application-shell.tsx", "utf8");

describe("registered individual account gate", () => {
  it("permits either an individual session or a verified view-only invitation", () => {
    expect(gate).toContain("if (!user && (!viewerAccess || accountRequired))");

    expect(gate).toContain("An individual account enables saved work");
    expect(gate).toContain('openAuth("sign-up")');
    expect(gate).toContain('openAuth("sign-in")');
    expect(gate).toContain('openAuth("invitation")');
    expect(gate).toContain("hasRequiredPageRole");

  });

  it("wraps ordinary routes in the account gate while leaving room links standalone", () => {
    expect(layout).toContain("<ApplicationShell>{children}</ApplicationShell>");
    expect(applicationShell).toContain("<AccountDeletionProvider><RegisteredAppGate><Navbar />{children}<Footer /></RegisteredAppGate>");
    expect(applicationShell).toContain("<AuthDialog />");
    expect(applicationShell).toContain("<LegalConsentGate /></AccountDeletionProvider>");
    expect(applicationShell).toContain("if (isStandaloneLiveWorld(pathname)) return <>{children}</>");
  });
});
