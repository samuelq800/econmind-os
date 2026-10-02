import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import pinnedManifest from "./world-v2-source-snapshot-manifest.json" with { type: "json" };
import {
  FULL_JSON_ARTIFACT_PATHS,
  MIGRATION_ID,
  MIGRATION_SHA256,
} from "./render-world-v2-api-full-reader-release.mjs";

export const SNAPSHOT_BUCKET = "world-v2-official-source-v1";
export const SNAPSHOT_SELECTION =
  "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315";
export const DB_SOURCE_PROOF_SHA256 =
  "9378f985d40887fc93e910fc384399c8c9a4d9af31eb9588b070f4813ec15bd6";
export const DB_SOURCE_PROOF_RUN = "36672349466";
const PACKAGE = "BALANCED_2026_09_28_V1";
export const BUCKET_PROPERTIES = Object.freeze({
  id: SNAPSHOT_BUCKET,
  name: SNAPSHOT_BUCKET,
  public: true,
  file_size_limit: 9_000_000,
  allowed_mime_types: ["application/json"],
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fail(code) {
  throw new Error(code);
}

export function verifyDatabaseSourceDigests(receipt, objects) {
  const after = receipt?.after;
  if (
    receipt?.status !== "WORLD_V2_API_FULL_READER_RELEASE_VERIFIED" ||
    receipt.migration_id !== MIGRATION_ID ||
    receipt.migration_sha256 !== MIGRATION_SHA256 ||
    after?.candidate_bundle?.bundle_id !== PACKAGE ||
    after.candidate_bundle.package_manifest_sha256 !== SNAPSHOT_SELECTION ||
    after.candidate_bundle.source_status !==
      "IMPLEMENTED_UNVERIFIED_CANDIDATE" ||
    after.candidate_bundle.activation_allowed !== false ||
    !Array.isArray(after.full_json_source_digests) ||
    after.full_json_source_digests.length !== 34
  )
    fail("SNAPSHOT_DB_SOURCE_PROOF_INVALID");
  const digests = new Map(
    after.full_json_source_digests.map((item) => [item.artifact_path, item]),
  );
  if (digests.size !== 34) fail("SNAPSHOT_DB_SOURCE_PROOF_INVALID");
  for (const object of objects) {
    const row = digests.get(object.storage_path);
    if (
      row?.content_sha256 !== object.sha256 ||
      row?.content_bytes !== object.bytes
    )
      fail("SNAPSHOT_DB_SOURCE_HASH_MISMATCH");
  }
}

function verifyObjects(objects) {
  if (
    !Array.isArray(objects) ||
    objects.length !== 34 ||
    new Set(objects.map((item) => item.key)).size !== 34 ||
    JSON.stringify(objects.map((item) => item.storage_path).sort()) !==
      JSON.stringify(FULL_JSON_ARTIFACT_PATHS)
  )
    fail("SNAPSHOT_PUBLIC_SOURCE_SET_INVALID");
  for (const object of objects) {
    if (
      !/^data\/[a-z0-9-]+\.json$/u.test(object.source_path) ||
      object.storage_path !==
        `source/${Buffer.from(object.source_path).toString("hex")}` ||
      object.key !== `${SNAPSHOT_SELECTION}/${object.sha256}.json` ||
      !/^[0-9a-f]{64}$/u.test(object.sha256) ||
      !Number.isSafeInteger(object.bytes) ||
      object.bytes < 1 ||
      object.bytes > 9_000_000 ||
      typeof object.content !== "string" ||
      Buffer.byteLength(object.content, "utf8") !== object.bytes ||
      hash(Buffer.from(object.content, "utf8")) !== object.sha256
    )
      fail("SNAPSHOT_PUBLIC_SOURCE_INVALID");
  }
}

export function verifyPinnedSourceManifest(objects) {
  if (!Array.isArray(objects) || objects.length !== pinnedManifest.length)
    fail("SNAPSHOT_PINNED_MANIFEST_MISMATCH");
  const byPath = new Map(
    objects.map((object) => [object.storage_path, object]),
  );
  if (byPath.size !== pinnedManifest.length)
    fail("SNAPSHOT_PINNED_MANIFEST_MISMATCH");
  for (const expected of pinnedManifest) {
    const actual = byPath.get(expected.storage_path);
    if (
      !actual ||
      actual.source_path !== expected.source_path ||
      actual.sha256 !== expected.sha256 ||
      actual.bytes !== expected.bytes
    )
      fail("SNAPSHOT_PINNED_MANIFEST_MISMATCH");
  }
}

/** Read-only preparation. Exact historical DB reconstruction evidence is reused,
 * not replaced by a new production query or a claimed live projection. */
export async function prepareSnapshot(worldRoot, proofBytes) {
  if (hash(proofBytes) !== DB_SOURCE_PROOF_SHA256)
    fail("SNAPSHOT_DB_PROOF_IDENTITY_INVALID");
  const { loadBalancedCountryCandidate } = await import(
    pathToFileURL(
      path.join(worldRoot, "scripts/balanced-country-candidate-intake.mjs"),
    ).href
  );
  const bundle = await loadBalancedCountryCandidate(worldRoot);
  const { OFFICIAL_DATASETS } = await import(
    pathToFileURL(
      path.join(
        worldRoot,
        "supabase/functions/world-v2-official-read/lib/official-dataset-registry.js",
      ),
    ).href
  );
  if (
    bundle.candidateId !== PACKAGE ||
    bundle.manifestSha256 !== SNAPSHOT_SELECTION ||
    bundle.activationAllowed !== false ||
    bundle.artifacts.length !== 87
  )
    fail("SNAPSHOT_SELECTED_SOURCE_INVALID");
  const artifacts = new Map(
    bundle.artifacts.map((item) => [item.sourcePath, item]),
  );
  const objects = OFFICIAL_DATASETS.map((spec) => ({
    source_path: spec.sourcePath,
    storage_path: spec.storagePath,
    sha256: spec.sha256,
    bytes: spec.bytes,
    key: `${SNAPSHOT_SELECTION}/${spec.sha256}.json`,
    content: artifacts.get(spec.sourcePath)?.content,
  }));
  verifyObjects(objects);
  verifyPinnedSourceManifest(objects);
  verifyDatabaseSourceDigests(JSON.parse(proofBytes.toString("utf8")), objects);
  return Object.freeze({
    bucket: SNAPSHOT_BUCKET,
    selection_sha256: SNAPSHOT_SELECTION,
    source_proof_run: DB_SOURCE_PROOF_RUN,
    source_proof_sha256: DB_SOURCE_PROOF_SHA256,
    source_artifacts_verified: 87,
    objects: Object.freeze(objects.map(Object.freeze)),
  });
}

function sameBytes(bytes, object) {
  return (
    bytes instanceof Uint8Array &&
    bytes.byteLength === object.bytes &&
    hash(bytes) === object.sha256
  );
}

/** Injectable create-only protocol for disposable tests. No production transport,
 * credential lookup or network access is provided by this candidate. */
export async function publishCreateOnlySnapshot(plan, transport) {
  verifyPinnedSourceManifest(plan.objects);
  return exerciseCreateOnlySnapshotProtocol(plan, transport);
}

// Exposed only for deterministic disposable protocol fixtures; production
// publication must enter through the pinned-manifest wrapper above.
export async function exerciseCreateOnlySnapshotProtocol(plan, transport) {
  if (
    plan.bucket !== SNAPSHOT_BUCKET ||
    plan.selection_sha256 !== SNAPSHOT_SELECTION ||
    plan.source_proof_sha256 !== DB_SOURCE_PROOF_SHA256 ||
    plan.source_artifacts_verified !== 87
  )
    fail("SNAPSHOT_PLAN_INVALID");
  verifyObjects(plan.objects);
  const expectedKeys = new Set(plan.objects.map((item) => item.key));
  const bucket = await transport.getBucket(SNAPSHOT_BUCKET);
  if (bucket === null) {
    try {
      await transport.createBucket(BUCKET_PROPERTIES);
    } catch {
      fail("SNAPSHOT_BUCKET_OUTCOME_UNKNOWN_NO_RETRY");
    }
  } else if (
    bucket.id !== SNAPSHOT_BUCKET ||
    bucket.name !== SNAPSHOT_BUCKET ||
    bucket.public !== true ||
    bucket.file_size_limit !== BUCKET_PROPERTIES.file_size_limit ||
    JSON.stringify(bucket.allowed_mime_types) !==
      JSON.stringify(BUCKET_PROPERTIES.allowed_mime_types)
  ) {
    fail("SNAPSHOT_EXISTING_BUCKET_CONFLICT");
  }
  const existingKeys = await transport.listKeys(SNAPSHOT_BUCKET);
  if (
    !Array.isArray(existingKeys) ||
    existingKeys.some((key) => !expectedKeys.has(key)) ||
    new Set(existingKeys).size !== existingKeys.length
  )
    fail("SNAPSHOT_UNEXPECTED_PUBLIC_OBJECT");
  for (const object of plan.objects) {
    const before = await transport.readObject(SNAPSHOT_BUCKET, object.key);
    if (before !== null) {
      if (!sameBytes(before, object)) fail("SNAPSHOT_EXISTING_OBJECT_CONFLICT");
      continue;
    }
    try {
      await transport.createObject(
        SNAPSHOT_BUCKET,
        object.key,
        Buffer.from(object.content, "utf8"),
        { contentType: "application/json", upsert: false },
      );
    } catch {
      fail("SNAPSHOT_OBJECT_OUTCOME_UNKNOWN_NO_RETRY");
    }
    if (
      !sameBytes(
        await transport.readObject(SNAPSHOT_BUCKET, object.key),
        object,
      )
    )
      fail("SNAPSHOT_OBJECT_READBACK_FAILED");
  }
  // No connection/deploy success is emitted until every object is readback verified.
  for (const object of plan.objects)
    if (
      !sameBytes(
        await transport.readObject(SNAPSHOT_BUCKET, object.key),
        object,
      )
    )
      fail("SNAPSHOT_COMPLETE_READBACK_FAILED");
  return {
    status: "WORLD_V2_SOURCE_SNAPSHOT_BYTES_VERIFIED",
    bucket: SNAPSHOT_BUCKET,
    selection_sha256: SNAPSHOT_SELECTION,
    objects: 34,
    source_artifacts_verified: 87,
    source_proof_run: DB_SOURCE_PROOF_RUN,
    source_proof_sha256: DB_SOURCE_PROOF_SHA256,
    live_world_state: false,
    deployment: "NOT_RUN",
    write_policy_verification: "NOT_RUN",
    production_release: "HOLD",
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const [command, root, proof, output] = process.argv.slice(2);
  try {
    if (command !== "prepare" || !root || !proof || !output)
      fail("SNAPSHOT_PREPARE_ARGUMENTS_INVALID");
    const plan = await prepareSnapshot(
      path.resolve(root),
      await readFile(proof),
    );
    const { objects, ...identity } = plan;
    await writeFile(
      output,
      JSON.stringify(
        {
          status: "WORLD_V2_SOURCE_SNAPSHOT_PREPARED",
          ...identity,
          objects: objects.map(({ content, ...metadata }) => {
            void content;
            return metadata;
          }),
          production_release: "HOLD",
          credential_acquisition: "NOT_RUN",
          deployment: "NOT_RUN",
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    process.stdout.write("WORLD_V2_SOURCE_SNAPSHOT_PREPARED\n");
  } catch {
    console.error("WORLD_V2_SOURCE_SNAPSHOT_PREPARATION_FAILED");
    process.exitCode = 1;
  }
}
