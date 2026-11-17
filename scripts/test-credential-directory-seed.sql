\set ON_ERROR_STOP on
-- Disposable database only. The authorized starter roster contains no contact fields.
\ir test-credential-research-sources.sql
reset role;
create role service_role;
\ir ../supabase/migrations/20261116010000_credential_issuance_core.sql
\ir ../supabase/migrations/20261116020000_shared_team_directory.sql
\ir ../supabase/seeds/organization_directory_snapshot_20261115.sql
do $$ begin
  if (select count(*) from public.organization_directory) <> 26 then raise exception 'starter roster count mismatch'; end if;
  if not (select activated and activation_method='deployment' and activated_at is not null from private.organization_directory_settings where singleton) then raise exception 'reviewed starter roster was not activated'; end if;
end $$;
