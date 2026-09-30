import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MIGRATION_ID,
  MIGRATION_SHA256,
  MIGRATION_SOURCE_COMMIT,
} from "./render-world-v2-api-full-reader-release.mjs";

export const PROJECT_REF = "vimksjrhaxdpnkvgsavz";
export const LOGIN_ROLE = "world_v2_api_login";
export const READER_ROLE = "world_v2_api_reader";
export const FUNCTION_SLUG = "world-v2-official-read";

const POOLER_HOST = /^aws-[0-9]+-ap-northeast-1\.pooler\.supabase\.com$/u;
const SECRET_NAMES = Object.freeze([
  "WORLD_DATABASE_URL",
  "WORLD_API_DB_LOGIN_ROLE",
  "WORLD_API_DB_READER_ROLE",
  "WORLD_DATABASE_FINGERPRINT",
  "WORLD_DATABASE_NAMESPACE",
  "WORLD_DATABASE_MUTATION_MODE",
  "WORLD_API_OFFICIAL_PUBLIC_ORIGINS",
]);

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function exact(actual, expected) {
  if (Object.is(actual, expected)) return true;
  if (actual === null || expected === null || typeof actual !== typeof expected)
    return false;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((value, index) => exact(value, expected[index]))
    );
  }
  if (typeof actual !== "object") return false;
  const keys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    exact(keys, expectedKeys) &&
    keys.every((key) => exact(actual[key], expected[key]))
  );
}

function roleSql(name) {
  return `(select jsonb_build_object(
    'can_login', rolcanlogin,
    'can_bypass_rls', rolbypassrls,
    'is_superuser', rolsuper,
    'inherits_privileges', rolinherit,
    'can_create_db', rolcreatedb,
    'can_create_role', rolcreaterole,
    'can_replicate', rolreplication
  ) from pg_roles where rolname = '${name}')`;
}

export const EVIDENCE_SQL = `select jsonb_build_object(
  'migration_count', (select count(*)::int from world_v2.schema_release),
  'migration', (select jsonb_build_object(
    'migration_id', migration_id,
    'artifact_sha256', artifact_sha256,
    'source_repo_commit', source_repo_commit,
    'release_order', release_order
  ) from world_v2.schema_release where migration_id = '${MIGRATION_ID}'),
  'login_role', ${roleSql(LOGIN_ROLE)},
  'reader_role', ${roleSql(READER_ROLE)},
  'login_memberships', coalesce((select jsonb_agg(jsonb_build_object(
    'role', granted.rolname,
    'admin_option', membership.admin_option,
    'inherit_option', membership.inherit_option,
    'set_option', membership.set_option
  ) order by granted.rolname)
    from pg_auth_members membership
    join pg_roles member on member.oid = membership.member
    join pg_roles granted on granted.oid = membership.roleid
    where member.rolname = '${LOGIN_ROLE}'
  ), '[]'::jsonb)
) as evidence;`;

export function request(query) {
  return JSON.stringify({ query });
}

export function responseEvidence(response) {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.rows)
      ? response.rows
      : Array.isArray(response?.result)
        ? response.result
        : null;
  if (
    rows?.length !== 1 ||
    rows[0]?.evidence === null ||
    typeof rows[0]?.evidence !== "object" ||
    Array.isArray(rows[0]?.evidence)
  )
    fail("WORLD_V2_EDGE_ROLE_RESPONSE_INVALID");
  return rows[0].evidence;
}

function expectedRole(canLogin) {
  return {
    can_login: canLogin,
    can_bypass_rls: false,
    is_superuser: false,
    inherits_privileges: false,
    can_create_db: false,
    can_create_role: false,
    can_replicate: false,
  };
}

export function verifyEvidence(evidence, canLogin) {
  const expected = {
    migration_count: 21,
    migration: {
      migration_id: MIGRATION_ID,
      artifact_sha256: MIGRATION_SHA256,
      source_repo_commit: MIGRATION_SOURCE_COMMIT,
      release_order: 21,
    },
    login_role: expectedRole(canLogin),
    reader_role: expectedRole(false),
    login_memberships: [
      {
        role: READER_ROLE,
        admin_option: false,
        inherit_option: false,
        set_option: true,
      },
    ],
  };
  if (!exact(evidence, expected)) fail("WORLD_V2_EDGE_ROLE_EVIDENCE_MISMATCH");
  return true;
}

export function ensureNewSecretNames(secretList) {
  if (
    !Array.isArray(secretList) ||
    !secretList.every((item) => typeof item?.name === "string")
  )
    fail("WORLD_V2_EDGE_SECRET_LIST_INVALID");
  const existing = new Set(secretList.map((item) => item.name));
  if (SECRET_NAMES.some((name) => existing.has(name)))
    fail("WORLD_V2_EDGE_SECRET_NAME_ALREADY_EXISTS");
  return true;
}

export function verifySecretNames(secretList) {
  if (
    !Array.isArray(secretList) ||
    !secretList.every((item) => typeof item?.name === "string")
  )
    fail("WORLD_V2_EDGE_SECRET_LIST_INVALID");
  const existing = new Set(secretList.map((item) => item.name));
  if (SECRET_NAMES.some((name) => !existing.has(name)))
    fail("WORLD_V2_EDGE_SECRET_NAME_MISSING");
  return true;
}

export function ensureNewFunctionSlug(functionList) {
  if (
    !Array.isArray(functionList) ||
    !functionList.every((item) => typeof item?.slug === "string")
  )
    fail("WORLD_V2_EDGE_FUNCTION_LIST_INVALID");
  if (functionList.some((item) => item.slug === FUNCTION_SLUG))
    fail("WORLD_V2_EDGE_FUNCTION_ALREADY_EXISTS");
  return true;
}

export function verifyFunctionSlug(functionList) {
  if (
    !Array.isArray(functionList) ||
    !functionList.every((item) => typeof item?.slug === "string")
  )
    fail("WORLD_V2_EDGE_FUNCTION_LIST_INVALID");
  const matches = functionList.filter((item) => item.slug === FUNCTION_SLUG);
  if (
    matches.length !== 1 ||
    matches[0].status !== "ACTIVE" ||
    matches[0].verify_jwt !== false
  )
    fail("WORLD_V2_EDGE_FUNCTION_NOT_VERIFIED");
  return true;
}

export function poolerHost(config) {
  if (!Array.isArray(config)) fail("WORLD_V2_EDGE_POOLER_CONFIG_INVALID");
  const hosts = config
    .filter((item) => item?.pool_mode === "transaction")
    .map((item) => item.connection_string ?? item.connectionString)
    .filter((value) => typeof value === "string")
    .map((value) => {
      let url;
      try {
        url = new URL(value);
      } catch {
        fail("WORLD_V2_EDGE_POOLER_URL_INVALID");
      }
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        url.port !== "6543" ||
        url.pathname !== "/postgres" ||
        url.username !== `postgres.${PROJECT_REF}` ||
        !POOLER_HOST.test(url.hostname)
      )
        fail("WORLD_V2_EDGE_POOLER_URL_INVALID");
      return url.hostname;
    });
  if (hosts.length !== 1) fail("WORLD_V2_EDGE_TRANSACTION_POOLER_NOT_UNIQUE");
  return hosts[0];
}

function rolePreconditionSql() {
  return `do $world_v2_edge_login_precondition$
begin
  if (select count(*) from world_v2.schema_release) <> 21 or
     not exists (select 1 from world_v2.schema_release
       where migration_id = '${MIGRATION_ID}'
         and artifact_sha256 = '${MIGRATION_SHA256}'
         and source_repo_commit = '${MIGRATION_SOURCE_COMMIT}'
         and release_order = 21) or
     not exists (select 1 from pg_roles where rolname = '${READER_ROLE}'
       and not rolcanlogin and not rolsuper and not rolbypassrls
       and not rolinherit and not rolcreatedb and not rolcreaterole
       and not rolreplication) or
     not exists (select 1 from pg_roles where rolname = '${LOGIN_ROLE}'
       and not rolcanlogin and not rolsuper and not rolbypassrls
       and not rolinherit and not rolcreatedb and not rolcreaterole
       and not rolreplication) or
     (select count(*) from pg_auth_members membership
       join pg_roles member on member.oid = membership.member
       where member.rolname = '${LOGIN_ROLE}') <> 1 or
     not exists (select 1 from pg_auth_members membership
       join pg_roles member on member.oid = membership.member
       join pg_roles granted on granted.oid = membership.roleid
       where member.rolname = '${LOGIN_ROLE}'
         and granted.rolname = '${READER_ROLE}'
         and not membership.admin_option
         and not membership.inherit_option
         and membership.set_option) then
    raise exception 'World V2 Edge login precondition mismatch';
  end if;
end;
$world_v2_edge_login_precondition$;`;
}

export function roleActivationSql(password) {
  if (!/^[0-9a-f]{96}$/u.test(password))
    fail("WORLD_V2_EDGE_PASSWORD_FORMAT_INVALID");
  return `begin;
${rolePreconditionSql()}
alter role ${LOGIN_ROLE} login password '${password}';
commit;
${EVIDENCE_SQL}`;
}

export function credentialFiles(host, password) {
  if (!POOLER_HOST.test(host)) fail("WORLD_V2_EDGE_POOLER_HOST_INVALID");
  const query = roleActivationSql(password);
  const url = new URL(
    `postgresql://${LOGIN_ROLE}.${PROJECT_REF}@${host}:6543/postgres`,
  );
  url.password = password;
  url.searchParams.set("sslmode", "require");
  return {
    request: request(query),
    env:
      [
        `WORLD_DATABASE_URL=${url.toString()}`,
        `WORLD_API_DB_LOGIN_ROLE=${LOGIN_ROLE}`,
        `WORLD_API_DB_READER_ROLE=${READER_ROLE}`,
        "WORLD_DATABASE_FINGERPRINT=world-v2-production",
        "WORLD_DATABASE_NAMESPACE=world_v2",
        "WORLD_DATABASE_MUTATION_MODE=disabled",
        "WORLD_API_OFFICIAL_PUBLIC_ORIGINS=https://samuelq800.github.io",
      ].join("\n") + "\n",
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "render-preflight" && args.length === 1) {
    await writeFile(args[0], request(EVIDENCE_SQL), {
      flag: "wx",
      mode: 0o600,
    });
  } else if (
    (command === "verify-preflight" || command === "verify-after") &&
    args.length === 1
  ) {
    verifyEvidence(
      responseEvidence(JSON.parse(await readFile(args[0], "utf8"))),
      command === "verify-after",
    );
  } else if (command === "verify-secrets-absent" && args.length === 1) {
    ensureNewSecretNames(JSON.parse(await readFile(args[0], "utf8")));
  } else if (command === "verify-secrets-present" && args.length === 1) {
    verifySecretNames(JSON.parse(await readFile(args[0], "utf8")));
  } else if (command === "verify-function-absent" && args.length === 1) {
    ensureNewFunctionSlug(JSON.parse(await readFile(args[0], "utf8")));
  } else if (command === "verify-function-present" && args.length === 1) {
    verifyFunctionSlug(JSON.parse(await readFile(args[0], "utf8")));
  } else if (command === "render-credential" && args.length === 2) {
    const [poolerConfigPath, outputDir] = args;
    const host = poolerHost(
      JSON.parse(await readFile(poolerConfigPath, "utf8")),
    );
    const password = randomBytes(48).toString("hex");
    const files = credentialFiles(host, password);
    await mkdir(outputDir, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(outputDir, "role-apply-request.json"),
      files.request,
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(path.join(outputDir, "edge.env"), files.env, {
      flag: "wx",
      mode: 0o600,
    });
  } else {
    fail("WORLD_V2_EDGE_PROVISION_USAGE_INVALID");
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main().catch((error) => {
    console.error(error?.code ?? "WORLD_V2_EDGE_PROVISION_FAILED");
    process.exitCode = 1;
  });
}
