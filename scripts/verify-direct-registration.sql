select (
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='direct_registration_limits')
  and exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='direct_registration_policy')
  and to_regprocedure('public.authorize_direct_registration(text)') is not null
  and exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_record_registration_policies' and tgenabled='O')
  and has_function_privilege('service_role','public.authorize_direct_registration(text)','execute')
  and not has_function_privilege('anon','public.authorize_direct_registration(text)','execute')
  and not has_function_privilege('authenticated','public.authorize_direct_registration(text)','execute')
  and not has_table_privilege('authenticated',(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='direct_registration_limits'),'select')
) as verified;
