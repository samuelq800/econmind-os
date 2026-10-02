import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  canonicalOid,
  policyReleaseFingerprint,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/world-v2-snapshot-storage-policy-release.mjs";
import {
  policyReadbackFingerprint,
  verifyPolicyReadbackLock,
  buildPolicyReadbackQuery,
  ORIGINAL_UNKNOWN_SHA256,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/world-v2-snapshot-storage-policy-readback.mjs";
describe("bounded current-state recovery, never original publication success", () => {
  it("preserves original UNKNOWN bytes without relabelling", () => {
    const bytes = readFileSync(
      new URL(
        "../docs/evidence/world-v2-storage-policy-unknown-37031019041.json",
        import.meta.url,
      ),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      ORIGINAL_UNKNOWN_SHA256,
    );
    const original = JSON.parse(bytes.toString("utf8"));
    expect(original.status).toBe("UNKNOWN_STOP_NO_RETRY");
    expect(original.github_run_id).toBe("37031019041");
  });
  it("accepts only canonical positive uint32 OIDs, strings or genuine integer JSON", () => {
    for (const value of ["10", 10, "4294967295", 4294967295])
      expect(canonicalOid(value)).toBe(String(value));
    for (const value of [
      null,
      undefined,
      0,
      -1,
      1.2,
      NaN,
      Infinity,
      "0",
      "01",
      "-1",
      " 10",
      "10 ",
      "1e1",
      "4294967296",
      4294967296,
      [],
      {},
    ])
      expect(canonicalOid(value)).toBeNull();
  });
  it("separates readback lock and confirmation from publication and defaults HOLD", async () => {
    const fingerprint = await policyReadbackFingerprint();
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toBe(await policyReleaseFingerprint());
    for (const [lock, confirmation] of [
      [undefined, undefined],
      [`RELEASE_GO:${fingerprint}`, "READ_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE"],
      [
        `READBACK_GO:${fingerprint}`,
        "RELEASE_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE",
      ],
      [
        `READBACK_GO:${"0".repeat(64)}`,
        "READ_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE",
      ],
    ])
      await expect(
        verifyPolicyReadbackLock(lock, confirmation),
      ).rejects.toThrow("SNAPSHOT_POLICY_READBACK_HOLD");
    await expect(
      verifyPolicyReadbackLock(
        `READBACK_GO:${fingerprint}`,
        "READ_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE",
      ),
    ).resolves.toBeUndefined();
  });
  it("rejects unbound ledger inputs and keeps a single request in the existing workflow", () => {
    expect(() =>
      buildPolicyReadbackQuery({
        beforeLedger: Array(21).fill({}),
        afterLedger: Array(22).fill({}),
      }),
    ).toThrow("SNAPSHOT_POLICY_READBACK_INTENT_INVALID");
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/release-world-v2-snapshot-storage-policies.yml",
        import.meta.url,
      ),
      "utf8",
    );
    expect(workflow.match(/curl --fail/g)).toHaveLength(1);
    expect(workflow).toContain("default: readback");
    expect(workflow).toContain("WORLD_V2_SNAPSHOT_POLICY_READBACK_LOCK");
    expect(workflow).not.toMatch(
      /--retry|api-keys|storage\/v1|functions deploy/,
    );
    const readbackSource = readFileSync(
      new URL(
        "../scripts/world-v2-snapshot-storage-policy-readback.mjs",
        import.meta.url,
      ),
      "utf8",
    );
    expect(readbackSource).toContain("read_only: true");
    expect(readbackSource).not.toMatch(
      /create temporary|lock table|pg_advisory|insert into|update storage|delete from/i,
    );
    expect(readbackSource).toContain('original_release_success: "NOT_CLAIMED"');
    expect(readbackSource).toContain("NOT_EVIDENCED_BY_CURRENT_READBACK");
  });
});
