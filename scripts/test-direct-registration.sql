-- Disposable fixture ONLY. Never run this against a hosted project.
\set ON_ERROR_STOP on
do $$ begin if current_database()<>'direct_registration_test' then raise exception 'Disposable database required'; end if; end $$;
create role anon;
create role authenticated;
create role service_role;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
create table public.profiles(user_id uuid primary key);
create table public.legal_document_versions(document_type text,version text,effective_date date,require_reacceptance boolean,status text,change_summary text,primary key(document_type,version));
create table public.user_consents(user_id uuid,document_type text,document_version text,accepted_at timestamptz default now(),unique(user_id,document_type,document_version));
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000001','old@example.test');
insert into profiles values('00000000-0000-0000-0000-000000000001');
\ir ../supabase/migrations/20261021020000_policy_acknowledgement_release.sql
\ir ../supabase/migrations/20261023000000_direct_registration_policy_receipts.sql
\ir ../supabase/migrations/20261023000000_direct_registration_policy_receipts.sql
do $$ begin
 if exists(select 1 from policy_acknowledgement_records) then raise exception 'Backfilled old acceptance'; end if;
 if has_function_privilege('anon','public.authorize_direct_registration(text)','execute') or has_function_privilege('authenticated','public.authorize_direct_registration(text)','execute') then raise exception 'Registration authorization exposed'; end if;
 if not has_function_privilege('service_role','public.authorize_direct_registration(text)','execute') then raise exception 'Service authorization missing'; end if;
end $$;
create temp table checks as select jsonb_object_agg(document_key,true) as payload from private.current_policy_release_documents();
insert into auth.users(id,email,raw_user_meta_data) select '00000000-0000-0000-0000-000000000002','new@example.test',jsonb_build_object('policy_acknowledgement',jsonb_build_object('release_id','2026-10-21-v2','checks',payload)) from checks;
insert into profiles values('00000000-0000-0000-0000-000000000002');
do $$ begin
 if (select count(*) from policy_acknowledgement_records where user_id='00000000-0000-0000-0000-000000000002')<>8 then raise exception 'New registration lacks eight receipts'; end if;
 if (select count(*) from user_consents where user_id='00000000-0000-0000-0000-000000000002')<>2 then raise exception 'New registration lacks current Terms/Privacy'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$ begin if not (public.get_my_policy_acknowledgement_status('00000000-0000-0000-0000-000000000002')->>'complete')::boolean then raise exception 'Would repeat confirmation'; end if; end $$;
reset role;
-- Missing World, wrong release and anonymous accounts must not get receipts.
insert into auth.users(id,email,raw_user_meta_data) select '00000000-0000-0000-0000-000000000003','partial@example.test',jsonb_build_object('policy_acknowledgement',jsonb_build_object('release_id','2026-10-21-v2','checks',payload-'world/terms')) from checks;
insert into auth.users(id,email,raw_user_meta_data) select '00000000-0000-0000-0000-000000000004','stale@example.test',jsonb_build_object('policy_acknowledgement',jsonb_build_object('release_id','old','checks',payload)) from checks;
insert into auth.users(id,email,raw_user_meta_data,is_anonymous) select '00000000-0000-0000-0000-000000000005','anon@example.test',jsonb_build_object('policy_acknowledgement',jsonb_build_object('release_id','2026-10-21-v2','checks',payload)),true from checks;
insert into profiles values('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004'),('00000000-0000-0000-0000-000000000005');
do $$ begin if (select count(*) from policy_acknowledgement_records)<>8 then raise exception 'Fabricated incomplete/anonymous receipts'; end if; end $$;
-- Updating old metadata/profile must not silently accept policies.
update auth.users set raw_user_meta_data=(select jsonb_build_object('policy_acknowledgement',jsonb_build_object('release_id','2026-10-21-v2','checks',payload)) from checks) where id='00000000-0000-0000-0000-000000000001';
update profiles set user_id=user_id where user_id='00000000-0000-0000-0000-000000000001';
do $$ begin if exists(select 1 from policy_acknowledgement_records where user_id='00000000-0000-0000-0000-000000000001') then raise exception 'Accepted policies for old account'; end if; end $$;
set role service_role;
do $$ begin
 if public.authorize_direct_registration('old@example.test')->>'status'<>'invalid' then raise exception 'Existing account allowed'; end if;
 if public.authorize_direct_registration('fresh@example.test')->>'status'<>'new' then raise exception 'New address rejected'; end if;
 for i in 1..5 loop perform public.authorize_direct_registration('fresh@example.test'); end loop;
 if public.authorize_direct_registration('fresh@example.test')->>'status'<>'limited' then raise exception 'Per-account limit missing'; end if;
end $$;
reset role;
truncate private.direct_registration_limits;
set role service_role;
do $$ begin
 for i in 1..100 loop perform public.authorize_direct_registration('user'||i||'@example.test'); end loop;
 if public.authorize_direct_registration('another@example.test')->>'status'<>'limited' then raise exception 'Global limit missing'; end if;
end $$;
reset role;
truncate private.direct_registration_limits;
update private.direct_registration_policy set enabled=false;
set role service_role;
do $$ begin if public.authorize_direct_registration('fresh@example.test')->>'status'<>'unavailable' then raise exception 'Kill switch missing'; end if; end $$;
reset role;
\ir verify-direct-registration.sql
select 'DIRECT_REGISTRATION_DATABASE_PASS' as result;
