import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_ID = "0020_world_v2_official_country_reader";
const MIGRATION_SHA256 =
  "083e06aca86763e4bc32a34347c1a86b26aa910f3c6a191b9393021347211618";
const MIGRATION_SOURCE_COMMIT = "f3413bae195b75e80d28d6afa314ca0e394bdfbc";
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

const expectedPolicies = [
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
  if (!value || value.length !== 1) {
    fail("WORLD_V2_API_READER_AUDIT_RESPONSE_INVALID");
  }
  return value;
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

function exactPolicies(value) {
  if (!Array.isArray(value)) return false;
  const normalized = value.map((policy) => {
    if (!isPlainObject(policy)) return null;
    return { ...policy, qual: normalizedPolicyQual(policy.qual) };
  });
  return exactJson(normalized, expectedPolicies);
}

const [responsePath, outputPath] = process.argv.slice(2);
if (!responsePath || !outputPath || process.argv.length !== 4) {
  fail("WORLD_V2_API_READER_AUDIT_ARGUMENTS_INVALID");
}

const response = JSON.parse(await readFile(path.resolve(responsePath), "utf8"));
const evidence = rows(response)[0]?.evidence;
if (
  !isPlainObject(evidence) ||
  evidence.phase !== "READBACK_AUDIT" ||
  evidence.migration_id !== MIGRATION_ID ||
  evidence.artifact_sha256 !== MIGRATION_SHA256 ||
  evidence.source_repo_commit !== MIGRATION_SOURCE_COMMIT ||
  Number(evidence.release_order) !== 20 ||
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
  !exactJson(evidence.control_plane_role, {
    name: "postgres",
    can_login: true,
    can_bypass_rls: true,
    is_superuser: false,
    can_create_role: true,
    inherits_privileges: true,
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
  !exactPolicies(evidence.candidate_table_policies)
) {
  fail("WORLD_V2_API_READER_AUDIT_EVIDENCE_MISMATCH");
}

await writeFile(
  path.resolve(outputPath),
  JSON.stringify(
    {
      status: "WORLD_V2_API_READER_READBACK_AUDIT_VERIFIED",
      authority: "SERVER_ONLY_INACTIVE_CANDIDATE_READ",
      ...evidence,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
process.stdout.write("WORLD_V2_API_READER_READBACK_AUDIT_VERIFIED\n");
