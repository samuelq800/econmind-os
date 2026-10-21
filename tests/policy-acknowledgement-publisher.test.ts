import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Local release script is intentionally standalone JavaScript.
import { publishPolicyAcknowledgements } from "../scripts/publish-policy-acknowledgements.mjs";
const migration = readFileSync(
  "supabase/migrations/20261021020000_policy_acknowledgement_release.sql",
  "utf8",
);
const verification = readFileSync(
  "scripts/verify-policy-acknowledgements.sql",
  "utf8",
);
describe("bounded policy receipt activation", () => {
  it("installs only the exact migration with an atomic ledger, never accepts for any user", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false, table_exists: false }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ matches: true }])
      .mockResolvedValueOnce([{ verified: true }]);
    const result = await publishPolicyAcknowledgements({
      request,
      migration,
      verification,
    });
    expect(result.userConfirmationsCreated).toBe(0);
    expect(request.mock.calls.filter((c) => c[1] === false)).toHaveLength(1);
    const sql = request.mock.calls[1][0];
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("supabase_migrations.schema_migrations");
    expect(sql).not.toMatch(/select\s+public\.acknowledge_policy_release\(/);
  });
  it("read-only readiness cannot install or mutate", async () => {
    const request = vi
      .fn()
      .mockResolvedValue([{ installed: false, table_exists: false }]);
    await expect(
      publishPolicyAcknowledgements({
        request,
        migration,
        verification,
        checkOnly: true,
      }),
    ).rejects.toThrow("not installed");
    expect(request.mock.calls.every((c) => c[1] === true)).toBe(true);
  });
  it("does not overwrite an untracked table", async () => {
    const request = vi
      .fn()
      .mockResolvedValue([{ installed: false, table_exists: true }]);
    await expect(
      publishPolicyAcknowledgements({ request, migration, verification }),
    ).rejects.toThrow("Untracked");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("only verifies an installed exact release and fails on a ledger mismatch", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: true, table_exists: true }])
      .mockResolvedValueOnce([{ matches: true }])
      .mockResolvedValueOnce([{ verified: true }]);
    expect(
      (
        await publishPolicyAcknowledgements({
          request,
          migration,
          verification,
        })
      ).result,
    ).toBe("verified-existing");
    expect(request.mock.calls.every((c) => c[1] === true)).toBe(true);
    request
      .mockReset()
      .mockResolvedValueOnce([{ installed: true, table_exists: true }])
      .mockResolvedValueOnce([{ matches: false }]);
    await expect(
      publishPolicyAcknowledgements({ request, migration, verification }),
    ).rejects.toThrow("readback failed");
  });
});
