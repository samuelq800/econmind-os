-- DISPOSABLE TEST DATABASE ONLY. Real PostgreSQL execution of the shipped SQL.
\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'season1_test' then raise exception 'Use the disposable season1_test database only'; end if;
end $$;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create role anon nologin;
create role authenticated nologin;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.schools(id uuid primary key, name text);
create table public.profiles(user_id uuid primary key, display_name text, school_id uuid references public.schools(id), account_status text default 'active', is_admin boolean default false, created_at timestamptz default now());
create function public.is_platform_admin(p_user_id uuid default auth.uid()) returns boolean language sql stable security definer as $$
  select coalesce((select is_admin from public.profiles where user_id = p_user_id),false);
$$;
create publication supabase_realtime;
insert into public.profiles(user_id,display_name)
select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid, 'Player ' || n from generate_series(1,9) n;
\ir ../supabase/migrations/20260916000000_world_preseason_team_lobby.sql
\ir ../supabase/migrations/20260916010000_expand_world_preseason_team_lobby.sql
\ir ../supabase/migrations/20260916020000_fix_world_preseason_application_idempotency.sql
\ir ../supabase/migrations/20260924000000_season1_member_lobby_access.sql
\ir ../supabase/migrations/20260924010000_season1_opening_gate.sql
update public.world_preseason_seasons set lobby_opens_at = now() - interval '1 hour';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.world_preseason_create_team('Existing four-person team') as team_a \gset
insert into public.world_preseason_team_members(season_id,team_id,user_id)
select t.season_id,t.id,p.user_id from public.world_preseason_teams t cross join public.profiles p
where t.id = :'team_a' and p.display_name in ('Player 2','Player 3','Player 4');
select public.world_preseason_refresh_team(:'team_a');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);
select public.world_preseason_create_team('Other team') as team_b \gset

\ir ../supabase/migrations/20260926000000_season1_my_team.sql
-- Applying twice must retain team codes and membership.
select team_code as stable_code from public.world_preseason_teams where id = :'team_a' \gset
\ir ../supabase/migrations/20260926000000_season1_my_team.sql

create function pg_temp.assert_true(ok boolean, description text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %',description; end if; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then raise exception 'Wrong error: % (expected %)',sqlerrm,expected; end if;
    return;
  end;
  raise exception 'Expected failure: %',statement;
end $$;
select pg_temp.assert_true((select capacity=6 and recruiting and team_code=:'stable_code' from public.world_preseason_teams where id=:'team_a'),'existing full team expands to six without changing code');
select pg_temp.assert_true((select count(*)=4 from public.world_preseason_team_members where team_id=:'team_a'),'existing members retained');
select pg_temp.assert_true((select config->>'maximumTeamSize'='6' from public.world_preseason_seasons where code='season-1'),'configuration is six');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.world_preseason_team_members','DELETE'),'no direct member deletion');
select pg_temp.assert_true(not has_function_privilege('anon','public.get_world_preseason_my_team()','EXECUTE'),'anonymous read denied');
select pg_temp.assert_true(not has_function_privilege('anon','public.world_preseason_remove_member(uuid,uuid)','EXECUTE'),'anonymous removal denied');
select pg_temp.assert_true(not has_function_privilege('anon','public.world_preseason_leave_team(uuid)','EXECUTE'),'anonymous exit denied');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select public.world_preseason_create_team('New six-person team') as team_c \gset
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'capacity'='6','new team has capacity six');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'members'->0->>'memberRole'='captain','captain listed first');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'='null'::jsonb,'outsider cannot read another roster');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'members'='[]'::jsonb,'outsider sees no members');
select pg_temp.expect_error(format('select public.world_preseason_remove_member(%L,%L)',:'team_a','00000000-0000-0000-0000-000000000002'),'Only the current team captain');
select pg_temp.expect_error(format('select public.world_preseason_apply_by_team_code(%L)','NOT-A-CODE'),'Team code not found');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select pg_temp.expect_error(format('select public.world_preseason_remove_member(%L,%L)',:'team_a','00000000-0000-0000-0000-000000000003'),'Only the current team captain');
select pg_temp.expect_error(format('select public.world_preseason_leave_team(%L)',:'team_b'),'no longer a member');
select public.world_preseason_leave_team(:'team_a');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'='null'::jsonb,'departed member loses roster');
select pg_temp.expect_error(format('select public.world_preseason_post_message(%L,%L,%L,%L::jsonb)',:'team_a','No access','TEXT','{}'),'Active team membership required');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.expect_error(format('select public.world_preseason_leave_team(%L)',:'team_a'),'captain cannot leave');
select pg_temp.expect_error(format('select public.world_preseason_remove_member(%L,%L)',:'team_a','00000000-0000-0000-0000-000000000001'),'captain cannot be removed');
select public.world_preseason_remove_member(:'team_a','00000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(jsonb_array_length(public.get_world_preseason_my_team()->'members')=2,'captain removes only target member');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'='null'::jsonb,'removed member loses roster');
select pg_temp.expect_error(format('select public.world_preseason_post_message(%L,%L,%L,%L::jsonb)',:'team_a','No access','TEXT','{}'),'Active team membership required');

-- All code joins require captain approval, including retry-safe applications.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select public.world_preseason_apply_by_team_code(:'stable_code') as overflow_app \gset
select pg_temp.assert_true(public.world_preseason_apply_by_team_code(lower(:'stable_code'))=:'overflow_app'::uuid,'code applications are idempotent');
select set_config('test.team_a',:'team_a',false);
select set_config('test.team_code',:'stable_code',false);
do $$
declare n integer; application uuid;
begin
  foreach n in array array[2,3,5,6] loop
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-' || lpad(n::text,12,'0'),false);
    application := public.world_preseason_apply_by_team_code(current_setting('test.team_code'));
    perform pg_temp.assert_true(public.get_world_preseason_my_team()->'team'='null'::jsonb,'application does not bypass approval');
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
    perform public.world_preseason_review_application(application,true);
  end loop;
end $$;
select pg_temp.assert_true(jsonb_array_length(public.get_world_preseason_my_team()->'members')=6,'six members admitted');
select pg_temp.expect_error(format('select public.world_preseason_review_application(%L,true)',:'overflow_app'),'cannot accept another member');
select public.world_preseason_create_invite(:'team_a') ->> 'code' as full_invite \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select pg_temp.expect_error(format('select public.world_preseason_respond_to_invite(%L,true)',:'full_invite'),'can no longer be accepted');
select pg_temp.expect_error(format('select public.world_preseason_apply_by_team_code(%L)',:'stable_code'),'not accepting applications');

reset role;
update public.world_preseason_teams set status='frozen' where id=:'team_a';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select pg_temp.expect_error(format('select public.world_preseason_leave_team(%L)',:'team_a'),'roster is locked');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.expect_error(format('select public.world_preseason_remove_member(%L,%L)',:'team_a','00000000-0000-0000-0000-000000000004'),'roster is locked');
reset role;
update public.profiles set account_status='suspended' where display_name='Player 1';
set role authenticated;
select pg_temp.expect_error('select public.get_world_preseason_my_team()','active authenticated account');
reset role;
update public.profiles set account_status='active' where display_name='Player 1';
update public.world_preseason_seasons set lobby_opens_at=now()+interval '1 day';
set role authenticated;
select pg_temp.expect_error('select public.get_world_preseason_my_team()','has not opened yet');
reset role;
select 'PASS: Season 1 capacity, migration replay, code applications, privacy, member removal/exit and six-member enforcement' as result;
\ir verify-season1-my-team.sql
