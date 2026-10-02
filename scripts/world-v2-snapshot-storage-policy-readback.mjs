import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import baseline from "../docs/evidence/world-v2-storage-preflight-37021759785.json" with { type: "json" };
import original from "../docs/evidence/world-v2-storage-policy-unknown-37031019041.json" with { type: "json" };
import {
  policyReleaseFingerprint,
  verifiedPolicySource,
  policyObservationSql,
  summarySql,
  expectedNewPolicies,
  validLedgerIntent,
  canonicalOid,
  POLICY_MIGRATION_ID,
  POLICY_SQL_SHA256,
  POLICY_SOURCE_COMMIT,
  POLICY_SOURCE_TREE,
} from "./world-v2-snapshot-storage-policy-release.mjs";
import { permissionEvidence } from "./run-world-v2-source-snapshot-release.mjs";
import { verifyStorageWriteBoundary } from "./world-v2-source-snapshot-transport.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNKNOWN_FILE =
  "docs/evidence/world-v2-storage-policy-unknown-37031019041.json";
export const ORIGINAL_UNKNOWN_SHA256 =
  "6ae0eccabf3447f5d0975df1c935a4eec33479daa219856ff8f783a7dbea5409";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const literal = (v) => `'${v.replaceAll("'", "''")}'`;
const json = (v) => `${literal(JSON.stringify(v))}::jsonb`;
const historical = {
  bucket: baseline.bucket,
  roles: baseline.roles,
  relations: baseline.relations,
  policies: baseline.policies,
};
const source = {
  bundle_id: "BALANCED_2026_09_28_V1",
  package_manifest_sha256:
    "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315",
  source_status: "IMPLEMENTED_UNVERIFIED_CANDIDATE",
  activation_allowed: false,
};
const roles = ["world_v2_api_login", "world_v2_api_reader"].map((name) => ({
  name,
  login: false,
  super: false,
  bypass: false,
  inherit: false,
}));
const stable = (v) =>
  JSON.stringify(v, (_k, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const same = (a, b) => stable(a) === stable(b);
const digest = (v) =>
  `encode(sha256(convert_to(coalesce((${v})::text,'null'),'UTF8')),'hex')`;
function fail(code) {
  throw new Error(code);
}
export async function policyReadbackFingerprint(root = ROOT) {
  const h = createHash("sha256")
    .update("world-v2-policy-readback-v1\0")
    .update(await policyReleaseFingerprint(root));
  for (const file of [
    "scripts/world-v2-snapshot-storage-policy-readback.mjs",
    "tests/world-v2-snapshot-storage-policy-readback.test.ts",
    UNKNOWN_FILE,
  ])
    h.update(file)
      .update("\0")
      .update(await readFile(path.join(root, file)))
      .update("\0");
  return h.digest("hex");
}
export async function verifyPolicyReadbackLock(
  lock,
  confirmation,
  root = ROOT,
) {
  if (
    confirmation !== "READ_WORLD_V2_SNAPSHOT_STORAGE_VETO_ONCE" ||
    lock !== `READBACK_GO:${await policyReadbackFingerprint(root)}`
  )
    fail("SNAPSHOT_POLICY_READBACK_HOLD");
}
// One SELECT. All raw old policies/ACLs/bucket rows stay server-side. Only exact
// expected public tuples, current ACL digests/OIDs and bounded flags leave it.
export function buildPolicyReadbackQuery(release) {
  if (!validLedgerIntent(release))
    fail("SNAPSHOT_POLICY_READBACK_INTENT_INVALID");
  return `with observed as materialized (${policyObservationSql()}),
parts as (select observation v,
  (select coalesce(jsonb_agg(p order by p->>'table',p->>'name'),'[]'::jsonb) from jsonb_array_elements(observation->'policy_definitions') p
    where p->>'name' in ('world_v2_snapshot_objects_delete_deny','world_v2_snapshot_objects_insert_deny')) new_policies,
  jsonb_set(observation->'permissions','{policies}',(select coalesce(jsonb_agg(p order by ordinal),'[]'::jsonb)
    from jsonb_array_elements(observation#>'{permissions,policies}') with ordinality as policies(p,ordinal)
    where p->>'name' not in ('world_v2_snapshot_objects_delete_deny','world_v2_snapshot_objects_insert_deny'))) old_permission
  from observed),
checked as (select *,${summarySql("old_permission")} old_summary,
  (select coalesce(jsonb_agg(p order by (p->>'release_order')::integer),'[]'::jsonb) from jsonb_array_elements(v->'ledger') p
    where p->>'migration_id'<>${literal(POLICY_MIGRATION_ID)}) old_ledger,
  (select coalesce(jsonb_agg(p),'[]'::jsonb) from jsonb_array_elements(v->'ledger') p
    where p->>'migration_id'=${literal(POLICY_MIGRATION_ID)}) ledger22
  from parts)
select jsonb_build_object(
  'contract','WORLD_V2_POLICY_CURRENT_STATE_READBACK_V1',
  'original_run','37031019041','original_status','UNKNOWN_STOP_NO_RETRY',
  'original_receipt_sha256',${literal(ORIGINAL_UNKNOWN_SHA256)},
  'new_policy_count',jsonb_array_length(new_policies),
  'new_policy_definitions',case when new_policies=${json(expectedNewPolicies())} or new_policies='[]'::jsonb then new_policies else null end,
  'new_policy_definitions_sha256',${digest("new_policies")},
  'historical_permission_summary',case when old_summary=${json(historical)} then old_summary else null end,
  'current_old_permission_summary_sha256',${digest("old_summary")},
  'ledger_count',jsonb_array_length(v->'ledger'),
  'historical_ledger21',case when old_ledger=${json(release.beforeLedger)} then old_ledger else null end,
  'ledger22',case when ledger22=${json([release.afterLedger.at(-1)])} or ledger22='[]'::jsonb then ledger22 else null end,
  'current_ledger_sha256',${digest("v->'ledger'")},
  'current_acl',jsonb_build_object(
    'schema_owner_oid',v#>>'{protected_storage_metadata,schema,owner}',
    'schema_acl_sha256',${digest("v#>'{protected_storage_metadata,schema,acl}'")},
    'relations',(select jsonb_agg(jsonb_build_object('name',r->'name','owner_oid',r->>'owner','rls',r->'rls',
      'force_rls',r->'force_rls','acl_sha256',${digest("r->'acl'")}) order by r->>'name')
      from jsonb_array_elements(v#>'{protected_storage_metadata,relations}') r),
    'column_count',jsonb_array_length(v#>'{protected_storage_metadata,columns}'),
    'columns_sha256',${digest("v#>'{protected_storage_metadata,columns}'")},
    'complete_current_metadata_sha256',${digest("v->'protected_storage_metadata'")}),
  'current_old_bucket_rows',v->'old_bucket_rows','current_new_scope_rows',v->'new_scope_rows',
  'world_roles',case when v->'world_roles'=${json(roles)} then v->'world_roles' else null end,
  'world_roles_sha256',${digest("v->'world_roles'")},
  'source_state',case when v->'source_state'=${json(source)} then v->'source_state' else null end,
  'source_state_sha256',${digest("v->'source_state'")}
) as evidence from checked;`;
}
export function verifyPolicyReadback(response, release) {
  if (!validLedgerIntent(release))
    fail("SNAPSHOT_POLICY_READBACK_INTENT_INVALID");
  const e = permissionEvidence(response),
    hex = (v) => typeof v === "string" && /^[0-9a-f]{64}$/u.test(v);
  if (
    e.contract !== "WORLD_V2_POLICY_CURRENT_STATE_READBACK_V1" ||
    e.original_run !== "37031019041" ||
    e.original_status !== "UNKNOWN_STOP_NO_RETRY" ||
    e.original_receipt_sha256 !== ORIGINAL_UNKNOWN_SHA256 ||
    !Number.isInteger(e.new_policy_count) ||
    e.new_policy_count < 0 ||
    e.new_policy_count > 4 ||
    !Number.isInteger(e.ledger_count) ||
    e.ledger_count < 0 ||
    e.ledger_count > 23 ||
    !hex(e.new_policy_definitions_sha256) ||
    !hex(e.current_old_permission_summary_sha256) ||
    !hex(e.current_ledger_sha256) ||
    !hex(e.world_roles_sha256) ||
    !hex(e.source_state_sha256) ||
    !e.current_acl ||
    canonicalOid(e.current_acl.schema_owner_oid) === null ||
    !hex(e.current_acl.schema_acl_sha256) ||
    !hex(e.current_acl.columns_sha256) ||
    !hex(e.current_acl.complete_current_metadata_sha256) ||
    !Number.isInteger(e.current_acl.column_count) ||
    e.current_acl.column_count < 1 ||
    !Array.isArray(e.current_acl.relations) ||
    e.current_acl.relations.length !== 2 ||
    !same(
      e.current_acl.relations.map((r) => r.name),
      ["buckets", "objects"],
    ) ||
    e.current_acl.relations.some(
      (r) =>
        canonicalOid(r.owner_oid) === null ||
        typeof r.rls !== "boolean" ||
        typeof r.force_rls !== "boolean" ||
        !hex(r.acl_sha256),
    ) ||
    !Number.isInteger(e.current_old_bucket_rows?.count) ||
    e.current_old_bucket_rows.count < 0 ||
    e.current_old_bucket_rows.count > 101 ||
    !hex(e.current_old_bucket_rows.sha256) ||
    !e.current_new_scope_rows ||
    !["buckets", "objects"].every(
      (k) =>
        Number.isInteger(e.current_new_scope_rows[k]) &&
        e.current_new_scope_rows[k] >= 0,
    )
  )
    fail("SNAPSHOT_POLICY_READBACK_EVIDENCE_INVALID");
  const guards = {
    historical_permission_summary: same(
      e.historical_permission_summary,
      historical,
    ),
    historical_ledger21: same(e.historical_ledger21, release.beforeLedger),
    no_login_no_inherit: same(e.world_roles, roles),
    source_inactive: same(e.source_state, source),
    empty_new_scope: same(e.current_new_scope_rows, { buckets: 0, objects: 0 }),
    old_bucket_bound: e.current_old_bucket_rows.count <= 100,
  };
  const common = Object.values(guards).every((v) => v === true);
  const present =
    common &&
    e.new_policy_count === 2 &&
    same(e.new_policy_definitions, expectedNewPolicies()) &&
    e.ledger_count === 22 &&
    same(e.ledger22, [release.afterLedger.at(-1)]);
  const absent =
    common &&
    e.new_policy_count === 0 &&
    same(e.new_policy_definitions, []) &&
    e.ledger_count === 21 &&
    same(e.ledger22, []);
  if (present) {
    // Opaque historical expressions are not reconstructed as permission.
    // Matching frozen command/role summaries plus the exact new restrictive
    // veto are enough for the existing conservative boundary checker.
    const nullHash = hash("null");
    verifyStorageWriteBoundary({
      ...historical,
      policies: [
        ...historical.policies.map((p, i) => ({
          ...p,
          name: `opaque_historical_${i}`,
          qual: p.qual_sha256 === nullHash ? null : "OPAQUE",
          check: p.check_sha256 === nullHash ? null : "OPAQUE",
        })),
        ...expectedNewPolicies().map((p) => ({
          ...p,
          applies_to: ["anon", "authenticated"],
        })),
      ],
    });
  }
  return {
    status:
      present || absent
        ? "CURRENT_STATE_RECOVERED"
        : "CURRENT_STATE_CONFLICT_STOP",
    current_state: present
      ? "EXACT_VETO_AND_LEDGER22_PRESENT"
      : absent
        ? "VETO_AND_LEDGER22_ABSENT"
        : "CONFLICT_OR_DRIFT",
    original_run: "37031019041",
    original_run_status: "UNKNOWN_STOP_NO_RETRY",
    original_receipt_sha256: ORIGINAL_UNKNOWN_SHA256,
    original_release_success: "NOT_CLAIMED",
    historical_full_acl_and_bucket_preservation:
      "NOT_EVIDENCED_BY_CURRENT_READBACK",
    world_source_commit: POLICY_SOURCE_COMMIT,
    world_migration_tree: POLICY_SOURCE_TREE,
    migration_sha256: POLICY_SQL_SHA256,
    guards,
    new_policy_definitions: e.new_policy_definitions,
    ledger22: e.ledger22,
    historical_ledger21_matches: guards.historical_ledger21,
    current_acl: e.current_acl,
    current_old_bucket_rows: e.current_old_bucket_rows,
    current_new_scope_rows: e.current_new_scope_rows,
    current_ledger_sha256: e.current_ledger_sha256,
    current_old_permission_summary_sha256:
      e.current_old_permission_summary_sha256,
    current_new_policy_definitions_sha256: e.new_policy_definitions_sha256,
    ordinary_storage_write_boundary: present
      ? "SNAPSHOT_DIRECT_STORAGE_WRITE_DENIED"
      : "NOT_VERIFIED",
    database_mutation: "NOT_RUN",
    ddl_replay: "NOT_RUN",
    key_acquisition: "NOT_RUN",
    snapshot_transport: "HOLD_NOT_RUN",
    deployment: "NOT_RUN",
    login_change: "NOT_RUN",
    economic_activation: false,
  };
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "fingerprint")
    process.stdout.write((await policyReadbackFingerprint()) + "\n");
  else if (command === "guard")
    await verifyPolicyReadbackLock(
      process.env.WORLD_V2_SNAPSHOT_POLICY_READBACK_LOCK,
      process.env.WORLD_V2_SNAPSHOT_POLICY_CONFIRMATION,
    );
  else if (command === "render") {
    if (
      hash(await readFile(path.join(ROOT, UNKNOWN_FILE))) !==
        ORIGINAL_UNKNOWN_SHA256 ||
      original.status !== "UNKNOWN_STOP_NO_RETRY"
    )
      fail("SNAPSHOT_POLICY_READBACK_ORIGINAL_CHANGED");
    const release = await verifiedPolicySource(args[0]);
    await writeFile(
      args[1],
      JSON.stringify({
        query: buildPolicyReadbackQuery(release),
        read_only: true,
      }),
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      args[2],
      JSON.stringify({
        beforeLedger: release.beforeLedger,
        afterLedger: release.afterLedger,
      }),
      { flag: "wx", mode: 0o600 },
    );
  } else if (command === "verify") {
    const raw = await readFile(args[0]),
      release = JSON.parse(await readFile(args[1], "utf8"));
    const result = verifyPolicyReadback(JSON.parse(raw), release);
    await writeFile(
      args[2],
      JSON.stringify(
        {
          ...result,
          main_site_commit: process.env.GITHUB_SHA ?? "NOT_RUN",
          github_run_id: process.env.GITHUB_RUN_ID ?? "NOT_RUN",
          readback_fingerprint: await policyReadbackFingerprint(),
          response_sha256: hash(raw),
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    if (result.status !== "CURRENT_STATE_RECOVERED") process.exitCode = 1;
  } else if (command === "unknown") {
    await writeFile(
      args[0],
      JSON.stringify(
        {
          status: "READBACK_UNKNOWN_STOP_NO_RETRY",
          original_run: "37031019041",
          original_run_status: "UNKNOWN_STOP_NO_RETRY",
          original_receipt_sha256: ORIGINAL_UNKNOWN_SHA256,
          main_site_commit: process.env.GITHUB_SHA ?? "NOT_RUN",
          github_run_id: process.env.GITHUB_RUN_ID ?? "NOT_RUN",
          readback_fingerprint: await policyReadbackFingerprint(),
          database_mutation: "NOT_RUN",
          ddl_replay: "NOT_RUN",
          snapshot_transport: "HOLD_NOT_RUN",
          economic_activation: false,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  } else fail("SNAPSHOT_POLICY_READBACK_ARGUMENTS_INVALID");
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
        : "SNAPSHOT_POLICY_READBACK_STEP_FAILED",
    );
    process.exitCode = 1;
  }
}
