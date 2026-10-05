-- Season 1 collaboration only: durable home-school discovery, captain
-- succession and dissolution. No World, economic state, clock or ledger writes.
begin;

do $$
begin
  if to_regprocedure('public.get_world_preseason_my_team()') is null
    or to_regprocedure('public.world_preseason_apply_by_team_code(text)') is null
    or to_regprocedure('public.world_preseason_set_team_lock(uuid,boolean)') is null
    or to_regprocedure('public.world_preseason_guard_member_join()') is null
    or to_regprocedure('public.world_preseason_leave_team(uuid)') is null
    or not exists (
      select 1 from pg_attribute where attrelid = 'public.world_preseason_teams'::regclass
      and attname = 'recruitment_locked' and not attisdropped and attnotnull
    )
    or not exists (
      select 1 from pg_attribute a join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = 'public.world_preseason_teams'::regclass and a.attname = 'team_code'
        and not a.attisdropped and a.attnotnull
    )
    or not exists (
      select 1 from pg_trigger where tgrelid = 'public.world_preseason_team_members'::regclass
        and tgname = 'world_preseason_guard_member_join' and not tgisinternal and tgenabled = 'O'
    ) then
    raise exception 'Season 1 lifecycle requires My Team, stable team codes, automatic joins and recruitment locks';
  end if;
  if position('recruitmentLocked' in pg_get_functiondef('public.get_world_preseason_my_team()'::regprocedure)) = 0
    or position('recruitment_locked' in pg_get_functiondef('public.world_preseason_apply_to_team(uuid,text)'::regprocedure)) = 0
    or position('insert into public.world_preseason_team_members' in pg_get_functiondef('public.world_preseason_apply_to_team(uuid,text)'::regprocedure)) = 0 then
    raise exception 'Season 1 lifecycle requires the current My Team and automatic-join implementation';
  end if;
end;
$$;

-- Some deployments already have school_id. Bind missing home schools once from
-- the founding creator, retaining any existing school (and explicitly unknown
-- schools). The marker prevents replay from rebinding after profile changes.
do $$
begin
  if not exists (
    select 1 from pg_attribute where attrelid = 'public.world_preseason_teams'::regclass
      and attname = 'school_id' and not attisdropped
  ) then
    alter table public.world_preseason_teams
      add column school_id uuid references public.schools(id) on delete set null;
  end if;
end;
$$;
alter table public.world_preseason_teams
  add column if not exists home_school_bound_at timestamptz;
update public.world_preseason_teams team
set school_id = coalesce(team.school_id, (
    select profile.school_id from public.profiles profile where profile.user_id = team.created_by
  )), home_school_bound_at = now()
from public.world_preseason_seasons season
where season.id = team.season_id and season.code = 'season-1'
  and team.home_school_bound_at is null;
create index if not exists world_preseason_teams_school_discovery_idx
  on public.world_preseason_teams(season_id, school_id, recruiting, created_at desc);

-- The roster's original same-team lookup recursively evaluated its own RLS
-- policy, also blocking channel/message reads. Resolve only the caller's own
-- membership under the definer; preserve the existing gate and policy scope.
create or replace function public.world_preseason_is_current_team_member(p_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.world_preseason_team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;
revoke all on function public.world_preseason_is_current_team_member(uuid) from public, anon, authenticated;
grant execute on function public.world_preseason_is_current_team_member(uuid) to authenticated;
alter policy world_preseason_member_roster_read on public.world_preseason_team_members
  using (public.world_preseason_gate_open() and (
    user_id = auth.uid() or public.world_preseason_is_current_team_member(team_id)
      or public.is_platform_admin(auth.uid())
  ));

create or replace function public.world_preseason_create_team(
  p_name text,
  p_description text default '',
  p_recruitment_mode text default 'open',
  p_team_style text default 'balanced',
  p_preferred_language text default 'English',
  p_role_preferences text[] default '{}'::text[]
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_season public.world_preseason_seasons%rowtype;
  v_team_id uuid;
  v_school_id uuid;
begin
  perform public.world_preseason_require_participant();
  select * into v_season from public.world_preseason_seasons
  where code = 'season-1' and status in ('pre_season', 'registration_open');
  if not found then raise exception 'Season 1 is not available'; end if;
  if exists (
    select 1 from public.world_preseason_team_members
    where season_id = v_season.id and user_id = auth.uid()
  ) then raise exception 'You already have an active team for this season'; end if;
  select school_id into v_school_id from public.profiles where user_id = auth.uid();
  -- Omit team_code deliberately: its existing unique default remains in force.
  insert into public.world_preseason_teams(
    season_id, name, description, recruitment_focus, recruitment_mode,
    team_style, preferred_language, capacity, school_id, home_school_bound_at, captain_user_id, created_by
  ) values (
    v_season.id, trim(p_name), trim(coalesce(p_description, '')),
    trim(coalesce(p_description, '')), p_recruitment_mode, p_team_style,
    trim(p_preferred_language), 6, v_school_id, now(), auth.uid(), auth.uid()
  ) returning id into v_team_id;
  insert into public.world_preseason_team_members(
    season_id, team_id, user_id, member_role, role_preferences
  ) values (v_season.id, v_team_id, auth.uid(), 'captain', coalesce(p_role_preferences, '{}'));
  insert into public.world_preseason_chat_channels(season_id, channel_type, team_id)
  values (v_season.id, 'TEAM', v_team_id);
  perform public.world_preseason_refresh_team(v_team_id);
  return v_team_id;
end;
$$;

create or replace function public.world_preseason_dissolve_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype;
begin
  perform public.world_preseason_require_participant();
  select t.* into v_team from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id = t.season_id
  where t.id = p_team_id and s.code = 'season-1' for update of t;
  if not found or v_team.captain_user_id <> auth.uid() or not exists (
    select 1 from public.world_preseason_team_members
    where team_id = p_team_id and user_id = auth.uid() and member_role = 'captain'
  ) then raise exception 'Only the current team captain can dissolve this team'; end if;
  if v_team.status in ('frozen', 'dissolved', 'registered', 'active') then
    raise exception 'This team roster is locked';
  end if;
  update public.world_preseason_teams
  set status = 'dissolved', recruiting = false, recruitment_locked = true
  where id = p_team_id;
  update public.world_preseason_team_applications
  set status = 'withdrawn', reviewed_by = auth.uid(), reviewed_at = timezone('utc', now())
  where team_id = p_team_id and status = 'pending';
  update public.world_preseason_team_invites
  set status = 'revoked', responded_at = timezone('utc', now())
  where team_id = p_team_id and status = 'pending';
  delete from public.world_preseason_team_members where team_id = p_team_id;
  -- Keep the team, channel, messages and reviewed applications as history.
  -- Existing membership checks revoke departed players' TEAM chat access.
end;
$$;

create or replace function public.world_preseason_create_invite(
  p_team_id uuid,
  p_invited_user_id uuid default null,
  p_expires_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype; v_code text; v_id uuid;
begin
  perform public.world_preseason_require_participant();
  select t.* into v_team from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id = t.season_id
  where t.id = p_team_id and s.code = 'season-1' for update of t;
  if not found or (not public.is_platform_admin(auth.uid()) and (
    v_team.captain_user_id <> auth.uid() or not exists (
      select 1 from public.world_preseason_team_members
      where team_id = p_team_id and user_id = auth.uid() and member_role = 'captain'
    )
  )) then raise exception 'Only the current team captain can invite players'; end if;
  if v_team.status in ('frozen', 'dissolved', 'registered', 'active') or v_team.recruitment_locked then
    raise exception 'This team roster is locked';
  end if;
  v_code := 'EM-S1-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.world_preseason_team_invites(
    season_id, team_id, invited_user_id, invited_by, code, expires_at
  ) values (v_team.season_id, v_team.id, p_invited_user_id, auth.uid(), v_code, p_expires_at)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', v_code, 'teamId', v_team.id);
end;
$$;

create or replace function public.world_preseason_leave_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_team public.world_preseason_teams%rowtype;
  v_membership public.world_preseason_team_members%rowtype;
  v_successor_user_id uuid;
begin
  perform public.world_preseason_require_participant();
  -- Every membership entry path also locks the team before insertion. Keep the
  -- same order for leave/removal/succession so capacity and captain stay atomic.
  select t.* into v_team from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id = t.season_id
  where t.id = p_team_id and s.code = 'season-1' for update of t;
  if not found then raise exception 'Team not found'; end if;
  select * into v_membership from public.world_preseason_team_members
  where team_id = p_team_id and user_id = auth.uid() for update;
  if not found then raise exception 'You are no longer a member of this team'; end if;
  if v_team.status in ('frozen', 'dissolved', 'registered', 'active') then
    raise exception 'This team roster is locked';
  end if;
  if v_membership.member_role = 'captain' or v_team.captain_user_id = auth.uid() then
    if v_membership.member_role <> 'captain' or v_team.captain_user_id <> auth.uid() then
      raise exception 'Team captain records are inconsistent; contact support';
    end if;
    select user_id into v_successor_user_id from public.world_preseason_team_members
    where team_id = p_team_id and user_id <> auth.uid()
    order by joined_at, user_id limit 1 for update;
    if v_successor_user_id is null then
      perform public.world_preseason_dissolve_team(p_team_id);
      return;
    end if;
    update public.world_preseason_team_members set member_role = 'captain'
    where team_id = p_team_id and user_id = v_successor_user_id;
    update public.world_preseason_teams set captain_user_id = v_successor_user_id
    where id = p_team_id;
  end if;
  delete from public.world_preseason_team_members where id = v_membership.id;
  perform public.world_preseason_refresh_team(p_team_id);
end;
$$;

create or replace function public.get_world_preseason_lobby(p_message_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_season public.world_preseason_seasons%rowtype;
  v_team_id uuid;
  v_viewer_school_id uuid;
  v_viewer_school_name text;
begin
  perform public.world_preseason_require_participant();
  select * into v_season from public.world_preseason_seasons where code = 'season-1';
  if not found then raise exception 'Season 1 configuration is unavailable'; end if;
  select profile.school_id, school.name into v_viewer_school_id, v_viewer_school_name
  from public.profiles profile left join public.schools school on school.id = profile.school_id
  where profile.user_id = auth.uid();
  select team_id into v_team_id from public.world_preseason_team_members
  where season_id = v_season.id and user_id = auth.uid();
  return jsonb_build_object(
    'season', jsonb_build_object('id', v_season.id, 'code', v_season.code,
      'displayName', v_season.display_name, 'registrationOpen', v_season.registration_open,
      'simulationLocked', v_season.simulation_locked, 'config', v_season.config),
    'viewer', jsonb_build_object('schoolId', v_viewer_school_id, 'schoolName', v_viewer_school_name),
    'stats', jsonb_build_object(
      'players', (select count(*) from public.profiles where account_status = 'active'),
      'teams', (select count(*) from public.world_preseason_teams where season_id = v_season.id and status <> 'dissolved'),
      'freeAgents', (select count(*) from public.world_preseason_free_agents where season_id = v_season.id and availability_status = 'available'),
      'recruitingTeams', (select count(*) from public.world_preseason_teams where season_id = v_season.id and recruiting)),
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'description', t.description, 'focus', t.recruitment_focus,
      'capacity', t.capacity, 'recruiting', t.recruiting, 'recruitmentMode', t.recruitment_mode,
      'teamStyle', t.team_style, 'preferredLanguage', t.preferred_language, 'status', t.status,
      'schoolId', t.school_id, 'schoolName', school.name,
      'sameSchool', coalesce(t.school_id = v_viewer_school_id, false),
      'memberCount', (select count(*) from public.world_preseason_team_members m where m.team_id = t.id),
      'readyCount', (select count(*) from public.world_preseason_team_members m where m.team_id = t.id and m.is_ready),
      'applicationCount', (select count(*) from public.world_preseason_team_applications a where a.team_id = t.id and a.status = 'pending'),
      'teamType', case
        when (select count(distinct p.school_id) from public.world_preseason_team_members m
          join public.profiles p on p.user_id = m.user_id where m.team_id = t.id and p.school_id is not null) = 1
          and (select count(*) from public.world_preseason_team_members m join public.profiles p on p.user_id = m.user_id where m.team_id = t.id)
            = (select count(*) from public.world_preseason_team_members m where m.team_id = t.id) then 'SCHOOL TEAM'
        when (select count(distinct p.school_id) from public.world_preseason_team_members m
          join public.profiles p on p.user_id = m.user_id where m.team_id = t.id and p.school_id is not null) > 1 then 'CROSS-SCHOOL TEAM'
        else 'OPEN TEAM' end,
      'schools', coalesce((select jsonb_agg(distinct s.name) from public.world_preseason_team_members m
        join public.profiles p on p.user_id = m.user_id left join public.schools s on s.id = p.school_id
        where m.team_id = t.id and s.name is not null), '[]'::jsonb)
    ) order by coalesce(t.school_id = v_viewer_school_id, false) desc, t.created_at desc, t.id)
      from public.world_preseason_teams t left join public.schools school on school.id = t.school_id
      where t.season_id = v_season.id and t.status <> 'dissolved'), '[]'::jsonb),
    'freeAgents', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', p.user_id, 'displayName', coalesce(p.display_name, 'Participant'), 'schoolName', s.name,
      'rolePreferences', coalesce((select m.role_preferences from public.world_preseason_team_members m where m.season_id = v_season.id and m.user_id = p.user_id), '{}'::text[]),
      'interests', f.interests, 'preferredLanguage', f.preferred_language, 'teamStylePreference', f.team_style_preference)
      order by f.updated_at desc) from public.world_preseason_free_agents f join public.profiles p on p.user_id = f.user_id
      left join public.schools s on s.id = p.school_id where f.season_id = v_season.id and f.availability_status = 'available'), '[]'::jsonb),
    'membership', (select jsonb_build_object('teamId', m.team_id, 'memberRole', m.member_role, 'rolePreferences', m.role_preferences, 'isReady', m.is_ready)
      from public.world_preseason_team_members m where m.season_id = v_season.id and m.user_id = auth.uid()),
    'members', coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'displayName', coalesce(p.display_name, 'Participant'),
      'schoolName', s.name, 'memberRole', m.member_role, 'rolePreferences', m.role_preferences, 'isReady', m.is_ready)
      order by (m.member_role = 'captain') desc, m.joined_at, m.user_id)
      from public.world_preseason_team_members m join public.profiles p on p.user_id = m.user_id
      left join public.schools s on s.id = p.school_id where m.team_id = v_team_id), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'teamId', a.team_id, 'teamName', t.name,
      'applicantName', coalesce(p.display_name, 'Participant'), 'note', a.note) order by a.created_at)
      from public.world_preseason_team_applications a join public.world_preseason_teams t on t.id = a.team_id
      join public.profiles p on p.user_id = a.applicant_user_id where a.season_id = v_season.id and a.status = 'pending'
      and (a.applicant_user_id = auth.uid() or t.captain_user_id = auth.uid() or public.is_platform_admin(auth.uid()))), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'teamId', i.team_id, 'teamName', t.name, 'code', i.code,
      'status', i.status, 'invitedUserId', i.invited_user_id) order by i.created_at desc)
      from public.world_preseason_team_invites i join public.world_preseason_teams t on t.id = i.team_id
      where i.season_id = v_season.id and i.status = 'pending'
      and (i.invited_user_id = auth.uid() or t.captain_user_id = auth.uid() or public.is_platform_admin(auth.uid()))), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(x order by (x ->> 'createdAt')::timestamptz asc) from (
      select jsonb_build_object('id', m.id, 'content', m.content, 'messageType', m.message_type, 'metadata', m.metadata,
        'createdAt', m.created_at, 'deletedAt', m.deleted_at, 'authorName', coalesce(p.display_name, 'Participant'), 'authorId', m.author_user_id) x
      from public.world_preseason_chat_messages m join public.world_preseason_chat_channels c on c.id = m.channel_id
      left join public.profiles p on p.user_id = m.author_user_id where c.season_id = v_season.id and c.channel_type = 'LOBBY'
      order by m.created_at desc limit greatest(1, least(p_message_limit, 100))) q), '[]'::jsonb),
    'teamMessages', coalesce((select jsonb_agg(x order by (x ->> 'createdAt')::timestamptz asc) from (
      select jsonb_build_object('id', m.id, 'content', m.content, 'messageType', m.message_type, 'metadata', m.metadata,
        'createdAt', m.created_at, 'deletedAt', m.deleted_at, 'authorName', coalesce(p.display_name, 'Participant'), 'authorId', m.author_user_id) x
      from public.world_preseason_chat_messages m join public.world_preseason_chat_channels c on c.id = m.channel_id
      left join public.profiles p on p.user_id = m.author_user_id where c.team_id = v_team_id
      order by m.created_at desc limit greatest(1, least(p_message_limit, 100))) q), '[]'::jsonb)
  );
end;
$$;

-- Keep the deployed signatures. No legacy no-argument leave/dissolve or
-- one-argument remove-member overload is introduced by this migration.
revoke all on function public.world_preseason_leave_team(uuid), public.world_preseason_dissolve_team(uuid),
  public.world_preseason_create_team(text,text,text,text,text,text[]), public.get_world_preseason_lobby(integer),
  public.world_preseason_create_invite(uuid,uuid,timestamptz)
  from public, anon, authenticated;
grant execute on function public.world_preseason_leave_team(uuid), public.world_preseason_dissolve_team(uuid),
  public.world_preseason_create_team(text,text,text,text,text,text[]), public.get_world_preseason_lobby(integer),
  public.world_preseason_create_invite(uuid,uuid,timestamptz)
  to authenticated;
-- Keep historical functions for provenance, but deny stale entry points that
-- bypass the current roster locks and refresh/succession implementation.
do $$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.world_preseason_leave_team()',
    'public.world_preseason_dissolve_team()',
    'public.world_preseason_remove_member(uuid)'
  ] loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    end if;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;
