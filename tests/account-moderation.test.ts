import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navbar = readFileSync("components/layout/navbar.tsx", "utf8");
const provider = readFileSync("components/auth/auth-provider.tsx", "utf8");
const functionSource = readFileSync("supabase/functions/moderate-account-access/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260831010000_add_reversible_account_suspension.sql", "utf8");
const workflow = readFileSync(".github/workflows/deploy-supabase.yml", "utf8");

describe("designated account moderation", () => {
  it("keeps the control restricted, reversible, and audited", () => {
    expect(functionSource).toContain('const DESIGNATED_ADMIN_ID = "ffc87a95-f535-4781-9c2d-c2fac962ea9e"');
    expect(functionSource).toContain('const DESIGNATED_TARGET_ID = "1396ed21-aef3-4827-a2b9-dd25d4be21a7"');
    expect(functionSource).toContain('profile?.platform_role !== "platform_admin"');
    expect(functionSource).toContain('ban_duration: nextSuspended ? "876000h" : "none"');
    expect(functionSource).toContain('action: nextSuspended ? "access_restricted" : "access_restored"');
    expect(functionSource).toContain("accountIsBanned");
    expect(functionSource).toContain("isPendingAccessStateSchema");
  });

  it("shows the console only to the designated administrator and signs suspended users out of the app", () => {
    expect(navbar).toContain("designatedAccountModerator");
    expect(navbar).toContain("Account access control");
    expect(navbar).toContain("account-access-code-stream");
    expect(provider).toContain('account_status === "suspended"');
    expect(provider).toContain('select("role,platform_role")');
    expect(provider).toContain('supabase.auth.signOut({ scope: "local" })');
  });

  it("persists a reversible suspension state and deploys its protected function", () => {
    expect(migration).toContain("account_status");
    expect(migration).toContain("account_status_changed_by");
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toContain("new.account_status := old.account_status");
    expect(workflow).toContain("moderate-account-access");
    expect(workflow).toContain("inputs.apply_migrations == false && inputs.deploy_workers == false");
  });
});
