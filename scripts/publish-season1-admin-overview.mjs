import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PROJECT = "vimksjrhaxdpnkvgsavz";
export const VERSION = "20261011000000";
export const MIGRATION = `supabase/migrations/${VERSION}_season1_admin_overview.sql`;

export async function publishAdminOverview({
  request,
  migration,
  verification,
}) {
  if (!/^begin;\s*$/m.test(migration) || !/commit;\s*$/.test(migration))
    throw new Error("Explicit migration transaction required");
  const rows = await request(
    `select exists(select 1 from supabase_migrations.schema_migrations where version='${VERSION}') as installed`,
    true,
  );
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    typeof rows[0]?.installed !== "boolean"
  )
    throw new Error("Invalid installation metadata");
  if (rows[0].installed) {
    await request(verification, false);
    return "already-installed";
  }
  const ledger = `insert into supabase_migrations.schema_migrations(version,name,statements) values ('${VERSION}','season1_admin_overview',array['${migration.replaceAll("'", "''")}']);`;
  // No write retries. Definition, grants, publication and ledger commit together.
  await request(
    migration.replace(/commit;\s*$/, `${verification}\n${ledger}\ncommit;`),
    false,
  );
  return "published";
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || process.env.SUPABASE_PROJECT_REF !== PROJECT)
    throw new Error("Approved production project required");
  const migration = readFileSync(MIGRATION, "utf8");
  const verification = readFileSync(
    "scripts/verify-season1-admin-overview.sql",
    "utf8",
  );
  const result = await publishAdminOverview({
    migration,
    verification,
    request: async (query, readOnly) => {
      const response = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT}/database/query${readOnly ? "/read-only" : ""}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(60000),
        },
      );
      if (!response.ok)
        throw new Error(
          `Scoped overview deployment failed (HTTP ${response.status}); provider body omitted`,
        );
      return response.json();
    },
  });
  console.log(
    JSON.stringify({
      project: PROJECT,
      result,
      migrationSha256: createHash("sha256").update(migration).digest("hex"),
      readOnlyAdminProjection: true,
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
