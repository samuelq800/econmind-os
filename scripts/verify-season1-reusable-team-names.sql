-- Read-only catalogue evidence, suitable for the Management API read-only role.
select not exists (
  select 1 from pg_constraint
  where conrelid = 'public.world_preseason_teams'::regclass
    and conname = 'world_preseason_teams_season_id_name_key'
) and exists (
  select 1 from pg_index i
  where i.indexrelid = to_regclass('public.world_preseason_live_team_name_idx')
    and i.indrelid = 'public.world_preseason_teams'::regclass
    and i.indisunique and i.indisvalid and i.indisready
    and i.indnkeyatts = 2 and i.indnatts = 2
    and i.indexprs is null
    and i.indkey[0] = (select attnum from pg_attribute where attrelid = i.indrelid and attname = 'season_id' and not attisdropped)
    and i.indkey[1] = (select attnum from pg_attribute where attrelid = i.indrelid and attname = 'name' and not attisdropped)
    and pg_get_expr(i.indpred, i.indrelid) = '(status <> ''dissolved''::text)'
) as verified;
