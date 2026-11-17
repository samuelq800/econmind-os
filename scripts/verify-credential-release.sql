-- Read-only production verification. It does not issue a certificate.
select
  to_regclass('private.credentials') is not null as credentials_present,
  (select count(*)=26 from public.organization_directory) as initial_roster_present,
  (select activated and activation_method='deployment' and activated_at is not null from private.organization_directory_settings where singleton) as public_directory_activated,
  (select count(*)=5 from supabase_migrations.schema_migrations where version in
    ('20261116000000','20261116010000','20261116020000','20261116030000','20261116060000')) as migrations_recorded,
  exists(select 1 from private.credential_visual_assets where id
    and encode(extensions.digest(template_html,'sha256'),'hex')='591e6c0d67eec9b59ed856f060eca4d3ad5ed8d041b91bf3f67361cf0da6a358'
    and encode(extensions.digest(yale_signature,'sha256'),'hex')='587af46f950be365383eb8505e77ec072472df5dbc77f6aba734f8ebdf161c53') as approved_private_assets,
  not has_table_privilege('authenticated','private.credential_visual_assets','select')
    and not has_function_privilege('anon','public.get_credential_visual_assets()','execute')
    and has_function_privilege('authenticated','public.get_credential_visual_assets()','execute') as asset_permissions,
  not has_table_privilege('authenticated','private.credentials','insert')
    and not has_table_privilege('authenticated','private.credentials','update')
    and not has_function_privilege('anon','public.issue_credential_batch(uuid)','execute') as issuance_permissions,
  (select count(*)=2 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename in ('organization_directory','credential_source_revisions')) as realtime_published,
  (select count(*)=0 from private.credentials) as no_test_credentials;
