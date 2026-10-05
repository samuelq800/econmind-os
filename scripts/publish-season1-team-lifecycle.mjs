import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const migrationPath =
  "supabase/migrations/20261005010000_season1_team_lifecycle.sql";
const verificationPath = "scripts/verify-season1-team-lifecycle.sql";
const installationQuery =
  "select to_regprocedure('public.world_preseason_dissolve_team(uuid)') is not null as installed";

/** Publish only this reviewed migration; never push the other pending migrations. */
export async function publishSeason1TeamLifecycle({
  request,
  migration,
  verification,
}) {
  if (!/^begin;\s*$/m.test(migration) || !/commit;\s*$/.test(migration)) {
    throw new Error(
      "Season 1 lifecycle migration must have an explicit transaction",
    );
  }
  const rows = await request(installationQuery, true);
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    typeof rows[0]?.installed !== "boolean"
  ) {
    throw new Error(
      "Season 1 lifecycle installation check returned an invalid result",
    );
  }
  if (rows[0].installed) {
    await request(verification, false);
    return "already-installed";
  }
  // Permission/schema verification must succeed in the same transaction.
  await request(
    migration.replace(/commit;\s*$/, `${verification}\ncommit;`),
    false,
  );
  return "published";
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const project = process.env.SUPABASE_PROJECT_REF;
  if (!token || project !== "vimksjrhaxdpnkvgsavz") {
    throw new Error(
      "The approved Supabase production project configuration is required",
    );
  }
  const migration = readFileSync(migrationPath, "utf8");
  const verification = readFileSync(verificationPath, "utf8");
  const result = await publishSeason1TeamLifecycle({
    migration,
    verification,
    request: async (query, readOnly) => {
      const response = await fetch(
        `https://api.supabase.com/v1/projects/${project}/database/query${readOnly ? "/read-only" : ""}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(60_000),
        },
      );
      // No write retries, tokens, query results or member information in logs.
      if (!response.ok)
        throw new Error(
          `Season 1 lifecycle database request failed (HTTP ${response.status})`,
        );
      return response.json();
    },
  });
  console.log(
    `Season 1 team lifecycle: ${result}; migration SHA-256 ${createHash("sha256").update(migration).digest("hex")}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
