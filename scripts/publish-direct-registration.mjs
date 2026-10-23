import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
export const PROJECT = "vimksjrhaxdpnkvgsavz";
export const VERSION = "20261023000000";
export async function publishDirectRegistration({
  request,
  migration,
  verification,
  checkOnly = false,
}) {
  const hash = createHash("sha256").update(migration).digest("hex");
  const before = await request(
    `select exists(select 1 from supabase_migrations.schema_migrations where version='${VERSION}') as installed, exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='direct_registration_limits') as table_exists`,
    true,
  );
  if (typeof before?.[0]?.installed !== "boolean")
    throw Error("Invalid migration metadata");
  if (!before[0].installed) {
    if (checkOnly || before[0].table_exists)
      throw Error("Uninstalled or untracked registration backend");
    if (!/^begin;$/m.test(migration) || !/commit;\s*$/.test(migration))
      throw Error("Atomic migration required");
    const ledger = `insert into supabase_migrations.schema_migrations(version,name,statements) values('${VERSION}','direct_registration_policy_receipts',array['${migration.replaceAll("'", "''")}']);`;
    const assertion = `do $verify$ begin if not (select verified from (${verification.trim().replace(/;$/, "")}) v) then raise exception 'Registration readback failed'; end if; end $verify$;`;
    await request(
      migration
        .replace(
          /^begin;$/m,
          "begin;\nselect pg_advisory_xact_lock(20261023,0);",
        )
        .replace(/commit;\s*$/, () => `${assertion}\n${ledger}\ncommit;`),
      false,
    );
  }
  const ledger = await request(
    `select encode(sha256(convert_to(statements[1],'UTF8')),'hex') as migration_sha256 from supabase_migrations.schema_migrations where version='${VERSION}'`,
    true,
  );
  if (
    ledger?.[0]?.migration_sha256 !== hash ||
    (await request(verification, true))?.[0]?.verified !== true
  )
    throw Error("Migration readback mismatch; no automatic write retry");
  return {
    result: before[0].installed ? "verified-existing" : "installed",
    migrationSha256: hash,
  };
}
export async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN,
    checkOnly = process.argv.includes("--check-only");
  if (
    !token ||
    process.env.SUPABASE_PROJECT_REF !== PROJECT ||
    (!checkOnly && process.env.DIRECT_REGISTRATION_APPROVED !== "true")
  )
    throw Error("Approved project and registration release required");
  const request = async (query, readOnly) => {
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
      throw Error(
        `Scoped registration release HTTP ${response.status}; provider body omitted`,
      );
    return response.json();
  };
  console.log(
    JSON.stringify(
      await publishDirectRegistration({
        request,
        migration: readFileSync(
          `supabase/migrations/${VERSION}_direct_registration_policy_receipts.sql`,
          "utf8",
        ),
        verification: readFileSync(
          "scripts/verify-direct-registration.sql",
          "utf8",
        ),
        checkOnly,
      }),
    ),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
