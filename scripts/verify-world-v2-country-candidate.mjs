import { readFile, writeFile } from 'node:fs/promises';

const [phase, responsePath, outputPath, batchIndex] = process.argv.slice(2);
if (!['schema', 'batch', 'import'].includes(phase) || !responsePath || !outputPath) {
  throw new Error('WORLD_V2_COUNTRY_EVIDENCE_ARGUMENTS_INVALID');
}
if (phase === 'batch' && !/^\d{3}$/u.test(batchIndex ?? '')) {
  throw new Error('WORLD_V2_COUNTRY_BATCH_INDEX_INVALID');
}

const response = JSON.parse(await readFile(responsePath, 'utf8'));
const rows = Array.isArray(response)
  ? response
  : Array.isArray(response?.rows)
    ? response.rows
    : Array.isArray(response?.result)
      ? response.result
      : null;
if (!rows || rows.length !== 1) {
  throw new Error('WORLD_V2_COUNTRY_EVIDENCE_RESPONSE_INVALID');
}
const evidence = rows[0]?.evidence;
if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
  throw new Error('WORLD_V2_COUNTRY_EVIDENCE_MISSING');
}

if (phase === 'schema') {
  if (
    evidence.phase !== 'SCHEMA' ||
    evidence.migration_id !== '0018_world_v2_country_candidate_intake' ||
    evidence.artifact_sha256 !== '77c08b7adee042b26e2ef4938613b19a9ab7cf35f39f0f0085694556314c3643' ||
    evidence.source_repo_commit !== '129aa1d9b5df139a3b4bf4f4ff9bb2e5a82835c8' ||
    Number(evidence.release_order) !== 18 ||
    Number(evidence.candidate_table_count) !== 3
  ) {
    throw new Error('WORLD_V2_COUNTRY_SCHEMA_EVIDENCE_MISMATCH');
  }
} else if (phase === 'batch') {
  if (
    evidence.phase !== 'BATCH' ||
    evidence.bundle_id !== 'MAP_LOCKED_2026_09_28' ||
    Number(evidence.batch_index) !== Number(batchIndex) ||
    !['BUNDLE', 'ARTIFACT', 'PROFILE'].includes(evidence.kind) ||
    !Number.isInteger(Number(evidence.batch_rows)) ||
    Number(evidence.batch_rows) < 0
  ) {
    throw new Error('WORLD_V2_COUNTRY_BATCH_EVIDENCE_MISMATCH');
  }
} else if (
  evidence.phase !== 'IMPORT' ||
  evidence.bundle_id !== 'MAP_LOCKED_2026_09_28' ||
  evidence.source_thread_id !== '01a0e1b0-603c-7e13-81de-2cddb9c5d4c1' ||
  evidence.manifest_sha256 !== 'ea8567accc519baf05a5c48dc74f2102e16e11c88a9b4ba2e2e5b5a14c7ea1a2' ||
  evidence.activation_allowed !== false ||
  Number(evidence.source_artifact_count) !== 23 ||
  Number(evidence.storage_row_count) !== 36 ||
  Number(evidence.country_count) !== 70
) {
  throw new Error('WORLD_V2_COUNTRY_IMPORT_EVIDENCE_MISMATCH');
}

await writeFile(outputPath, JSON.stringify({
  status: 'VERIFIED',
  authority: 'INACTIVE_CANDIDATE_ONLY',
  ...evidence,
}, null, 2) + '\n');
process.stdout.write(`WORLD_V2_COUNTRY_${phase.toUpperCase()}_VERIFIED\n`);
