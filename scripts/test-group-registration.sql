\set ON_ERROR_STOP on
-- Disposable database only; minimal existing Auth/profile fixtures.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema auth;
create table auth.users (id uuid primary key, email text unique, aud text default 'authenticated',
  email_confirmed_at timestamptz, is_anonymous boolean default false, deleted_at timestamptz, banned_until timestamptz, encrypted_password text default 'native-password-hash');
create table auth.identities (user_id uuid, provider text);
create table public.profiles (user_id uuid primary key, platform_role text default 'user', account_status text default 'active');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
create function public.is_platform_admin(p_id uuid) returns boolean language sql stable as $$ select exists(select 1 from public.profiles where user_id = p_id and platform_role = 'platform_admin') $$;
insert into public.profiles(user_id,platform_role) values ('00000000-0000-0000-0000-000000000001','platform_admin'),('00000000-0000-0000-0000-000000000002','user');
\ir ../supabase/migrations/20261011120000_group_registration.sql
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

do $$ declare r jsonb; i integer; begin
  assert public.authorize_group_registration('GROUP-TEST-2026','new@example.test',repeat('a',64))->>'status' = 'unavailable';
  begin
    perform public.set_group_registration_policy('GROUP-TEST-2026',true,null);
    raise exception 'Missing administrator accepted';
  exception when raise_exception then
    if sqlerrm <> 'Platform administrator required' then raise; end if;
  end;
  perform set_config('test.user_id','00000000-0000-0000-0000-000000000001',false);
  perform public.set_group_registration_policy('GROUP-TEST-2026',true,null);
  assert public.get_group_registration_policy()->>'has_code' = 'true';
  assert not public.get_group_registration_policy() ? 'code_hash';
  assert not public.get_group_registration_policy() ? 'code';
  assert public.authorize_group_registration('wrong-code-2026','new@example.test',repeat('a',64))->>'status' = 'invalid';
  assert public.authorize_group_registration('group-test-2026','new@example.test',repeat('a',64))->>'status' = 'new';
  assert public.authorize_group_registration(' GROUP-TEST-2026 ','second@example.test',repeat('a',64))->>'status' = 'new', 'shared code consumed';
  insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000003','pending@example.test');
  insert into auth.identities values ('00000000-0000-0000-0000-000000000003','email');
  r := public.authorize_group_registration('GROUP-TEST-2026','pending@example.test',repeat('a',64));
  assert r->>'status' = 'pending';
  assert r->>'user_id' = '00000000-0000-0000-0000-000000000003';
  insert into auth.identities values ('00000000-0000-0000-0000-000000000003','google');
  assert public.authorize_group_registration('GROUP-TEST-2026','pending@example.test',repeat('a',64))->>'status' = 'invalid';
  delete from auth.identities where provider = 'google';
  update auth.users set email_confirmed_at = clock_timestamp();
  assert public.authorize_group_registration('GROUP-TEST-2026','pending@example.test',repeat('a',64))->>'status' = 'invalid';
  update auth.users set email_confirmed_at = null, banned_until = clock_timestamp()+interval '1 day';
  assert public.authorize_group_registration('GROUP-TEST-2026','pending@example.test',repeat('a',64))->>'status' = 'invalid';
  update auth.users set banned_until = null;
  insert into public.profiles(user_id,account_status) values ('00000000-0000-0000-0000-000000000003','suspended');
  assert public.authorize_group_registration('GROUP-TEST-2026','pending@example.test',repeat('a',64))->>'status' = 'invalid';
  -- Wrong-code attempts are persistent, per email and peer, without plaintext.
  for i in 1..7 loop r := public.authorize_group_registration('WRONG-GROUP-CODE','limited@example.test',repeat('b',64)); end loop;
  assert r->>'status' = 'limited';
  update private.group_registration_limits set opened_at = clock_timestamp()-interval '11 minutes';
  assert public.authorize_group_registration('GROUP-TEST-2026','limited@example.test',repeat('b',64))->>'status' = 'new';
  for i in 1..31 loop r := public.authorize_group_registration('GROUP-TEST-2026','peer-'||i||'@example.test',repeat('c',64)); end loop;
  assert r->>'status' = 'limited';
  perform public.set_group_registration_policy(null,false,null);
  assert public.authorize_group_registration('GROUP-TEST-2026','stopped@example.test',repeat('d',64))->>'status' = 'unavailable';
  perform public.set_group_registration_policy('ROTATED-TEST-2026',true,clock_timestamp()+interval '1 day');
  assert public.authorize_group_registration('GROUP-TEST-2026','rotated@example.test',repeat('d',64))->>'status' = 'invalid';
  assert public.authorize_group_registration('ROTATED-TEST-2026','rotated@example.test',repeat('d',64))->>'status' = 'new';
  update private.group_registration_policy set expires_at = clock_timestamp()-interval '1 second';
  assert public.authorize_group_registration('ROTATED-TEST-2026','expired@example.test',repeat('d',64))->>'status' = 'unavailable';
  assert not has_table_privilege('anon','private.group_registration_policy','select');
  assert not has_table_privilege('authenticated','private.group_registration_policy','select');
  assert not has_function_privilege('anon','public.authorize_group_registration(text,text,text)','execute');
  assert not has_function_privilege('authenticated','public.authorize_group_registration(text,text,text)','execute');
  assert has_function_privilege('service_role','public.authorize_group_registration(text,text,text)','execute');
end $$;
set role authenticated;
select set_config('test.user_id','00000000-0000-0000-0000-000000000001',false);
select public.set_group_registration_policy('GROUP-TEST-2026',true,null);
select public.get_group_registration_policy()->>'enabled' = 'true' as admin_rpc_works;
select set_config('test.user_id','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform public.get_group_registration_policy(); raise exception 'Ordinary user accepted';
  exception when raise_exception then if sqlerrm <> 'Platform administrator required' then raise; end if; end;
  begin perform public.set_group_registration_policy(null,false,null); raise exception 'Ordinary user accepted';
  exception when raise_exception then if sqlerrm <> 'Platform administrator required' then raise; end if; end;
end $$;
reset role;
set role service_role;
select public.authorize_group_registration('GROUP-TEST-2026','service@example.test',repeat('f',64))->>'status' = 'new' as service_rpc_works;
reset role;
\ir ../supabase/migrations/20261011120000_group_registration.sql
select enabled as migration_retry_preserves_policy from private.group_registration_policy;
