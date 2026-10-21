select
 to_regprocedure('public.get_my_policy_acknowledgement_status(uuid)') is not null
 and to_regprocedure('public.acknowledge_policy_release(uuid,text,jsonb)') is not null
 -- Read-only Management API deliberately cannot execute private functions.
 -- Verify their immutable definition through the catalog instead; the exact
 -- migration hash and disposable execution tests pin the eight-document body.
 and exists(select 1 from pg_catalog.pg_proc
  where oid=to_regprocedure('private.current_policy_release_documents()')
   and provolatile='i' and regexp_count(prosrc,'[a-f0-9]{64}')=8
   and prosrc like '%world/about%' and prosrc like '%world/terms%' and prosrc like '%world/privacy%')
 and (select relrowsecurity from pg_class where oid='public.policy_acknowledgement_records'::regclass)
 and not has_table_privilege('authenticated','public.policy_acknowledgement_records','insert,update,delete')
 and not has_table_privilege('anon','public.policy_acknowledgement_records','select,insert,update,delete')
 and not has_function_privilege('anon','public.acknowledge_policy_release(uuid,text,jsonb)','execute')
 and has_function_privilege('authenticated','public.acknowledge_policy_release(uuid,text,jsonb)','execute')
 and (select count(*)=2 from public.legal_document_versions where version='2.0' and status='active' and document_type in ('terms','privacy'))
 as verified;
