import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);

export const WORLD_V2_RELEASE_PROJECT_REF = "vimksjrhaxdpnkvgsavz";
export const WORLD_V2_RELEASE_SOURCE_COMMIT =
  "02f59be5026cdf2131eaf6e7fd907d5b87e987b3";
const WORLD_V2_SOURCE_REMOTE =
  "https://github.com/samuelq800/econmind-os-world-simulation.git";
const WORLD_V2_RELEASE_OWNER = "main-site-release-chain";
const WORLD_V2_RELEASE_VERSION = "WORLD_V2_MAIN_SITE_RELEASE_HANDOFF-1";
const WORLD_V2_EXPECTED_MIGRATION_COUNT = 17;
const WORLD_V2_EXPECTED_TABLE_COUNT = 21;

export class WorldV2ReleaseRendererError extends Error {
  constructor(code) {
    super(code);
    this.name = "WorldV2ReleaseRendererError";
    this.code = code;
  }
}

function fail(code) {
  throw new WorldV2ReleaseRendererError(code);
}

function sqlLiteral(value) {
  if (typeof value !== "string") fail("WORLD_V2_RELEASE_SQL_LITERAL_INVALID");
  return `'${value.replaceAll("'", "''")}'`;
}

function requireSqlArtifact(sql) {
  if (typeof sql !== "string" || sql.trim() === "") {
    fail("WORLD_V2_RELEASE_ARTIFACT_SQL_INVALID");
  }
  return sql.endsWith("\n") ? sql : `${sql}\n`;
}

async function git(repositoryRoot, args) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    fail("WORLD_V2_RELEASE_SOURCE_GIT_CHECK_FAILED");
  }
}

async function loadReviewedHandoff(sourceRoot) {
  if (!sourceRoot) fail("WORLD_V2_RELEASE_SOURCE_ROOT_MISSING");
  const repositoryRoot = path.resolve(sourceRoot);
  if (
    (await git(repositoryRoot, ["rev-parse", "HEAD"])) !==
    WORLD_V2_RELEASE_SOURCE_COMMIT
  ) {
    fail("WORLD_V2_RELEASE_SOURCE_COMMIT_MISMATCH");
  }
  if (
    (await git(repositoryRoot, ["remote", "get-url", "origin"])) !==
    WORLD_V2_SOURCE_REMOTE
  ) {
    fail("WORLD_V2_RELEASE_SOURCE_REMOTE_MISMATCH");
  }
  if (
    (await git(repositoryRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ])) !== ""
  ) {
    fail("WORLD_V2_RELEASE_SOURCE_NOT_CLEAN");
  }

  const handoffModulePath = path.join(
    repositoryRoot,
    "scripts/world-v2-release-handoff.mjs",
  );
  let handoffModule;
  try {
    handoffModule = await import(pathToFileURL(handoffModulePath).href);
  } catch {
    fail("WORLD_V2_RELEASE_HANDOFF_MODULE_UNAVAILABLE");
  }
  if (typeof handoffModule.loadWorldV2ReleaseHandoff !== "function") {
    fail("WORLD_V2_RELEASE_HANDOFF_LOADER_UNAVAILABLE");
  }
  const handoff = await handoffModule.loadWorldV2ReleaseHandoff(repositoryRoot);
  if (
    handoff?.version !== WORLD_V2_RELEASE_VERSION ||
    handoff?.namespace !== "world_v2" ||
    handoff?.productionPublisher !== WORLD_V2_RELEASE_OWNER ||
    handoff?.expectedTableCount !== WORLD_V2_EXPECTED_TABLE_COUNT ||
    !Object.isFrozen(handoff) ||
    !Array.isArray(handoff?.migrations) ||
    handoff.migrations.length !== WORLD_V2_EXPECTED_MIGRATION_COUNT ||
    !Object.isFrozen(handoff.migrations) ||
    handoff.migrations.some(
      (migration, index) =>
        !Object.isFrozen(migration) ||
        migration.release_order !== index + 1 ||
        typeof migration.migration_id !== "string" ||
        typeof migration.artifact_sha256 !== "string" ||
        typeof migration.source_repo_commit !== "string",
    )
  ) {
    fail("WORLD_V2_RELEASE_HANDOFF_INVALID");
  }
  return handoff;
}

const protectedCatalogSnapshot = `
  with protected_namespaces as (
    select oid, nspname, nspowner, nspacl
    from pg_namespace where nspname in ('public', 'auth', 'storage')
  ), objects as (
    select 'namespace' as kind, nspname as identity, to_jsonb(n)::text as definition
    from protected_namespaces n
    union all
    select 'relation', n.nspname || '.' || c.relname,
      jsonb_build_object('kind', c.relkind, 'owner', c.relowner,
        'acl', c.relacl, 'rls', c.relrowsecurity,
        'forceRls', c.relforcerowsecurity, 'options', c.reloptions)::text
    from pg_class c join protected_namespaces n on n.oid = c.relnamespace
    union all
    select 'column', n.nspname || '.' || c.relname || '.' || a.attname,
      jsonb_build_object('type', format_type(a.atttypid, a.atttypmod),
        'number', a.attnum, 'notNull', a.attnotnull, 'acl', a.attacl,
        'identity', a.attidentity, 'generated', a.attgenerated,
        'default', pg_get_expr(d.adbin, d.adrelid))::text
    from pg_attribute a join pg_class c on c.oid = a.attrelid
    join protected_namespaces n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attnum > 0 and not a.attisdropped
    union all
    select 'constraint', n.nspname || '.' || c.conrelid::text || '.' || c.conname,
      pg_get_constraintdef(c.oid)
    from pg_constraint c join protected_namespaces n on n.oid = c.connamespace
    union all
    select 'function', n.nspname || '.' || p.oid::text,
      jsonb_build_object('body', pg_get_functiondef(p.oid),
        'owner', p.proowner, 'acl', p.proacl)::text
    from pg_proc p join protected_namespaces n on n.oid = p.pronamespace
    where p.prokind in ('f', 'p')
    union all
    select 'trigger', n.nspname || '.' || t.tgrelid::text || '.' || t.tgname,
      jsonb_build_object('body', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled)::text
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join protected_namespaces n on n.oid = c.relnamespace
    union all
    select 'policy', n.nspname || '.' || p.polrelid::text || '.' || p.polname,
      to_jsonb(p)::text
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join protected_namespaces n on n.oid = c.relnamespace
    union all
    select 'index', n.nspname || '.' || i.indexrelid::text, pg_get_indexdef(i.indexrelid)
    from pg_index i join pg_class c on c.oid = i.indrelid
    join protected_namespaces n on n.oid = c.relnamespace
  )
  select count(*)::bigint as object_count,
    md5(coalesce(string_agg(kind || ':' || identity || ':' || definition, E'\\n'
      order by kind, identity, definition), '')) as fingerprint
  from objects`;

const protectedCatalogSnapshotInto = protectedCatalogSnapshot.replace(
  "  from objects",
  "  into after_object_count, after_fingerprint\n  from objects",
);

function releaseRows(handoff) {
  return handoff.migrations.map((migration) => ({
    artifact_sha256: migration.artifact_sha256,
    migration_id: migration.migration_id,
    release_order: migration.release_order,
    source_repo_commit: migration.source_repo_commit,
  }));
}

function renderLedgerVerification(rows) {
  const values = rows
    .map(
      (row) =>
        `(${sqlLiteral(row.migration_id)}, ${sqlLiteral(row.artifact_sha256)}, ${sqlLiteral(row.source_repo_commit)}, ${row.release_order})`,
    )
    .join(",\n        ");
  return `
  do $world_v2_release_ledger$
  begin
    if (select count(*) from world_v2.schema_release) <> ${WORLD_V2_EXPECTED_MIGRATION_COUNT} then
      raise exception 'WORLD_V2_SCHEMA_RELEASE_LEDGER_MISMATCH';
    end if;
    if exists (
      select 1
      from (values
        ${values}
      ) as expected(migration_id, artifact_sha256, source_repo_commit, release_order)
      full join world_v2.schema_release as actual
        using (migration_id)
      where actual.migration_id is distinct from expected.migration_id
         or actual.artifact_sha256 is distinct from expected.artifact_sha256
         or actual.source_repo_commit is distinct from expected.source_repo_commit
         or actual.release_order is distinct from expected.release_order
    ) then
      raise exception 'WORLD_V2_SCHEMA_RELEASE_LEDGER_MISMATCH';
    end if;
    if (
      select count(*)
      from information_schema.tables
      where table_schema = 'world_v2' and table_type = 'BASE TABLE'
    ) <> ${WORLD_V2_EXPECTED_TABLE_COUNT} then
      raise exception 'WORLD_V2_SCHEMA_TABLE_COUNT_MISMATCH';
    end if;
  end
  $world_v2_release_ledger$;`;
}

function renderAtomicQuery(handoff) {
  const rows = releaseRows(handoff);
  const artifactSql = handoff.migrations
    .map((migration) => {
      const insert = `insert into world_v2.schema_release
  (migration_id, artifact_sha256, source_repo_commit, release_order)
values (${sqlLiteral(migration.migration_id)}, ${sqlLiteral(migration.artifact_sha256)}, ${sqlLiteral(migration.source_repo_commit)}, ${migration.release_order});`;
      return `-- ${migration.release_order}: ${migration.migration_id}\n${requireSqlArtifact(migration.sql)}${insert}`;
    })
    .join("\n\n");
  const responseLedger = `coalesce((
    select jsonb_agg(jsonb_build_object(
      'migration_id', migration_id,
      'artifact_sha256', artifact_sha256,
      'source_repo_commit', source_repo_commit,
      'release_order', release_order
    ) order by release_order)
    from world_v2.schema_release
  ), '[]'::jsonb)`;

  return `begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $world_v2_release_namespace$
begin
  if to_regnamespace('world_v2') is not null then
    raise exception 'WORLD_V2_NAMESPACE_MUST_BE_ABSENT';
  end if;
end
$world_v2_release_namespace$;

create temporary table world_v2_release_scope_guard (
  object_count bigint not null,
  fingerprint text not null
) on commit drop;
insert into world_v2_release_scope_guard (object_count, fingerprint)
${protectedCatalogSnapshot};

${artifactSql}

${renderLedgerVerification(rows)}

do $world_v2_release_scope_guard$
declare
  before_object_count bigint;
  before_fingerprint text;
  after_object_count bigint;
  after_fingerprint text;
begin
  select object_count, fingerprint
    into before_object_count, before_fingerprint
    from world_v2_release_scope_guard;
  ${protectedCatalogSnapshotInto};
  if before_object_count is distinct from after_object_count
     or before_fingerprint is distinct from after_fingerprint then
    raise exception 'WORLD_V2_PROTECTED_CATALOG_CHANGED';
  end if;
end
$world_v2_release_scope_guard$;

commit;

select jsonb_build_object(
  'handoff_source_commit', ${sqlLiteral(WORLD_V2_RELEASE_SOURCE_COMMIT)},
  'migration_count', (select count(*) from world_v2.schema_release),
  'table_count', (
    select count(*)
    from information_schema.tables
    where table_schema = 'world_v2' and table_type = 'BASE TABLE'
  ),
  'schema_release', ${responseLedger}
) as world_v2_release_evidence;
`;
}

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !["--output", "--expectation-output", "--sql-output"].includes(flag) ||
      typeof value !== "string" ||
      result[flag] !== undefined
    ) {
      fail("WORLD_V2_RELEASE_RENDER_ARGUMENTS_INVALID");
    }
    result[flag] = value;
  }
  if (!result["--output"] || !result["--expectation-output"]) {
    fail("WORLD_V2_RELEASE_RENDER_ARGUMENTS_INVALID");
  }
  return result;
}

async function main() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const handoff = await loadReviewedHandoff(
    process.env.WORLD_V2_RELEASE_SOURCE_ROOT,
  );
  const expectation = {
    handoff_source_commit: WORLD_V2_RELEASE_SOURCE_COMMIT,
    migration_count: WORLD_V2_EXPECTED_MIGRATION_COUNT,
    schema_release: releaseRows(handoff),
    table_count: WORLD_V2_EXPECTED_TABLE_COUNT,
  };
  await writeFile(
    path.resolve(argumentsMap["--output"]),
    `${JSON.stringify({ query: renderAtomicQuery(handoff) })}\n`,
    "utf8",
  );
  await writeFile(
    path.resolve(argumentsMap["--expectation-output"]),
    `${JSON.stringify(expectation, null, 2)}\n`,
    "utf8",
  );
  if (argumentsMap["--sql-output"]) {
    await writeFile(
      path.resolve(argumentsMap["--sql-output"]),
      renderAtomicQuery(handoff),
      "utf8",
    );
  }
  process.stdout.write("WORLD_V2_RELEASE_PAYLOAD_READY\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error?.code ?? "WORLD_V2_RELEASE_RENDER_FAILED"}\n`);
    process.exitCode = 1;
  });
}
