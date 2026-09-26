-- Run only in disposable PostgreSQL, never in a production project.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'member_identity_test' then raise exception 'Use member_identity_test only'; end if; end $$;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
create table public.school_location_catalog(location_key text primary key, area_label text);
create table public.schools(id uuid primary key, name text, logo_url text, city text, status text, location_key text, liaison_user_id uuid);
create table public.profiles(user_id uuid primary key, display_name text, avatar_url text, graduation_year integer, economics_club_name text, role_preference text, created_at timestamptz default now(), school_id uuid references public.schools(id), platform_role text default 'user', role text default 'student', account_status text default 'active', onboarding_path text, onboarding_completed_at timestamptz);
alter table public.profiles enable row level security;
create policy self_read on public.profiles for select to authenticated using(user_id=auth.uid());
create policy self_update on public.profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select on public.profiles to authenticated;
grant update(display_name,avatar_url,graduation_year,economics_club_name,role_preference) on public.profiles to authenticated;
create table public.teams(id uuid primary key,status text,school_id uuid);
create table public.team_members(team_id uuid,user_id uuid);
create table public.world_preseason_seasons(id uuid primary key,code text);
create table public.world_preseason_teams(id uuid primary key,name text,status text);
create table public.world_preseason_team_members(team_id uuid,season_id uuid,user_id uuid,member_role text,role_preferences text[],joined_at timestamptz default now());
create table public.research_papers(owner_user_id uuid,status text);
create table public.live_world_rooms(created_by uuid);
create function public.is_superme_platform_admin(uuid) returns boolean language sql as $$select false$$;
insert into public.schools(id,name,status) values
('10000000-0000-0000-0000-000000000001','School A','approved'),
('10000000-0000-0000-0000-000000000002','School B','approved'),
('10000000-0000-0000-0000-000000000003','Pending school','pending');
insert into public.profiles(user_id,display_name,school_id)
select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Member '||n,'10000000-0000-0000-0000-000000000001' from generate_series(1,5) n;
update public.profiles set platform_role='school_leader' where display_name='Member 2';
update public.profiles set account_status='suspended' where display_name='Member 5';
insert into public.world_preseason_seasons values('20000000-0000-0000-0000-000000000001','season-1');
insert into public.world_preseason_teams values('30000000-0000-0000-0000-000000000001','Real team','registered');
insert into public.world_preseason_team_members(team_id,season_id,user_id,member_role,role_preferences) values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','captain',array['Central Bank']);
insert into public.research_papers values('00000000-0000-0000-0000-000000000001','draft'),('00000000-0000-0000-0000-000000000001','published');
insert into public.live_world_rooms values('00000000-0000-0000-0000-000000000001');
insert into public.teams values('40000000-0000-0000-0000-000000000001','active','10000000-0000-0000-0000-000000000001');
insert into public.team_members values('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
\ir ../supabase/migrations/20260926020000_member_identity_center.sql
create function pg_temp.assert_true(ok boolean, description text) returns void language plpgsql as $$ begin if ok is not true then raise exception 'FAIL: %',description; end if; end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$ begin
  begin execute statement; exception when others then if position(expected in sqlerrm)=0 then raise exception 'Wrong error: % expected %',sqlerrm,expected; end if; return; end;
  raise exception 'Expected failure: %',statement;
end $$;
-- A legacy definer path must not bypass school responsibility guards.
create function public.test_legacy_school_change(target uuid) returns void language sql security definer as $$update public.profiles set school_id=target where user_id=auth.uid()$$;
select pg_temp.assert_true(not has_function_privilege('anon','public.get_my_member_identity()','EXECUTE'),'no anonymous private profile reads');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.require_member_profile_user()','EXECUTE'),'internal helper not exposed');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.member_profile_choices','INSERT'),'no direct preference insertion');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(public.get_my_member_identity()->'choices'='[]'::jsonb,'old account without choices loads');
select pg_temp.assert_true(public.get_my_member_identity()->'identity'->>'bio'='','old account without details loads');
select public.save_my_member_identity('New name',null,'My bio','Grade 11',2028,'Econ Club','school_liaison');
select public.save_my_member_preferences('area',array['technology','academic'],'technology');
select public.save_my_member_preferences('activity',array['season1','research']);
select pg_temp.assert_true((select count(*)=2 from public.member_profile_choices where category='area'),'own interests saved');
select pg_temp.assert_true((select count(*)=1 from public.member_profile_choices where is_primary),'one primary');
select pg_temp.assert_true(public.get_my_member_identity()->'roles'='[]'::jsonb,'interest and liaison preference do not grant official roles');
select pg_temp.assert_true(public.get_my_member_identity()->'activity'->'season1'->>'memberRole'='captain','actual Season role retained');
select pg_temp.assert_true(public.get_my_member_identity()->'activity'->'season1'->'rolePreferences'= '["Central Bank"]'::jsonb,'Season preferences not overwritten');
select pg_temp.assert_true(public.get_my_member_identity()->'activity'->'research'->>'publications'='1','actual publication count');
select pg_temp.assert_true(public.get_my_member_identity()->'activity'->>'liveRoomsHosted'='1','actual hosted count');
select pg_temp.assert_true(not (public.get_my_member_identity()->'identity' ?| array['email','phone','auth','raw_user_meta_data']),'no private auth metadata returned');
select pg_temp.expect_error($q$select public.save_my_member_preferences('roles',array['school_leader'])$q$,'Invalid preference category');
select pg_temp.expect_error($q$select public.save_my_member_preferences('area',array['school_leader'],'school_leader')$q$,'supported preference');
select pg_temp.expect_error($q$select public.save_my_member_preferences('area',array['technology'],null)$q$,'exactly one primary');
select pg_temp.expect_error($q$select public.save_my_member_preferences('skill',array['python'],'python')$q$,'Only a selected area');
select pg_temp.expect_error($q$update public.profiles set platform_role='school_leader'$q$,'permission denied');
select pg_temp.expect_error($q$update public.profiles set school_id=null$q$,'permission denied');
select pg_temp.expect_error($q$insert into public.member_profile_details values(auth.uid(),'hack','',now())$q$,'permission denied');
select pg_temp.expect_error($q$select public.save_my_member_identity('x','javascript:alert(1)','','',null,null,null)$q$,'HTTPS');
select pg_temp.expect_error($q$select public.save_my_member_identity('x',null,repeat('x',601),'',null,null,null)$q$,'length limit');
select pg_temp.expect_error($q$select public.change_my_member_school('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001')$q$,'approved League directory');
select public.change_my_member_school('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
select pg_temp.assert_true(public.get_my_member_identity()->'school'->>'name'='School B','ordinary member changes canonical school');
select pg_temp.expect_error($q$select public.change_my_member_school(null,'10000000-0000-0000-0000-000000000001')$q$,'Refresh');
select public.change_my_member_school(null,'10000000-0000-0000-0000-000000000002');
select pg_temp.assert_true(public.get_my_member_identity()->'school'='null'::jsonb,'ordinary member leaves canonical school');
select pg_temp.assert_true(public.get_my_member_identity()->'activity'->'season1'->>'teamName'='Real team','school leave preserves Season history');
select pg_temp.assert_true(public.get_my_member_identity()->'activity'->'research'->>'submissions'='2','school leave preserves research history');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select pg_temp.assert_true(public.get_my_member_identity()->'roles'->0->>'label'='School Leader','authoritative leader badge');
select pg_temp.assert_true((select count(*)=0 from public.member_profile_choices),'cannot read other preferences');
select pg_temp.assert_true((select count(*)=0 from public.member_profile_details),'cannot read other bio');
select pg_temp.expect_error($q$select public.change_my_member_school(null,'10000000-0000-0000-0000-000000000001')$q$,'step down');
select pg_temp.expect_error($q$select public.test_legacy_school_change('10000000-0000-0000-0000-000000000002')$q$,'step down');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.expect_error($q$select public.change_my_member_school(null,'10000000-0000-0000-0000-000000000001')$q$,'League school-team');
-- Existing invite-code join changes affiliation after inserting its membership.
reset role;
update public.teams set school_id='10000000-0000-0000-0000-000000000002';
set role authenticated;
select public.test_legacy_school_change('10000000-0000-0000-0000-000000000002');
select pg_temp.assert_true(public.get_my_member_identity()->'school'->>'name'='School B','existing team join can set its matching school');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select pg_temp.assert_true(public.get_my_member_identity()->'activity'->'season1'='null'::jsonb,'new member has no fabricated participation');
select public.save_my_member_preferences('area','{}');
select pg_temp.assert_true(public.get_my_member_identity()->'choices'='[]'::jsonb,'empty preferences supported');
update public.profiles set display_name='Wrong' where user_id='00000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select pg_temp.expect_error($q$select public.save_my_member_preferences('skill',array['python'])$q$,'active member');
select set_config('request.jwt.claim.sub','',false);
select pg_temp.expect_error($q$select public.get_my_member_identity()$q$,'active member');
reset role;
select pg_temp.assert_true((select display_name='New name' from public.profiles where user_id='00000000-0000-0000-0000-000000000001'),'cannot update other member');
-- Reapply retains all new and existing data.
\ir ../supabase/migrations/20260926020000_member_identity_center.sql
select pg_temp.assert_true((select count(*)=4 from public.member_profile_choices),'idempotent migration preserves preferences');
select pg_temp.assert_true((select bio='My bio' from public.member_profile_details where user_id='00000000-0000-0000-0000-000000000001'),'idempotent migration preserves bio');
insert into public.member_profile_options values('skill','new-tool','New Tool',100);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select public.save_my_member_preferences('skill',array['new-tool']);
select pg_temp.assert_true(public.get_my_member_identity()->'choices'->0->>'key'='new-tool','extensible catalog');
reset role;
select 'PASS: Member Identity permission and persistence scenarios';
