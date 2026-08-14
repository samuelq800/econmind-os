import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260814000000_viewer_invitation_access.sql", "utf8");
const provider = readFileSync("components/auth/auth-provider.tsx", "utf8");
const dialog = readFileSync("components/auth/auth-dialog.tsx", "utf8");
const gate = readFileSync("components/auth/registered-app-gate.tsx", "utf8");
const onboarding = readFileSync("components/auth/account-onboarding.tsx", "utf8");
const manager = readFileSync("components/admin/viewer-invitation-manager.tsx", "utf8");
const viewerEntry = readFileSync("components/auth/viewer-invitation-entry.tsx", "utf8");

describe("view-only invitation access", () => {
  it("validates opaque invitations without creating a user, school, or write policy", () => {
    expect(migration).toContain("viewer_invitation_codes");
    expect(migration).toContain("validate_viewer_invitation_code");
    expect(migration).toContain("alter table public.viewer_invitation_codes enable row level security");
    expect(migration).toContain("grant execute on function public.validate_viewer_invitation_code(text) to anon, authenticated");
    expect(migration).toContain("revoke all on table public.viewer_invitation_codes from anon, authenticated");
  });

  it("adds an invitation-only entry flow and permits it through the application gate", () => {
    expect(provider).toContain('AuthMode = "sign-in" | "sign-up" | "invitation"');
    expect(provider).toContain("startViewerSession");
    expect(dialog).toContain("Enter with invitation code");
    expect(gate).toContain("viewerAccess");
    expect(gate).toContain('openAuth("invitation")');
    expect(viewerEntry).toContain("Enter with an invitation code");
    expect(viewerEntry).toContain("Enter view-only mode");
  });

  it("skips school selection for invitation viewers and keeps code creation administrator-only", () => {
    expect(onboarding).toContain("if (viewerAccess || !user");
    expect(manager).toContain("Create view-only code");
    expect(manager).toContain("Platform administrator access required");
  });
});
