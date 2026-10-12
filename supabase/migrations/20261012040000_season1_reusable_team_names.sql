-- Release names held by dissolved teams without changing any stored rows.
-- Active, frozen and archived-season teams retain the same name uniqueness.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Prevent a gap between installing the replacement and removing the old key.
lock table public.world_preseason_teams in access exclusive mode;

create unique index if not exists world_preseason_live_team_name_idx
  on public.world_preseason_teams(season_id, name)
  where status <> 'dissolved';

-- Fail closed on an unexpected pre-existing index, including a weaker key.
do $verify$
begin
  if not exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.world_preseason_live_team_name_idx')
      and i.indrelid = 'public.world_preseason_teams'::regclass
      and i.indisunique and i.indisvalid and i.indisready
      and i.indnkeyatts = 2 and i.indnatts = 2
      and i.indexprs is null
      and i.indkey[0] = (select attnum from pg_attribute where attrelid = i.indrelid and attname = 'season_id' and not attisdropped)
      and i.indkey[1] = (select attnum from pg_attribute where attrelid = i.indrelid and attname = 'name' and not attisdropped)
      and pg_get_expr(i.indpred, i.indrelid) = '(status <> ''dissolved''::text)'
  ) then
    raise exception 'Unexpected live-team name index; no constraints changed';
  end if;
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.world_preseason_teams'::regclass
      and conname = 'world_preseason_teams_season_id_name_key'
      and (contype <> 'u' or pg_get_constraintdef(oid) <> 'UNIQUE (season_id, name)')
  ) then
    raise exception 'Unexpected legacy team-name constraint; no constraints changed';
  end if;
end
$verify$;

-- RESTRICT is deliberate: never cascade away a dependent foreign key.
alter table public.world_preseason_teams
  drop constraint if exists world_preseason_teams_season_id_name_key;

commit;
