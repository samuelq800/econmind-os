import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import baseline from "../docs/evidence/world-v2-storage-preflight-37021759785.json" with { type: "json" };
import {
  buildPolicyApplyQuery,
  policyObservationSql,
  summarizePolicyPermission,
  verifiedPolicySource,
  POLICY_SOURCE_COMMIT,
  POLICY_SOURCE_TREE,
  POLICY_SQL_SHA256,
} from "./world-v2-snapshot-storage-policy-release.mjs";
import { verifyStorageWriteBoundary } from "./world-v2-source-snapshot-transport.mjs";
import { buildPolicyReadbackQuery } from "./world-v2-snapshot-storage-policy-readback.mjs";

const quote = (v) => `'${v.replaceAll("'", "''")}'`;
const jsonSql = (v) => `${quote(JSON.stringify(v))}::jsonb`;
const historicalSummary = {
  bucket: baseline.bucket,
  roles: baseline.roles,
  relations: baseline.relations,
  policies: baseline.policies,
};
const reset = `drop schema if exists world_v2 cascade; drop schema if exists storage cascade;
drop role if exists world_v2_api_login; drop role if exists world_v2_api_reader;
drop role if exists anon; drop role if exists authenticated;`;
const storageFixture = `create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
create schema storage; grant usage on schema storage to public;
create table storage.buckets(id text primary key,public boolean not null);
create table storage.objects(bucket_id text,name text,content text,primary key(bucket_id,name));
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.buckets,storage.objects to public;
create policy old_a_delete on storage.objects for delete to authenticated using(true);
create policy old_b_select on storage.objects for select to anon,authenticated using(true);
create policy old_c_insert on storage.objects for insert to authenticated with check(true);
insert into storage.buckets values('old-avatar-fixture',true);
insert into storage.objects values('old-avatar-fixture','original.json','old');`;

// This adapter is TEST ONLY: opaque production policy expressions were deliberately
// never persisted. The production renderer has no arbitrary-baseline parameter.
function fixtureQuery(release, observation) {
  const sql = buildPolicyApplyQuery(release);
  const marker = jsonSql(historicalSummary);
  assert.equal(
    sql.split(marker).length,
    2,
    "exactly one fixed production baseline",
  );
  return sql.replace(
    marker,
    jsonSql(summarizePolicyPermission(observation.permissions)),
  );
}
function readbackFixtureQuery(release, observation) {
  const query = buildPolicyReadbackQuery(release),
    marker = jsonSql(historicalSummary);
  assert.equal(
    query.split(marker).length,
    2,
    "one fixed readback historical baseline",
  );
  return query.replace(
    marker,
    jsonSql(summarizePolicyPermission(observation.permissions)),
  );
}
async function cliFixture(before, release) {
  // Test-only copied CLI: only the opaque historical JSON baseline import and
  // module-path resolution change. Production has NO baseline override option.
  // Actual PostgreSQL JSON, the entire actual verifier and its CLI run unchanged.
  const fixtureRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "world-policy-cli-fixture-")),
  );
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const expectedFile = path.join(fixtureRoot, "expected.json");
  await writeFile(
    expectedFile,
    JSON.stringify({
      beforeLedger: release.beforeLedger,
      afterLedger: release.afterLedger,
    }),
    { flag: "wx", mode: 0o600 },
  );
  const scripts = {};
  for (const [kind, name] of [
    ["publish", "world-v2-snapshot-storage-policy-release.mjs"],
    ["readback", "world-v2-snapshot-storage-policy-readback.mjs"],
  ]) {
    const moduleUrl = new URL(name, import.meta.url);
    const originalCode = await readFile(moduleUrl, "utf8");
    const baselineMarker =
      '"../docs/evidence/world-v2-storage-preflight-37021759785.json"';
    const rootMarker =
      'const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");';
    assert.equal(originalCode.split(baselineMarker).length, 2);
    assert.equal(originalCode.split(rootMarker).length, 2);
    const data =
      "data:application/json;base64," +
      Buffer.from(
        JSON.stringify(summarizePolicyPermission(before.permissions)),
      ).toString("base64");
    const code = originalCode
      .replace(baselineMarker, JSON.stringify(data))
      .replace(rootMarker, `const ROOT = ${JSON.stringify(repoRoot)};`)
      .replace(
        /from "(\.{1,2}\/[^"]+)"/gu,
        (_match, relative) =>
          `from ${JSON.stringify(new URL(relative, moduleUrl).href)}`,
      );
    scripts[kind] = path.join(fixtureRoot, name);
    await writeFile(scripts[kind], code, { flag: "wx", mode: 0o600 });
  }
  let counter = 0;
  return async (kind, response, expectedStatus, errorCode) => {
    counter += 1;
    const input = path.join(fixtureRoot, `response-${counter}.json`),
      output = path.join(fixtureRoot, `result-${counter}.json`);
    await writeFile(input, JSON.stringify(response), {
      flag: "wx",
      mode: 0o600,
    });
    let failure;
    try {
      execFileSync(
        process.execPath,
        [scripts[kind], "verify", input, expectedFile, output],
        { env: { PATH: process.env.PATH }, stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      failure = error;
    }
    if (errorCode) {
      assert.ok(failure);
      assert.ok(String(failure.stderr).includes(errorCode));
      return;
    }
    const result = JSON.parse(await readFile(output, "utf8"));
    assert.equal(result.status, expectedStatus);
    if (expectedStatus === "CURRENT_STATE_CONFLICT_STOP") assert.ok(failure);
    else assert.equal(failure, undefined);
    if (kind === "readback") {
      assert.equal(result.original_run_status, "UNKNOWN_STOP_NO_RETRY");
      assert.equal(result.original_release_success, "NOT_CLAIMED");
      assert.equal(
        result.historical_full_acl_and_bucket_preservation,
        "NOT_EVIDENCED_BY_CURRENT_READBACK",
      );
    }
    return result;
  };
}

export async function exercisePolicyProtocol(database, worldRoot) {
  const release = await verifiedPolicySource(worldRoot);
  const manifest = JSON.parse(
    await readFile(
      path.join(worldRoot, "database/migrations/manifest.json"),
      "utf8",
    ),
  );
  const artifacts = await Promise.all(
    manifest.migrations
      .slice(0, 21)
      .map((m) => readFile(path.join(worldRoot, m.path), "utf8")),
  );
  const observe = async () =>
    (await database.query(policyObservationSql())).rows[0].observation;
  async function fresh() {
    await database.exec(reset);
    await database.exec(storageFixture);
    for (const [i, sql] of artifacts.entries()) {
      await database.exec(sql);
      const m = release.beforeLedger[i];
      await database.exec(
        `insert into world_v2.schema_release(migration_id,artifact_sha256,source_repo_commit,release_order) values(${quote(m.migration_id)},${quote(m.artifact_sha256)},${quote(m.source_repo_commit)},${m.release_order})`,
      );
    }
    await database.exec(`insert into world_v2.country_candidate_bundle(bundle_id,source_thread_id,package_manifest_sha256,source_status)
      values('BALANCED_2026_09_28_V1','DISPOSABLE_FIXTURE','88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315','IMPLEMENTED_UNVERIFIED_CANDIDATE')`);
    return observe();
  }
  async function rejected(sql, code) {
    let error;
    try {
      await database.query(sql);
    } catch (e) {
      error = e;
    }
    assert.ok(error, "must reject and roll back");
    assert.ok(String(error.message).includes(code), `expected ${code}`);
    await database.exec("rollback");
  }
  assert.throws(
    () =>
      buildPolicyApplyQuery({ ...release, sql: release.sql + "\nselect 1;" }),
    /RENDER_INTENT_INVALID/,
  );
  assert.throws(
    () =>
      buildPolicyApplyQuery({
        ...release,
        migration: { ...release.migration, sha256: "0".repeat(64) },
      }),
    /RENDER_INTENT_INVALID/,
  );
  const results = [];
  for (const [name, mutation, code] of [
    [
      "stale_rls",
      "alter table storage.objects disable row level security",
      "STALE_PERMISSION_BASELINE",
    ],
    [
      "stale_grants",
      "revoke insert on storage.objects from public",
      "STALE_PERMISSION_BASELINE",
    ],
    [
      "stale_bypass",
      "alter role authenticated bypassrls",
      "STALE_PERMISSION_BASELINE",
    ],
    [
      "stale_ledger",
      "insert into world_v2.schema_release values('unexpected','x','x',23,now())",
      "LEDGER_BASELINE_INVALID",
    ],
    [
      "scope_collision",
      "insert into storage.buckets values('world-v2-official-source-v1',true)",
      "SCOPE_ROWS_CONFLICT",
    ],
    [
      "bounded_old_bucket_overflow",
      "insert into storage.buckets select 'bounded-old-'||i,true from generate_series(1,101) i",
      "SCOPE_ROWS_CONFLICT",
    ],
    [
      "login_conflict",
      "alter role world_v2_api_login login",
      "NOLOGIN_REQUIRED",
    ],
  ]) {
    const before = await fresh();
    const query = fixtureQuery(release, before);
    await database.exec(mutation);
    const changed = await observe();
    await rejected(query, code);
    assert.deepEqual(
      await observe(),
      changed,
      "failed request must not mutate drifted state",
    );
    results.push(name);
  }
  await fresh();
  await database.exec(
    "create policy world_v2_snapshot_objects_insert_deny on storage.objects for insert to authenticated with check(true)",
  );
  const collision = await observe();
  await rejected(fixtureQuery(release, collision), "NAME_COLLISION");
  assert.deepEqual(await observe(), collision);
  results.push("policy_name_collision");

  for (const [name, mutation, code] of [
    [
      "after_old_bucket_drift",
      "update storage.buckets set public=false where id='old-avatar-fixture';",
      "PROTECTED_PROPERTY_CHANGED",
    ],
    [
      "after_acl_drift",
      "revoke delete on storage.objects from public;",
      "PROTECTED_PROPERTY_CHANGED",
    ],
    [
      "after_column_acl_drift",
      "grant insert(content) on storage.objects to anon;",
      "PROTECTED_PROPERTY_CHANGED",
    ],
    [
      "after_old_policy_drift",
      "alter policy old_a_delete on storage.objects using(false);",
      "EXACT_POLICY_DELTA_INVALID",
    ],
    [
      "after_role_drift",
      "alter role world_v2_api_login login;",
      "PROTECTED_PROPERTY_CHANGED",
    ],
    [
      "after_policy_drift",
      "alter policy world_v2_snapshot_objects_insert_deny on storage.objects with check(true);",
      "EXACT_POLICY_DELTA_INVALID",
    ],
  ]) {
    const before = await fresh();
    const query = fixtureQuery(release, before).replace(
      "create temporary table snapshot_veto_after",
      `${mutation}\ncreate temporary table snapshot_veto_after`,
    );
    await rejected(query, code);
    assert.deepEqual(
      await observe(),
      before,
      "aftercheck must roll back policies, ledger and injected drift together",
    );
    results.push(name);
  }
  const before = await fresh();
  const cli = await cliFixture(before, release);
  const readBefore = await database.query(
    `begin read only;${readbackFixtureQuery(release, before)}commit;`,
  );
  const absent = await cli(
    "readback",
    readBefore.rows,
    "CURRENT_STATE_RECOVERED",
  );
  assert.equal(absent.current_state, "VETO_AND_LEDGER22_ABSENT");
  assert.deepEqual(
    await observe(),
    before,
    "pure SELECT must not change anything",
  );
  const query = fixtureQuery(release, before);
  const response = await database.query(query);
  const evidence = response.rows[0].evidence;
  assert.equal(
    typeof evidence.before.protected_storage_metadata.schema.owner,
    "string",
  );
  assert.equal(
    Number.isInteger(evidence.before.protected_storage_metadata.schema.owner),
    false,
    "actual87 rejects valid PG OID JSON",
  );
  await cli(
    "publish",
    response.rows,
    "WORLD_V2_SNAPSHOT_STORAGE_POLICY_RELEASE_VERIFIED",
  );
  for (const mutate of [
    (e) => {
      e.after.protected_storage_metadata.schema.owner = "01";
    },
    (e) => {
      e.after.protected_storage_metadata.relations[0].owner = "4294967296";
    },
    (e) => {
      e.after.protected_storage_metadata.columns[0].type = "-1";
    },
    (e) => {
      delete e.after.protected_storage_metadata.columns[0].acl;
    },
  ]) {
    const bad = structuredClone(response.rows);
    mutate(bad[0].evidence);
    await cli(
      "publish",
      bad,
      undefined,
      "SNAPSHOT_POLICY_PUBLICATION_EVIDENCE_INVALID",
    );
  }
  for (const [mutate, code] of [
    [
      (e) => {
        e.after.old_bucket_rows.sha256 = "0".repeat(64);
      },
      "SNAPSHOT_POLICY_PROTECTED_PROPERTY_CHANGED",
    ],
    [
      (e) => {
        e.after.protected_storage_metadata.schema.acl = [];
      },
      "SNAPSHOT_POLICY_PROTECTED_PROPERTY_CHANGED",
    ],
    [
      (e) => {
        e.after.ledger[21].source_repo_commit = "0".repeat(40);
      },
      "SNAPSHOT_POLICY_PUBLICATION_DELTA_INVALID",
    ],
  ]) {
    const bad = structuredClone(response.rows);
    mutate(bad[0].evidence);
    await cli("publish", bad, undefined, code);
  }
  const readAfter = await database.query(
    `begin read only;${readbackFixtureQuery(release, before)}commit;`,
  );
  const present = await cli(
    "readback",
    readAfter.rows,
    "CURRENT_STATE_RECOVERED",
  );
  assert.equal(present.current_state, "EXACT_VETO_AND_LEDGER22_PRESENT");
  await database.exec(
    "alter policy world_v2_snapshot_objects_insert_deny on storage.objects with check(true)",
  );
  const realPolicyDrift = await database.query(
    `begin read only;${readbackFixtureQuery(release, before)}commit;`,
  );
  assert.equal(
    realPolicyDrift.rows[0].evidence.new_policy_definitions,
    null,
    "unexpected expressions must never leave the server",
  );
  await cli("readback", realPolicyDrift.rows, "CURRENT_STATE_CONFLICT_STOP");
  await database.exec(
    "alter policy world_v2_snapshot_objects_insert_deny on storage.objects with check(bucket_id is distinct from 'world-v2-official-source-v1')",
  );
  for (const mutate of [
    (e) => {
      e.new_policy_definitions = null;
    },
    (e) => {
      e.historical_ledger21 = null;
    },
    (e) => {
      e.ledger22 = null;
    },
    (e) => {
      e.historical_permission_summary = null;
    },
    (e) => {
      e.world_roles = null;
    },
    (e) => {
      e.source_state = null;
    },
    (e) => {
      e.current_new_scope_rows.objects = 1;
    },
  ]) {
    const bad = structuredClone(readAfter.rows);
    mutate(bad[0].evidence);
    await cli("readback", bad, "CURRENT_STATE_CONFLICT_STOP");
  }
  const badOid = structuredClone(readAfter.rows);
  badOid[0].evidence.current_acl.schema_owner_oid = "4294967296";
  await cli(
    "readback",
    badOid,
    undefined,
    "SNAPSHOT_POLICY_READBACK_EVIDENCE_INVALID",
  );
  results.push(
    "full_pg_json_cli_publication_positive",
    "full_cli_oid_and_missing_field_4_negative",
    "full_cli_old_property_and_ledger_3_negative",
    "read_only_absent_and_present_cli_2_positive",
    "readback_drift_7_negative",
    "readback_oid_negative",
    "readback_real_sql_policy_drift_negative_no_expression_dump",
  );
  assert.equal(evidence.status, "SNAPSHOT_POLICY_ATOMIC_SCOPE_VERIFIED");
  const after = await observe();
  assert.deepEqual(after.ledger, release.afterLedger);
  assert.equal(
    after.policy_definitions.length,
    before.policy_definitions.length + 2,
  );
  for (const key of [
    "protected_storage_metadata",
    "old_bucket_rows",
    "world_roles",
    "source_state",
    "new_scope_rows",
  ])
    assert.deepEqual(after[key], before[key]);
  verifyStorageWriteBoundary(after.permissions);
  await rejected(query, "STALE_PERMISSION_BASELINE");
  assert.deepEqual(
    await observe(),
    after,
    "second request cannot overwrite a completed release",
  );
  await database.exec(`insert into storage.buckets values('world-v2-official-source-v1',true);
    insert into storage.objects values('world-v2-official-source-v1','frozen.json','immutable');
    create function public.disposable_check_snapshot_denials() returns void language plpgsql as $$
    declare affected integer;
    begin
      begin insert into storage.objects values('world-v2-official-source-v1','new.json','x');
        raise exception 'World INSERT unexpectedly allowed'; exception when insufficient_privilege then null; end;
      begin insert into storage.objects values('world-v2-official-source-v1','frozen.json','changed')
        on conflict(bucket_id,name) do update set content=excluded.content;
        raise exception 'World UPSERT unexpectedly allowed'; exception when insufficient_privilege then null; end;
      update storage.objects set content='changed' where bucket_id='world-v2-official-source-v1';
      get diagnostics affected=row_count; if affected<>0 then raise exception 'World UPDATE allowed'; end if;
      update storage.objects set bucket_id='old-avatar-fixture' where bucket_id='world-v2-official-source-v1';
      get diagnostics affected=row_count; if affected<>0 then raise exception 'World MOVE allowed'; end if;
      delete from storage.objects where bucket_id='world-v2-official-source-v1';
      get diagnostics affected=row_count; if affected<>0 then raise exception 'World DELETE allowed'; end if;
      begin insert into storage.buckets values('forbidden-new-bucket',true);
        raise exception 'bucket INSERT allowed'; exception when insufficient_privilege then null; end;
      if current_user='authenticated' then
        insert into storage.objects values('old-avatar-fixture','retained-write','old');
        delete from storage.objects where bucket_id='old-avatar-fixture' and name='retained-write';
        get diagnostics affected=row_count; if affected<>1 then raise exception 'old DELETE downgraded'; end if;
      end if;
      if (select count(*) from storage.objects where bucket_id='old-avatar-fixture')<>1 then raise exception 'old SELECT downgraded'; end if;
    end $$;
    set role anon; select public.disposable_check_snapshot_denials(); reset role;
    set role authenticated; select public.disposable_check_snapshot_denials(); reset role;
    drop function public.disposable_check_snapshot_denials();`);
  const final = await observe();
  assert.deepEqual(final.old_bucket_rows, before.old_bucket_rows);
  assert.equal(
    (
      await database.query(
        "select content from storage.objects where bucket_id='world-v2-official-source-v1'",
      )
    ).rows[0].content,
    "immutable",
  );
  results.push(
    "atomic_success_exact_two_policies",
    "repeat_refused",
    "ordinary_roles_denied_old_scope_preserved",
  );
  return {
    status: "PASS",
    productionAccess: false,
    results,
    database: database.target ?? "INJECTED_DISPOSABLE_ENGINE",
    world_source_commit: POLICY_SOURCE_COMMIT,
    world_migration_tree: POLICY_SOURCE_TREE,
    migration_sha256: POLICY_SQL_SHA256,
    main_site_commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim(),
    github_run_id: process.env.GITHUB_RUN_ID ?? "NOT_RUN",
  };
}

function nativeDatabase() {
  // No URL / environment-controlled host, port, database, user or service file.
  // Reset is permitted only in this fixed disposable PG17 fixture database.
  if (process.env.DISPOSABLE_SNAPSHOT_POLICY_TEST !== "PG17_LOOPBACK")
    throw new Error("DISPOSABLE_DATABASE_NOT_APPROVED");
  const env = {
    PATH: process.env.PATH,
    PGPASSWORD: "disposable-test-only",
    PGCONNECT_TIMEOUT: "5",
  };
  function execute(sql) {
    return execFileSync(
      "psql",
      [
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-h",
        "127.0.0.1",
        "-p",
        "5432",
        "-U",
        "postgres",
        "-d",
        "world_snapshot_policy_test",
      ],
      {
        input: sql,
        encoding: "utf8",
        env,
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 2 * 1024 * 1024,
      },
    );
  }
  assert.equal(
    execute(
      "select current_database()||':'||(current_setting('server_version_num')::integer/10000)::text",
    ).trim(),
    "world_snapshot_policy_test:17",
  );
  return {
    target: "PG17_LOOPBACK:world_snapshot_policy_test",
    exec: async (sql) => {
      execute(sql);
    },
    query: async (sql) => {
      const text = execute(sql).trim();
      if (!text) return { rows: [] };
      // The atomic protocol has one evidence SELECT before COMMIT. psql's
      // quiet/tuples-only output excludes the empty COMMIT result.
      if (sql === policyObservationSql())
        return { rows: [{ observation: JSON.parse(text) }] };
      if (
        sql.includes("as evidence;") ||
        sql.includes("as evidence from checked;")
      )
        return { rows: [{ evidence: JSON.parse(text) }] };
      if (sql.startsWith("select content"))
        return { rows: [{ content: text }] };
      throw new Error("DISPOSABLE_QUERY_SHAPE_UNEXPECTED");
    },
  };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    const result =
      JSON.stringify(
        await exercisePolicyProtocol(nativeDatabase(), process.argv[2]),
        null,
        2,
      ) + "\n";
    if (process.argv[3])
      await writeFile(process.argv[3], result, { flag: "wx", mode: 0o600 });
    console.log(result);
  } catch (error) {
    // Native adapter accepts only the fixed fixture connection and synthetic
    // fixture contents, never production environment credentials or records.
    console.error(
      "DISPOSABLE_SNAPSHOT_POLICY_TEST_FAILED",
      String(error.message).slice(0, 1000),
    );
    process.exitCode = 1;
  }
}
