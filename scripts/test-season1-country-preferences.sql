-- Fresh local cluster ONLY; includes regression coverage for existing team RPCs.
\ir test-season1-reusable-team-names.sql
update public.world_preseason_seasons set lobby_opens_at=now()-interval '1 hour';
create temporary table country_before as select pg_temp.team_history() as data;
\ir ../supabase/migrations/20261018000000_season1_country_preferences.sql
\ir ../supabase/migrations/20261018000000_season1_country_preferences.sql
select pg_temp.assert_true(pg_temp.team_history()=(select data from country_before),'migration and replay preserve every existing team and history row');

insert into public.profiles(user_id,display_name)
select pg_temp.player(n),'Country test '||n from generate_series(101,116) n;
insert into public.world_preseason_teams(id,season_id,name,captain_user_id,created_by,recruitment_locked)
select pg_temp.player(1000+n),s.id,'Country test team '||n,pg_temp.player(101+(n-1)*4),pg_temp.player(101+(n-1)*4),false
from generate_series(1,4) n cross join public.world_preseason_seasons s where s.code='season-1';
insert into public.world_preseason_team_members(season_id,team_id,user_id,member_role)
select t.season_id,t.id,pg_temp.player(101+(n-1)*4+k),case when k=0 then 'captain' else 'member' end
from generate_series(1,4) n cross join generate_series(0,3) k join public.world_preseason_teams t on t.id=pg_temp.player(1000+n);
update public.world_preseason_teams set recruitment_locked=true where name like 'Country test team %';

select pg_temp.assert_true(not has_table_privilege('authenticated','public.world_preseason_country_preferences','SELECT'),'private submitter identities cannot be read directly');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.world_preseason_country_preferences','INSERT'),'cannot bypass eligibility via table writes');
select pg_temp.assert_true(not has_function_privilege('anon','public.get_world_preseason_country_preferences()','EXECUTE'),'anonymous reads denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.world_preseason_release_ineligible_country(uuid)','EXECUTE'),'private release helper not callable');
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.player(101)::text,false);
select pg_temp.assert_true(jsonb_array_length(public.get_world_preseason_country_preferences()->'countries')=70,'all 70 codes exposed');
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->>'eligible'='true','eligible captain recognized');
select public.set_world_preseason_country_preference(pg_temp.player(1001),'52',null);
select public.set_world_preseason_country_preference(pg_temp.player(1001),'52',null);
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->'preference'->>'code'='52','same selection retry is idempotent');
select pg_temp.expect_error(format('select public.set_world_preseason_country_preference(%L,%L,null)',pg_temp.player(1001),'71'),'01 to 70');
select pg_temp.expect_error(format('select public.set_world_preseason_country_preference(%L,%L,null)',pg_temp.player(1001),'01'),'selection changed');

select set_config('request.jwt.claim.sub',pg_temp.player(105)::text,false);
select public.set_world_preseason_country_preference(pg_temp.player(1002),'01',null);
select pg_temp.expect_error(format('select public.set_world_preseason_country_preference(%L,%L,%L)',pg_temp.player(1002),'52','01'),'already been selected');
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->'preference'->>'code'='01','failed switch preserves original country');
select pg_temp.assert_true(public.get_world_preseason_country_preferences()::text not like '%submitted_by%' and public.get_world_preseason_country_preferences()::text not like '%Country test team 1%','availability does not leak another team identity or submitter');
select set_config('request.jwt.claim.sub',pg_temp.player(102)::text,false);
select pg_temp.expect_error(format('select public.set_world_preseason_country_preference(%L,%L,null)',pg_temp.player(1001),'02'),'Only the current team captain');
select pg_temp.expect_error(format('select public.set_world_preseason_country_preference(%L,%L,null)',pg_temp.player(1002),'02'),'Only the current team captain');

-- Captain removal remains authorized while recruitment is locked.
select set_config('request.jwt.claim.sub',pg_temp.player(101)::text,false);
select public.world_preseason_remove_member(pg_temp.player(1001),pg_temp.player(104));
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->'preference'->>'code'='52','4 to 3 retains preference');
select public.world_preseason_remove_member(pg_temp.player(1001),pg_temp.player(103));
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->'preference'='null'::jsonb,'3 to 2 immediately releases preference');
select pg_temp.expect_error(format('select public.set_world_preseason_country_preference(%L,%L,null)',pg_temp.player(1001),'52'),'At least 3');

select set_config('request.jwt.claim.sub',pg_temp.player(105)::text,false);
select public.set_world_preseason_country_preference(pg_temp.player(1002),'52','01');
select public.world_preseason_set_team_lock(pg_temp.player(1002),false);
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->'preference'='null'::jsonb,'unlock immediately releases');
select pg_temp.expect_error(format('select public.set_world_preseason_country_preference(%L,%L,null)',pg_temp.player(1002),'52'),'Lock recruitment');
select public.world_preseason_set_team_lock(pg_temp.player(1002),true);
select public.set_world_preseason_country_preference(pg_temp.player(1002),'52',null);
select public.world_preseason_leave_team(pg_temp.player(1002));
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'='null'::jsonb,'departed captain loses access');
select set_config('request.jwt.claim.sub',pg_temp.player(106)::text,false);
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->>'isCaptain'='true','successor gets authority');
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->'preference'->>'code'='52','captain handover with 3 members retains preference');
select public.set_world_preseason_country_preference(pg_temp.player(1002),'70','52');
select set_config('request.jwt.claim.sub',pg_temp.player(107)::text,false);
select public.world_preseason_leave_team(pg_temp.player(1002));
reset role;
select pg_temp.assert_true((select released_at is not null and release_reason='fewer_than_three_members' from public.world_preseason_country_preferences where team_id=pg_temp.player(1002)),'member self-leave below 3 releases without losing history');

-- Requalifying does not silently reclaim a country; captain selects again.
update public.world_preseason_teams set recruitment_locked=false where id=pg_temp.player(1001);
insert into public.world_preseason_team_members(season_id,team_id,user_id)
select season_id,id,pg_temp.player(103) from public.world_preseason_teams where id=pg_temp.player(1001);
update public.world_preseason_teams set recruitment_locked=true where id=pg_temp.player(1001);
set role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.player(101)::text,false);
select pg_temp.assert_true(public.get_world_preseason_country_preferences()->'myTeam'->'preference'='null'::jsonb,'no implicit reclaim on requalification');
select public.set_world_preseason_country_preference(pg_temp.player(1001),'70',null);
select public.world_preseason_dissolve_team(pg_temp.player(1001));
reset role;
select pg_temp.assert_true((select released_at is not null from public.world_preseason_country_preferences where team_id=pg_temp.player(1001)),'dissolution releases and retains history');
update public.profiles set account_status='suspended' where user_id=pg_temp.player(101);
set role authenticated;
select pg_temp.expect_error('select public.get_world_preseason_country_preferences()','active authenticated');
reset role;
select pg_temp.assert_true((select count(*)=0 from pg_publication_tables where tablename='world_preseason_country_preferences'),'private preference rows are not broadcast');
select 'PASS: permissions, exclusive choices, atomic switches, locked captain removal, leave, handover, automatic release, requalification, replay, retained history' as result;
