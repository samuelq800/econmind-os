-- Builds the disposable lifecycle fixture, never a production database.
\ir test-season1-team-lifecycle.sql
\ir ../supabase/migrations/20261011000000_season1_admin_overview.sql
\ir ../supabase/migrations/20261011000000_season1_admin_overview.sql
\ir verify-season1-admin-overview.sql

-- The fixture closes the participant gate at its end. Admin reads still work;
-- ordinary members, captains and unauthenticated calls must be rejected.
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error('select public.get_world_preseason_admin_overview()', 'Platform administrator role required');
set role anon;
select pg_temp.expect_error('select public.get_world_preseason_admin_overview()', 'permission denied');
reset role;
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
set role authenticated;
select pg_temp.expect_error('select public.get_world_preseason_admin_overview()', 'Platform administrator role required');
reset role;
select set_config('request.jwt.claim.sub', pg_temp.player(30)::text, false);
set role authenticated;
select pg_temp.assert_true(public.get_world_preseason_admin_overview()->'stats'->>'registeredPlayers'='30', 'account total is real and separate from participants');
select pg_temp.assert_true((public.get_world_preseason_admin_overview()->'stats'->>'teams')::int = jsonb_array_length(public.get_world_preseason_admin_overview()->'teams'), 'total matches all current teams, without pagination');
select pg_temp.assert_true((public.get_world_preseason_admin_overview()->'stats'->>'teamMembers')::int = (select sum(jsonb_array_length(t->'members')) from jsonb_array_elements(public.get_world_preseason_admin_overview()->'teams') t), 'member count matches full rosters');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.get_world_preseason_admin_overview()->'teams') t where t->>'status'='dissolved'), 'dissolved teams are excluded');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.get_world_preseason_admin_overview()->'teams') t where jsonb_array_length(t->'members') <> (t->>'memberCount')::int), 'each team includes its complete roster');
select pg_temp.assert_true((public.get_world_preseason_admin_overview()->>'snapshotAt')::timestamptz <= now(), 'server timestamp included');
select pg_temp.assert_true(public.get_world_preseason_admin_overview()::text not like '%Retained private team history%', 'private messages are not exposed');
reset role;

-- A duplicated free-agent listing must never double-count an in-team member.
insert into public.world_preseason_free_agents(season_id,user_id)
select season_id,user_id from public.world_preseason_team_members limit 1
on conflict(season_id,user_id) do update set availability_status='available';
set role authenticated;
select pg_temp.assert_true((public.get_world_preseason_admin_overview()->'stats'->>'participants')::int =
  (public.get_world_preseason_admin_overview()->'stats'->>'teamMembers')::int + (public.get_world_preseason_admin_overview()->'stats'->>'freeAgents')::int, 'participants do not double-count stale free-agent listings');
reset role;
select 'PASS: admin-only snapshot, all team rosters, truthful totals, privacy and idempotency' as result;
