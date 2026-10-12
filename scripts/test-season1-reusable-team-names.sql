-- DISPOSABLE season1_test DATABASE ONLY. Includes all existing lifecycle/admin tests.
\ir test-season1-admin-overview.sql
update public.world_preseason_seasons set lobby_opens_at = now() - interval '1 hour';

-- Capture complete stored rows before the DDL, including retained private history.
create function pg_temp.team_history() returns jsonb language sql as $$
  select jsonb_build_object(
    'teams', (select jsonb_agg(to_jsonb(t) order by id) from public.world_preseason_teams t),
    'members', (select jsonb_agg(to_jsonb(t) order by id) from public.world_preseason_team_members t),
    'channels', (select jsonb_agg(to_jsonb(t) order by id) from public.world_preseason_chat_channels t),
    'messages', (select jsonb_agg(to_jsonb(t) order by id) from public.world_preseason_chat_messages t),
    'applications', (select jsonb_agg(to_jsonb(t) order by id) from public.world_preseason_team_applications t),
    'invites', (select jsonb_agg(to_jsonb(t) order by id) from public.world_preseason_team_invites t)
  );
$$;
create temporary table preserved_history as select pg_temp.team_history() as data;
\ir ../supabase/migrations/20261012040000_season1_reusable_team_names.sql
select pg_temp.assert_true(pg_temp.team_history() = (select data from preserved_history), 'all existing team, roster, chat, application and invitation rows unchanged');

set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
select public.world_preseason_create_team('Dissolve atomically', 'Corrected slogan') as replacement_team \gset
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'id' = :'replacement_team', 'original captain can recreate under original dissolved name');
select pg_temp.assert_true(:'replacement_team' <> :'dissolve_team', 'recreation has a new identity');
reset role;
select pg_temp.assert_true((select count(*) = 1 from public.world_preseason_chat_messages where channel_id = :'dissolve_channel'), 'old private chat history retained');
select pg_temp.assert_true((select team_code <> (select team_code from public.world_preseason_teams where id = :'dissolve_team') from public.world_preseason_teams where id = :'replacement_team'), 'new identity has a distinct stable team code');
set role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.world_preseason_chat_messages where channel_id = :'dissolve_channel'), 'new captain cannot read dissolved team chat');
select pg_temp.assert_true(public.get_world_preseason_lobby()->'teamMessages' = '[]'::jsonb, 'new team does not inherit old private chat');
select pg_temp.expect_error(format('select public.world_preseason_post_message(%L,%L,%L,%L::jsonb)', :'dissolve_team', 'Forbidden', 'TEXT', '{}'), 'Active team membership required');
reset role;

-- Every non-dissolved status still reserves its name, including locked rosters.
select set_config('test.replacement_team', :'replacement_team', false);
do $$ declare team_status text;
begin
  foreach team_status in array array['forming','recruiting','full','ready','registered','active','frozen'] loop
    update public.world_preseason_teams set status = team_status where id = current_setting('test.replacement_team')::uuid;
    perform set_config('request.jwt.claim.sub', pg_temp.player(18)::text, false);
    perform pg_temp.expect_error($sql$select public.world_preseason_create_team('Dissolve atomically')$sql$, 'world_preseason_live_team_name_idx');
  end loop;
  update public.world_preseason_teams set status = 'forming' where id = current_setting('test.replacement_team')::uuid;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.player(1)::text, false);
select public.world_preseason_leave_team(:'replacement_team');
select set_config('request.jwt.claim.sub', pg_temp.player(18)::text, false);
select public.world_preseason_create_team('Dissolve atomically', 'Another captain') as third_team \gset
select pg_temp.assert_true(public.get_world_preseason_my_team()->'team'->>'id' = :'third_team', 'another account can reuse the name after last-member dissolution');
reset role;
select pg_temp.assert_true((select count(*) = 3 from public.world_preseason_teams where name = 'Dissolve atomically'), 'all three identities are retained');
select pg_temp.assert_true((select count(*) = 2 from public.world_preseason_teams where name = 'Dissolve atomically' and status = 'dissolved'), 'both dissolved identities are retained');

-- Uniqueness stays scoped to the season, as it was before this fix.
insert into public.world_preseason_seasons(code, display_name) values ('season-test', 'Disposable second season') returning id as other_season \gset
insert into public.world_preseason_teams(season_id, name, captain_user_id, created_by)
values (:'other_season', 'Dissolve atomically', pg_temp.player(24), pg_temp.player(24));

truncate preserved_history;
insert into preserved_history select pg_temp.team_history();
\ir ../supabase/migrations/20261012040000_season1_reusable_team_names.sql
select pg_temp.assert_true(pg_temp.team_history() = (select data from preserved_history), 'replay preserves same-named historical and current teams');
\ir verify-season1-team-lifecycle.sql
\ir verify-season1-reusable-team-names.sql
select pg_temp.assert_true(
  not exists (select 1 from pg_constraint where conrelid = 'public.world_preseason_teams'::regclass and conname = 'world_preseason_teams_season_id_name_key')
  and exists (select 1 from pg_index where indexrelid = 'public.world_preseason_live_team_name_idx'::regclass and indisunique and indisvalid),
  'legacy constraint removed and valid unique replacement installed');
select 'PASS: preserved data, original and new captains, repeated dissolution, locked names, cross-season uniqueness, private chat isolation and idempotent replay' as result;
