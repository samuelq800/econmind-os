import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import baseline from "../docs/evidence/world-v2-storage-preflight-37021759785.json";
import {
  policyReleaseFingerprint,
  verifyPolicyReleaseLock,
  buildPolicyApplyQuery,
  verifyPolicyPublication,
  POLICY_SQL_SHA256,
  POLICY_MIGRATION_ID,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/world-v2-snapshot-storage-policy-release.mjs";

describe("two-policy candidate is locked and fail closed, no production contact", () => {
  it("preserves the immutable historical receipt bytes", () => {
    const bytes = readFileSync(
      new URL(
        "../docs/evidence/world-v2-storage-preflight-37021759785.json",
        import.meta.url,
      ),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      "bdda465e29c3889f5cf3c3312370bcf73b08b0a8a44cd3a4b39ae5ef33f086c9",
    );
    expect(baseline.status).toBe("SNAPSHOT_STORAGE_WRITE_BOUNDARY_BLOCKED");
  });
  it("defaults to HOLD and binds a distinct complete candidate fingerprint", async () => {
    const fingerprint = await policyReleaseFingerprint();
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    for (const [lock, confirmation] of [
      [undefined, undefined],
      [
        `PREFLIGHT_GO:${fingerprint}`,
        "RELEASE_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE",
      ],
      [
        `RELEASE_GO:${"0".repeat(64)}`,
        "RELEASE_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE",
      ],
      [`RELEASE_GO:${fingerprint}`, "RELEASE_WORLD_V2_SOURCE_SNAPSHOT_ONCE"],
    ])
      await expect(verifyPolicyReleaseLock(lock, confirmation)).rejects.toThrow(
        "SNAPSHOT_POLICY_RELEASE_HOLD",
      );
    await expect(
      verifyPolicyReleaseLock(
        `RELEASE_GO:${fingerprint}`,
        "RELEASE_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE",
      ),
    ).resolves.toBeUndefined();
  });
  it("refuses non-exact migration bytes before rendering any SQL", () => {
    expect(() =>
      buildPolicyApplyQuery({
        sql: "create policy other;",
        migration: {
          migration_id: POLICY_MIGRATION_ID,
          sha256: POLICY_SQL_SHA256,
        },
        beforeLedger: Array(21).fill({}),
        afterLedger: Array(22).fill({}),
      }),
    ).toThrow("SNAPSHOT_POLICY_RENDER_INTENT_INVALID");
  });
  it("refuses empty/truncated/equivocal receipts including missing paired protected properties", () => {
    const release = { beforeLedger: [], afterLedger: [] };
    for (const response of [
      [],
      [{ evidence: {} }],
      [
        {
          evidence: {
            status: "SNAPSHOT_POLICY_ATOMIC_SCOPE_VERIFIED",
            migration_id: POLICY_MIGRATION_ID,
            migration_sha256: POLICY_SQL_SHA256,
            before: {},
            after: {},
          },
        },
      ],
    ])
      expect(() => verifyPolicyPublication(response, release)).toThrow();
  });
  it("separates one DDL request from snapshot credentials/deployment and records UNKNOWN without retry", () => {
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/release-world-v2-snapshot-storage-policies.yml",
        import.meta.url,
      ),
      "utf8",
    );
    expect(workflow.match(/curl --fail/g)).toHaveLength(1);
    expect(workflow).not.toMatch(
      /--retry|api-keys|storage\/v1|functions deploy|ALTER ROLE/i,
    );
    expect(workflow).toContain("group: supabase-production");
    expect(workflow).toContain("WORLD_V2_SNAPSHOT_POLICY_RELEASE_LOCK");
    expect(workflow).toContain("UNKNOWN and stop, never retry");
    const native = readFileSync(
      new URL(
        "../scripts/test-world-v2-snapshot-storage-policy-release.mjs",
        import.meta.url,
      ),
      "utf8",
    );
    expect(native).toContain('"world_snapshot_policy_test:17"');
    expect(native).toContain('"127.0.0.1"');
    expect(native).not.toContain("DATABASE_URL");
  });
});
