import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import pinnedManifest from "../scripts/world-v2-source-snapshot-manifest.json";
import {
  FULL_JSON_ARTIFACT_PATHS,
  MIGRATION_ID,
  MIGRATION_SHA256,
  // @ts-expect-error ESM helper has no declarations.
} from "../scripts/render-world-v2-api-full-reader-release.mjs";
import {
  publishCreateOnlySnapshot,
  exerciseCreateOnlySnapshotProtocol,
  verifyPinnedSourceManifest,
  verifyDatabaseSourceDigests,
  BUCKET_PROPERTIES,
  SNAPSHOT_BUCKET,
  SNAPSHOT_SELECTION,
  DB_SOURCE_PROOF_SHA256,
  // @ts-expect-error ESM helper has no declarations.
} from "../scripts/world-v2-source-snapshot-publisher.mjs";
const objects = FULL_JSON_ARTIFACT_PATHS.map(
  (storage: string, index: number) => {
    const content = JSON.stringify({ synthetic: index });
    const sha256 = createHash("sha256").update(content).digest("hex");
    return {
      source_path: Buffer.from(storage.slice(7), "hex").toString("utf8"),
      storage_path: storage,
      content,
      sha256,
      bytes: Buffer.byteLength(content),
      key: `${SNAPSHOT_SELECTION}/${sha256}.json`,
    };
  },
);
const plan = {
  bucket: SNAPSHOT_BUCKET,
  selection_sha256: SNAPSHOT_SELECTION,
  source_proof_sha256: DB_SOURCE_PROOF_SHA256,
  source_artifacts_verified: 87,
  objects,
};
function transport() {
  const state = new Map<string, Uint8Array>();
  let bucket: typeof BUCKET_PROPERTIES | null = null;
  const calls = {
    getBucket: vi.fn(async () => bucket),
    createBucket: vi.fn(async (value: typeof BUCKET_PROPERTIES) => {
      bucket = value;
    }),
    listKeys: vi.fn(async () => [...state.keys()]),
    readObject: vi.fn(
      async (_bucket: string, key: string) => state.get(key) ?? null,
    ),
    createObject: vi.fn(
      async (name: string, key: string, data: Uint8Array, options: unknown) => {
        expect(name).toBe(SNAPSHOT_BUCKET);
        expect(options).toEqual({
          contentType: "application/json",
          upsert: false,
        });
        if (state.has(key)) throw new Error("duplicate");
        state.set(key, data);
      },
    ),
  };
  return { state, calls };
}
describe("World-only source create-only candidate publisher", () => {
  it("writes only the 34 content-address objects, verifies all bytes and reruns without mutation", async () => {
    const { calls } = transport();
    expect(await exerciseCreateOnlySnapshotProtocol(plan, calls)).toMatchObject(
      {
        objects: 34,
        live_world_state: false,
        deployment: "NOT_RUN",
        production_release: "HOLD",
      },
    );
    await exerciseCreateOnlySnapshotProtocol(plan, calls);
    expect(calls.createBucket).toHaveBeenCalledTimes(1);
    expect(calls.createObject).toHaveBeenCalledTimes(34);
  });
  it("rejects unapproved files and wrong hash before any storage operation", async () => {
    for (const changed of [
      { ...plan, objects: [...objects, { ...objects[0], key: "old/private" }] },
      {
        ...plan,
        objects: objects.map((item: object, index: number) =>
          index === 0 ? { ...item, content: "wrong" } : item,
        ),
      },
    ]) {
      const { calls } = transport();
      await expect(publishCreateOnlySnapshot(changed, calls)).rejects.toThrow();
      expect(calls.getBucket).not.toHaveBeenCalled();
    }
  });
  it("stops on conflicting existing object or unexpected public object without overwrite", async () => {
    for (const key of [objects[0].key, "old/private"]) {
      const { calls, state } = transport();
      state.set(key, Buffer.from("wrong"));
      await expect(
        exerciseCreateOnlySnapshotProtocol(plan, calls),
      ).rejects.toThrow();
      expect(calls.createObject).not.toHaveBeenCalled();
    }
  });
  it("never retries unknown writes or calls delete/update; partial publication is not connected", async () => {
    const { calls } = transport();
    calls.createObject.mockRejectedValueOnce(
      new Error("synthetic-secret-do-not-output"),
    );
    await expect(
      exerciseCreateOnlySnapshotProtocol(plan, calls),
    ).rejects.toThrow("SNAPSHOT_OBJECT_OUTCOME_UNKNOWN_NO_RETRY");
    expect(calls.createObject).toHaveBeenCalledTimes(1);
    const second = transport();
    second.calls.readObject
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(Buffer.from("corrupt"));
    await expect(
      exerciseCreateOnlySnapshotProtocol(plan, second.calls),
    ).rejects.toThrow("SNAPSHOT_OBJECT_READBACK_FAILED");
  });
  it("pins the exact historical 34-source hash/size manifest, not just file paths", async () => {
    expect(() => verifyPinnedSourceManifest(pinnedManifest)).not.toThrow();
    expect(() => verifyPinnedSourceManifest(objects)).toThrow(
      "SNAPSHOT_PINNED_MANIFEST_MISMATCH",
    );
    const { calls } = transport();
    await expect(publishCreateOnlySnapshot(plan, calls)).rejects.toThrow(
      "SNAPSHOT_PINNED_MANIFEST_MISMATCH",
    );
    expect(calls.getBucket).not.toHaveBeenCalled();
  });
  it("requires the recorded inactive DB source digests for all 34 exact bytes", () => {
    const receipt = {
      status: "WORLD_V2_API_FULL_READER_RELEASE_VERIFIED",
      migration_id: MIGRATION_ID,
      migration_sha256: MIGRATION_SHA256,
      after: {
        candidate_bundle: {
          bundle_id: "BALANCED_2026_09_28_V1",
          package_manifest_sha256: SNAPSHOT_SELECTION,
          source_status: "IMPLEMENTED_UNVERIFIED_CANDIDATE",
          activation_allowed: false,
        },
        full_json_source_digests: objects.map(
          (item: { storage_path: string; sha256: string; bytes: number }) => ({
            artifact_path: item.storage_path,
            content_sha256: item.sha256,
            content_bytes: item.bytes,
          }),
        ),
      },
    };
    expect(() => verifyDatabaseSourceDigests(receipt, objects)).not.toThrow();
    expect(() =>
      verifyDatabaseSourceDigests(
        {
          ...receipt,
          after: { ...receipt.after, full_json_source_digests: [] },
        },
        objects,
      ),
    ).toThrow();
    expect(() =>
      verifyDatabaseSourceDigests(
        receipt,
        objects.map((item: object, index: number) =>
          index === 0 ? { ...item, bytes: 1 } : item,
        ),
      ),
    ).toThrow();
  });
});
