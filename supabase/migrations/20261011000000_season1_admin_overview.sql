-- Read-only admin projection. No team, profile, permission or simulation data is changed.
begin;

create or replace function public.get_world_preseason_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_season_id uuid;
begin
  perform public.world_preseason_require_admin();
  select id into v_season_id from public.world_preseason_seasons where code = 'season-1';
  if v_season_id is null then raise exception 'Season 1 configuration is unavailable'; end if;
  return (
    with teams as materialized (
      select t.* from public.world_preseason_teams t
      where t.season_id = v_season_id and t.status <> 'dissolved'
    ), members as materialized (
      select m.* from public.world_preseason_team_members m join teams t on t.id = m.team_id
      where m.season_id = v_season_id
    ), free_agents as materialized (
      select f.user_id from public.world_preseason_free_agents f
      where f.season_id = v_season_id and f.availability_status = 'available'
        and not exists (select 1 from members m where m.user_id = f.user_id)
    )
    select jsonb_build_object(
      'seasonId', v_season_id, 'snapshotAt', statement_timestamp(),
      'stats', jsonb_build_object(
        'registeredPlayers', (select count(*) from public.profiles where account_status = 'active'),
        'participants', (select count(*) from (select user_id from members union select user_id from free_agents) p),
        'teamMembers', (select count(*) from members),
        'teams', (select count(*) from teams),
        'freeAgents', (select count(*) from free_agents),
        'readyMembers', (select count(*) from members where is_ready)
      ),
      'teams', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'code', t.team_code,
        'description', t.description, 'focus', t.recruitment_focus,
        'capacity', t.capacity, 'status', t.status,
        'recruiting', t.recruiting, 'recruitmentLocked', t.recruitment_locked,
        'recruitmentMode', t.recruitment_mode, 'teamStyle', t.team_style,
        'preferredLanguage', t.preferred_language,
        'schoolName', s.name, 'createdAt', t.created_at,
        'memberCount', (select count(*) from members m where m.team_id = t.id),
        'readyCount', (select count(*) from members m where m.team_id = t.id and m.is_ready),
        'applicationCount', (select count(*) from public.world_preseason_team_applications a where a.team_id = t.id and a.season_id = v_season_id and a.status = 'pending'),
        'members', coalesce((select jsonb_agg(jsonb_build_object(
          'userId', m.user_id, 'displayName', coalesce(p.display_name, 'Participant'),
          'schoolName', school.name, 'memberRole', m.member_role,
          'rolePreferences', m.role_preferences, 'isReady', m.is_ready, 'joinedAt', m.joined_at
        ) order by (m.member_role = 'captain') desc, m.joined_at, m.user_id)
          from members m left join public.profiles p on p.user_id = m.user_id
          left join public.schools school on school.id = p.school_id where m.team_id = t.id), '[]'::jsonb)
      ) order by t.created_at desc, t.id) from teams t left join public.schools s on s.id = t.school_id), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_world_preseason_admin_overview() from public, anon, authenticated;
grant execute on function public.get_world_preseason_admin_overview() to authenticated;

-- Members/free-agent events are already published. Team-only edits (e.g. locks)
-- must also invalidate the snapshot; existing row-level authorization is kept.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'world_preseason_teams') then
    alter publication supabase_realtime add table public.world_preseason_teams;
  end if;
end $$;
commit;
