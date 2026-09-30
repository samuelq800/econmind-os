import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MIGRATION_ID = "0021_world_v2_official_full_data_reader";
export const MIGRATION_PATH =
  "database/migrations/artifacts/0021_world_v2_official_full_data_reader.sql";
export const MIGRATION_SHA256 =
  "e5c75c9f731283571680647d0447fd88924bf8a1476f67fe71b7c663ead1f670";
export const MIGRATION_SOURCE_COMMIT =
  "f2ceea4bce70e8d2a193c641f87af5ce8d2e47e3";

const BUNDLE_ID = "BALANCED_2026_09_28_V1";
const PREVIOUS_MIGRATION_COUNT = 20;
const READER_ROLE = "world_v2_api_reader";
const LOGIN_ROLE = "world_v2_api_login";
const FULL_READER_POLICY =
  "country_candidate_artifact_selected_full_source_server_read";
export const MAX_PART_BYTES = 150_000;
export const FULL_JSON_STORAGE_ROW_COUNT = 142;

const FULL_JSON_SOURCE_FILES = Object.freeze([
  "assumptions.json",
  "changes.json",
  "commodity-catalog.json",
  "countries.json",
  "coverage.json",
  "deposits.json",
  "domestic-access.json",
  "employment.json",
  "entities.json",
  "facilities.json",
  "facility-map-links.json",
  "finance.json",
  "geography.json",
  "hazard-proposals.json",
  "illustration-links.json",
  "land-program.json",
  "license-proposals.json",
  "manifest.json",
  "nodes.json",
  "opening-material-reconciliation.json",
  "population-services.json",
  "power.json",
  "production-plans.json",
  "recipes.json",
  "regions.json",
  "seasonal-water.json",
  "settlements.json",
  "stocks.json",
  "supplier-concentration-policy.json",
  "technology-proposals.json",
  "trade-plans.json",
  "transit-proposals.json",
  "transport-routes.json",
  "water-allocations.json",
]);

export const FULL_JSON_ARTIFACT_PATHS = Object.freeze(
  FULL_JSON_SOURCE_FILES.map(
    (file) => `source/${Buffer.from(`data/${file}`, "utf8").toString("hex")}`,
  ).sort(),
);

export const FULL_READER_CHUNK_PATTERN = `^(${FULL_JSON_ARTIFACT_PATHS.join(
  "|",
)})\\.part[0-9]{4}$`;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function ledgerRows(migrations) {
  return migrations.map((migration) => ({
    migration_id: migration.migration_id,
    artifact_sha256: migration.sha256,
    source_repo_commit: migration.artifact_source_commit,
    release_order: migration.release_order,
  }));
}

function jsonLiteral(value) {
  return sqlLiteral(JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// Mirrors storageArtifacts in the pinned World 0019 import renderer. The
// verified loader supplies the exact UTF-8 source and hashes before splitting.
function splitUtf8(content) {
  const parts = [];
  let current = "";
  let bytes = 0;
  for (const character of content) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > MAX_PART_BYTES && current !== "") {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += character;
    bytes += size;
  }
  if (current !== "") parts.push(current);
  return parts;
}

async function verifiedStorageExpectation(sourceRoot, checksums) {
  const loaderPath = path.join(
    sourceRoot,
    "scripts/balanced-country-candidate-intake.mjs",
  );
  const { loadBalancedCountryCandidate } = await import(
    pathToFileURL(loaderPath).href
  );
  const bundle = await loadBalancedCountryCandidate(sourceRoot);
  if (bundle.candidateId !== BUNDLE_ID || bundle.activationAllowed !== false) {
    fail("WORLD_V2_FULL_READER_FROZEN_BUNDLE_INVALID");
  }
  const bySourcePath = new Map(
    bundle.artifacts.map((artifact) => [artifact.sourcePath, artifact]),
  );
  const sources = [];
  const storageRows = [];
  for (const checksum of checksums) {
    if (
      !checksum.path.startsWith("data/") ||
      !checksum.path.endsWith(".json")
    ) {
      continue;
    }
    const artifact = bySourcePath.get(checksum.path);
    if (
      !artifact ||
      artifact.sha256 !== checksum.sha256 ||
      Buffer.byteLength(artifact.content, "utf8") !== checksum.bytes
    ) {
      fail("WORLD_V2_FULL_READER_SOURCE_CONTENT_INVALID");
    }
    const parts = splitUtf8(artifact.content);
    if (parts.length === 0 || parts.length > 9999) {
      fail("WORLD_V2_FULL_READER_STORAGE_PARTS_INVALID");
    }
    sources.push({
      artifact_path: artifact.path,
      content_sha256: artifact.sha256,
      content_bytes: checksum.bytes,
    });
    for (const [index, content] of parts.entries()) {
      storageRows.push({
        bundle_id: BUNDLE_ID,
        artifact_path:
          parts.length === 1
            ? artifact.path
            : `${artifact.path}.part${String(index + 1).padStart(4, "0")}`,
        content_sha256: sha256(content),
        content_bytes: Buffer.byteLength(content, "utf8"),
      });
    }
  }
  sources.sort((left, right) =>
    left.artifact_path.localeCompare(right.artifact_path),
  );
  storageRows.sort((left, right) =>
    left.artifact_path.localeCompare(right.artifact_path),
  );
  if (
    sources.length !== FULL_JSON_ARTIFACT_PATHS.length ||
    JSON.stringify(sources.map((source) => source.artifact_path)) !==
      JSON.stringify(FULL_JSON_ARTIFACT_PATHS) ||
    new Set(storageRows.map((row) => row.artifact_path)).size !==
      storageRows.length ||
    storageRows.length !== FULL_JSON_STORAGE_ROW_COUNT
  ) {
    fail("WORLD_V2_FULL_READER_STORAGE_SET_INVALID");
  }
  return {
    bundle: {
      bundle_id: BUNDLE_ID,
      source_thread_id: bundle.sourceThread,
      package_manifest_sha256: bundle.manifestSha256,
      source_status: bundle.sourceStatus,
      activation_allowed: false,
    },
    sources,
    storageRows,
  };
}

async function verifiedSource(sourceRoot) {
  const manifest = JSON.parse(
    await readFile(
      path.join(sourceRoot, "database/migrations/manifest.json"),
      "utf8",
    ),
  );
  if (
    !Array.isArray(manifest.migrations) ||
    manifest.migrations.length !== 21
  ) {
    fail("WORLD_V2_FULL_READER_MIGRATION_CHAIN_INVALID");
  }

  const migration = manifest.migrations.at(-1);
  if (
    migration?.migration_id !== MIGRATION_ID ||
    migration.path !== MIGRATION_PATH ||
    migration.sha256 !== MIGRATION_SHA256 ||
    migration.artifact_source_commit !== MIGRATION_SOURCE_COMMIT ||
    migration.release_order !== 21
  ) {
    fail("WORLD_V2_FULL_READER_MIGRATION_IDENTITY_INVALID");
  }

  const sqlBuffer = await readFile(path.join(sourceRoot, migration.path));
  if (
    createHash("sha256").update(sqlBuffer).digest("hex") !== MIGRATION_SHA256
  ) {
    fail("WORLD_V2_FULL_READER_MIGRATION_HASH_INVALID");
  }

  const checksums = JSON.parse(
    await readFile(
      path.join(
        sourceRoot,
        "artifacts/world-balanced-candidate-v1/CHECKSUMS.json",
      ),
      "utf8",
    ),
  );
  const actualPaths = checksums
    .filter(
      (entry) => entry.path.startsWith("data/") && entry.path.endsWith(".json"),
    )
    .map((entry) => `source/${Buffer.from(entry.path, "utf8").toString("hex")}`)
    .sort();
  if (
    JSON.stringify(actualPaths) !== JSON.stringify(FULL_JSON_ARTIFACT_PATHS) ||
    !sqlBuffer.toString("utf8").includes(FULL_READER_POLICY)
  ) {
    fail("WORLD_V2_FULL_READER_FROZEN_PATHSET_INVALID");
  }

  const storage = await verifiedStorageExpectation(sourceRoot, checksums);

  return Object.freeze({
    manifest,
    migration,
    sql: sqlBuffer.toString("utf8"),
    storage,
  });
}

function catalogEvidenceQuery(phase) {
  const roots = FULL_JSON_ARTIFACT_PATHS.map(sqlLiteral).join(", ");
  const rootValues = FULL_JSON_ARTIFACT_PATHS.map(
    (root) => `(${sqlLiteral(root)})`,
  ).join(", ");
  return `select jsonb_build_object(
  'phase', ${sqlLiteral(phase)},
  'ledger_entries', coalesce((
    select jsonb_agg(jsonb_build_object(
      'migration_id', migration_id,
      'artifact_sha256', artifact_sha256,
      'source_repo_commit', source_repo_commit,
      'release_order', release_order
    ) order by release_order)
    from world_v2.schema_release
  ), '[]'::jsonb),
  'reader_role', (
    select jsonb_build_object(
      'can_login', rolcanlogin,
      'can_bypass_rls', rolbypassrls,
      'is_superuser', rolsuper,
      'inherits_privileges', rolinherit
    ) from pg_roles where rolname = ${sqlLiteral(READER_ROLE)}
  ),
  'login_role', (
    select jsonb_build_object(
      'can_login', rolcanlogin,
      'can_bypass_rls', rolbypassrls,
      'is_superuser', rolsuper,
      'inherits_privileges', rolinherit
    ) from pg_roles where rolname = ${sqlLiteral(LOGIN_ROLE)}
  ),
  'reader_memberships', coalesce((
    select jsonb_agg(jsonb_build_object(
      'member', member_role.rolname,
      'role', granted_role.rolname,
      'grantor', grantor_role.rolname,
      'admin_option', membership.admin_option,
      'inherit_option', membership.inherit_option,
      'set_option', membership.set_option
    ) order by member_role.rolname)
    from pg_auth_members membership
    join pg_roles member_role on member_role.oid = membership.member
    join pg_roles granted_role on granted_role.oid = membership.roleid
    join pg_roles grantor_role on grantor_role.oid = membership.grantor
    where granted_role.rolname = ${sqlLiteral(READER_ROLE)}
  ), '[]'::jsonb),
  'schema_usage', coalesce((
    select jsonb_agg(namespace.nspname order by namespace.nspname)
    from pg_namespace namespace
    where namespace.nspname in ('auth', 'public', 'storage', 'world_v2')
      and has_schema_privilege(${sqlLiteral(READER_ROLE)}, namespace.oid, 'USAGE')
  ), '[]'::jsonb),
  'column_select_privileges', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'table', relation.relname,
      'column', attribute.attname
    ) order by namespace.nspname, relation.relname, attribute.attnum)
    from pg_attribute attribute
    join pg_class relation on relation.oid = attribute.attrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('auth', 'public', 'storage', 'world_v2')
      and relation.relkind in ('p', 'r')
      and attribute.attnum > 0
      and not attribute.attisdropped
      and has_column_privilege(${sqlLiteral(READER_ROLE)}, relation.oid, attribute.attname, 'SELECT')
  ), '[]'::jsonb),
  'table_privileges', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', namespace.nspname,
      'table', relation.relname,
      'privilege', action.name
    ) order by namespace.nspname, relation.relname, action.name)
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    cross join (values ('DELETE'), ('INSERT'), ('SELECT'), ('TRUNCATE'), ('UPDATE'))
      as action(name)
    where namespace.nspname in ('auth', 'public', 'storage', 'world_v2')
      and relation.relkind in ('p', 'r')
      and has_table_privilege(${sqlLiteral(READER_ROLE)}, relation.oid, action.name)
  ), '[]'::jsonb),
  'candidate_table_policies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', policy.schemaname,
      'table', policy.tablename,
      'name', policy.policyname,
      'roles', to_jsonb(policy.roles),
      'command', policy.cmd,
      'permissive', policy.permissive,
      'qual', policy.qual,
      'with_check', policy.with_check
    ) order by policy.policyname)
    from pg_policies policy
    where policy.schemaname = 'world_v2'
      and policy.tablename in (
        'country_candidate_bundle',
        'country_candidate_artifact'
      )
  ), '[]'::jsonb),
  'candidate_bundle', (
    select jsonb_build_object(
      'bundle_id', bundle_id,
      'source_thread_id', source_thread_id,
      'package_manifest_sha256', package_manifest_sha256,
      'source_status', source_status,
      'activation_allowed', activation_allowed
    ) from world_v2.country_candidate_bundle
    where bundle_id = ${sqlLiteral(BUNDLE_ID)}
  ),
  'full_json_storage_rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'bundle_id', bundle_id,
      'artifact_path', artifact_path,
      'content_sha256', content_sha256,
      'computed_sha256', world_v2.authoritative_sha256(content_utf8),
      'content_bytes', octet_length(content_utf8)
    ) order by artifact_path)
    from world_v2.country_candidate_artifact artifact
    where artifact.bundle_id = ${sqlLiteral(BUNDLE_ID)}
      and (artifact.artifact_path in (${roots}) or exists (
        select 1 from (values ${rootValues}) as source(artifact_path)
        where left(artifact.artifact_path, length(source.artifact_path) + 5)
          = source.artifact_path || '.part'
      ))
  ), '[]'::jsonb),
  'full_json_source_digests', coalesce((
    select jsonb_agg(jsonb_build_object(
      'artifact_path', source.artifact_path,
      'content_sha256', (
        select world_v2.authoritative_sha256(
          string_agg(artifact.content_utf8, '' order by artifact.artifact_path)
        )
        from world_v2.country_candidate_artifact artifact
        where artifact.bundle_id = ${sqlLiteral(BUNDLE_ID)}
          and (artifact.artifact_path = source.artifact_path
            or left(artifact.artifact_path, length(source.artifact_path) + 5)
              = source.artifact_path || '.part')
      ),
      'content_bytes', (
        select sum(octet_length(artifact.content_utf8))
        from world_v2.country_candidate_artifact artifact
        where artifact.bundle_id = ${sqlLiteral(BUNDLE_ID)}
          and (artifact.artifact_path = source.artifact_path
            or left(artifact.artifact_path, length(source.artifact_path) + 5)
              = source.artifact_path || '.part')
      )
    ) order by source.artifact_path)
    from (values ${rootValues}) as source(artifact_path)
  ), '[]'::jsonb)
) as evidence;`;
}

function applyQuery({ manifest, migration, sql }) {
  const baseline = ledgerRows(
    manifest.migrations.slice(0, PREVIOUS_MIGRATION_COUNT),
  );
  return `begin;
do $world_v2_full_reader_preflight$
begin
  if (select coalesce(jsonb_agg(jsonb_build_object(
       'migration_id', migration_id,
       'artifact_sha256', artifact_sha256,
       'source_repo_commit', source_repo_commit,
       'release_order', release_order
     ) order by release_order), '[]'::jsonb)
      from world_v2.schema_release) <> ${jsonLiteral(baseline)}::jsonb then
    raise exception 'World V2 release ledger is not the exact reviewed 20-artifact baseline';
  end if;
end;
$world_v2_full_reader_preflight$;
${sql}
insert into world_v2.schema_release
  (migration_id, artifact_sha256, source_repo_commit, release_order)
values (${sqlLiteral(migration.migration_id)}, ${sqlLiteral(migration.sha256)},
        ${sqlLiteral(migration.artifact_source_commit)}, ${migration.release_order});
commit;
${catalogEvidenceQuery("AFTER_FULL_READER_RELEASE")}`;
}

/**
 * Renders read-only preflight/diagnostic SQL plus one atomic 0021 request.
 * The module has no credentials, network client, or production side effect.
 */
export async function renderWorldV2ApiFullReaderRelease(sourceRoot) {
  const release = await verifiedSource(sourceRoot);
  const beforeLedger = ledgerRows(
    release.manifest.migrations.slice(0, PREVIOUS_MIGRATION_COUNT),
  );
  const afterLedger = ledgerRows(release.manifest.migrations);
  return Object.freeze({
    migration: release.migration,
    expectation: Object.freeze({
      after_ledger: afterLedger,
      before_ledger: beforeLedger,
      full_json_artifact_paths: FULL_JSON_ARTIFACT_PATHS,
      candidate_bundle: release.storage.bundle,
      full_json_source_digests: release.storage.sources,
      full_json_storage_rows: release.storage.storageRows,
      migration_id: MIGRATION_ID,
      migration_sha256: MIGRATION_SHA256,
      migration_source_commit: MIGRATION_SOURCE_COMMIT,
    }),
    applyQuery: applyQuery(release),
    diagnosticQuery: catalogEvidenceQuery("READ_ONLY_FULL_READER_DIAGNOSTIC"),
    preflightQuery: catalogEvidenceQuery("BEFORE_FULL_READER_RELEASE"),
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const [
    sourceRoot,
    preflightOutput,
    applyOutput,
    expectationOutput,
    diagnosticOutput,
  ] = process.argv.slice(2);
  if (
    !sourceRoot ||
    !preflightOutput ||
    !applyOutput ||
    !expectationOutput ||
    !diagnosticOutput ||
    process.argv.length !== 7
  ) {
    fail("WORLD_V2_FULL_READER_RENDER_ARGUMENTS_INVALID");
  }
  const release = await renderWorldV2ApiFullReaderRelease(
    path.resolve(sourceRoot),
  );
  await Promise.all([
    writeFile(
      path.resolve(preflightOutput),
      JSON.stringify({ query: release.preflightQuery }),
    ),
    writeFile(
      path.resolve(applyOutput),
      JSON.stringify({ query: release.applyQuery }),
    ),
    writeFile(
      path.resolve(expectationOutput),
      JSON.stringify(release.expectation, null, 2) + "\n",
    ),
    writeFile(
      path.resolve(diagnosticOutput),
      JSON.stringify({ query: release.diagnosticQuery }),
    ),
  ]);
  process.stdout.write(
    JSON.stringify({
      migrationId: release.migration.migration_id,
      migrationSha256: release.migration.sha256,
      sourceCommit: release.migration.artifact_source_commit,
    }) + "\n",
  );
}
