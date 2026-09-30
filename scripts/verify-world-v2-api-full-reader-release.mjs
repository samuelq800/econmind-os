import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  FULL_JSON_ARTIFACT_PATHS,
  FULL_READER_CHUNK_PATTERN,
  MIGRATION_ID,
  MIGRATION_SHA256,
  MIGRATION_SOURCE_COMMIT,
} from "./render-world-v2-api-full-reader-release.mjs";

const BUNDLE_ID = "BALANCED_2026_09_28_V1";
const READER_ROLE = "world_v2_api_reader";
const LOGIN_ROLE = "world_v2_api_login";

const expectedColumnSelectPrivileges = [
  {
    schema: "world_v2",
    table: "country_candidate_artifact",
    column: "bundle_id",
  },
  {
    schema: "world_v2",
    table: "country_candidate_artifact",
    column: "artifact_path",
  },
  {
    schema: "world_v2",
    table: "country_candidate_artifact",
    column: "content_sha256",
  },
  {
    schema: "world_v2",
    table: "country_candidate_artifact",
    column: "content_utf8",
  },
  {
    schema: "world_v2",
    table: "country_candidate_bundle",
    column: "bundle_id",
  },
  {
    schema: "world_v2",
    table: "country_candidate_bundle",
    column: "package_manifest_sha256",
  },
  {
    schema: "world_v2",
    table: "country_candidate_bundle",
    column: "source_status",
  },
  {
    schema: "world_v2",
    table: "country_candidate_bundle",
    column: "activation_allowed",
  },
];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactJson(actual, expected) {
  if (Object.is(actual, expected)) return true;
  if (
    typeof actual !== typeof expected ||
    actual === null ||
    expected === null
  ) {
    return false;
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((value, index) => exactJson(value, expected[index]))
    );
  }
  if (!isPlainObject(actual) || !isPlainObject(expected)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key, index) =>
        key === expectedKeys[index] && exactJson(actual[key], expected[key]),
    )
  );
}

function normalizedPolicyQual(value) {
  if (typeof value !== "string") return null;
  return value
    .replaceAll("::text", "")
    .replaceAll(/\s+/g, "")
    .replaceAll(/[()]/g, "");
}

function normalizedFullPolicyQual(value) {
  if (typeof value !== "string") return null;
  const withoutCasts = value.replaceAll("::text", "");
  let normalized = "";
  let insideLiteral = false;
  for (const character of withoutCasts) {
    if (character === "'") {
      insideLiteral = !insideLiteral;
      normalized += character;
    } else if (
      !insideLiteral &&
      (/\s/u.test(character) || character === "(" || character === ")")
    ) {
      continue;
    } else {
      normalized += character;
    }
  }
  return normalized;
}

function fullPolicyQual() {
  const roots = FULL_JSON_ARTIFACT_PATHS.map((path) => `'${path}'`).join(",");
  return `bundle_id='${BUNDLE_ID}'ANDartifact_path=ANYARRAY[${roots}]ORartifact_path~'${FULL_READER_CHUNK_PATTERN}'`;
}

function expectedPolicies(includeFullReaderPolicy) {
  const policies = [
    {
      schema: "world_v2",
      table: "country_candidate_artifact",
      name: "country_candidate_artifact_selected_source_server_read",
      roles: [READER_ROLE],
      command: "SELECT",
      permissive: "PERMISSIVE",
      qual: "bundle_id='BALANCED_2026_09_28_V1'ANDartifact_path='source/646174612f636f756e74726965732e6a736f6e'",
      with_check: null,
    },
    {
      schema: "world_v2",
      table: "country_candidate_bundle",
      name: "country_candidate_bundle_selected_source_server_read",
      roles: [READER_ROLE],
      command: "SELECT",
      permissive: "PERMISSIVE",
      qual: "bundle_id='BALANCED_2026_09_28_V1'",
      with_check: null,
    },
  ];
  if (includeFullReaderPolicy) {
    policies.push({
      schema: "world_v2",
      table: "country_candidate_artifact",
      name: "country_candidate_artifact_selected_full_source_server_read",
      roles: [READER_ROLE],
      command: "SELECT",
      permissive: "PERMISSIVE",
      qual: fullPolicyQual(),
      with_check: null,
    });
  }
  return policies.sort((left, right) => left.name.localeCompare(right.name));
}

function exactPolicies(actual, includeFullReaderPolicy) {
  if (!Array.isArray(actual)) return false;
  return exactJson(
    actual.map((policy) => {
      if (!isPlainObject(policy)) return policy;
      return {
        ...policy,
        qual:
          policy.name ===
          "country_candidate_artifact_selected_full_source_server_read"
            ? normalizedFullPolicyQual(policy.qual)
            : normalizedPolicyQual(policy.qual),
      };
    }),
    expectedPolicies(includeFullReaderPolicy),
  );
}

function responseEvidence(response) {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.rows)
      ? response.rows
      : Array.isArray(response?.result)
        ? response.result
        : null;
  if (!rows || rows.length !== 1 || !isPlainObject(rows[0]?.evidence)) {
    fail("WORLD_V2_FULL_READER_RESPONSE_INVALID");
  }
  return rows[0].evidence;
}

function validateExpectation(expectation) {
  if (
    !isPlainObject(expectation) ||
    expectation.migration_id !== MIGRATION_ID ||
    expectation.migration_sha256 !== MIGRATION_SHA256 ||
    expectation.migration_source_commit !== MIGRATION_SOURCE_COMMIT ||
    !Array.isArray(expectation.before_ledger) ||
    expectation.before_ledger.length !== 20 ||
    !Array.isArray(expectation.after_ledger) ||
    expectation.after_ledger.length !== 21 ||
    !exactJson(
      expectation.after_ledger.slice(0, -1),
      expectation.before_ledger,
    ) ||
    !exactJson(expectation.after_ledger.at(-1), {
      migration_id: MIGRATION_ID,
      artifact_sha256: MIGRATION_SHA256,
      source_repo_commit: MIGRATION_SOURCE_COMMIT,
      release_order: 21,
    }) ||
    !exactJson(expectation.full_json_artifact_paths, FULL_JSON_ARTIFACT_PATHS)
  ) {
    fail("WORLD_V2_FULL_READER_EXPECTATION_INVALID");
  }
}

function validateEvidence(
  evidence,
  { phase, ledger, includeFullReaderPolicy },
) {
  if (
    evidence.phase !== phase ||
    !exactJson(evidence.ledger_entries, ledger) ||
    !exactJson(evidence.reader_role, {
      can_login: false,
      can_bypass_rls: false,
      is_superuser: false,
      inherits_privileges: false,
    }) ||
    !exactJson(evidence.login_role, {
      can_login: false,
      can_bypass_rls: false,
      is_superuser: false,
      inherits_privileges: false,
    }) ||
    !exactJson(evidence.reader_memberships, [
      {
        member: "postgres",
        role: READER_ROLE,
        grantor: "supabase_admin",
        admin_option: true,
        inherit_option: false,
        set_option: false,
      },
      {
        member: LOGIN_ROLE,
        role: READER_ROLE,
        grantor: "postgres",
        admin_option: false,
        inherit_option: false,
        set_option: true,
      },
    ]) ||
    !exactJson(evidence.schema_usage, ["public", "world_v2"]) ||
    !exactJson(
      evidence.column_select_privileges,
      expectedColumnSelectPrivileges,
    ) ||
    !exactJson(evidence.table_privileges, []) ||
    !exactPolicies(
      evidence.candidate_table_policies,
      includeFullReaderPolicy,
    ) ||
    !exactJson(evidence.full_json_artifact_paths, FULL_JSON_ARTIFACT_PATHS)
  ) {
    fail("WORLD_V2_FULL_READER_EVIDENCE_MISMATCH");
  }
}

const args = process.argv.slice(2);
if (args[0] === "--preflight") {
  const [, beforeResponsePath, expectationPath, outputPath] = args;
  if (
    !beforeResponsePath ||
    !expectationPath ||
    !outputPath ||
    args.length !== 4
  ) {
    fail("WORLD_V2_FULL_READER_ARGUMENTS_INVALID");
  }
  const [beforeResponse, expectation] = await Promise.all([
    readFile(path.resolve(beforeResponsePath), "utf8").then(JSON.parse),
    readFile(path.resolve(expectationPath), "utf8").then(JSON.parse),
  ]);
  validateExpectation(expectation);
  const before = responseEvidence(beforeResponse);
  validateEvidence(before, {
    phase: "BEFORE_FULL_READER_RELEASE",
    ledger: expectation.before_ledger,
    includeFullReaderPolicy: false,
  });
  await writeFile(
    path.resolve(outputPath),
    JSON.stringify(
      {
        status: "WORLD_V2_API_FULL_READER_PRECONDITION_VERIFIED",
        authority: "SERVER_ONLY_INACTIVE_CANDIDATE_FULL_DATA_READ",
        migration_id: MIGRATION_ID,
        migration_sha256: MIGRATION_SHA256,
        migration_source_commit: MIGRATION_SOURCE_COMMIT,
        before,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write("WORLD_V2_API_FULL_READER_PRECONDITION_VERIFIED\n");
} else {
  const [beforeResponsePath, afterResponsePath, expectationPath, outputPath] =
    args;
  if (
    !beforeResponsePath ||
    !afterResponsePath ||
    !expectationPath ||
    !outputPath ||
    args.length !== 4
  ) {
    fail("WORLD_V2_FULL_READER_ARGUMENTS_INVALID");
  }
  const [beforeResponse, afterResponse, expectation] = await Promise.all([
    readFile(path.resolve(beforeResponsePath), "utf8").then(JSON.parse),
    readFile(path.resolve(afterResponsePath), "utf8").then(JSON.parse),
    readFile(path.resolve(expectationPath), "utf8").then(JSON.parse),
  ]);
  validateExpectation(expectation);
  const before = responseEvidence(beforeResponse);
  const after = responseEvidence(afterResponse);
  validateEvidence(before, {
    phase: "BEFORE_FULL_READER_RELEASE",
    ledger: expectation.before_ledger,
    includeFullReaderPolicy: false,
  });
  validateEvidence(after, {
    phase: "AFTER_FULL_READER_RELEASE",
    ledger: expectation.after_ledger,
    includeFullReaderPolicy: true,
  });

  await writeFile(
    path.resolve(outputPath),
    JSON.stringify(
      {
        status: "WORLD_V2_API_FULL_READER_RELEASE_VERIFIED",
        authority: "SERVER_ONLY_INACTIVE_CANDIDATE_FULL_DATA_READ",
        migration_id: MIGRATION_ID,
        migration_sha256: MIGRATION_SHA256,
        migration_source_commit: MIGRATION_SOURCE_COMMIT,
        before,
        after,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write("WORLD_V2_API_FULL_READER_RELEASE_VERIFIED\n");
}
