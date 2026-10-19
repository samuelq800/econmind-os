// Applies only the explicitly authorized additive recipient-query migration. Never sends mail.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PROJECT = "vimksjrhaxdpnkvgsavz";
export const VERSION = "20261019000000";
const MIGRATION = `supabase/migrations/${VERSION}_admin_mail_recipient_groups.sql`;

export async function publishRecipientGroups({ request, migration, verification }) {
  if (!/^begin;\s*$/m.test(migration) || !/commit;\s*$/.test(migration)) throw new Error("Explicit migration transaction required");
  const metadata = await request(`select exists(select 1 from supabase_migrations.schema_migrations where version='${VERSION}') as installed, to_regprocedure('public.admin_mail_recipient_directory(uuid)') is not null as function_exists`, true);
  if (typeof metadata?.[0]?.installed !== "boolean" || typeof metadata?.[0]?.function_exists !== "boolean") throw new Error("Invalid installation metadata");
  if (!metadata[0].installed) {
    if (metadata[0].function_exists) throw new Error("Untracked directory function; review before replacing");
    const ready = await request(`select to_regprocedure('public.admin_mail_recipients(uuid)') is not null and to_regprocedure('public.is_platform_admin(uuid)') is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name='world_preseason_teams' and column_name='created_by') as ready`, true);
    if (ready?.[0]?.ready !== true) throw new Error("Mail directory dependencies unavailable");
    const assertion = `do $verify$ begin if not (select verified from (${verification.trim().replace(/;$/, "")}) v) then raise exception 'Recipient directory verification failed'; end if; end $verify$;`;
    const preserve = `create temporary table mail_directory_preserved on commit drop as select md5(pg_get_functiondef('public.admin_mail_recipients(uuid)'::regprocedure)) as old_directory;`;
    const preserved = `do $preserve$ begin if not (select old_directory=md5(pg_get_functiondef('public.admin_mail_recipients(uuid)'::regprocedure)) from mail_directory_preserved) then raise exception 'Existing directory modified'; end if; end $preserve$;`;
    const ledger = `insert into supabase_migrations.schema_migrations(version,name,statements) values('${VERSION}','admin_mail_recipient_groups',array['${migration.replaceAll("'", "''")}']);`;
    // Callback replacements preserve PostgreSQL dollar quotes. No automatic write retries.
    await request(migration.replace(/^begin;\s*$/m, () => `begin;\n${preserve}`).replace(/commit;\s*$/, () => `${assertion}\n${preserved}\n${ledger}\ncommit;`), false);
  }
  const evidence = await request(verification, true);
  if (evidence?.[0]?.verified !== true) throw new Error("Directory readback failed; no automatic write retry");
  return metadata[0].installed ? "already-installed" : "published";
}

export async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const checkOnly = process.argv.includes("--check-only");
  if (!token || process.env.SUPABASE_PROJECT_REF !== PROJECT || (!checkOnly && process.env.MAIL_RECIPIENT_GROUPS_APPROVED !== "true")) throw new Error("Explicit approved project and migration required");
  const migration = readFileSync(MIGRATION, "utf8");
  const verification = readFileSync("scripts/verify-mail-recipient-groups.sql", "utf8");
  const request = async (query, readOnly) => {
    if (checkOnly && !readOnly) throw new Error("Read-only prerequisite cannot apply migrations");
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query${readOnly ? "/read-only" : ""}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Recipient directory migration HTTP ${response.status}; provider body omitted`);
    return response.json();
  };
  let result;
  if (checkOnly) {
    if ((await request(verification, true))?.[0]?.verified !== true) throw new Error("Recipient directory backend prerequisite failed");
    result = "verified-read-only";
  } else result = await publishRecipientGroups({ migration, verification, request });
  console.log(JSON.stringify({ project: PROJECT, result, migrationSha256: createHash("sha256").update(migration).digest("hex"), emailsSent: 0 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
