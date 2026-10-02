import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import baseline from "../docs/evidence/world-v2-storage-preflight-37021759785.json" with { type: "json" };
import {
  SNAPSHOT_STORAGE_PERMISSION_SQL,
  verifyStorageWriteBoundary,
} from "./world-v2-source-snapshot-transport.mjs";
import { permissionEvidence } from "./run-world-v2-source-snapshot-release.mjs";

export const POLICY_SOURCE_COMMIT = "e5814c018dfd585e71ecd271f19eee624d6ea255";
export const POLICY_SOURCE_TREE = "e67e17cc97103b73464a4b2ddbf80487f05100f2";
export const POLICY_MIGRATION_ID = "0022_world_v2_snapshot_storage_veto";
export const POLICY_SQL_SHA256 =
  "c1ceebbf6265b54c67230d550f438e1b197415c42b3921cc358cf247482b4ef1";
const POLICY_PATH = `database/migrations/artifacts/${POLICY_MIGRATION_ID}.sql`;
const ARTIFACT_SOURCE = "41f387700cf8f933a777f924c503d11cbcd99ffe";
const PREFIX_MANIFEST_HASH =
  "df82b1ad8db19aee67ac232041f3b3e8f7c776676b4ae7047554557c0a6b54b3";
const BEFORE_LEDGER_HASH =
  "8c5d2ffbd80de94ee0e69fd7da54322f3a3ce160b9a1f835db7aa5c2b49b1e52";
const BASELINE_RECEIPT_HASH =
  "bdda465e29c3889f5cf3c3312370bcf73b08b0a8a44cd3a4b39ae5ef33f086c9";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAMES = [
  "world_v2_snapshot_objects_delete_deny",
  "world_v2_snapshot_objects_insert_deny",
];
const BUCKET = "world-v2-official-source-v1";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const literal = (s) => `'${s.replaceAll("'", "''")}'`;
const jsonLiteral = (v) => `${literal(JSON.stringify(v))}::jsonb`;
const permissionQuery = SNAPSHOT_STORAGE_PERMISSION_SQL.trim().replace(
  /;$/u,
  "",
);
function fail(code) {
  throw new Error(code);
}
const FINGERPRINT_FILES = [
  ".github/workflows/release-world-v2-snapshot-storage-policies.yml",
  ".github/workflows/verify-world-v2-snapshot-storage-policies.yml",
  "scripts/world-v2-snapshot-storage-policy-release.mjs",
  "scripts/world-v2-source-snapshot-transport.mjs",
  "scripts/run-world-v2-source-snapshot-release.mjs",
  "docs/evidence/world-v2-storage-preflight-37021759785.json",
  "scripts/test-world-v2-snapshot-storage-policy-release.mjs",
];
export async function policyReleaseFingerprint(root = ROOT) {
  const digest = createHash("sha256");
  for (const file of FINGERPRINT_FILES)
    digest
      .update(file)
      .update("\0")
      .update(await readFile(path.join(root, file)))
      .update("\0");
  return digest.digest("hex");
}
export async function verifyPolicyReleaseLock(lock, confirmation, root = ROOT) {
  if (
    confirmation !== "RELEASE_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE" ||
    lock !== `RELEASE_GO:${await policyReleaseFingerprint(root)}`
  )
    fail("SNAPSHOT_POLICY_RELEASE_HOLD");
}
export async function verifiedPolicySource(worldRoot) {
  const git = (...args) =>
    execFileSync("git", ["--no-replace-objects", "-C", worldRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    if (
      git("rev-parse", "HEAD") !== POLICY_SOURCE_COMMIT ||
      git("remote", "get-url", "origin") !==
        "https://github.com/samuelq800/econmind-os-world-simulation.git" ||
      git("status", "--porcelain=v1", "--untracked-files=all") !== "" ||
      git("rev-parse", "HEAD:database/migrations") !== POLICY_SOURCE_TREE
    )
      fail("SNAPSHOT_POLICY_SOURCE_INVALID");
    const manifest = JSON.parse(
      await readFile(
        path.join(worldRoot, "database/migrations/manifest.json"),
        "utf8",
      ),
    );
    const migration = manifest.migrations.at(-1);
    if (
      manifest.namespace !== "world_v2" ||
      manifest.production_publisher !== "main-site-release-chain" ||
      manifest.world_repository_production_mutation !== false ||
      manifest.migrations.length !== 22 ||
      hash(JSON.stringify(manifest.migrations.slice(0, 21))) !==
        PREFIX_MANIFEST_HASH ||
      migration.migration_id !== POLICY_MIGRATION_ID ||
      migration.path !== POLICY_PATH ||
      migration.sha256 !== POLICY_SQL_SHA256 ||
      migration.release_order !== 22 ||
      migration.artifact_source_commit !== ARTIFACT_SOURCE ||
      migration.scope_authority !== "CONTROL_TOWER_OWNER_DELEGATION" ||
      JSON.stringify(migration.affected_schemas) !== '["storage"]' ||
      migration.production_approval !== null
    )
      fail("SNAPSHOT_POLICY_MANIFEST_INVALID");
    for (const m of manifest.migrations) {
      const bytes = await readFile(path.join(worldRoot, m.path));
      if (
        hash(bytes) !== m.sha256 ||
        hash(
          execFileSync(
            "git",
            [
              "--no-replace-objects",
              "-C",
              worldRoot,
              "show",
              `${m.artifact_source_commit}:${m.path}`,
            ],
            { stdio: ["ignore", "pipe", "pipe"] },
          ),
        ) !== m.sha256
      )
        fail("SNAPSHOT_POLICY_ARTIFACT_PROVENANCE_INVALID");
    }
    const sql = await readFile(path.join(worldRoot, POLICY_PATH), "utf8");
    return {
      sql,
      migration,
      beforeLedger: ledgerRows(manifest.migrations.slice(0, 21)),
      afterLedger: ledgerRows(manifest.migrations),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /^SNAPSHOT_POLICY_[A-Z0-9_]+$/u.test(error.message)
    )
      throw error;
    fail("SNAPSHOT_POLICY_SOURCE_INVALID");
  }
}
function ledgerRows(migrations) {
  return migrations.map((m) => ({
    migration_id: m.migration_id,
    artifact_sha256: m.sha256,
    source_repo_commit: m.artifact_source_commit,
    release_order: m.release_order,
  }));
}
export function summarizePolicyPermission(permissions) {
  return {
    bucket: permissions.bucket,
    roles: permissions.roles,
    relations: permissions.relations,
    policies: permissions.policies.map((p) => ({
      table: p.table,
      command: p.command,
      permissive: p.permissive,
      applies_to: p.applies_to,
      qual_sha256: hash(String(p.qual)),
      check_sha256: hash(String(p.check)),
    })),
  };
}
const expectedSummary = {
  bucket: baseline.bucket,
  roles: baseline.roles,
  relations: baseline.relations,
  policies: baseline.policies,
};
export function summarySql(permission) {
  return `jsonb_build_object('bucket',${permission}->'bucket','roles',${permission}->'roles','relations',${permission}->'relations',
    'policies',(select coalesce(jsonb_agg(jsonb_build_object('table',p->'table','command',p->'command',
      'permissive',p->'permissive','applies_to',p->'applies_to',
      'qual_sha256',encode(sha256(convert_to(coalesce(p->>'qual','null'),'UTF8')),'hex'),
      'check_sha256',encode(sha256(convert_to(coalesce(p->>'check','null'),'UTF8')),'hex')) order by ordinal),'[]'::jsonb)
      from jsonb_array_elements(${permission}->'policies') with ordinality as policy(p,ordinal)))`;
}
// Bounded to two relations / relevant roles / one inactive source and ledger.
// Old bucket rows remain server-side; only a digest/count ever leaves the runner.
export function policyObservationSql() {
  return `select jsonb_build_object(
    'permissions',(select evidence from (${permissionQuery}) permission),
    'policy_definitions',coalesce((select jsonb_agg(jsonb_build_object('table',c.relname,'name',p.polname,
      'command',p.polcmd,'permissive',p.polpermissive,'roles',(select jsonb_agg(case when r=0 then 'PUBLIC' else (select rolname from pg_roles where oid=r) end order by case when r=0 then 'PUBLIC' else (select rolname from pg_roles where oid=r) end) from unnest(p.polroles) r),
      'qual',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by c.relname,p.polname)
      from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='storage' and c.relname in ('objects','buckets')),'[]'::jsonb),
    'protected_storage_metadata',jsonb_build_object(
      'schema',(select jsonb_build_object('owner',nspowner,'acl',nspacl) from pg_namespace where nspname='storage'),
      'relations',(select jsonb_agg(jsonb_build_object('name',c.relname,'owner',c.relowner,'acl',c.relacl,'kind',c.relkind,
        'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'options',c.reloptions) order by c.relname)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname in ('objects','buckets')),
      'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',a.atttypid,'acl',a.attacl,
        'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attnum)
        from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where n.nspname='storage' and c.relname in ('objects','buckets') and a.attnum>0 and not a.attisdropped)),
    'old_bucket_rows', (select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(b)::text,E'\\n' order by id),''),'UTF8')),'hex'))
      from (select * from storage.buckets where id<>${literal(BUCKET)} order by id limit 101) b),
    'new_scope_rows',jsonb_build_object('buckets',(select count(*) from storage.buckets where id=${literal(BUCKET)}),
      'objects',(select count(*) from storage.objects where bucket_id=${literal(BUCKET)})),
    'world_roles',(select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit) order by rolname)
      from pg_roles where rolname in ('world_v2_api_login','world_v2_api_reader')),
    'source_state',(select jsonb_build_object('bundle_id',bundle_id,'package_manifest_sha256',package_manifest_sha256,'source_status',source_status,'activation_allowed',activation_allowed)
      from world_v2.country_candidate_bundle where bundle_id='BALANCED_2026_09_28_V1'),
    'ledger',coalesce((select jsonb_agg(jsonb_build_object('migration_id',migration_id,'artifact_sha256',artifact_sha256,
      'source_repo_commit',source_repo_commit,'release_order',release_order) order by release_order)
      from (select migration_id,artifact_sha256,source_repo_commit,release_order from world_v2.schema_release order by release_order limit 23) bounded_ledger),'[]'::jsonb)
  ) as observation`;
}
export function expectedNewPolicies() {
  const expression = `(bucket_id IS DISTINCT FROM '${BUCKET}'::text)`;
  return [
    {
      table: "objects",
      name: NAMES[0],
      command: "d",
      permissive: false,
      roles: ["anon", "authenticated"],
      qual: expression,
      check: null,
    },
    {
      table: "objects",
      name: NAMES[1],
      command: "a",
      permissive: false,
      roles: ["anon", "authenticated"],
      qual: null,
      check: expression,
    },
  ];
}
export function buildPolicyApplyQuery(release) {
  if (
    hash(release.sql) !== POLICY_SQL_SHA256 ||
    release.migration?.migration_id !== POLICY_MIGRATION_ID ||
    release.migration.sha256 !== POLICY_SQL_SHA256 ||
    !validLedgerIntent(release)
  )
    fail("SNAPSHOT_POLICY_RENDER_INTENT_INVALID");
  const observed = policyObservationSql();
  return `begin;
set local lock_timeout='5s'; set local statement_timeout='30s';
do $snapshot_veto_lock$ begin perform pg_advisory_xact_lock(hashtext('world-v2-main-site-release-chain')); end $snapshot_veto_lock$;
lock table storage.objects in access exclusive mode;
lock table storage.buckets in share mode;
lock table world_v2.schema_release in share row exclusive mode;
create temporary table snapshot_veto_before on commit drop as ${observed};
do $snapshot_veto_preflight$
declare before_value jsonb; permission jsonb;
begin
  select observation into strict before_value from snapshot_veto_before;
  permission:=before_value->'permissions';
  if ${summarySql("permission")} is distinct from ${jsonLiteral(expectedSummary)} then raise exception 'SNAPSHOT_POLICY_STALE_PERMISSION_BASELINE'; end if;
  if before_value->'ledger' is distinct from ${jsonLiteral(release.beforeLedger)} then raise exception 'SNAPSHOT_POLICY_LEDGER_BASELINE_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(before_value->'policy_definitions') p where p->>'name' in (${NAMES.map(literal).join(",")})) then raise exception 'SNAPSHOT_POLICY_NAME_COLLISION'; end if;
  if before_value->'new_scope_rows' is distinct from '{"buckets":0,"objects":0}'::jsonb or (before_value#>>'{old_bucket_rows,count}')::integer>100 then raise exception 'SNAPSHOT_POLICY_SCOPE_ROWS_CONFLICT'; end if;
  if before_value->'world_roles' is distinct from '[{"name":"world_v2_api_login","login":false,"super":false,"bypass":false,"inherit":false},{"name":"world_v2_api_reader","login":false,"super":false,"bypass":false,"inherit":false}]'::jsonb then raise exception 'SNAPSHOT_POLICY_NOLOGIN_REQUIRED'; end if;
  if before_value->'source_state' is distinct from '{"bundle_id":"BALANCED_2026_09_28_V1","package_manifest_sha256":"88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315","source_status":"IMPLEMENTED_UNVERIFIED_CANDIDATE","activation_allowed":false}'::jsonb then raise exception 'SNAPSHOT_POLICY_INACTIVE_SOURCE_REQUIRED'; end if;
end $snapshot_veto_preflight$;
${release.sql}
insert into world_v2.schema_release(migration_id,artifact_sha256,source_repo_commit,release_order)
values(${literal(POLICY_MIGRATION_ID)},${literal(POLICY_SQL_SHA256)},${literal(ARTIFACT_SOURCE)},22);
create temporary table snapshot_veto_after on commit drop as ${observed};
do $snapshot_veto_aftercheck$
declare before_value jsonb; after_value jsonb; old_policies jsonb; new_policies jsonb;
begin
  select observation into strict before_value from snapshot_veto_before;
  select observation into strict after_value from snapshot_veto_after;
  select coalesce(jsonb_agg(p order by p->>'table',p->>'name'),'[]'::jsonb) into old_policies from jsonb_array_elements(after_value->'policy_definitions') p where p->>'name' not in (${NAMES.map(literal).join(",")});
  select coalesce(jsonb_agg(p order by p->>'table',p->>'name'),'[]'::jsonb) into new_policies from jsonb_array_elements(after_value->'policy_definitions') p where p->>'name' in (${NAMES.map(literal).join(",")});
  if old_policies is distinct from before_value->'policy_definitions' or new_policies is distinct from ${jsonLiteral(expectedNewPolicies())} then raise exception 'SNAPSHOT_POLICY_EXACT_POLICY_DELTA_INVALID'; end if;
  if (after_value-'permissions'-'policy_definitions'-'ledger') is distinct from (before_value-'permissions'-'policy_definitions'-'ledger') or
     after_value#>'{permissions,roles}' is distinct from before_value#>'{permissions,roles}' or
     after_value#>'{permissions,relations}' is distinct from before_value#>'{permissions,relations}' then raise exception 'SNAPSHOT_POLICY_PROTECTED_PROPERTY_CHANGED'; end if;
  if after_value->'ledger' is distinct from ${jsonLiteral(release.afterLedger)} then raise exception 'SNAPSHOT_POLICY_EXACT_LEDGER_DELTA_INVALID'; end if;
end $snapshot_veto_aftercheck$;
select jsonb_build_object('status','SNAPSHOT_POLICY_ATOMIC_SCOPE_VERIFIED',
  'before',(select observation from snapshot_veto_before),'after',(select observation from snapshot_veto_after),
  'migration_id',${literal(POLICY_MIGRATION_ID)},'migration_sha256',${literal(POLICY_SQL_SHA256)}) as evidence;
commit;`;
}
export function canonicalOid(value) {
  // PostgreSQL jsonb encodes catalog OID (not an int4) as a decimal string.
  // Permit only canonical positive uint32, never loose numeric coercion.
  const text =
    typeof value === "number" && Number.isInteger(value)
      ? String(value)
      : value;
  return typeof text === "string" &&
    /^[1-9][0-9]{0,9}$/u.test(text) &&
    BigInt(text) <= 4294967295n
    ? text
    : null;
}
export function validatePolicyObservation(observation) {
  const has = (object, fields) =>
    object && fields.every((field) => Object.hasOwn(object, field));
  if (
    !observation ||
    !observation.permissions ||
    !Array.isArray(observation.permissions.policies) ||
    !Array.isArray(observation.permissions.roles) ||
    !Array.isArray(observation.permissions.relations) ||
    !Array.isArray(observation.policy_definitions) ||
    !Array.isArray(observation.ledger) ||
    !observation.protected_storage_metadata?.schema ||
    !Array.isArray(observation.protected_storage_metadata.relations) ||
    observation.protected_storage_metadata.relations.length !== 2 ||
    !Array.isArray(observation.protected_storage_metadata.columns) ||
    observation.protected_storage_metadata.columns.length === 0 ||
    !Number.isInteger(observation.old_bucket_rows?.count) ||
    observation.old_bucket_rows.count < 0 ||
    observation.old_bucket_rows.count > 100 ||
    !/^[0-9a-f]{64}$/u.test(observation.old_bucket_rows?.sha256 ?? "") ||
    !Array.isArray(observation.world_roles) ||
    observation.world_roles.length !== 2 ||
    !observation.source_state ||
    !observation.new_scope_rows
  )
    fail("SNAPSHOT_POLICY_PUBLICATION_EVIDENCE_INVALID");
  const metadata = observation.protected_storage_metadata;
  if (
    !has(metadata.schema, ["owner", "acl"]) ||
    canonicalOid(metadata.schema.owner) === null ||
    metadata.relations.some(
      (item) =>
        !has(item, [
          "name",
          "owner",
          "acl",
          "kind",
          "rls",
          "force_rls",
          "options",
        ]) ||
        canonicalOid(item.owner) === null ||
        typeof item.rls !== "boolean" ||
        typeof item.force_rls !== "boolean",
    ) ||
    metadata.columns.some(
      (item) =>
        !has(item, ["table", "name", "type", "acl", "not_null", "default"]) ||
        canonicalOid(item.type) === null ||
        typeof item.not_null !== "boolean",
    )
  )
    fail("SNAPSHOT_POLICY_PUBLICATION_EVIDENCE_INVALID");
  if (
    observation.permissions.policies.length !==
      observation.policy_definitions.length ||
    observation.permissions.policies.some(
      (policy) =>
        !observation.policy_definitions.some((definition) =>
          ["table", "name", "command", "permissive", "qual", "check"].every(
            (key) => policy[key] === definition[key],
          ),
        ),
    )
  )
    fail("SNAPSHOT_POLICY_PUBLICATION_EVIDENCE_INVALID");
}
export function verifyPolicyPublication(response, release) {
  const evidence = permissionEvidence(response);
  if (
    evidence.status !== "SNAPSHOT_POLICY_ATOMIC_SCOPE_VERIFIED" ||
    evidence.migration_id !== POLICY_MIGRATION_ID ||
    evidence.migration_sha256 !== POLICY_SQL_SHA256
  )
    fail("SNAPSHOT_POLICY_PUBLICATION_EVIDENCE_INVALID");
  const before = evidence.before,
    after = evidence.after;
  validatePolicyObservation(before);
  validatePolicyObservation(after);
  if (!validLedgerIntent(release))
    fail("SNAPSHOT_POLICY_RENDER_INTENT_INVALID");
  const stable = (v) =>
    JSON.stringify(v, (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
          )
        : value,
    );
  const same = (a, b) => stable(a) === stable(b);
  if (
    !same(before.new_scope_rows, { buckets: 0, objects: 0 }) ||
    !same(before.world_roles, [
      {
        name: "world_v2_api_login",
        login: false,
        super: false,
        bypass: false,
        inherit: false,
      },
      {
        name: "world_v2_api_reader",
        login: false,
        super: false,
        bypass: false,
        inherit: false,
      },
    ]) ||
    !same(before.source_state, {
      bundle_id: "BALANCED_2026_09_28_V1",
      package_manifest_sha256:
        "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315",
      source_status: "IMPLEMENTED_UNVERIFIED_CANDIDATE",
      activation_allowed: false,
    })
  )
    fail("SNAPSHOT_POLICY_PUBLICATION_EVIDENCE_INVALID");
  if (
    !same(summarizePolicyPermission(before.permissions), expectedSummary) ||
    !same(before.ledger, release.beforeLedger) ||
    !same(after.ledger, release.afterLedger) ||
    !same(
      after.policy_definitions.filter((p) => !NAMES.includes(p.name)),
      before.policy_definitions,
    ) ||
    !same(
      after.policy_definitions.filter((p) => NAMES.includes(p.name)),
      expectedNewPolicies(),
    ) ||
    !same(before.permissions.roles, after.permissions.roles) ||
    !same(before.permissions.relations, after.permissions.relations)
  )
    fail("SNAPSHOT_POLICY_PUBLICATION_DELTA_INVALID");
  for (const key of [
    "protected_storage_metadata",
    "old_bucket_rows",
    "new_scope_rows",
    "world_roles",
    "source_state",
  ])
    if (!same(before[key], after[key]))
      fail("SNAPSHOT_POLICY_PROTECTED_PROPERTY_CHANGED");
  verifyStorageWriteBoundary(after.permissions);
  return {
    status: "WORLD_V2_SNAPSHOT_STORAGE_POLICY_RELEASE_VERIFIED",
    migration_id: POLICY_MIGRATION_ID,
    migration_sha256: POLICY_SQL_SHA256,
    migration_source_commit: ARTIFACT_SOURCE,
    world_source_commit: POLICY_SOURCE_COMMIT,
    world_migration_tree: POLICY_SOURCE_TREE,
    historical_preflight_run: "37021759785",
    historical_receipt_sha256: BASELINE_RECEIPT_HASH,
    before_permission_summary_sha256: hash(
      stable(summarizePolicyPermission(before.permissions)),
    ),
    old_policy_definitions_sha256: hash(stable(before.policy_definitions)),
    old_grants_and_properties_sha256: hash(
      stable(before.protected_storage_metadata),
    ),
    old_bucket_rows: before.old_bucket_rows,
    old_world_role_flags_sha256: hash(stable(before.world_roles)),
    before_ledger_sha256: hash(stable(before.ledger)),
    after_ledger_sha256: hash(stable(after.ledger)),
    new_policies: NAMES,
    ordinary_storage_write_boundary: "SNAPSHOT_DIRECT_STORAGE_WRITE_DENIED",
    snapshot_publication: "NOT_RUN",
    key_acquisition: "NOT_RUN",
    deployment: "NOT_RUN",
    economic_activation: false,
  };
}
export function validLedgerIntent(release) {
  return (
    Array.isArray(release.beforeLedger) &&
    Array.isArray(release.afterLedger) &&
    release.beforeLedger.length === 21 &&
    release.afterLedger.length === 22 &&
    hash(JSON.stringify(release.beforeLedger)) === BEFORE_LEDGER_HASH &&
    JSON.stringify(release.afterLedger) ===
      JSON.stringify([
        ...release.beforeLedger,
        {
          migration_id: POLICY_MIGRATION_ID,
          artifact_sha256: POLICY_SQL_SHA256,
          source_repo_commit: ARTIFACT_SOURCE,
          release_order: 22,
        },
      ])
  );
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "fingerprint")
    process.stdout.write((await policyReleaseFingerprint()) + "\n");
  else if (command === "guard")
    await verifyPolicyReleaseLock(
      process.env.WORLD_V2_SNAPSHOT_POLICY_RELEASE_LOCK,
      process.env.WORLD_V2_SNAPSHOT_POLICY_CONFIRMATION,
    );
  else if (command === "render") {
    if (
      hash(
        await readFile(
          path.join(
            ROOT,
            "docs/evidence/world-v2-storage-preflight-37021759785.json",
          ),
        ),
      ) !== BASELINE_RECEIPT_HASH
    )
      fail("SNAPSHOT_POLICY_HISTORICAL_RECEIPT_CHANGED");
    const release = await verifiedPolicySource(args[0]);
    await writeFile(
      args[1],
      JSON.stringify({ query: buildPolicyApplyQuery(release) }),
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      args[2],
      JSON.stringify(
        {
          beforeLedger: release.beforeLedger,
          afterLedger: release.afterLedger,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
  } else if (command === "verify") {
    const release = JSON.parse(await readFile(args[1], "utf8"));
    const raw = await readFile(args[0]);
    const result = verifyPolicyPublication(JSON.parse(raw), release);
    await writeFile(
      args[2],
      JSON.stringify(
        {
          ...result,
          main_site_commit: process.env.GITHUB_SHA ?? "NOT_RUN",
          github_run_id: process.env.GITHUB_RUN_ID ?? "NOT_RUN",
          response_sha256: hash(raw),
          release_fingerprint: await policyReleaseFingerprint(),
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  } else if (command === "unknown") {
    await writeFile(
      args[0],
      JSON.stringify(
        {
          status: "UNKNOWN_STOP_NO_RETRY",
          main_site_commit: process.env.GITHUB_SHA ?? "NOT_RUN",
          github_run_id: process.env.GITHUB_RUN_ID ?? "NOT_RUN",
          migration_id: POLICY_MIGRATION_ID,
          migration_sha256: POLICY_SQL_SHA256,
          release_fingerprint: await policyReleaseFingerprint(),
          execution_result: "UNKNOWN",
          production_requery: "NOT_RUN",
          remote_cleanup: "NOT_RUN",
          snapshot_publication: "NOT_RUN",
          key_acquisition: "NOT_RUN",
          deployment: "NOT_RUN",
          economic_activation: false,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  } else fail("SNAPSHOT_POLICY_ARGUMENTS_INVALID");
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof Error &&
        /^SNAPSHOT_POLICY_[A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : "SNAPSHOT_POLICY_STEP_FAILED",
    );
    process.exitCode = 1;
  }
}
