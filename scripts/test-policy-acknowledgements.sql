-- Disposable fixture only; never run against the production database.
\set ON_ERROR_STOP on
do $$ begin if current_database()<>'policy_acknowledgements_test' then raise exception 'Disposable fixture required'; end if; end $$;
create role anon;
create role authenticated;
create role supabase_read_only_user bypassrls;
grant pg_read_all_data to supabase_read_only_user;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
create table profiles(user_id uuid primary key);
create table legal_document_versions(document_type text,version text,effective_date date,require_reacceptance boolean,status text,change_summary text,primary key(document_type,version));
create table user_consents(user_id uuid,document_type text,document_version text,accepted_at timestamptz default now(),unique(user_id,document_type,document_version));
insert into profiles values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into user_consents values('00000000-0000-0000-0000-000000000001','terms','1.2',date '2026-08-27');
create temp table old_receipts as select * from user_consents;
\ir ../supabase/migrations/20261021020000_policy_acknowledgement_release.sql
\ir ../supabase/migrations/20261021020000_policy_acknowledgement_release.sql
do $$ begin
 if exists(select 1 from policy_acknowledgement_records) then raise exception 'Migration fabricated confirmations'; end if;
 if has_function_privilege('anon','public.acknowledge_policy_release(uuid,text,jsonb)','execute') then raise exception 'Anon RPC exposed'; end if;
 if has_table_privilege('authenticated','public.policy_acknowledgement_records','insert') or has_table_privilege('authenticated','public.policy_acknowledgement_records','update') then raise exception 'Direct receipt mutation allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
create temp table checks as select jsonb_object_agg(document_key,true) as payload from private.current_policy_release_documents();
grant select on checks to authenticated;
set role authenticated;
do $$ declare id uuid:='00000000-0000-0000-0000-000000000001'; payload jsonb:=(select payload from checks); result jsonb; begin
 if (public.get_my_policy_acknowledgement_status(id)->>'complete')::boolean then raise exception 'Old pair incorrectly counted'; end if;
 begin perform public.acknowledge_policy_release(id,'old',payload); raise exception 'Allowed stale release'; exception when raise_exception then if sqlerrm='Allowed stale release' then raise; end if; end;
 begin perform public.acknowledge_policy_release(id,'2026-10-21-v2',payload-'world/terms'); raise exception 'Allowed missing World checkbox'; exception when raise_exception then if sqlerrm='Allowed missing World checkbox' then raise; end if; end;
 begin perform public.acknowledge_policy_release(id,'2026-10-21-v2',payload||'{"world/privacy":false}'); raise exception 'Allowed false checkbox'; exception when raise_exception then if sqlerrm='Allowed false checkbox' then raise; end if; end;
 begin perform public.acknowledge_policy_release(id,'2026-10-21-v2',payload||'{"extra":true}'); raise exception 'Allowed extra document'; exception when raise_exception then if sqlerrm='Allowed extra document' then raise; end if; end;
 begin perform public.acknowledge_policy_release('00000000-0000-0000-0000-000000000002','2026-10-21-v2',payload); raise exception 'Allowed account switch'; exception when insufficient_privilege then null; end;
 result:=public.acknowledge_policy_release(id,'2026-10-21-v2',payload);
 if not (result->>'complete')::boolean then raise exception 'Confirmation incomplete'; end if;
 perform public.acknowledge_policy_release(id,'2026-10-21-v2',payload);
 if (select count(*) from public.policy_acknowledgement_records)<>8 then raise exception 'Duplicate receipts'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 if exists(select 1 from public.policy_acknowledgement_records) then raise exception 'Other account receipts visible'; end if;
 if (public.get_my_policy_acknowledgement_status('00000000-0000-0000-0000-000000000002')->>'complete')::boolean then raise exception 'Other account status accepted'; end if;
end $$;
select set_config('request.jwt.claims','{"is_anonymous":true}',false);
do $$ begin
 begin perform public.acknowledge_policy_release('00000000-0000-0000-0000-000000000002','2026-10-21-v2',(select payload from checks)); raise exception 'Anonymous room account accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Reproduce the provider's restricted read-only role. Do not grant it private EXECUTE.
set role supabase_read_only_user;
\ir verify-policy-acknowledgements.sql
do $$ begin
 if has_function_privilege(current_user,'private.current_policy_release_documents()','execute') then raise exception 'Readiness role gained private EXECUTE'; end if;
end $$;
reset role;
do $$ begin
 if exists((select * from old_receipts) except (select * from user_consents)) then raise exception 'Historical receipt modified'; end if;
 if (select count(*) from user_consents where document_version='2.0')<>2 then raise exception 'Current pair missing'; end if;
end $$;
select 'PASS: all eight required, stable versions, no fabricated consent, idempotence, RLS, account switch, anonymous rejection, history preserved' as result;
