import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !["--expected", "--response", "--output"].includes(flag) ||
      typeof value !== "string" ||
      result[flag] !== undefined
    ) {
      fail("WORLD_V2_RELEASE_RECOVERY_ARGUMENTS_INVALID");
    }
    result[flag] = value;
  }
  if (!result["--expected"] || !result["--response"] || !result["--output"]) {
    fail("WORLD_V2_RELEASE_RECOVERY_ARGUMENTS_INVALID");
  }
  return result;
}

function readJson(text, code) {
  try {
    return JSON.parse(text);
  } catch {
    fail(code);
  }
}

function responseRow(response) {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.rows)
      ? response.rows
      : Array.isArray(response?.result)
        ? response.result
        : null;
  if (!rows || rows.length !== 1) fail("WORLD_V2_RELEASE_RECOVERY_RESPONSE_INVALID");
  return rows[0];
}

function sameRows(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every(
      (row, index) =>
        row?.migration_id === expected[index]?.migration_id &&
        row?.artifact_sha256 === expected[index]?.artifact_sha256 &&
        row?.source_repo_commit === expected[index]?.source_repo_commit &&
        Number(row?.release_order) === expected[index]?.release_order,
    )
  );
}

async function main() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const expected = readJson(
    await readFile(path.resolve(argumentsMap["--expected"]), "utf8"),
    "WORLD_V2_RELEASE_RECOVERY_EXPECTATION_INVALID",
  );
  const response = readJson(
    await readFile(path.resolve(argumentsMap["--response"]), "utf8"),
    "WORLD_V2_RELEASE_RECOVERY_RESPONSE_JSON_INVALID",
  );
  const evidence = responseRow(response)?.world_v2_release_recovery;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    fail("WORLD_V2_RELEASE_RECOVERY_RESPONSE_INVALID");
  }
  const status = evidence.status;
  if (
    !["ABSENT", "EXPECTED_RELEASE_METADATA_MATCH", "CONFLICT"].includes(
      status,
    ) || evidence.handoff_source_commit !== expected.handoff_source_commit
  ) {
    fail("WORLD_V2_RELEASE_RECOVERY_CLASSIFICATION_INVALID");
  }
  if (
    status === "EXPECTED_RELEASE_METADATA_MATCH" &&
    (Number(evidence.migration_count) !== expected.migration_count ||
      Number(evidence.table_count) !== expected.table_count ||
      JSON.stringify(evidence.table_names) !==
        JSON.stringify(expected.expected_table_names) ||
      !sameRows(evidence.schema_release, expected.schema_release))
  ) {
    fail("WORLD_V2_RELEASE_RECOVERY_EXPECTED_MATCH_INVALID");
  }
  await writeFile(
    path.resolve(argumentsMap["--output"]),
    `${JSON.stringify(
      { ...evidence, status: `WORLD_V2_RELEASE_RECOVERY_${status}` },
      null,
      2,
    )}\n`,
    "utf8",
  );
  if (status !== "EXPECTED_RELEASE_METADATA_MATCH") {
    process.stderr.write(`WORLD_V2_RELEASE_RECOVERY_${status}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("WORLD_V2_RELEASE_RECOVERY_EXPECTED_RELEASE_METADATA_MATCH\n");
}

main().catch((error) => {
  process.stderr.write(`${error?.code ?? "WORLD_V2_RELEASE_RECOVERY_FAILED"}\n`);
  process.exitCode = 1;
});
