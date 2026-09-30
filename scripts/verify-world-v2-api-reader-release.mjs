import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_ID = "0020_world_v2_official_country_reader";
const MIGRATION_SHA256 =
  "083e06aca86763e4bc32a34347c1a86b26aa910f3c6a191b9393021347211618";
const MIGRATION_SOURCE_COMMIT = "f3413bae195b75e80d28d6afa314ca0e394bdfbc";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function rows(response) {
  const value = Array.isArray(response)
    ? response
    : Array.isArray(response?.rows)
      ? response.rows
      : Array.isArray(response?.result)
        ? response.result
        : null;
  if (!value || value.length !== 1)
    fail("WORLD_V2_API_READER_RESPONSE_INVALID");
  return value;
}

function leastPrivilegeRole(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.can_login === false &&
    value.can_bypass_rls === false &&
    value.is_superuser === false &&
    value.inherits_privileges === false
  );
}

const [responsePath, outputPath] = process.argv.slice(2);
if (!responsePath || !outputPath || process.argv.length !== 4) {
  fail("WORLD_V2_API_READER_ARGUMENTS_INVALID");
}

const response = JSON.parse(await readFile(path.resolve(responsePath), "utf8"));
const evidence = rows(response)[0]?.evidence;
if (
  evidence === null ||
  typeof evidence !== "object" ||
  Array.isArray(evidence) ||
  evidence.phase !== "SCHEMA" ||
  evidence.migration_id !== MIGRATION_ID ||
  evidence.artifact_sha256 !== MIGRATION_SHA256 ||
  evidence.source_repo_commit !== MIGRATION_SOURCE_COMMIT ||
  Number(evidence.release_order) !== 20 ||
  !leastPrivilegeRole(evidence.reader_role) ||
  !leastPrivilegeRole(evidence.login_role) ||
  evidence.login_may_set_reader_role !== true ||
  Number(evidence.selected_source_policy_count) !== 2
) {
  fail("WORLD_V2_API_READER_EVIDENCE_MISMATCH");
}

await writeFile(
  path.resolve(outputPath),
  `${JSON.stringify(
    {
      status: "WORLD_V2_API_READER_RELEASE_VERIFIED",
      authority: "SERVER_ONLY_INACTIVE_CANDIDATE_READ",
      ...evidence,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
process.stdout.write("WORLD_V2_API_READER_RELEASE_VERIFIED\n");
