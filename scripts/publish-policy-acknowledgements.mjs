// Exact, additive owner-authorised release only. Never accepts policies for a user.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
export const PROJECT = "vimksjrhaxdpnkvgsavz";
export const VERSION = "20261021020000";
export async function publishPolicyAcknowledgements({
  request,
  migration,
  verification,
  checkOnly = false,
}) {
  const hash = createHash("sha256").update(migration).digest("hex");
  const metadata = await request(
    `select exists(select 1 from supabase_migrations.schema_migrations where version='${VERSION}') as installed, to_regclass('public.policy_acknowledgement_records') is not null as table_exists`,
    true,
  );
  if (typeof metadata?.[0]?.installed !== "boolean")
    throw Error("Invalid release metadata");
  if (!metadata[0].installed) {
    if (checkOnly) throw Error("Policy confirmation backend is not installed");
    if (metadata[0].table_exists)
      throw Error("Untracked receipt table; manual review required");
    if (!/^begin;$/m.test(migration) || !/commit;\s*$/.test(migration))
      throw Error("Atomic migration required");
    if (
      /(?:update|delete from)\s+(?:public\.)?(?:profiles|user_consents|auth\.users)\b/i.test(
        migration,
      )
    )
      throw Error("Existing account writes prohibited");
    const ledger = `insert into supabase_migrations.schema_migrations(version,name,statements) values('${VERSION}','policy_acknowledgement_release',array['${migration.replaceAll("'", "''")}']);`;
    const assertion = `do $verify$ begin if not (select verified from (${verification.trim().replace(/;$/, "")}) v) then raise exception 'Policy backend verification failed'; end if; end $verify$;`;
    await request(
      migration
        .replace(
          /^begin;$/m,
          () => `begin;\nselect pg_advisory_xact_lock(20261021,20000);`,
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
    throw Error("Policy release readback failed; no automatic write retry");
  return {
    result: metadata[0].installed ? "verified-existing" : "installed",
    migrationSha256: hash,
    userConfirmationsCreated: 0,
  };
}
export async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN,
    checkOnly = process.argv.includes("--check-only");
  if (
    !token ||
    process.env.SUPABASE_PROJECT_REF !== PROJECT ||
    (!checkOnly && process.env.POLICY_ACKNOWLEDGEMENT_APPROVED !== "true")
  )
    throw Error("Approved project and bounded policy activation required");
  const request = async (query, readOnly) => {
    if (checkOnly && !readOnly) throw Error("Read-only check cannot mutate");
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
        `Policy release HTTP ${response.status}; provider body omitted`,
      );
    return response.json();
  };
  console.log(
    JSON.stringify(
      await publishPolicyAcknowledgements({
        request,
        migration: readFileSync(
          `supabase/migrations/${VERSION}_policy_acknowledgement_release.sql`,
          "utf8",
        ),
        verification: readFileSync(
          "scripts/verify-policy-acknowledgements.sql",
          "utf8",
        ),
        checkOnly,
      }),
    ),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
