import { readFile, writeFile } from "node:fs/promises";

const [phase, responsePath, outputPath, batchIndex] = process.argv.slice(2);
if (
  !["schema", "batch", "import"].includes(phase) ||
  !responsePath ||
  !outputPath
) {
  throw new Error("WORLD_V2_BALANCED_EVIDENCE_ARGUMENTS_INVALID");
}
if (phase === "batch" && !/^\d{3}$/u.test(batchIndex ?? "")) {
  throw new Error("WORLD_V2_BALANCED_BATCH_INDEX_INVALID");
}
const response = JSON.parse(await readFile(responsePath, "utf8"));
const rows = Array.isArray(response)
  ? response
  : Array.isArray(response?.rows)
    ? response.rows
    : Array.isArray(response?.result)
      ? response.result
      : null;
if (!rows || rows.length !== 1)
  throw new Error("WORLD_V2_BALANCED_RESPONSE_INVALID");
const evidence = rows[0]?.evidence;
if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
  throw new Error("WORLD_V2_BALANCED_EVIDENCE_MISSING");
}
if (phase === "schema") {
  if (
    evidence.phase !== "SCHEMA" ||
    evidence.migration_id !== "0019_world_v2_balanced_candidate_status" ||
    evidence.artifact_sha256 !==
      "82f7471ddc42cf0a7c0e884cf806f3e20f8424e0f848667cd633a1f7b0f03ccb" ||
    evidence.source_repo_commit !==
      "a0843ef3a5d4ad5ae6c7ea0893775b482b5d3b50" ||
    Number(evidence.release_order) !== 19
  )
    throw new Error("WORLD_V2_BALANCED_SCHEMA_EVIDENCE_MISMATCH");
} else if (phase === "batch") {
  if (
    evidence.phase !== "BATCH" ||
    evidence.bundle_id !== "BALANCED_2026_09_28_V1" ||
    Number(evidence.batch_index) !== Number(batchIndex) ||
    !["BUNDLE", "ARTIFACT", "PROFILE"].includes(evidence.kind) ||
    !Number.isInteger(Number(evidence.batch_rows)) ||
    Number(evidence.batch_rows) < 0
  )
    throw new Error("WORLD_V2_BALANCED_BATCH_EVIDENCE_MISMATCH");
} else if (
  evidence.phase !== "IMPORT" ||
  evidence.bundle_id !== "BALANCED_2026_09_28_V1" ||
  evidence.source_thread_id !== "01a0e1b0-603c-7e13-81de-2cddb9c5d4c1" ||
  evidence.manifest_sha256 !==
    "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315" ||
  evidence.source_status !== "IMPLEMENTED_UNVERIFIED_CANDIDATE" ||
  evidence.activation_allowed !== false ||
  Number(evidence.source_artifact_count) !== 87 ||
  Number(evidence.storage_row_count) !== 278 ||
  Number(evidence.country_count) !== 70 ||
  Number(evidence.world_head_count) !== 0 ||
  Number(evidence.opening_seed_count) !== 0
)
  throw new Error("WORLD_V2_BALANCED_IMPORT_EVIDENCE_MISMATCH");

await writeFile(
  outputPath,
  JSON.stringify(
    {
      status: "VERIFIED",
      authority: "INACTIVE_CANDIDATE_ONLY",
      ...evidence,
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(`WORLD_V2_BALANCED_${phase.toUpperCase()}_VERIFIED\n`);
