-- Read-only deployment gate; returns no private template or signature bytes.
select
  to_regclass('private.credentials') is not null
  and to_regprocedure('public.list_credential_research_sources(uuid,integer)') is not null
  and to_regprocedure('public.confirm_credential_print_review(uuid,boolean)') is not null
  and to_regprocedure('public.issue_credential_batch(uuid)') is not null
  and (select count(*)=5 from supabase_migrations.schema_migrations where version in
    ('20261116000000','20261116010000','20261116020000','20261116030000','20261116060000'))
  and exists(select 1 from private.credential_visual_assets where id
    and encode(extensions.digest(template_html,'sha256'),'hex')='591e6c0d67eec9b59ed856f060eca4d3ad5ed8d041b91bf3f67361cf0da6a358'
    and encode(extensions.digest(yale_signature,'sha256'),'hex')='587af46f950be365383eb8505e77ec072472df5dbc77f6aba734f8ebdf161c53')
  and not has_table_privilege('authenticated','private.credential_visual_assets','select')
  and not has_function_privilege('anon','public.get_credential_visual_assets()','execute')
  and not has_function_privilege('anon','public.issue_credential_batch(uuid)','execute')
  and (select count(*)=2 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename in ('organization_directory','credential_source_revisions'))
  as verified;
