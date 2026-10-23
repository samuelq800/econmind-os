import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Scoped release script has no TypeScript declaration.
import { publishDirectRegistration } from "../scripts/publish-direct-registration.mjs";
describe("bounded registration publisher", () => {
  const migration = "begin;\nselect 1;\ncommit;\n",
    verification = "select true as verified;";
  const hash = createHash("sha256").update(migration).digest("hex");
  it("applies one transaction with ledger and verifies its exact hash", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false, table_exists: false }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ migration_sha256: hash }])
      .mockResolvedValueOnce([{ verified: true }]);
    expect(
      await publishDirectRegistration({ request, migration, verification }),
    ).toMatchObject({ result: "installed" });
    expect(request.mock.calls[1][0]).toContain("pg_advisory_xact_lock");
    expect(request.mock.calls[1][0]).toMatch(/commit;$/);
  });
  it("never retries an uncertain write or changes an untracked backend", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ installed: false, table_exists: false }])
      .mockRejectedValueOnce(new Error("uncertain"));
    await expect(
      publishDirectRegistration({ request, migration, verification }),
    ).rejects.toThrow("uncertain");
    expect(request).toHaveBeenCalledTimes(2);
    request
      .mockReset()
      .mockResolvedValueOnce([{ installed: false, table_exists: true }]);
    await expect(
      publishDirectRegistration({ request, migration, verification }),
    ).rejects.toThrow("untracked");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
