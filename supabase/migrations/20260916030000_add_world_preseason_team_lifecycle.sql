-- Season 1 team lifecycle and school affinity. These records remain limited
-- to pre-season collaboration; no economic world, country, office, policy,
-- clock, or ledger is created or modified here.

alter table public.world_preseason_teams
  add column if not exists school_id uuid references public.schools(id) on delete set null;

create index if not exists world_preseason_teams_school_discovery_idx
  on public.world_preseason_teams(season_id, school_id, recruiting, created_at desc);

-- Preserve a durable home-school match for existing teams where the founding
-- captain has a verified school. Cross-school membership remains allowed.
update public.world_preseason_teams team
set school_id = profile.school_id
from public.profiles profile
where profile.user_id = team.captain_user_id
  and team.school_id is null
  and profile.school_id is not null;

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
  v_capacity smallint;
  v_school_id uuid;
begin
  perform public.world_preseason_require_participant();

  select * into v_season
  from public.world_preseason_seasons
  where code = 'season-1' and status in ('pre_season', 'registration_open');
  if not found then raise exception 'Season 1 is not available'; end if;

  if exists (
    select 1 from public.world_preseason_team_members
    where season_id = v_season.id and user_id = auth.uid()
  ) then
    raise exception 'You already have an active team for this season';
  end if;

  select school_id into v_school_id
  from public.profiles
  where user_id = auth.uid();

  v_capacity := coalesce((v_season.config->>'maximumTeamSize')::smallint, 4);
  insert into public.world_preseason_teams(
    season_id,
    name,
    description,
    recruitment_focus,
    recruitment_mode,
    team_style,
    preferred_language,
    capacity,
    school_id,
    captain_user_id,
    created_by
  )
  values (
    v_season.id,
    trim(p_name),
    trim(coalesce(p_description, '')),
    trim(coalesce(p_description, '')),
    p_recruitment_mode,
    p_team_style,
    trim(p_preferred_language),
    v_capacity,
    v_school_id,
    auth.uid(),
    auth.uid()
  )
  returning id into v_team_id;

  insert into public.world_preseason_team_members(
    season_id,
    team_id,
    user_id,
    member_role,
    role_preferences
  )
  values (v_season.id, v_team_id, auth.uid(), 'captain', coalesce(p_role_preferences, '{}'));
  insert into public.world_preseason_chat_channels(season_id, channel_type, team_id)
  values (v_season.id, 'TEAM', v_team_id);
  perform public.world_preseason_refresh_team(v_team_id);
  return v_team_id;
end;
$$;

create or replace function public.world_preseason_leave_team()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_membership public.world_preseason_team_members%rowtype;
  v_team public.world_preseason_teams%rowtype;
  v_successor_user_id uuid;
begin
  perform public.world_preseason_require_participant();

  select * into v_membership
  from public.world_preseason_team_members
  where season_id = (select id from public.world_preseason_seasons where code = 'season-1')
    and user_id = auth.uid()
  for update;
  if not found then raise exception 'You do not have an active Season 1 team'; end if;

  select * into v_team
  from public.world_preseason_teams
  where id = v_membership.team_id
  for update;
  if v_team.status in ('frozen', 'registered', 'active', 'dissolved') then
    raise exception 'Team membership can no longer change';
  end if;

  if v_membership.member_role = 'captain' then
    select user_id into v_successor_user_id
    from public.world_preseason_team_members
    where team_id = v_team.id and user_id <> auth.uid()
    order by joined_at, id
    limit 1
    for update;

    if v_successor_user_id is null then
      update public.world_preseason_teams
      set status = 'dissolved', recruiting = false
      where id = v_team.id;
      update public.world_preseason_team_applications
      set status = 'withdrawn', reviewed_by = auth.uid(), reviewed_at = timezone('utc', now())
      where team_id = v_team.id and status = 'pending';
      update public.world_preseason_team_invites
      set status = 'revoked', responded_at = timezone('utc', now())
      where team_id = v_team.id and status = 'pending';
    else
      update public.world_preseason_team_members
      set member_role = 'captain'
      where team_id = v_team.id and user_id = v_successor_user_id;
      update public.world_preseason_teams
      set captain_user_id = v_successor_user_id
      where id = v_team.id;
    end if;
  end if;

  delete from public.world_preseason_team_members
  where id = v_membership.id;

  if v_successor_user_id is not null then
    perform public.world_preseason_refresh_team(v_team.id);
  end if;
end;
$$;

create or replace function public.world_preseason_remove_member(p_member_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_team public.world_preseason_teams%rowtype;
  v_target public.world_preseason_team_members%rowtype;
begin
  perform public.world_preseason_require_participant();

  select * into v_team
  from public.world_preseason_teams
  where captain_user_id = auth.uid()
    and season_id = (select id from public.world_preseason_seasons where code = 'season-1')
  for update;
  if not found then raise exception 'Only the team captain can remove members'; end if;
  if v_team.status in ('frozen', 'registered', 'active', 'dissolved') then
    raise exception 'Team membership can no longer change';
  end if;
  if p_member_user_id = auth.uid() then
    raise exception 'Captains can leave their team instead';
  end if;

  select * into v_target
  from public.world_preseason_team_members
  where team_id = v_team.id and user_id = p_member_user_id
  for update;
  if not found or v_target.member_role = 'captain' then
    raise exception 'This participant is not a removable team member';
  end if;

  delete from public.world_preseason_team_members where id = v_target.id;
  perform public.world_preseason_refresh_team(v_team.id);
end;
$$;

create or replace function public.world_preseason_dissolve_team()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_team public.world_preseason_teams%rowtype;
begin
  perform public.world_preseason_require_participant();

  select * into v_team
  from public.world_preseason_teams
  where captain_user_id = auth.uid()
    and season_id = (select id from public.world_preseason_seasons where code = 'season-1')
  for update;
  if not found then raise exception 'Only the team captain can dissolve this team'; end if;
  if v_team.status in ('frozen', 'registered', 'active', 'dissolved') then
    raise exception 'This team can no longer be dissolved';
  end if;

  update public.world_preseason_teams
  set status = 'dissolved', recruiting = false
  where id = v_team.id;
  update public.world_preseason_team_applications
  set status = 'withdrawn', reviewed_by = auth.uid(), reviewed_at = timezone('utc', now())
  where team_id = v_team.id and status = 'pending';
  update public.world_preseason_team_invites
  set status = 'revoked', responded_at = timezone('utc', now())
  where team_id = v_team.id and status = 'pending';
  delete from public.world_preseason_team_members where team_id = v_team.id;
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

  select school_id into v_viewer_school_id from public.profiles where user_id = auth.uid();
  select name into v_viewer_school_name from public.schools where id = v_viewer_school_id;
  select team_id into v_team_id
  from public.world_preseason_team_members
  where season_id = v_season.id and user_id = auth.uid();

  return jsonb_build_object(
    'season', jsonb_build_object('id', v_season.id, 'code', v_season.code, 'displayName', v_season.display_name, 'registrationOpen', v_season.registration_open, 'simulationLocked', v_season.simulation_locked, 'config', v_season.config),
    'viewer', jsonb_build_object('schoolId', v_viewer_school_id, 'schoolName', v_viewer_school_name),
    'stats', jsonb_build_object('players', (select count(*) from public.profiles where account_status = 'active'), 'teams', (select count(*) from public.world_preseason_teams where season_id = v_season.id and status <> 'dissolved'), 'freeAgents', (select count(*) from public.world_preseason_free_agents where season_id = v_season.id and availability_status = 'available'), 'recruitingTeams', (select count(*) from public.world_preseason_teams where season_id = v_season.id and recruiting)),
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'description', t.description,
          'focus', t.recruitment_focus,
          'capacity', t.capacity,
          'recruiting', t.recruiting,
          'recruitmentMode', t.recruitment_mode,
          'teamStyle', t.team_style,
          'preferredLanguage', t.preferred_language,
          'status', t.status,
          'schoolId', t.school_id,
          'schoolName', school.name,
          'sameSchool', (v_viewer_school_id is not null and t.school_id = v_viewer_school_id),
          'memberCount', (select count(*) from public.world_preseason_team_members m where m.team_id = t.id),
          'readyCount', (select count(*) from public.world_preseason_team_members m where m.team_id = t.id and m.is_ready),
          'applicationCount', (select count(*) from public.world_preseason_team_applications a where a.team_id = t.id and a.status = 'pending'),
          'teamType', case
            when (select count(distinct p.school_id) from public.world_preseason_team_members m join public.profiles p on p.user_id = m.user_id where m.team_id = t.id and p.school_id is not null) = 1
              and (select count(*) from public.world_preseason_team_members m join public.profiles p on p.user_id = m.user_id where m.team_id = t.id) = (select count(*) from public.world_preseason_team_members m where m.team_id = t.id)
              then 'SCHOOL TEAM'
            when (select count(distinct p.school_id) from public.world_preseason_team_members m join public.profiles p on p.user_id = m.user_id where m.team_id = t.id and p.school_id is not null) > 1
              then 'CROSS-SCHOOL TEAM'
            else 'OPEN TEAM'
          end,
          'schools', coalesce((select jsonb_agg(distinct s.name) from public.world_preseason_team_members m join public.profiles p on p.user_id = m.user_id left join public.schools s on s.id = p.school_id where m.team_id = t.id and s.name is not null), '[]'::jsonb)
        ) order by (v_viewer_school_id is not null and t.school_id = v_viewer_school_id) desc, t.created_at desc
      )
      from public.world_preseason_teams t
      left join public.schools school on school.id = t.school_id
      where t.season_id = v_season.id and t.status <> 'dissolved'
    ), '[]'::jsonb),
    'freeAgents', coalesce((select jsonb_agg(jsonb_build_object('userId', p.user_id, 'displayName', coalesce(p.display_name, 'Participant'), 'schoolName', s.name, 'rolePreferences', coalesce((select m.role_preferences from public.world_preseason_team_members m where m.season_id = v_season.id and m.user_id = p.user_id), '{}'::text[]), 'interests', f.interests, 'preferredLanguage', f.preferred_language, 'teamStylePreference', f.team_style_preference) order by f.updated_at desc) from public.world_preseason_free_agents f join public.profiles p on p.user_id = f.user_id left join public.schools s on s.id = p.school_id where f.season_id = v_season.id and f.availability_status = 'available'), '[]'::jsonb),
    'membership', (select jsonb_build_object('teamId', m.team_id, 'memberRole', m.member_role, 'rolePreferences', m.role_preferences, 'isReady', m.is_ready) from public.world_preseason_team_members m where m.season_id = v_season.id and m.user_id = auth.uid()),
    'members', coalesce((select jsonb_agg(jsonb_build_object('userId', m.user_id, 'displayName', coalesce(p.display_name, 'Participant'), 'schoolName', s.name, 'memberRole', m.member_role, 'rolePreferences', m.role_preferences, 'isReady', m.is_ready) order by m.member_role desc, m.joined_at) from public.world_preseason_team_members m join public.profiles p on p.user_id = m.user_id left join public.schools s on s.id = p.school_id where m.team_id = v_team_id), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'teamId', a.team_id, 'teamName', t.name, 'applicantName', coalesce(p.display_name, 'Participant'), 'note', a.note) order by a.created_at) from public.world_preseason_team_applications a join public.world_preseason_teams t on t.id = a.team_id join public.profiles p on p.user_id = a.applicant_user_id where a.season_id = v_season.id and a.status = 'pending' and (a.applicant_user_id = auth.uid() or t.captain_user_id = auth.uid() or public.is_platform_admin(auth.uid()))), '[]'::jsonb),
    'applicationTeamIds', coalesce((select jsonb_agg(a.team_id) from public.world_preseason_team_applications a where a.season_id = v_season.id and a.applicant_user_id = auth.uid() and a.status = 'pending'), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'teamId', i.team_id, 'teamName', t.name, 'code', i.code, 'status', i.status, 'invitedUserId', i.invited_user_id) order by i.created_at desc) from public.world_preseason_team_invites i join public.world_preseason_teams t on t.id = i.team_id where i.season_id = v_season.id and i.status = 'pending' and (i.invited_user_id = auth.uid() or t.captain_user_id = auth.uid() or public.is_platform_admin(auth.uid()))), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(x order by (x->>'createdAt')::timestamptz asc) from (select jsonb_build_object('id', m.id, 'content', m.content, 'messageType', m.message_type, 'metadata', m.metadata, 'createdAt', m.created_at, 'deletedAt', m.deleted_at, 'authorName', coalesce(p.display_name, 'Participant'), 'authorId', m.author_user_id) x from public.world_preseason_chat_messages m join public.world_preseason_chat_channels c on c.id = m.channel_id left join public.profiles p on p.user_id = m.author_user_id where c.season_id = v_season.id and c.channel_type = 'LOBBY' order by m.created_at desc limit greatest(1, least(p_message_limit, 100))) q), '[]'::jsonb),
    'teamMessages', coalesce((select jsonb_agg(x order by (x->>'createdAt')::timestamptz asc) from (select jsonb_build_object('id', m.id, 'content', m.content, 'messageType', m.message_type, 'metadata', m.metadata, 'createdAt', m.created_at, 'deletedAt', m.deleted_at, 'authorName', coalesce(p.display_name, 'Participant'), 'authorId', m.author_user_id) x from public.world_preseason_chat_messages m join public.world_preseason_chat_channels c on c.id = m.channel_id left join public.profiles p on p.user_id = m.author_user_id where c.team_id = v_team_id order by m.created_at desc limit greatest(1, least(p_message_limit, 100))) q), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.world_preseason_leave_team(), public.world_preseason_remove_member(uuid), public.world_preseason_dissolve_team() from public, anon;
grant execute on function public.world_preseason_create_team(text, text, text, text, text, text[]), public.world_preseason_leave_team(), public.world_preseason_remove_member(uuid), public.world_preseason_dissolve_team(), public.get_world_preseason_lobby(integer) to authenticated;
