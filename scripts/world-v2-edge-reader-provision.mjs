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

// Effective grants include PUBLIC and apply both before and after SET ROLE.
// This reads catalogs only; it never reads user data or routine bodies.
// MAINTAIN was added in PostgreSQL 17; never pass it to older servers.
const TABLE_ACTIONS_SQL = `array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
  || case when current_setting('server_version_num')::integer >= 170000
     then array['MAINTAIN']::text[] else array[]::text[] end`;
export const EFFECTIVE_ACCESS_SQL = `with audited_roles(role_name) as (
  values ('${LOGIN_ROLE}'), ('${READER_ROLE}')
), user_schemas as (
  select oid, nspname from pg_namespace
  where nspname <> 'information_schema' and nspname !~ '^pg_'
), access as (
  select audited.role_name, 'schema_usage'::text as kind,
    namespace.nspname as schema_name, namespace.nspname as object_name,
    null::text as column_name, 'USAGE'::text as privilege,
    null::boolean as security_definer
  from audited_roles audited cross join user_schemas namespace
  where has_schema_privilege(audited.role_name, namespace.oid, 'USAGE')
  union all
  select audited.role_name, 'schema_create'::text as kind,
    namespace.nspname as schema_name, namespace.nspname as object_name,
    null::text as column_name, 'CREATE'::text as privilege,
    null::boolean as security_definer
  from audited_roles audited cross join user_schemas namespace
  where has_schema_privilege(audited.role_name, namespace.oid, 'CREATE')
  union all
  select audited.role_name, 'table', namespace.nspname, relation.relname,
    null, action.name, null
  from audited_roles audited cross join user_schemas namespace
  join pg_class relation on relation.relnamespace = namespace.oid
  cross join unnest(${TABLE_ACTIONS_SQL}) action(name)
  where relation.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_schema_privilege(audited.role_name, namespace.oid, 'USAGE')
    and has_table_privilege(audited.role_name, relation.oid, action.name)
  union all
  select audited.role_name, 'column', namespace.nspname, relation.relname,
    attribute.attname, action.name, null
  from audited_roles audited cross join user_schemas namespace
  join pg_class relation on relation.relnamespace = namespace.oid
  join pg_attribute attribute on attribute.attrelid = relation.oid
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) action(name)
  where relation.relkind in ('r', 'p', 'v', 'm', 'f')
    and attribute.attnum > 0 and not attribute.attisdropped
    and has_schema_privilege(audited.role_name, namespace.oid, 'USAGE')
    and has_column_privilege(audited.role_name, relation.oid, attribute.attnum, action.name)
    and not has_table_privilege(audited.role_name, relation.oid, action.name)
  union all
  select audited.role_name, 'sequence', namespace.nspname, relation.relname,
    null, action.name, null
  from audited_roles audited cross join user_schemas namespace
  join pg_class relation on relation.relnamespace = namespace.oid
  cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) action(name)
  where relation.relkind = 'S'
    and has_schema_privilege(audited.role_name, namespace.oid, 'USAGE')
    and has_sequence_privilege(audited.role_name, relation.oid, action.name)
  union all
  select audited.role_name, 'routine', namespace.nspname,
    routine.proname || '(' || pg_get_function_identity_arguments(routine.oid) || ')',
    null, 'EXECUTE', routine.prosecdef
  from audited_roles audited cross join user_schemas namespace
  join pg_proc routine on routine.pronamespace = namespace.oid
  where has_schema_privilege(audited.role_name, namespace.oid, 'USAGE')
    and has_function_privilege(audited.role_name, routine.oid, 'EXECUTE')
)
select coalesce(jsonb_agg(jsonb_build_object(
  'role', role_name, 'kind', kind, 'schema', schema_name,
  'object', object_name, 'column', column_name, 'privilege', privilege,
  'security_definer', security_definer
) order by role_name, kind, schema_name, object_name, column_name, privilege),
  '[]'::jsonb) from access`;

const READER_COLUMNS = [
  ["country_candidate_artifact", "artifact_path"],
  ["country_candidate_artifact", "bundle_id"],
  ["country_candidate_artifact", "content_sha256"],
  ["country_candidate_artifact", "content_utf8"],
  ["country_candidate_bundle", "activation_allowed"],
  ["country_candidate_bundle", "bundle_id"],
  ["country_candidate_bundle", "package_manifest_sha256"],
  ["country_candidate_bundle", "source_status"],
];
export const EXPECTED_EFFECTIVE_ACCESS = [
  ...READER_COLUMNS.map(([object, column]) => ({
    role: READER_ROLE,
    kind: "column",
    schema: "world_v2",
    object,
    column,
    privilege: "SELECT",
    security_definer: null,
  })),
  ...[
    [LOGIN_ROLE, "public"],
    [READER_ROLE, "public"],
    [READER_ROLE, "world_v2"],
  ].map(([role, schema]) => ({
    role,
    kind: "schema_usage",
    schema,
    object: schema,
    column: null,
    privilege: "USAGE",
    security_definer: null,
  })),
].sort((left, right) =>
  [
    left.role,
    left.kind,
    left.schema,
    left.object,
    left.column ?? "",
    left.privilege,
  ]
    .join("\0")
    .localeCompare(
      [
        right.role,
        right.kind,
        right.schema,
        right.object,
        right.column ?? "",
        right.privilege,
      ].join("\0"),
      "en",
    ),
);

export const CATALOG_SQL = `with audited_roles(role_name) as (
  values ('${LOGIN_ROLE}'), ('${READER_ROLE}')
), namespaces as (
  select oid, nspname, nspacl, nspowner from pg_namespace
  where nspname <> 'information_schema' and nspname !~ '^pg_'
), relations as (
  select relation.* from pg_class relation join namespaces on namespaces.oid = relation.relnamespace
  where relation.relkind in ('r','p','v','m','f','S')
), routines as (
  select routine.* from pg_proc routine join namespaces on namespaces.oid = routine.pronamespace
)
select jsonb_build_object(
  'coverage', jsonb_build_object('roles', 2,
    'schemas', (select count(*) from namespaces),
    'relations', (select count(*) from relations),
    'routines', (select count(*) from routines)),
  'schemas', (select coalesce(jsonb_agg(jsonb_build_object(
    'role', role_name, 'oid', namespace.oid, 'schema', nspname,
    'usage', has_schema_privilege(role_name, namespace.oid, 'USAGE'),
    'create', has_schema_privilege(role_name, namespace.oid, 'CREATE'),
    'acl', (select jsonb_agg(jsonb_build_object('grantee', case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
      'grantor', pg_get_userbyid(acl.grantor), 'privilege', acl.privilege_type, 'grantable', acl.is_grantable))
      from aclexplode(coalesce(nspacl, acldefault('n', nspowner))) acl)
  ) order by role_name, nspname), '[]'::jsonb) from audited_roles cross join namespaces namespace),
  'relations', (select coalesce(jsonb_agg(jsonb_build_object(
    'role', role_name, 'oid', relation.oid, 'schema', namespace.nspname,
    'name', relation.relname, 'kind', relation.relkind,
    'schema_usage', has_schema_privilege(role_name, namespace.oid, 'USAGE'),
    'table', case when relation.relkind='S' then null else
      (select jsonb_object_agg(action, has_table_privilege(role_name, relation.oid, action))
       from unnest(${TABLE_ACTIONS_SQL}) action) end,
    'any_column', case when relation.relkind='S' then null else
      (select jsonb_object_agg(action, has_any_column_privilege(role_name, relation.oid, action))
       from unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) action) end,
    'sequence', case when relation.relkind<>'S' then null else
      (select jsonb_object_agg(action, has_sequence_privilege(role_name, relation.oid, action))
       from unnest(array['USAGE','SELECT','UPDATE']) action) end,
    'column_acl', (select coalesce(jsonb_agg(jsonb_build_object('column', attribute.attname,
      'grantee', case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
      'grantor', pg_get_userbyid(acl.grantor), 'privilege', acl.privilege_type, 'grantable', acl.is_grantable)
      order by attribute.attnum, acl.grantee, acl.privilege_type), '[]'::jsonb)
      from pg_attribute attribute cross join lateral aclexplode(attribute.attacl) acl
      where attribute.attrelid=relation.oid and attribute.attnum>0 and not attribute.attisdropped),
    'acl', (select jsonb_agg(jsonb_build_object('grantee', case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
      'grantor', pg_get_userbyid(acl.grantor), 'privilege', acl.privilege_type, 'grantable', acl.is_grantable))
      from aclexplode(coalesce(relacl, acldefault(case when relation.relkind='S' then 's'::"char" else 'r'::"char" end, relowner))) acl)
  ) order by role_name, namespace.nspname, relation.relname), '[]'::jsonb)
    from audited_roles cross join relations relation join namespaces namespace on namespace.oid=relation.relnamespace),
  'routines', (select coalesce(jsonb_agg(jsonb_build_object(
    'role', role_name, 'oid', routine.oid, 'schema', namespace.nspname,
    'signature', routine.proname || '(' || pg_get_function_identity_arguments(routine.oid) || ')',
    'kind', routine.prokind, 'owner', pg_get_userbyid(routine.proowner),
    'security_definer', routine.prosecdef, 'volatility', routine.provolatile,
    'schema_usage', has_schema_privilege(role_name, namespace.oid, 'USAGE'),
    'execute', has_function_privilege(role_name, routine.oid, 'EXECUTE'),
    'acl', (select jsonb_agg(jsonb_build_object('grantee', case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
      'grantor', pg_get_userbyid(acl.grantor), 'privilege', acl.privilege_type, 'grantable', acl.is_grantable))
      from aclexplode(coalesce(proacl, acldefault('f', proowner))) acl)
  ) order by role_name, namespace.nspname, routine.oid), '[]'::jsonb)
    from audited_roles cross join routines routine join namespaces namespace on namespace.oid=routine.pronamespace)
)`;

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
  'effective_access', (${EFFECTIVE_ACCESS_SQL}),
  'set_role_closure', (select jsonb_object_agg(role_name, targets) from (
    select audited.role_name, (select jsonb_agg(target.rolname order by target.rolname)
      from pg_roles target where pg_has_role(audited.role_name, target.oid, 'SET')) targets
    from (values ('${LOGIN_ROLE}'), ('${READER_ROLE}')) audited(role_name)) closure),
  'catalog', (${CATALOG_SQL}),
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
  const { catalog, ...boundedEvidence } = evidence;
  if (
    !catalog ||
    catalog.schemas?.length !== catalog.coverage?.schemas * 2 ||
    catalog.relations?.length !== catalog.coverage?.relations * 2 ||
    catalog.routines?.length !== catalog.coverage?.routines * 2 ||
    catalog.coverage?.roles !== 2
  )
    fail("WORLD_V2_EDGE_CATALOG_COVERAGE_INVALID");
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
    effective_access: EXPECTED_EFFECTIVE_ACCESS,
    set_role_closure: {
      [LOGIN_ROLE]: [LOGIN_ROLE, READER_ROLE],
      [READER_ROLE]: [READER_ROLE],
    },
    login_memberships: [
      {
        role: READER_ROLE,
        admin_option: false,
        inherit_option: false,
        set_option: true,
      },
    ],
  };
  if (!exact(boundedEvidence, expected))
    fail("WORLD_V2_EDGE_ROLE_EVIDENCE_MISMATCH");
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
         and membership.set_option) or
     (${EFFECTIVE_ACCESS_SQL}) <> '${JSON.stringify(EXPECTED_EFFECTIVE_ACCESS)}'::jsonb or
     exists (select 1 from pg_roles target
       where (pg_has_role('${LOGIN_ROLE}', target.oid, 'SET')
              and target.rolname not in ('${LOGIN_ROLE}', '${READER_ROLE}'))
          or (pg_has_role('${READER_ROLE}', target.oid, 'SET')
              and target.rolname <> '${READER_ROLE}')) then
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
  } else if (command === "record-readiness" && args.length === 2) {
    const evidence = responseEvidence(
      JSON.parse(await readFile(args[0], "utf8")),
    );
    let status = "WORLD_V2_EDGE_EFFECTIVE_ACCESS_VERIFIED";
    try {
      verifyEvidence(evidence, false);
    } catch {
      status = "WORLD_V2_EDGE_EFFECTIVE_ACCESS_BLOCKED";
    }
    await writeFile(
      args[1],
      JSON.stringify({ status, evidence }, null, 2) + "\n",
      { flag: "wx" },
    );
  } else if (command === "record-control-plane" && args.length === 4) {
    const [poolerPath, functionsPath, secretsPath, outputPath] = args;
    const config = JSON.parse(await readFile(poolerPath, "utf8"));
    let host = null;
    try {
      host = poolerHost(config);
    } catch {
      /* preserve sanitized evidence below */
    }
    const poolers = Array.isArray(config)
      ? config.map((item) => {
          let url;
          try {
            url = new URL(item.connection_string ?? item.connectionString);
          } catch {
            /* unknown shape */
          }
          return {
            pool_mode: item.pool_mode,
            database_type: item.database_type,
            hostname: url?.hostname ?? null,
            port: url?.port ?? null,
            username: url?.username ?? null,
            database: url?.pathname ?? null,
          };
        })
      : [];
    const functions = JSON.parse(await readFile(functionsPath, "utf8")).map(
      (item) => ({
        id: item.id,
        slug: item.slug,
        version: item.version,
        status: item.status,
        verify_jwt: item.verify_jwt,
        ezbr_sha256: item.ezbr_sha256,
        updated_at: item.updated_at,
      }),
    );
    const secretNames = JSON.parse(await readFile(secretsPath, "utf8"))
      .map((item) => item.name)
      .sort();
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          project_ref: PROJECT_REF,
          host,
          poolers,
          functions,
          secret_names: secretNames,
          secret_visibility: "PROJECT_WIDE",
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
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
