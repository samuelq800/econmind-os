-- Read-only: do not publish the V2 client until its additive backend exists.
select
  to_regclass('private.credential_wording_versions') is not null
  and to_regclass('private.credential_editor_drafts') is not null
  and to_regprocedure('public.list_credential_wording_versions()') is not null
  and to_regprocedure('public.create_credential_wording_version(text,text,text,jsonb)') is not null
  and to_regprocedure('public.set_credential_wording_status(uuid,text)') is not null
  and to_regprocedure('public.save_credential_editor_draft(uuid,integer,uuid,text,text,date,text,text,jsonb,jsonb,jsonb,jsonb)') is not null
  and to_regprocedure('public.get_credential_editor_render_data(uuid,uuid)') is not null
  and to_regprocedure('public.review_credential_editor_draft(uuid,integer,boolean)') is not null
  and coalesce(not has_function_privilege('anon',to_regprocedure('public.save_credential_editor_draft(uuid,integer,uuid,text,text,date,text,text,jsonb,jsonb,jsonb,jsonb)'),'execute'),false)
  and coalesce(has_function_privilege('authenticated',to_regprocedure('public.save_credential_editor_draft(uuid,integer,uuid,text,text,date,text,text,jsonb,jsonb,jsonb,jsonb)'),'execute'),false)
  and coalesce(not has_table_privilege('authenticated',to_regclass('private.credential_editor_drafts'),'select'),false)
  and coalesce(not has_table_privilege('authenticated',to_regclass('private.credential_wording_versions'),'select'),false)
  and exists(select 1 from pg_trigger where tgname='credential_editor_snapshot' and tgrelid=to_regclass('private.credentials') and tgfoid=to_regprocedure('private.snapshot_credential_editor_data()') and not tgisinternal)
  and exists(select 1 from pg_trigger where tgname='credential_editor_review_guard' and tgrelid=to_regclass('private.credential_batches') and tgfoid=to_regprocedure('private.guard_credential_editor_review()') and not tgisinternal)
  as verified;
