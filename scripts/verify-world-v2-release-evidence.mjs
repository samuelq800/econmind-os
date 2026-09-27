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
      fail("WORLD_V2_RELEASE_EVIDENCE_ARGUMENTS_INVALID");
    }
    result[flag] = value;
  }
  if (!result["--expected"] || !result["--response"] || !result["--output"]) {
    fail("WORLD_V2_RELEASE_EVIDENCE_ARGUMENTS_INVALID");
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
  if (!rows || rows.length !== 1) fail("WORLD_V2_RELEASE_EVIDENCE_RESPONSE_INVALID");
  return rows[0];
}

function releaseEvidence(response) {
  const row = responseRow(response);
  const evidence = row?.world_v2_release_evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    fail("WORLD_V2_RELEASE_EVIDENCE_RESPONSE_INVALID");
  }
  return evidence;
}

function sameLedger(actual, expected) {
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
    "WORLD_V2_RELEASE_EXPECTATION_INVALID",
  );
  const response = readJson(
    await readFile(path.resolve(argumentsMap["--response"]), "utf8"),
    "WORLD_V2_RELEASE_RESPONSE_JSON_INVALID",
  );
  const evidence = releaseEvidence(response);
  if (
    evidence.handoff_source_commit !== expected.handoff_source_commit ||
    Number(evidence.migration_count) !== expected.migration_count ||
    Number(evidence.table_count) !== expected.table_count ||
    !sameLedger(evidence.schema_release, expected.schema_release)
  ) {
    fail("WORLD_V2_RELEASE_EVIDENCE_MISMATCH");
  }
  await writeFile(
    path.resolve(argumentsMap["--output"]),
    `${JSON.stringify(
      {
        ...evidence,
        status: "WORLD_V2_RELEASE_EVIDENCE_VERIFIED",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  process.stdout.write("WORLD_V2_RELEASE_EVIDENCE_VERIFIED\n");
}

main().catch((error) => {
  process.stderr.write(`${error?.code ?? "WORLD_V2_RELEASE_EVIDENCE_FAILED"}\n`);
  process.exitCode = 1;
});
