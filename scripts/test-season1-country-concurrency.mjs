// Run AFTER test-season1-country-preferences.sql against its disposable cluster.
import { spawn, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const psql =
  process.env.COUNTRY_TEST_PSQL ??
  (process.platform === "darwin"
    ? "/opt/homebrew/opt/postgresql@16/bin/psql"
    : "psql");
const port = process.env.COUNTRY_TEST_PG_PORT ?? "55494";
if (!/^\d{4,5}$/.test(port)) throw new Error("Invalid local test port");
const args = [
  "-X",
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
  "-At",
];
const query = (sql) =>
  execFileSync(psql, [...args, "-c", sql], { encoding: "utf8" }).trim();
assert.equal(query("select current_database()"), "season1_test");
const run = (sql) =>
  new Promise((resolve) => {
    const child = spawn(psql, [...args, "-c", sql]);
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    child.on("close", (code) => resolve({ code, output }));
  });
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const tx = (player, team) =>
  `set role authenticated; select set_config('request.jwt.claim.sub','${uid(player)}',false); select public.set_world_preseason_country_preference('${uid(team)}','20',null);`;
// The first client holds its claim uncommitted; the second attempts the same
// country concurrently. The unique index must serialize this across teams.
const first = run(`begin; ${tx(109, 1003)} select pg_sleep(2); commit;`);
await new Promise((resolve) => setTimeout(resolve, 300));
const second = run(tx(113, 1004));
const results = await Promise.all([first, second]);
assert.equal(
  results.filter((result) => result.code === 0).length,
  1,
  JSON.stringify(results),
);
assert.match(
  results.find((result) => result.code !== 0).output,
  /already been selected/,
);
assert.equal(
  query(
    "select count(*) from public.world_preseason_country_preferences where country_code='20' and released_at is null",
  ),
  "1",
);
console.log(
  "PASS: two concurrent authenticated captains, exactly one active claim",
);
