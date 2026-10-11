import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const PROJECT = "vimksjrhaxdpnkvgsavz";
export const MIGRATION_SHA256 =
  "7692a283b0d92240712b24d0a3cc1285367a9a7cc41d873b6ae62295126e120f";
export const fingerprint = (value) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    )
    .digest("hex");
export function assertCodeHash(value) {
  if (!/^[a-f0-9]{64}$/.test(value || ""))
    throw new Error("Protected group code hash required");
  return value;
}
export async function runRelease({
  phase,
  statePath,
  token,
  project,
  codeHash,
  fetcher = fetch,
  read = readFile,
  write = writeFile,
  log = console.log,
}) {
  if (
    !["prepare", "activate"].includes(phase) ||
    !statePath ||
    !token ||
    project !== PROJECT
  )
    throw new Error("Approved project and bounded release phase required");
  const api = async (path, method = "GET", payload) => {
    const response = await fetcher(
      `https://api.supabase.com/v1/projects/${PROJECT}/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Scoped release ${method} ${path} HTTP ${response.status}; response omitted`,
      );
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  };
  const query = (sql) => api("database/query", "POST", { query: sql });
  const config = await api("config/auth");
  if (config.mailer_autoconfirm !== false)
    throw new Error("Ordinary email confirmation must remain enabled");
  if (phase === "prepare") {
    const rawSql = await read(
      "supabase/migrations/20261011120000_group_registration.sql",
      "utf8",
    );
    const sql = rawSql.replace(/\r\n/g, "\n");
    if (createHash("sha256").update(sql).digest("hex") !== MIGRATION_SHA256)
      throw new Error("Migration differs from reviewed candidate");
    const escaped = sql.replaceAll("'", "''");
    // One atomic, exact migration and ledger entry. Never push the migration directory.
    await query(`begin;
      select pg_advisory_xact_lock(20261011,120000);
      do $guard$ begin
        if exists(select 1 from supabase_migrations.schema_migrations where version='20261011120000' and statements is distinct from array['${escaped}']) then
          raise exception 'Migration ledger conflicts with reviewed candidate';
        end if;
      end $guard$;
      ${sql}
      insert into supabase_migrations.schema_migrations(version,name,statements)
      values ('20261011120000','group_registration',array['${escaped}']) on conflict(version) do nothing;
      do $verify$ begin
        if not (select relrowsecurity from pg_class where oid='private.group_registration_policy'::regclass) then raise exception 'Private RLS missing'; end if;
        if has_table_privilege('anon','private.group_registration_policy','select') or has_table_privilege('authenticated','private.group_registration_policy','select') then raise exception 'Policy exposed'; end if;
        if has_function_privilege('anon','public.authorize_group_registration(text,text,text)','execute') or has_function_privilege('authenticated','public.authorize_group_registration(text,text,text)','execute') then raise exception 'Authorization RPC exposed'; end if;
        if not has_function_privilege('service_role','public.authorize_group_registration(text,text,text)','execute') then raise exception 'Service authorization missing'; end if;
      end $verify$;
      commit;`);
    await write(
      statePath,
      JSON.stringify({
        authFingerprint: fingerprint(config),
        migration: MIGRATION_SHA256,
      }),
      { mode: 0o600, flag: "wx" },
    );
    log(
      "PASS: exact migration installed with ledger and private permissions; Auth settings unchanged",
    );
    return;
  }
  const state = JSON.parse(await read(statePath, "utf8"));
  if (
    state.migration !== MIGRATION_SHA256 ||
    state.authFingerprint !== fingerprint(config)
  )
    throw new Error("Auth configuration changed during release");
  const hash = assertCodeHash(codeHash);
  // Explicit owner-approved activation of the private singleton only. No auth.users writes.
  // On any uncertain readback, close the feature instead of exposing an unverified policy.
  try {
    await query(`update private.group_registration_policy set code_hash='${hash}', enabled=true, expires_at=null, changed_by=null, changed_at=clock_timestamp() where singleton;
      do $verify$ begin
        if not exists(select 1 from private.group_registration_policy where singleton and enabled and code_hash='${hash}' and expires_at is null) then raise exception 'Activation readback failed'; end if;
      end $verify$;`);
    if (fingerprint(await api("config/auth")) !== state.authFingerprint)
      throw new Error("Unrelated Auth configuration changed");
  } catch (error) {
    await query(
      "update private.group_registration_policy set enabled=false, changed_at=clock_timestamp() where singleton;",
    );
    throw error;
  }
  log(
    "PASS: reusable group code active; email confirmation, OAuth and recovery configuration unchanged",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runRelease({
    phase: process.argv[2],
    statePath: process.argv[3],
    token: process.env.SUPABASE_ACCESS_TOKEN,
    project: process.env.SUPABASE_PROJECT_REF,
    codeHash: process.env.GROUP_REGISTRATION_CODE_HASH,
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
