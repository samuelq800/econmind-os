import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Existing release scripts are deliberately dependency-free JavaScript.
import { publishRecipientGroups } from "../scripts/publish-mail-recipient-groups.mjs";
const migration = readFileSync("supabase/migrations/20261019000000_admin_mail_recipient_groups.sql", "utf8");
const verification = readFileSync("scripts/verify-mail-recipient-groups.sql", "utf8");
describe("Scoped recipient directory publisher", () => {
  it("applies one transactional additive migration and reads it back", async () => {
    const request = vi.fn().mockResolvedValueOnce([{ installed: false, function_exists: false }]).mockResolvedValueOnce([{ ready: true }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ verified: true }]);
    await expect(publishRecipientGroups({ request, migration, verification })).resolves.toBe("published");
    const writes = request.mock.calls.filter(([, readOnly]) => !readOnly);
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toContain("as $$");
    expect(writes[0][0]).toContain("end $verify$;");
    expect(writes[0][0]).toContain("supabase_migrations.schema_migrations");
    expect(migration).not.toMatch(/(?:insert into|update|delete from|alter table|drop function)\s+public\./i);
  });
  it("does not retry an uncertain write", async () => {
    const request = vi.fn().mockResolvedValueOnce([{ installed: false, function_exists: false }]).mockResolvedValueOnce([{ ready: true }]).mockRejectedValueOnce(new Error("timeout"));
    await expect(publishRecipientGroups({ request, migration, verification })).rejects.toThrow("timeout");
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("verifies existing installs read-only and rejects untracked functions", async () => {
    const request = vi.fn().mockResolvedValueOnce([{ installed: true, function_exists: true }]).mockResolvedValueOnce([{ verified: true }]);
    await expect(publishRecipientGroups({ request, migration, verification })).resolves.toBe("already-installed");
    expect(request.mock.calls.every(([, readOnly]) => readOnly)).toBe(true);
    request.mockReset().mockResolvedValueOnce([{ installed: false, function_exists: true }]);
    await expect(publishRecipientGroups({ request, migration, verification })).rejects.toThrow("Untracked");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
