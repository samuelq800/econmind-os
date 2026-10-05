-- DISPOSABLE TEST DATABASE ONLY. Example (fresh local PostgreSQL):
-- psql -h 127.0.0.1 -U postgres -d season1_test -f scripts/test-season1-team-lifecycle.sql
\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'season1_test' then
    raise exception 'Use the disposable season1_test database only';
  end if;
end $$;

create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create role anon nologin;
create role authenticated nologin;
grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.schools(id uuid primary key, name text);
create table public.profiles(
  user_id uuid primary key, display_name text, school_id uuid references public.schools(id),
  account_status text default 'active', is_admin boolean default false, created_at timestamptz default now()
);
create function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer as $$
  select coalesce((select is_admin from public.profiles where user_id = p_user_id), false);
$$;
create publication supabase_realtime;
create function pg_temp.player(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.assert_true(ok boolean, description text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %', description; end if; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then
      raise exception 'Wrong error: % (expected %)', sqlerrm, expected;
    end if;
    return;
  end;
  raise exception 'Expected failure: %', statement;
end $$;
insert into public.schools values
  ('11111111-1111-1111-1111-111111111111', 'School A'),
  ('22222222-2222-2222-2222-222222222222', 'School B');
insert into public.profiles(user_id, display_name, school_id, is_admin)
select pg_temp.player(n), 'Player ' || n,
  case when n in (20,21) then null
       when n in (3,4,8) then '22222222-2222-2222-2222-222222222222'::uuid
       else '11111111-1111-1111-1111-111111111111'::uuid end,
  n = 30 from generate_series(1,30) n;
\ir ../supabase/migrations/20260916000000_world_preseason_team_lobby.sql
\ir ../supabase/migrations/20260916010000_expand_world_preseason_team_lobby.sql
\ir ../supabase/migrations/20260916020000_fix_world_preseason_application_idempotency.sql
\ir ../supabase/migrations/20260924000000_season1_member_lobby_access.sql
\ir ../supabase/migrations/20260924010000_season1_opening_gate.sql
\ir ../supabase/migrations/20260926000000_season1_my_team.sql
\ir ../supabase/migrations/20260930010000_season1_world_chat.sql
\ir ../supabase/migrations/20261002000000_season1_auto_join_and_lock.sql
update public.world_preseason_seasons set lobby_opens_at = now() - interval '1 hour';

-- Seed teams before the new school column to exercise the real backfill.
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
select public.world_preseason_create_team('Legacy School A') as team_a \gset
insert into public.world_preseason_team_members(season_id, team_id, user_id, joined_at)
select t.season_id, t.id, pg_temp.player(n),
  case when n = 4 then '2026-09-29 00:00:00+00'::timestamptz else '2026-09-30 00:00:00+00'::timestamptz end
from public.world_preseason_teams t cross join generate_series(2,4) n where t.id = :'team_a';
select public.world_preseason_refresh_team(:'team_a');
select public.world_preseason_post_message(:'team_a', 'Retained private team history', 'TEXT', '{}');
select id as team_a_channel from public.world_preseason_chat_channels where team_id = :'team_a' \gset
select team_code as team_a_code from public.world_preseason_teams where id = :'team_a' \gset
select set_config('request.jwt.claim.sub', pg_temp.player(8)::text, false);
select public.world_preseason_create_team('Newer School B') as team_b \gset
select set_config('request.jwt.claim.sub', pg_temp.player(20)::text, false);
select public.world_preseason_create_team('Unknown home school') as unknown_team \gset
update public.world_preseason_teams set created_at = '2026-09-01 00:00:00+00' where id = :'team_a';
update public.world_preseason_teams set created_at = '2026-09-02 00:00:00+00' where id = :'team_b';
update public.world_preseason_teams set created_at = '2026-09-03 00:00:00+00' where id = :'unknown_team';

\ir ../supabase/migrations/20261005010000_season1_team_lifecycle.sql
select pg_temp.assert_true((select school_id = '11111111-1111-1111-1111-111111111111' from public.world_preseason_teams where id = :'team_a'), 'existing home school backfilled');
select pg_temp.assert_true((select school_id is null from public.world_preseason_teams where id = :'unknown_team'), 'unknown home school stays unknown');
select pg_temp.assert_true((select capacity = 6 and team_code = :'team_a_code' from public.world_preseason_teams where id = :'team_a'), 'migration preserves capacity and team code');
select pg_temp.assert_true((select count(*) = 4 from public.world_preseason_team_members where team_id = :'team_a'), 'migration preserves membership');
select pg_temp.assert_true(to_regprocedure('public.world_preseason_leave_team()') is null, 'no old leave overload');
select pg_temp.assert_true(to_regprocedure('public.world_preseason_dissolve_team()') is null, 'no old dissolve overload');
select pg_temp.assert_true(to_regprocedure('public.world_preseason_remove_member(uuid)') is null, 'no old removal overload');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.world_preseason_leave_team(uuid)', 'EXECUTE'), 'anonymous leave denied');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.world_preseason_dissolve_team(uuid)', 'EXECUTE'), 'anonymous dissolve denied');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.world_preseason_create_invite(uuid,uuid,timestamptz)', 'EXECUTE'), 'anonymous invite denied');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.world_preseason_team_members', 'DELETE'), 'direct member deletion denied');

set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
select pg_temp.assert_true(public.get_world_preseason_lobby()->'viewer'->>'schoolId' = '11111111-1111-1111-1111-111111111111', 'viewer home school id');
select pg_temp.assert_true(public.get_world_preseason_lobby()->'viewer'->>'schoolName' = 'School A', 'viewer home school name');
select pg_temp.assert_true(public.get_world_preseason_lobby()->'teams'->0->>'id' = :'team_a', 'same-school team sorts before newer foreign and null-school teams');
select pg_temp.assert_true(public.get_world_preseason_lobby()->'teams'->0->>'schoolName' = 'School A', 'discovery exposes home school name');
select pg_temp.assert_true(not exists (select 1 from jsonb_array_elements(public.get_world_preseason_lobby()->'teams') t where t->'sameSchool' = 'null'::jsonb), 'sameSchool is always boolean');
select pg_temp.assert_true((select count(*) = 4 from public.world_preseason_team_members where team_id = :'team_a'), 'current captain can read own team roster without RLS recursion');
select pg_temp.assert_true((select count(*) = 1 from public.world_preseason_chat_messages where channel_id = :'team_a_channel'), 'current captain can directly read private team chat');
select set_config('request.jwt.claim.sub', pg_temp.player(8)::text, false);
select pg_temp.assert_true((select count(*) = 0 from public.world_preseason_team_members where team_id = :'team_a'), 'other team captain cannot read private roster');
select pg_temp.assert_true((select count(*) = 0 from public.world_preseason_chat_messages where channel_id = :'team_a_channel'), 'other team captain cannot directly read private chat');
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
select public.world_preseason_set_team_lock(:'team_a', true);
select public.world_preseason_leave_team(:'team_a');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team' = 'null'::jsonb, 'departing captain loses My Team');
select pg_temp.assert_true(public.get_world_preseason_lobby()->'teamMessages' = '[]'::jsonb, 'departing captain loses team chat');
select pg_temp.assert_true((select count(*) = 0 from public.world_preseason_chat_messages where channel_id = :'team_a_channel'), 'departing captain loses direct RLS chat access');
select pg_temp.expect_error(format('select public.world_preseason_set_team_lock(%L,false)', :'team_a'), 'Only the current team captain');
select pg_temp.expect_error(format('select public.world_preseason_create_invite(%L)', :'team_a'), 'Only the current team captain');
select pg_temp.expect_error(format('select public.world_preseason_post_message(%L,%L,%L,%L::jsonb)', :'team_a', 'Forbidden', 'TEXT', '{}'), 'Active team membership required');
select set_config('request.jwt.claim.sub', pg_temp.player(4)::text, false);
select pg_temp.assert_true(public.get_world_preseason_my_team()->'membership'->>'memberRole' = 'captain', 'earliest joined member becomes captain despite greater user id');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'recruitmentLocked' = 'true', 'handover preserves recruitment lock');
select pg_temp.assert_true(jsonb_array_length(public.get_world_preseason_lobby()->'teamMessages') = 1, 'successor retains private chat');
select pg_temp.assert_true((select count(*) = 1 from public.world_preseason_chat_messages where channel_id = :'team_a_channel'), 'successor retains direct private chat access');
select public.world_preseason_leave_team(:'team_a');
select set_config('request.jwt.claim.sub', pg_temp.player(2)::text, false);
select pg_temp.assert_true(public.get_world_preseason_my_team()->'membership'->>'memberRole' = 'captain', 'equal joined_at uses user_id tie-break');
select public.world_preseason_set_team_lock(:'team_a', false);
select set_config('request.jwt.claim.sub', pg_temp.player(3)::text, false);
select pg_temp.expect_error(format('select public.world_preseason_dissolve_team(%L)', :'team_a'), 'Only the current team captain');
select public.world_preseason_leave_team(:'team_a');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team' = 'null'::jsonb, 'ordinary member exit still works');
select pg_temp.assert_true((select count(*) = 0 from public.world_preseason_chat_messages where channel_id = :'team_a_channel'), 'departing ordinary member loses direct private chat access');
select set_config('request.jwt.claim.sub', pg_temp.player(5)::text, false);
select pg_temp.expect_error(format('select public.world_preseason_leave_team(%L)', :'team_a'), 'no longer a member');
select pg_temp.expect_error(format('select public.world_preseason_dissolve_team(%L)', :'team_a'), 'Only the current team captain');
reset role;
select pg_temp.assert_true((select captain_user_id = pg_temp.player(2) and school_id = '11111111-1111-1111-1111-111111111111' from public.world_preseason_teams where id = :'team_a'), 'home school survives cross-school leadership changes');
select pg_temp.assert_true((select count(*) = 1 from public.world_preseason_team_members where team_id = :'team_a' and member_role = 'captain'), 'exactly one captain remains');

-- Fill a newly created team through the current automatic join RPC, not fixtures.
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(10)::text, false);
select public.world_preseason_create_team('Current six-member team') as full_team \gset
select public.world_preseason_post_message(:'full_team', 'Current team private history', 'TEXT', '{}');
select id as full_team_channel from public.world_preseason_chat_channels where team_id = :'full_team' \gset
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'capacity' = '6', 'new capacity remains six');
select pg_temp.assert_true((public.get_world_preseason_my_team()->'team'->>'code') ~ '^EM-T1-[A-Z0-9]{10}$', 'new team uses stable code default');
select set_config('test.full_team', :'full_team', false);
do $$ declare n integer;
begin
  for n in 11..15 loop
    perform set_config('request.jwt.claim.sub', pg_temp.player(n)::text, false);
    perform public.world_preseason_apply_to_team(current_setting('test.full_team')::uuid, 'Automatic join');
    perform pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'id' = current_setting('test.full_team'), 'automatic join takes effect immediately');
  end loop;
end $$;
select set_config('request.jwt.claim.sub', pg_temp.player(16)::text, false);
select pg_temp.expect_error(format('select public.world_preseason_apply_to_team(%L)', :'full_team'), 'not recruiting');
select set_config('request.jwt.claim.sub', pg_temp.player(10)::text, false);
select pg_temp.assert_true(jsonb_array_length(public.get_world_preseason_my_team()->'members') = 6, 'six admitted members');
reset role;
select pg_temp.assert_true((select school_id = '11111111-1111-1111-1111-111111111111' from public.world_preseason_teams where id = :'full_team'), 'new team binds founder school');

-- Every permanent roster status blocks both lifecycle commands and new invites.
do $$ declare locked_status text;
begin
  foreach locked_status in array array['frozen','registered','active','dissolved'] loop
    update public.world_preseason_teams set status = locked_status where id = current_setting('test.full_team')::uuid;
    perform pg_temp.expect_error(format('select public.world_preseason_leave_team(%L)', current_setting('test.full_team')), 'roster is locked');
    perform pg_temp.expect_error(format('select public.world_preseason_dissolve_team(%L)', current_setting('test.full_team')), 'roster is locked');
    perform pg_temp.expect_error(format('select public.world_preseason_create_invite(%L)', current_setting('test.full_team')), 'roster is locked');
    perform pg_temp.assert_true((select count(*) = 6 from public.world_preseason_team_members where team_id = current_setting('test.full_team')::uuid), 'locked roster unchanged');
  end loop;
  update public.world_preseason_teams set status = 'full' where id = current_setting('test.full_team')::uuid;
end $$;
set role authenticated;
select public.world_preseason_leave_team(:'full_team');
select set_config('request.jwt.claim.sub', pg_temp.player(11)::text, false);
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'captainUserId' = pg_temp.player(11)::text, 'full-team captain also hands over deterministically');
select set_config('request.jwt.claim.sub', pg_temp.player(16)::text, false);
select public.world_preseason_apply_to_team(:'full_team');
select pg_temp.assert_true(jsonb_array_length(public.get_world_preseason_my_team()->'members') = 6, 'captain exit reopens one seat without changing capacity');
reset role;

-- A failure part-way through cleanup must roll back the entire dissolve RPC.
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
select public.world_preseason_create_team('Dissolve atomically') as dissolve_team \gset
select public.world_preseason_post_message(:'dissolve_team', 'Keep this history', 'TEXT', '{}');
select id as dissolve_channel from public.world_preseason_chat_channels where team_id = :'dissolve_team' \gset
select public.world_preseason_create_invite(:'dissolve_team', pg_temp.player(18))->>'code' as pending_invite \gset
select set_config('request.jwt.claim.sub', pg_temp.player(6)::text, false);
select public.world_preseason_apply_to_team(:'dissolve_team');
select pg_temp.assert_true((select count(*) = 1 from public.world_preseason_chat_messages where channel_id = :'dissolve_channel'), 'ordinary member can directly read joined team private chat');
reset role;
insert into public.world_preseason_team_applications(season_id, team_id, applicant_user_id, status)
select season_id, id, pg_temp.player(17), 'pending' from public.world_preseason_teams where id = :'dissolve_team';
insert into public.world_preseason_team_applications(season_id, team_id, applicant_user_id, status)
select season_id, id, pg_temp.player(19), 'accepted' from public.world_preseason_teams where id = :'dissolve_team';
insert into public.world_preseason_team_applications(season_id, team_id, applicant_user_id, status)
select season_id, id, pg_temp.player(17), 'pending' from public.world_preseason_teams where id = :'team_b';
create function pg_temp.fail_invite_cleanup() returns trigger language plpgsql as $$
begin if new.status = 'revoked' then raise exception 'Injected invite cleanup failure'; end if; return new; end $$;
create trigger test_invite_cleanup_failure before update on public.world_preseason_team_invites
for each row execute function pg_temp.fail_invite_cleanup();
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
select pg_temp.expect_error(format('select public.world_preseason_dissolve_team(%L)', :'dissolve_team'), 'Injected invite cleanup failure');
select pg_temp.assert_true(jsonb_array_length(public.get_world_preseason_my_team()->'members') = 2, 'failed dissolve retains every member');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'status' <> 'dissolved', 'failed dissolve preserves team status');
reset role;
select pg_temp.assert_true((select status = 'pending' from public.world_preseason_team_applications where team_id = :'dissolve_team' and applicant_user_id = pg_temp.player(17)), 'failed dissolve rolls back applications');
select pg_temp.assert_true((select status = 'pending' from public.world_preseason_team_invites where code = :'pending_invite'), 'failed dissolve rolls back invitations');
drop trigger test_invite_cleanup_failure on public.world_preseason_team_invites;
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(30)::text, false);
select pg_temp.expect_error(format('select public.world_preseason_dissolve_team(%L)', :'dissolve_team'), 'Only the current team captain');
-- Preserve the existing administrator invitation permission for mutable teams.
select public.world_preseason_create_invite(:'dissolve_team', pg_temp.player(19));
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
select public.world_preseason_dissolve_team(:'dissolve_team');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team' = 'null'::jsonb, 'dissolved captain loses membership');
select pg_temp.assert_true(public.get_world_preseason_lobby()->'teamMessages' = '[]'::jsonb, 'dissolved captain loses chat RPC access');
select pg_temp.expect_error(format('select public.world_preseason_create_invite(%L)', :'dissolve_team'), 'Only the current team captain');
select set_config('request.jwt.claim.sub', pg_temp.player(6)::text, false);
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team' = 'null'::jsonb, 'dissolved ordinary member also loses membership');
select pg_temp.assert_true(public.get_world_preseason_lobby()->'teamMessages' = '[]'::jsonb, 'dissolved member loses chat RPC access');
select pg_temp.assert_true((select count(*) = 0 from public.world_preseason_chat_messages where channel_id = :'dissolve_channel'), 'dissolved member loses direct private chat access');
select pg_temp.expect_error(format('select public.world_preseason_post_message(%L,%L,%L,%L::jsonb)', :'dissolve_team', 'Forbidden', 'TEXT', '{}'), 'Active team membership required');
select set_config('request.jwt.claim.sub', pg_temp.player(18)::text, false);
select pg_temp.expect_error(format('select public.world_preseason_respond_to_invite(%L,true)', :'pending_invite'), 'invalid or expired');
select pg_temp.expect_error(format('select public.world_preseason_apply_to_team(%L)', :'dissolve_team'), 'not recruiting');
reset role;
select pg_temp.assert_true((select status = 'dissolved' and not recruiting and recruitment_locked from public.world_preseason_teams where id = :'dissolve_team'), 'dissolved team permanently stops recruitment');
select pg_temp.assert_true(not exists (select 1 from public.world_preseason_team_members where team_id = :'dissolve_team'), 'all memberships atomically removed');
select pg_temp.assert_true((select status = 'withdrawn' from public.world_preseason_team_applications where team_id = :'dissolve_team' and applicant_user_id = pg_temp.player(17)), 'pending applications withdrawn');
select pg_temp.assert_true((select count(*) = 2 and bool_and(status = 'revoked') from public.world_preseason_team_invites where team_id = :'dissolve_team'), 'all pending invitations revoked');
select pg_temp.assert_true((select status = 'accepted' from public.world_preseason_team_applications where team_id = :'dissolve_team' and applicant_user_id = pg_temp.player(19)), 'reviewed application history retained');
select pg_temp.assert_true((select status = 'pending' from public.world_preseason_team_applications where team_id = :'team_b' and applicant_user_id = pg_temp.player(17)), 'other teams applications untouched');
select pg_temp.assert_true((select count(*) = 1 from public.world_preseason_chat_messages m join public.world_preseason_chat_channels c on c.id = m.channel_id where c.team_id = :'dissolve_team'), 'private chat history retained in storage');

-- Replay preserves both known and unknown home schools after profile changes.
-- Model the production drift: school_id exists, but some founding schools have
-- never been bound. Existing non-null schools win even when founder differs.
select set_config('request.jwt.claim.sub', pg_temp.player(22)::text, false);
select public.world_preseason_create_team('Existing-column null school') as drift_team \gset
insert into public.world_preseason_team_members(season_id, team_id, user_id, member_role)
select season_id, id, pg_temp.player(23), 'member' from public.world_preseason_teams where id = :'drift_team';
update public.world_preseason_team_members set member_role = case when user_id = pg_temp.player(23) then 'captain' else 'member' end where team_id = :'drift_team';
update public.profiles set school_id = '22222222-2222-2222-2222-222222222222' where user_id = pg_temp.player(23);
update public.world_preseason_teams set captain_user_id = pg_temp.player(23), school_id = null, home_school_bound_at = null where id = :'drift_team';
update public.world_preseason_teams set school_id = '11111111-1111-1111-1111-111111111111', home_school_bound_at = null where id = :'team_b';
-- Historical RPCs remain present for provenance, but their execution is revoked.
create function public.world_preseason_leave_team() returns void language plpgsql as $$ begin end $$;
create function public.world_preseason_dissolve_team() returns void language plpgsql as $$ begin end $$;
create function public.world_preseason_remove_member(uuid) returns void language plpgsql as $$ begin end $$;
grant execute on function public.world_preseason_leave_team(), public.world_preseason_dissolve_team(), public.world_preseason_remove_member(uuid) to public, anon, authenticated;
update public.profiles set school_id = '22222222-2222-2222-2222-222222222222' where user_id in (pg_temp.player(2), pg_temp.player(20));
\ir ../supabase/migrations/20261005010000_season1_team_lifecycle.sql
select pg_temp.assert_true((select school_id = '11111111-1111-1111-1111-111111111111' and team_code = :'team_a_code' from public.world_preseason_teams where id = :'team_a'), 'replay does not rebind known home school or code');
select pg_temp.assert_true((select school_id is null from public.world_preseason_teams where id = :'unknown_team'), 'replay does not guess an initially unknown home school');
select pg_temp.assert_true((select school_id = '11111111-1111-1111-1111-111111111111' and home_school_bound_at is not null from public.world_preseason_teams where id = :'drift_team'), 'existing-column null school binds from founder rather than successor');
select pg_temp.assert_true((select school_id = '11111111-1111-1111-1111-111111111111' from public.world_preseason_teams where id = :'team_b'), 'existing home school differs from founder and remains unchanged');
select pg_temp.assert_true(not has_function_privilege('authenticated', 'public.world_preseason_leave_team()', 'EXECUTE') and not has_function_privilege('anon', 'public.world_preseason_leave_team()', 'EXECUTE'), 'legacy leave execution revoked');
select pg_temp.assert_true(not has_function_privilege('authenticated', 'public.world_preseason_dissolve_team()', 'EXECUTE') and not has_function_privilege('anon', 'public.world_preseason_dissolve_team()', 'EXECUTE'), 'legacy dissolve execution revoked');
select pg_temp.assert_true(not has_function_privilege('authenticated', 'public.world_preseason_remove_member(uuid)', 'EXECUTE') and not has_function_privilege('anon', 'public.world_preseason_remove_member(uuid)', 'EXECUTE'), 'legacy member removal execution revoked');
update public.profiles set school_id = '22222222-2222-2222-2222-222222222222' where user_id = pg_temp.player(22);
\ir ../supabase/migrations/20261005010000_season1_team_lifecycle.sql
select pg_temp.assert_true((select school_id = '11111111-1111-1111-1111-111111111111' from public.world_preseason_teams where id = :'drift_team'), 'once-backfilled drift team never rebinds on another replay');
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(20)::text, false);
select public.world_preseason_leave_team(:'unknown_team');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team' = 'null'::jsonb, 'last captain can leave');
reset role;
select pg_temp.assert_true((select status = 'dissolved' and not recruiting from public.world_preseason_teams where id = :'unknown_team'), 'last captain leave dissolves empty team');

-- Participant gate and suspension apply before lifecycle authorization.
update public.profiles set account_status = 'suspended' where user_id = pg_temp.player(11);
set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(11)::text, false);
select pg_temp.expect_error(format('select public.world_preseason_leave_team(%L)', :'full_team'), 'active authenticated account');
select pg_temp.expect_error(format('select public.world_preseason_dissolve_team(%L)', :'full_team'), 'active authenticated account');
reset role;
update public.profiles set account_status = 'active' where user_id = pg_temp.player(11);
set role authenticated;
select pg_temp.assert_true((select count(*) = 1 from public.world_preseason_chat_messages where channel_id = :'full_team_channel'), 'active captain can read private chat before gate closes');
reset role;
update public.world_preseason_seasons set lobby_opens_at = now() + interval '1 day';
set role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.world_preseason_chat_messages where channel_id = :'full_team_channel'), 'closed gate denies direct private chat');
select pg_temp.assert_true((select count(*) = 0 from public.world_preseason_team_members where team_id = :'full_team'), 'closed gate denies direct roster');
select pg_temp.expect_error(format('select public.world_preseason_leave_team(%L)', :'full_team'), 'has not opened yet');
select pg_temp.expect_error(format('select public.world_preseason_dissolve_team(%L)', :'full_team'), 'has not opened yet');
reset role;
\ir verify-season1-team-lifecycle.sql
select 'PASS: school affinity, six-member auto-join/locks, captain handover, atomic dissolution and chat membership isolation' as result;
