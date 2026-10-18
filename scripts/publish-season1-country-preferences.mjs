// Scoped, explicitly authorized database-only release. Never `db push` or Pages.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PROJECT = "vimksjrhaxdpnkvgsavz";
export const VERSION = "20261018000000";
export const MIGRATION = `supabase/migrations/${VERSION}_season1_country_preferences.sql`;
const dependencies = `select
  to_regprocedure('public.world_preseason_require_participant()') is not null
  and to_regprocedure('public.world_preseason_remove_member(uuid,uuid)') is not null
  and to_regprocedure('public.world_preseason_leave_team(uuid)') is not null
  and to_regprocedure('public.world_preseason_set_team_lock(uuid,boolean)') is not null
  and exists(select 1 from information_schema.columns where table_schema='public' and table_name='world_preseason_teams' and column_name='recruitment_locked')
  and (select count(*)=1 from public.world_preseason_seasons where code='season-1')
  as ready`;
// Locks fence ordinary team changes while the snapshot is compared, rather
// than mistaking unrelated concurrent user actions for migration data loss.
const preserve = `
lock table public.world_preseason_teams,public.world_preseason_team_members in share row exclusive mode;
create temporary table country_release_preserved on commit drop as select
  (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.world_preseason_teams t) as teams,
  (select md5(coalesce(jsonb_agg(to_jsonb(m) order by id)::text,'[]')) from public.world_preseason_team_members m) as members,
  md5(pg_get_functiondef('public.world_preseason_remove_member(uuid,uuid)'::regprocedure)) as remove_member,
  md5(pg_get_functiondef('public.world_preseason_leave_team(uuid)'::regprocedure)) as leave_team,
  md5(pg_get_functiondef('public.world_preseason_set_team_lock(uuid,boolean)'::regprocedure)) as lock_team;
`;
const assertPreserved = `do $preserved$ begin
  if not (select teams=(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.world_preseason_teams t)
    and members=(select md5(coalesce(jsonb_agg(to_jsonb(m) order by id)::text,'[]')) from public.world_preseason_team_members m)
    and remove_member=md5(pg_get_functiondef('public.world_preseason_remove_member(uuid,uuid)'::regprocedure))
    and leave_team=md5(pg_get_functiondef('public.world_preseason_leave_team(uuid)'::regprocedure))
    and lock_team=md5(pg_get_functiondef('public.world_preseason_set_team_lock(uuid,boolean)'::regprocedure))
    from country_release_preserved)
  then raise exception 'Existing teams, memberships or roster functions changed'; end if;
end $preserved$;`;

export async function publishCountryPreferences({
  request,
  migration,
  verification,
}) {
  if (!/^begin;\s*$/m.test(migration) || !/commit;\s*$/.test(migration))
    throw new Error("Explicit migration transaction required");
  const rows = await request(
    `select exists(select 1 from supabase_migrations.schema_migrations where version='${VERSION}') as installed, to_regclass('public.world_preseason_country_preferences') is not null as table_exists`,
    true,
  );
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    typeof rows[0]?.installed !== "boolean" ||
    typeof rows[0]?.table_exists !== "boolean"
  )
    throw new Error("Invalid installation metadata");
  if (!rows[0].installed) {
    if (rows[0].table_exists)
      throw new Error(
        "Untracked country preference table exists; review required",
      );
    const readiness = await request(dependencies, true);
    if (readiness?.[0]?.ready !== true)
      throw new Error("Season 1 dependencies are not ready");
    const assertion = `do $country$ begin if not (select verified from (${verification.trim().replace(/;$/, "")}) evidence) then raise exception 'Country preference verification failed'; end if; end $country$;`;
    const ledger = `insert into supabase_migrations.schema_migrations(version,name,statements) values('${VERSION}','season1_country_preferences',array['${migration.replaceAll("'", "''")}']);`;
    const query = migration
      .replace(/^begin;\s*$/m, () => `begin;\n${preserve}`)
      .replace(
        /commit;\s*$/,
        () => `${assertion}\n${assertPreserved}\n${ledger}\ncommit;`,
      );
    // Never retry writes after timeout/unknown outcome. Inspect ledger instead.
    await request(query, false);
  }
  const evidence = await request(verification, true);
  if (evidence?.[0]?.verified !== true)
    throw new Error(
      "Country preference readback failed; no automatic write retry",
    );
  return rows[0].installed ? "already-installed" : "published";
}

export async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (
    !token ||
    process.env.SUPABASE_PROJECT_REF !== PROJECT ||
    process.env.SEASON1_COUNTRY_MIGRATION_APPROVED !== "true"
  )
    throw new Error("Explicit approved project and migration required");
  const migration = readFileSync(MIGRATION, "utf8");
  const verification = readFileSync(
    "scripts/verify-season1-country-preferences.sql",
    "utf8",
  );
  const result = await publishCountryPreferences({
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
          `Scoped country migration failed (HTTP ${response.status}); provider body omitted`,
        );
      return response.json();
    },
  });
  console.log(
    JSON.stringify({
      project: PROJECT,
      result,
      migrationSha256: createHash("sha256").update(migration).digest("hex"),
      existingRosterPreserved: true,
      frontendPublished: false,
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
