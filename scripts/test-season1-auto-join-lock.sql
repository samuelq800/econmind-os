-- Continues the disposable season1_test fixture above.
reset role;
update public.world_preseason_seasons set lobby_opens_at=now()-interval '1 hour';
update public.world_preseason_teams set status='recruiting' where id=:'team_a';
\ir ../supabase/migrations/20261002000000_season1_auto_join_and_lock.sql
\ir ../supabase/migrations/20261002000000_season1_auto_join_and_lock.sql
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select pg_temp.expect_error(format('select public.world_preseason_set_team_lock(%L,true)',:'team_a'),'Only the current team captain');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.world_preseason_set_team_lock(:'team_a',true);
select pg_temp.assert_true((public.get_world_preseason_my_team()->'team'->>'recruitmentLocked')::boolean,'captain lock visible');
select public.world_preseason_remove_member(:'team_a','00000000-0000-0000-0000-000000000006');
select public.world_preseason_set_my_readiness(true);
select pg_temp.assert_true(not (select (x->>'recruiting')::boolean from jsonb_array_elements(public.get_world_preseason_lobby()->'teams') x where x->>'id'=:'team_a'),'remove and readiness do not reopen locked team');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select pg_temp.expect_error(format('select public.world_preseason_apply_to_team(%L)',:'team_a'),'not recruiting');
select pg_temp.expect_error(format('select public.world_preseason_apply_by_team_code(%L)',:'stable_code'),'not recruiting');
select pg_temp.expect_error(format('select public.world_preseason_respond_to_invite(%L,true)',:'full_invite'),'locked and is not accepting');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.expect_error(format('select public.world_preseason_review_application(%L,true)',:'overflow_app'),'locked and is not accepting');
select public.world_preseason_set_team_lock(:'team_a',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
select public.world_preseason_apply_by_team_code(:'stable_code') as accepted_application \gset
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'id'=:'team_a','code apply joins immediately');
select pg_temp.assert_true(public.world_preseason_apply_to_team(:'team_a')=:'accepted_application'::uuid,'retry does not duplicate membership');
select pg_temp.assert_true(public.world_preseason_apply_by_team_code(:'stable_code')=:'accepted_application'::uuid,'code retry does not duplicate membership');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select pg_temp.expect_error(format('select public.world_preseason_apply_to_team(%L)',:'team_a'),'not recruiting');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.world_preseason_remove_member(:'team_a','00000000-0000-0000-0000-000000000009');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select public.world_preseason_apply_to_team(:'team_a');
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'id'=:'team_a','card apply joins immediately');
select pg_temp.assert_true(jsonb_array_length(public.get_world_preseason_my_team()->'members')=6,'six-member capacity retained');
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.world_preseason_set_team_lock(uuid,boolean)','EXECUTE'),'anonymous lock denied');
select 'PASS: captain lock, auto-join, capacity, replay, retries and invitation guards' as result;
