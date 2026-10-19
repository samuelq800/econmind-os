-- Disposable local PostgreSQL fixture only. Never execute against production.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'mail_recipient_groups_test' then raise exception 'Disposable fixture database required'; end if; end $$;
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users(id uuid primary key, email text, deleted_at timestamptz);
create table public.schools(id uuid primary key, name text);
create table public.profiles(user_id uuid primary key, display_name text, school_id uuid, onboarding_path text, platform_role text, role text);
create function public.is_platform_admin(id uuid) returns boolean language sql stable as $$ select id = '00000000-0000-0000-0000-000000000001'::uuid $$;
create table public.world_preseason_seasons(id uuid primary key, code text);
create table public.world_preseason_teams(id uuid primary key, season_id uuid, created_by uuid, captain_user_id uuid, status text);
create table public.world_preseason_team_members(team_id uuid, season_id uuid, user_id uuid, member_role text);
create table public.world_preseason_free_agents(season_id uuid, user_id uuid, availability_status text);
insert into auth.users select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid, 'fixture' || n || '@example.test', case when n=210 then now() end from generate_series(1,210) n;
insert into public.schools values('10000000-0000-0000-0000-000000000001','Fixture school');
insert into public.profiles select id, 'Fixture', case when right(id::text,1)='3' then '10000000-0000-0000-0000-000000000001'::uuid end,
  case when right(id::text,1)='4' then 'visitor' end, case when right(id::text,1)='3' then 'school_leader' else 'user' end,
  case when right(id::text,1)='3' then 'professor' else 'student' end from auth.users;
insert into public.world_preseason_seasons values('20000000-0000-0000-0000-000000000001','season-1'),('20000000-0000-0000-0000-000000000002','season-2');
-- Founder 2 has transferred captaincy to 3 and is no longer a member.
insert into public.world_preseason_teams values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','recruiting'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000006','dissolved'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000007','recruiting');
insert into public.world_preseason_team_members values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','captain'),
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','member'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','captain'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000007','captain');
insert into public.world_preseason_free_agents values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','available'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005','available'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000008','paused');
create temp table before_data as select jsonb_build_array(
 (select jsonb_agg(to_jsonb(p)) from profiles p), (select jsonb_agg(to_jsonb(t)) from world_preseason_teams t),
 (select jsonb_agg(to_jsonb(m)) from world_preseason_team_members m)) as snapshot;
\ir ../supabase/migrations/20261019000000_admin_mail_recipient_groups.sql
\ir ../supabase/migrations/20261019000000_admin_mail_recipient_groups.sql
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare g text[]; begin
 if (select count(*) from public.admin_mail_recipient_directory()) <> 200 then raise exception 'First page'; end if;
 if (select count(*) from public.admin_mail_recipient_directory('00000000-0000-0000-0000-000000000200')) <> 9 then raise exception 'Second page / deleted user'; end if;
 select groups into g from public.admin_mail_recipient_directory() where user_id='00000000-0000-0000-0000-000000000002';
 if g <> array['season1_team_founders'] then raise exception 'Original founder identity: %',g; end if;
 select groups into g from public.admin_mail_recipient_directory() where user_id='00000000-0000-0000-0000-000000000003';
 if g <> array['season1_participants','season1_team_members','school_participants','school_leaders','teachers_professors'] then raise exception 'Current captain / stale free agent: %',g; end if;
 select groups into g from public.admin_mail_recipient_directory() where user_id='00000000-0000-0000-0000-000000000004';
 if not ('individual_participants'=any(g) and 'season1_team_members'=any(g)) then raise exception 'Individual member'; end if;
 select groups into g from public.admin_mail_recipient_directory() where user_id='00000000-0000-0000-0000-000000000005';
 if g <> array['season1_participants','season1_free_agents'] then raise exception 'Available free agent'; end if;
 if exists(select 1 from public.admin_mail_recipient_directory() where user_id in ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008') and cardinality(groups)>0) then raise exception 'Dissolved / other season / paused'; end if;
 if (select snapshot from before_data) <> jsonb_build_array((select jsonb_agg(to_jsonb(p)) from profiles p),(select jsonb_agg(to_jsonb(t)) from world_preseason_teams t),(select jsonb_agg(to_jsonb(m)) from world_preseason_team_members m)) then raise exception 'Existing data changed'; end if;
 if has_function_privilege('anon','public.admin_mail_recipient_directory(uuid)','execute') then raise exception 'Anonymous grant'; end if;
end $$;
set role authenticated;
-- Authenticated admins may read; ordinary users may not.
do $$ begin if (select count(*) from public.admin_mail_recipient_directory()) <> 200 then raise exception 'Admin cannot read'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 begin perform public.admin_mail_recipient_directory(); raise exception 'Non-admin unexpectedly allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
 begin perform public.admin_mail_recipient_directory(); raise exception 'Null identity unexpectedly allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: categories, original founders, pagination, permissions, repeat migration, preserved rows' as result;
