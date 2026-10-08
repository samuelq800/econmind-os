import { spawn } from "node:child_process";
import assert from "node:assert/strict";

if (
  !["localhost", "127.0.0.1"].includes(process.env.PGHOST) ||
  !["stable_codes_test", "postgres"].includes(process.env.PGDATABASE)
)
  throw new Error("Disposable local PostgreSQL only");
const subject = "1".repeat(64),
  peer = "2".repeat(64);
function sql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PSQL_PATH ?? "psql",
      ["-qAt", "-v", "ON_ERROR_STOP=1", "-c", query],
      { env: process.env },
    );
    let output = "",
      error = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (error += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error)),
    );
  });
}
const sends = await Promise.all(
  [0, 1].map((i) =>
    sql(
      `select public.stable_email_code_send('${subject}','signup','${String(i).repeat(40)}','${"h".repeat(40)}')->>'status';`,
    ),
  ),
);
assert.deepEqual(sends.sort(), ["limited", "ready"]);
const claims = await Promise.all(
  [0, 1].map(() =>
    sql(`select public.stable_email_code_claim('${subject}','${peer}');`),
  ),
);
const rows = claims.map(JSON.parse);
assert.deepEqual(rows.map((r) => r.status).sort(), ["busy", "ready"]);
const lease = rows.find((r) => r.status === "ready").lease;
assert.match(lease, /^[a-f0-9-]{36}$/);
assert.equal(
  await sql(
    `select public.stable_email_code_finish('${subject}','${lease}',true);`,
  ),
  "t",
);
assert.equal(
  await sql(
    `select public.stable_email_code_claim('${subject}','${peer}')->>'status';`,
  ),
  "invalid",
);
console.log(
  JSON.stringify({
    concurrentSend: ["ready", "limited"],
    concurrentVerify: ["ready", "busy"],
    consumedOnce: true,
  }),
);
