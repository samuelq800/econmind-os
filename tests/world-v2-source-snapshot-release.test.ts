import { describe, expect, it, vi } from "vitest";
import {
  releaseFingerprint,
  verifyReleaseLock,
  publishVerifiedSnapshot,
  permissionReceipt,
  permissionEvidence,
  verifyWorldSource,
  verifyUnusedFunctionScope,
  oldFunctionIdentity,
  WORLD_SOURCE_COMMIT,
  WORLD_FUNCTION_TREE,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/run-world-v2-source-snapshot-release.mjs";
const bucket = "world-v2-official-source-v1";
function evidence(privilege = false) {
  return {
    bucket,
    relations: ["objects", "buckets"].map((name) => ({ name, rls: true })),
    roles: ["anon", "authenticated"].flatMap((role) =>
      ["objects", "buckets"].map((table) => ({
        role,
        table,
        superuser: false,
        bypass_rls: false,
        owner_privileges: false,
        insert: privilege,
        update: privilege,
        delete: privilege,
        column_insert: privilege,
        column_update: privilege,
      })),
    ),
    policies: privilege
      ? [
          {
            table: "objects",
            name: "synthetic",
            command: "*",
            permissive: true,
            qual: "synthetic-sensitive-predicate",
            check: null,
            applies_to: ["anon", "authenticated"],
          },
        ]
      : [],
  };
}
async function fixture() {
  const input = {
    lock: `RELEASE_GO:${await releaseFingerprint()}`,
    confirmation: "RELEASE_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE",
    permissionBytes: Buffer.from(JSON.stringify([{ evidence: evidence() }])),
    worldRoot: "synthetic-world",
    proofBytes: Buffer.from("synthetic-source-proof"),
    managementToken: "synthetic-management-token",
  };
  const events: string[] = [];
  const dependencies = {
    verifySource: vi.fn(() => {
      events.push("source");
    }),
    prepare: vi.fn(async () => {
      events.push("prepare");
      return { synthetic: true };
    }),
    withTransport: vi.fn(
      async (
        _context: unknown,
        operation: (transport: object) => Promise<unknown>,
      ) => {
        events.push("acquire");
        try {
          return await operation({ synthetic: true });
        } finally {
          events.push("retire");
        }
      },
    ),
    publish: vi.fn(async () => {
      events.push("publish");
      return {
        status: "WORLD_V2_SOURCE_SNAPSHOT_BYTES_VERIFIED",
        objects: 34,
        bucket,
      };
    }),
  };
  return { input, dependencies, events };
}
describe("controlled snapshot release wrapper (mock only)", () => {
  it("keeps preflight and publish locks distinct, requiring exact fingerprint and confirmation", async () => {
    const fingerprint = await releaseFingerprint();
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    await expect(
      verifyReleaseLock(
        "preflight",
        `PREFLIGHT_GO:${fingerprint}`,
        "PREFLIGHT_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE",
      ),
    ).resolves.toBe(true);
    for (const [phase, lock, confirmation] of [
      [
        "publish",
        `PREFLIGHT_GO:${fingerprint}`,
        "RELEASE_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE",
      ],
      [
        "preflight",
        `RELEASE_GO:${fingerprint}`,
        "PREFLIGHT_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE",
      ],
      [
        "publish",
        `RELEASE_GO:${"0".repeat(64)}`,
        "RELEASE_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE",
      ],
      ["publish", `RELEASE_GO:${fingerprint}`, ""],
      [
        "unexpected",
        `RELEASE_GO:${fingerprint}`,
        "RELEASE_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE",
      ],
    ])
      await expect(
        verifyReleaseLock(phase, lock, confirmation),
      ).rejects.toThrow("RELEASE_HOLD");
  });
  it("rejects HOLD and unproved permissions before source preparation or key acquisition", async () => {
    for (const mode of ["hold", "permissions"]) {
      const { input, dependencies } = await fixture();
      if (mode === "hold") input.lock = "";
      else
        input.permissionBytes = Buffer.from(
          JSON.stringify([{ evidence: evidence(true) }]),
        );
      await expect(
        publishVerifiedSnapshot(input, dependencies),
      ).rejects.toThrow();
      expect(dependencies.verifySource).not.toHaveBeenCalled();
      expect(dependencies.prepare).not.toHaveBeenCalled();
      expect(dependencies.withTransport).not.toHaveBeenCalled();
    }
  });
  it("validates source and frozen proof before acquiring a credential; only full 34 readback succeeds", async () => {
    const { input, dependencies, events } = await fixture();
    const result = await publishVerifiedSnapshot(input, dependencies);
    expect(events).toEqual([
      "source",
      "prepare",
      "acquire",
      "publish",
      "retire",
    ]);
    expect(dependencies.prepare).toHaveBeenCalledWith(
      input.worldRoot,
      input.proofBytes,
    );
    expect(result).toMatchObject({
      world_source_commit: WORLD_SOURCE_COMMIT,
      world_function_tree: WORLD_FUNCTION_TREE,
      objects: 34,
      key_lifecycle: "RETIRED_IN_FINALLY",
      deployment: "NOT_RUN",
    });
    expect(JSON.stringify(result)).not.toContain(input.managementToken);
  });
  it("stops before credential on source/proof failure and retires on unknown write without retry", async () => {
    const source = await fixture();
    source.dependencies.verifySource.mockImplementationOnce(() => {
      throw new Error("source invalid");
    });
    await expect(
      publishVerifiedSnapshot(source.input, source.dependencies),
    ).rejects.toThrow();
    expect(source.dependencies.withTransport).not.toHaveBeenCalled();
    const proof = await fixture();
    proof.dependencies.prepare.mockRejectedValueOnce(
      new Error("proof invalid"),
    );
    await expect(
      publishVerifiedSnapshot(proof.input, proof.dependencies),
    ).rejects.toThrow();
    expect(proof.dependencies.withTransport).not.toHaveBeenCalled();
    const unknown = await fixture();
    unknown.dependencies.publish.mockRejectedValueOnce(
      new Error("SNAPSHOT_OBJECT_OUTCOME_UNKNOWN_NO_RETRY"),
    );
    await expect(
      publishVerifiedSnapshot(unknown.input, unknown.dependencies),
    ).rejects.toThrow("NO_RETRY");
    expect(unknown.dependencies.publish).toHaveBeenCalledTimes(1);
    expect(unknown.events.at(-1)).toBe("retire");
    const partial = await fixture();
    partial.dependencies.publish.mockResolvedValueOnce({
      status: "WORLD_V2_SOURCE_SNAPSHOT_BYTES_VERIFIED",
      objects: 33,
      bucket,
    });
    await expect(
      publishVerifiedSnapshot(partial.input, partial.dependencies),
    ).rejects.toThrow("RESULT_INVALID");
    expect(partial.events.at(-1)).toBe("retire");
  });
  it("never publishes predicates and does not label collected blocked metadata as approved", () => {
    const receipt = permissionReceipt(
      Buffer.from(JSON.stringify([{ evidence: evidence(true) }])),
    );
    expect(receipt).toMatchObject({
      verified: false,
      status: "SNAPSHOT_STORAGE_WRITE_BOUNDARY_BLOCKED",
      storage_write: "NOT_RUN",
      key_acquisition: "NOT_RUN",
    });
    expect(JSON.stringify(receipt)).not.toContain(
      "synthetic-sensitive-predicate",
    );
    expect(() => permissionEvidence([])).toThrow("RESPONSE_INVALID");
    expect(() => permissionEvidence([{ evidence: [] }])).toThrow(
      "RESPONSE_INVALID",
    );
    expect(() =>
      verifyWorldSource("/nonexistent/snapshot-source-test"),
    ).toThrow("SOURCE_IDENTITY_INVALID");
  });
  it("requires exactly seven old functions and an unused new slug before publication", () => {
    const old = Array.from({ length: 7 }, (_, i) => ({
      slug: `synthetic-old-${i}`,
      version: 1,
    }));
    expect(() => verifyUnusedFunctionScope(old)).not.toThrow();
    expect(() => verifyUnusedFunctionScope(old.slice(1))).toThrow(
      "OLD_FUNCTION_SCOPE_CHANGED",
    );
    expect(() =>
      verifyUnusedFunctionScope([
        ...old,
        { slug: "world-v2-official-read", version: 1 },
      ]),
    ).toThrow("ALREADY_EXISTS");
    expect(oldFunctionIdentity(old)).toEqual(
      oldFunctionIdentity([...old].reverse()),
    );
  });
});
