// Run only against a separately created disposable team_name_release_test DB.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  publishReusableTeamNames,
  MIGRATION,
} from "./publish-season1-reusable-team-names.mjs";

const host = process.env.PGHOST;
const database = process.env.PGDATABASE;
if (
  !["127.0.0.1", "localhost"].includes(host) ||
  database !== "team_name_release_test"
)
  throw new Error(
    "Disposable loopback team_name_release_test database required",
  );
const args = [
  "-X",
  "-qAt",
  "-v",
  "ON_ERROR_STOP=1",
  "-h",
  host,
  "-d",
  database,
];
const sql = (input) =>
  execFileSync("psql", args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const read = (query) =>
  JSON.parse(
    sql(
      `begin read only; select coalesce(json_agg(e), '[]'::json) from (\n${query.trim().replace(/;$/, "")}\n) e; commit;`,
    ),
  );
const migration = readFileSync(MIGRATION, "utf8");
const verification = readFileSync(
  "scripts/verify-season1-reusable-team-names.sql",
  "utf8",
);

sql(`
  create table public.world_preseason_teams (
    id integer primary key, season_id uuid not null, name text not null,
    status text not null default 'forming', unique(season_id, name)
  );
  insert into public.world_preseason_teams values
    (1, '11111111-1111-1111-1111-111111111111', 'Retained historical team', 'dissolved'),
    (2, '11111111-1111-1111-1111-111111111111', 'Current team', 'forming');
  create schema supabase_migrations;
  create table supabase_migrations.schema_migrations(version text primary key, name text, statements text[]);
  create function public.fail_test_ledger() returns trigger language plpgsql as $$
    begin raise exception 'Injected ledger failure'; end $$;
  create trigger test_ledger_failure before insert on supabase_migrations.schema_migrations
    for each row execute function public.fail_test_ledger();
`);
const before = read("select * from public.world_preseason_teams order by id");
let writeCount = 0;
const request = async (query, readOnly) => {
  if (readOnly) return read(query);
  writeCount++;
  sql(query);
  return [];
};
await assert.rejects(
  publishReusableTeamNames({ request, migration, verification }),
  /Injected ledger failure/,
);
assert.equal(writeCount, 1, "failed publication must not retry");
assert.deepEqual(
  read("select * from public.world_preseason_teams order by id"),
  before,
);
assert.equal(
  read(
    "select to_regclass('public.world_preseason_live_team_name_idx') is null as absent",
  )[0].absent,
  true,
);
assert.equal(
  read(
    "select exists(select 1 from pg_constraint where conrelid='public.world_preseason_teams'::regclass and conname='world_preseason_teams_season_id_name_key') as retained",
  )[0].retained,
  true,
);
assert.equal(
  read(
    "select count(*)::integer as count from supabase_migrations.schema_migrations",
  )[0].count,
  0,
);

// Explicit new test after resolving the injected failure, never an auto retry.
sql(
  "drop trigger test_ledger_failure on supabase_migrations.schema_migrations;",
);
assert.equal(
  await publishReusableTeamNames({ request, migration, verification }),
  "published",
);
assert.deepEqual(
  read("select * from public.world_preseason_teams order by id"),
  before,
);
assert.equal(
  await publishReusableTeamNames({ request, migration, verification }),
  "already-installed",
);
assert.equal(writeCount, 2, "installed release must remain read-only");
assert.equal(
  read(
    "select count(*)::integer as count from supabase_migrations.schema_migrations",
  )[0].count,
  1,
);

// Both requests reach PostgreSQL independently; exactly one must commit.
const { promisify } = await import("node:util");
const { execFile } = await import("node:child_process");
const execute = promisify(execFile);
const contenders = await Promise.allSettled(
  [3, 4].map((id) =>
    execute("psql", [
      ...args,
      "-c",
      `insert into public.world_preseason_teams values (${id}, '11111111-1111-1111-1111-111111111111', 'Retained historical team', 'forming');`,
    ]),
  ),
);
assert.equal(
  contenders.filter((result) => result.status === "fulfilled").length,
  1,
);
const rejected = contenders.find((result) => result.status === "rejected");
assert.match(rejected.reason.stderr, /world_preseason_live_team_name_idx/);
assert.equal(
  read(
    "select count(*)::integer as count from public.world_preseason_teams where name='Retained historical team' and status<>'dissolved'",
  )[0].count,
  1,
);
console.log(
  "PASS: actual publisher transaction, DDL/data/ledger rollback, ledger provenance, read-only replay and concurrent name uniqueness",
);
