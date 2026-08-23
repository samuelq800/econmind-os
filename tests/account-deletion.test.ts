import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260824000000_safe_personal_account_deletion.sql",
  "utf8",
);
const provider = readFileSync(
  "components/governance/account-deletion-provider.tsx",
  "utf8",
);
const styles = readFileSync(
  "components/governance/account-deletion-provider.module.css",
  "utf8",
);
const client = readFileSync("lib/supabase/account-deletion.ts", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

describe("safe personal-account deletion", () => {
  it("closes the old partial-profile deletion path", () => {
    expect(migration).toContain('drop policy if exists "profiles_delete_own"');
    expect(migration).toContain(
      "revoke delete on public.profiles from authenticated",
    );
  });

  it("derives the target from auth.uid and re-checks blockers inside one deletion RPC", () => {
    expect(migration).toContain(
      "delete_self_personal_account(p_confirmation text)",
    );
    expect(migration).toContain("account_id uuid := auth.uid()");
    expect(migration).toContain("for update");
    expect(migration).toContain(
      "private.account_deletion_blockers(account_id)",
    );
    expect(migration).toContain("delete from auth.users where id = account_id");
    expect(migration).not.toContain("delete_self_personal_account(p_user_id");
  });

  it("blocks organisation, elevated-role, World, League, and shared-content owners", () => {
    for (const blocker of [
      "privileged_role",
      "school_affiliation",
      "team_membership",
      "league_assignment",
      "world_membership",
      "shared_league_history",
      "shared_authored_content",
    ]) {
      expect(migration).toContain(blocker);
    }
    expect(migration).toContain("profile_platform_roles");
    expect(migration).toContain("league_challenge_role_assignments");
  });

  it("removes private support correspondence transactionally before the Auth cascade", () => {
    const moderationDelete = migration.indexOf(
      "delete from public.moderation_actions",
    );
    const supportDelete = migration.indexOf(
      "delete from public.support_requests",
    );
    const authDelete = migration.indexOf("delete from auth.users");
    expect(moderationDelete).toBeGreaterThan(0);
    expect(supportDelete).toBeGreaterThan(moderationDelete);
    expect(authDelete).toBeGreaterThan(supportDelete);
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("plays success only after the deletion RPC resolves and keeps its host above route changes", () => {
    expect(provider).toMatch(
      /await deletePersonalAccount\(confirmation\);\s+setPhase\("animating"\)/,
    );
    expect(provider).toContain(
      "Account deletion did not complete. No data was changed.",
    );
    expect(layout).toContain("AccountDeletionProvider");
    expect(client).toContain('signOut({ scope: "local" })');
  });

  it("uses composited aerospace and CRT motion with a reduced-motion completion path", () => {
    expect(provider).toContain("PAYLOAD FAIRING");
    expect(provider).toContain("THRUST STRUCTURE");
    expect(styles).toContain("@keyframes hatchLeft");
    expect(styles).toContain("@keyframes hatchRight");
    expect(styles).toContain("@keyframes crtBeamOut");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });
});
