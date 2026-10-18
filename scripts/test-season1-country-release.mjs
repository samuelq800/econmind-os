// Fresh disposable cluster after test-season1-reusable-team-names.sql, not the
// country-preferences fixture (which already installs the migration).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  publishCountryPreferences,
  MIGRATION,
} from "./publish-season1-country-preferences.mjs";
const port = process.env.COUNTRY_RELEASE_PG_PORT ?? "55495";
if (!/^\d{4,5}$/.test(port)) throw new Error("Invalid local test port");
const args = [
  "-X",
  "-qAt",
  "-h",
  "127.0.0.1",
  "-p",
  port,
  "-U",
  "postgres",
  "-d",
  "season1_test",
  "-v",
  "ON_ERROR_STOP=1",
];
const psql = (sql) =>
  execFileSync(
    process.env.COUNTRY_TEST_PSQL ??
      (process.platform === "darwin"
        ? "/opt/homebrew/opt/postgresql@16/bin/psql"
        : "psql"),
    [...args, "-c", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
assert.equal(psql("select current_database()"), "season1_test");
psql(
  "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);",
);
const options = {
  migration: readFileSync(MIGRATION, "utf8"),
  verification: readFileSync(
    "scripts/verify-season1-country-preferences.sql",
    "utf8",
  ),
  request: async (query, readOnly) =>
    readOnly
      ? JSON.parse(
          psql(
            `select coalesce(json_agg(e),'[]') from (${query.trim().replace(/;$/, "")}) e`,
          ),
        )
      : (psql(query), []),
};
assert.equal(await publishCountryPreferences(options), "published");
assert.equal(await publishCountryPreferences(options), "already-installed");
assert.equal(
  psql("select count(*) from public.world_preseason_country_preferences"),
  "0",
);
assert.equal(
  psql(
    "select count(*) from supabase_migrations.schema_migrations where version='20261018000000'",
  ),
  "1",
);
console.log(
  "PASS: exact publisher SQL, transaction, grants, triggers, row/function preservation, ledger, independent readback and installed no-replay",
);
