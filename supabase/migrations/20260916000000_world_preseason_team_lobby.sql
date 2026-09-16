-- World Pre-Season Team Lobby.  This is deliberately outside the economic
-- simulation and never creates a country, office, policy, ledger, or clock.

create table if not exists public.world_preseason_seasons (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{3,80}$'),
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  status text not null default 'pre_season' check (status in ('pre_season', 'registration_open', 'locked', 'archived')),
  registration_open boolean not null default false,
  simulation_locked boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (not registration_open or status = 'registration_open'),
  check (simulation_locked)
);

insert into public.world_preseason_seasons (code, display_name)
values ('season-1', 'EconMind World · Season 1')
on conflict (code) do nothing;

create table if not exists public.world_preseason_teams (
  id uuid primary key default extensions.gen_random_uuid(),
  season_id uuid not null references public.world_preseason_seasons(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 80),
  recruitment_focus text not null default '' check (char_length(recruitment_focus) <= 280),
  capacity smallint not null default 6 check (capacity between 2 and 12),
  recruiting boolean not null default true,
  captain_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (season_id, name)
);

create table if not exists public.world_preseason_team_members (
  id uuid primary key default extensions.gen_random_uuid(),
  season_id uuid not null references public.world_preseason_seasons(id) on delete restrict,
  team_id uuid not null references public.world_preseason_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('captain', 'member')),
  role_preferences text[] not null default '{}'::text[] check (role_preferences <@ array['Finance & Economy', 'Trade & Foreign Affairs', 'Industry & Technology', 'Labour & Social Development', 'Central Bank']),
  is_ready boolean not null default false,
  joined_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (season_id, user_id),
  unique (team_id, user_id)
);

create table if not exists public.world_preseason_team_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  season_id uuid not null references public.world_preseason_seasons(id) on delete restrict,
  team_id uuid not null references public.world_preseason_teams(id) on delete cascade,
  applicant_user_id uuid not null references public.profiles(user_id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists world_preseason_one_pending_application_idx
  on public.world_preseason_team_applications (season_id, team_id, applicant_user_id)
  where status = 'pending';

create table if not exists public.world_preseason_chat_channels (
  id uuid primary key default extensions.gen_random_uuid(),
  season_id uuid not null references public.world_preseason_seasons(id) on delete cascade,
  channel_type text not null check (channel_type in ('LOBBY', 'TEAM')),
  team_id uuid references public.world_preseason_teams(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check ((channel_type = 'LOBBY' and team_id is null) or (channel_type = 'TEAM' and team_id is not null)),
  unique (team_id)
);

create unique index if not exists world_preseason_one_lobby_channel_idx
  on public.world_preseason_chat_channels (season_id)
  where channel_type = 'LOBBY';

insert into public.world_preseason_chat_channels (season_id, channel_type)
select id, 'LOBBY' from public.world_preseason_seasons where code = 'season-1'
on conflict do nothing;

create table if not exists public.world_preseason_chat_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  channel_id uuid not null references public.world_preseason_chat_channels(id) on delete cascade,
  author_user_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists world_preseason_teams_season_idx on public.world_preseason_teams (season_id, recruiting, created_at desc);
create index if not exists world_preseason_members_team_idx on public.world_preseason_team_members (team_id, is_ready);
create index if not exists world_preseason_applications_team_idx on public.world_preseason_team_applications (team_id, status, created_at desc);
create index if not exists world_preseason_messages_channel_idx on public.world_preseason_chat_messages (channel_id, created_at desc);

create or replace function public.world_preseason_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;

drop trigger if exists world_preseason_seasons_updated_at on public.world_preseason_seasons;
drop trigger if exists world_preseason_teams_updated_at on public.world_preseason_teams;
drop trigger if exists world_preseason_members_updated_at on public.world_preseason_team_members;
drop trigger if exists world_preseason_applications_updated_at on public.world_preseason_team_applications;
create trigger world_preseason_seasons_updated_at before update on public.world_preseason_seasons for each row execute function public.world_preseason_set_updated_at();
create trigger world_preseason_teams_updated_at before update on public.world_preseason_teams for each row execute function public.world_preseason_set_updated_at();
create trigger world_preseason_members_updated_at before update on public.world_preseason_team_members for each row execute function public.world_preseason_set_updated_at();
create trigger world_preseason_applications_updated_at before update on public.world_preseason_team_applications for each row execute function public.world_preseason_set_updated_at();

create or replace function public.world_preseason_require_admin()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
end;
$$;

create or replace function public.world_preseason_create_team(
  p_season_code text,
  p_name text,
  p_recruitment_focus text,
  p_capacity smallint,
  p_role_preferences text[] default '{}'::text[]
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_season_id uuid; v_team_id uuid;
begin
  perform public.world_preseason_require_admin();
  select id into v_season_id from public.world_preseason_seasons where code = lower(trim(p_season_code)) and status = 'pre_season';
  if v_season_id is null then raise exception 'Pre-Season is not available'; end if;
  if exists (select 1 from public.world_preseason_team_members where season_id = v_season_id and user_id = auth.uid()) then
    raise exception 'You already have an active team for this season';
  end if;
  insert into public.world_preseason_teams (season_id, name, recruitment_focus, capacity, captain_user_id, created_by)
  values (v_season_id, trim(p_name), trim(coalesce(p_recruitment_focus, '')), p_capacity, auth.uid(), auth.uid())
  returning id into v_team_id;
  insert into public.world_preseason_team_members (season_id, team_id, user_id, member_role, role_preferences)
  values (v_season_id, v_team_id, auth.uid(), 'captain', coalesce(p_role_preferences, '{}'::text[]));
  insert into public.world_preseason_chat_channels (season_id, channel_type, team_id) values (v_season_id, 'TEAM', v_team_id);
  return v_team_id;
end;
$$;

create or replace function public.world_preseason_apply_to_team(p_team_id uuid, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_season_id uuid; v_capacity smallint; v_member_count integer; v_application_id uuid;
begin
  perform public.world_preseason_require_admin();
  select season_id, capacity into v_season_id, v_capacity from public.world_preseason_teams where id = p_team_id and recruiting;
  if v_season_id is null then raise exception 'This team is not recruiting'; end if;
  if exists (select 1 from public.world_preseason_team_members where season_id = v_season_id and user_id = auth.uid()) then raise exception 'You already have an active team for this season'; end if;
  select count(*) into v_member_count from public.world_preseason_team_members where team_id = p_team_id;
  if v_member_count >= v_capacity then raise exception 'This team is full'; end if;
  insert into public.world_preseason_team_applications (season_id, team_id, applicant_user_id, note)
  values (v_season_id, p_team_id, auth.uid(), trim(coalesce(p_note, '')))
  returning id into v_application_id;
  return v_application_id;
end;
$$;

create or replace function public.world_preseason_accept_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_application public.world_preseason_team_applications%rowtype; v_capacity smallint; v_member_count integer;
begin
  perform public.world_preseason_require_admin();
  select * into v_application from public.world_preseason_team_applications where id = p_application_id and status = 'pending' for update;
  if not found then raise exception 'Pending application not found'; end if;
  select capacity into v_capacity from public.world_preseason_teams where id = v_application.team_id for update;
  select count(*) into v_member_count from public.world_preseason_team_members where team_id = v_application.team_id;
  if v_member_count >= v_capacity then raise exception 'This team is full'; end if;
  if exists (select 1 from public.world_preseason_team_members where season_id = v_application.season_id and user_id = v_application.applicant_user_id) then raise exception 'Applicant already has an active team'; end if;
  insert into public.world_preseason_team_members (season_id, team_id, user_id)
  values (v_application.season_id, v_application.team_id, v_application.applicant_user_id);
  update public.world_preseason_team_applications set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = timezone('utc', now()) where id = v_application.id;
  update public.world_preseason_team_applications set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = timezone('utc', now()) where season_id = v_application.season_id and applicant_user_id = v_application.applicant_user_id and status = 'pending';
  return v_application.team_id;
end;
$$;

create or replace function public.world_preseason_set_my_preferences(p_role_preferences text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.world_preseason_require_admin();
  update public.world_preseason_team_members set role_preferences = coalesce(p_role_preferences, '{}'::text[]) where user_id = auth.uid() and season_id = (select id from public.world_preseason_seasons where code = 'season-1');
  if not found then raise exception 'Join a team before setting role preferences'; end if;
end;
$$;

create or replace function public.world_preseason_set_my_readiness(p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.world_preseason_require_admin();
  update public.world_preseason_team_members set is_ready = p_ready where user_id = auth.uid() and season_id = (select id from public.world_preseason_seasons where code = 'season-1');
  if not found then raise exception 'Join a team before setting readiness'; end if;
end;
$$;

create or replace function public.world_preseason_post_message(p_team_id uuid, p_content text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_channel_id uuid; v_message_id uuid; v_season_id uuid;
begin
  perform public.world_preseason_require_admin();
  if char_length(trim(coalesce(p_content, ''))) = 0 then raise exception 'Message cannot be empty'; end if;
  if p_team_id is null then
    select channel.id into v_channel_id from public.world_preseason_chat_channels channel join public.world_preseason_seasons season on season.id = channel.season_id where season.code = 'season-1' and channel.channel_type = 'LOBBY';
  else
    select team.season_id into v_season_id from public.world_preseason_teams team where team.id = p_team_id;
    if v_season_id is null or not exists (select 1 from public.world_preseason_team_members where team_id = p_team_id and user_id = auth.uid()) then raise exception 'Active team membership required'; end if;
    select id into v_channel_id from public.world_preseason_chat_channels where team_id = p_team_id and channel_type = 'TEAM';
  end if;
  if v_channel_id is null then raise exception 'Chat channel unavailable'; end if;
  insert into public.world_preseason_chat_messages (channel_id, author_user_id, content) values (v_channel_id, auth.uid(), trim(p_content)) returning id into v_message_id;
  return v_message_id;
end;
$$;

create or replace function public.get_world_preseason_admin_lobby()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_season public.world_preseason_seasons%rowtype;
begin
  perform public.world_preseason_require_admin();
  select * into v_season from public.world_preseason_seasons where code = 'season-1';
  if not found then raise exception 'Season 1 configuration is unavailable'; end if;
  return jsonb_build_object(
    'season', jsonb_build_object('code', v_season.code, 'displayName', v_season.display_name, 'registrationOpen', v_season.registration_open, 'simulationLocked', v_season.simulation_locked),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', team.id, 'name', team.name, 'focus', team.recruitment_focus, 'capacity', team.capacity, 'recruiting', team.recruiting, 'memberCount', (select count(*) from public.world_preseason_team_members member where member.team_id = team.id), 'readyCount', (select count(*) from public.world_preseason_team_members member where member.team_id = team.id and member.is_ready), 'applicationCount', (select count(*) from public.world_preseason_team_applications application where application.team_id = team.id and application.status = 'pending')) order by team.created_at desc) from public.world_preseason_teams team where team.season_id = v_season.id), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', message.id, 'content', message.content, 'createdAt', message.created_at, 'authorName', coalesce(profile.display_name, 'EconMind participant')) order by message.created_at asc) from public.world_preseason_chat_messages message join public.world_preseason_chat_channels channel on channel.id = message.channel_id left join public.profiles profile on profile.user_id = message.author_user_id where channel.season_id = v_season.id and channel.channel_type = 'LOBBY' and message.deleted_at is null), '[]'::jsonb),
    'teamMessages', coalesce((select jsonb_agg(jsonb_build_object('id', message.id, 'content', message.content, 'createdAt', message.created_at, 'authorName', coalesce(profile.display_name, 'EconMind participant')) order by message.created_at asc) from public.world_preseason_chat_messages message join public.world_preseason_chat_channels channel on channel.id = message.channel_id left join public.profiles profile on profile.user_id = message.author_user_id where channel.channel_type = 'TEAM' and channel.team_id = (select member.team_id from public.world_preseason_team_members member where member.season_id = v_season.id and member.user_id = auth.uid()) and message.deleted_at is null), '[]'::jsonb),
    'freeAgents', coalesce((select jsonb_agg(jsonb_build_object('userId', profile.user_id, 'displayName', coalesce(profile.display_name, 'Unnamed participant'), 'schoolName', school.name) order by profile.created_at desc) from public.profiles profile left join public.schools school on school.id = profile.school_id where profile.account_status = 'active' and profile.user_id <> auth.uid() and not exists (select 1 from public.world_preseason_team_members member where member.season_id = v_season.id and member.user_id = profile.user_id)), '[]'::jsonb),
    'currentMembership', (select jsonb_build_object('teamId', member.team_id, 'memberRole', member.member_role, 'rolePreferences', member.role_preferences, 'isReady', member.is_ready) from public.world_preseason_team_members member where member.season_id = v_season.id and member.user_id = auth.uid()),
    'applicationTeamIds', coalesce((select jsonb_agg(application.team_id) from public.world_preseason_team_applications application where application.season_id = v_season.id and application.applicant_user_id = auth.uid() and application.status = 'pending'), '[]'::jsonb),
    'pendingApplications', coalesce((select jsonb_agg(jsonb_build_object('id', application.id, 'teamId', application.team_id, 'teamName', team.name, 'applicantName', coalesce(profile.display_name, 'EconMind participant')) order by application.created_at asc) from public.world_preseason_team_applications application join public.world_preseason_teams team on team.id = application.team_id left join public.profiles profile on profile.user_id = application.applicant_user_id where application.season_id = v_season.id and application.status = 'pending'), '[]'::jsonb)
  );
end;
$$;

alter table public.world_preseason_seasons enable row level security;
alter table public.world_preseason_teams enable row level security;
alter table public.world_preseason_team_members enable row level security;
alter table public.world_preseason_team_applications enable row level security;
alter table public.world_preseason_chat_channels enable row level security;
alter table public.world_preseason_chat_messages enable row level security;

create policy world_preseason_seasons_admin_read on public.world_preseason_seasons for select to authenticated using (public.is_platform_admin());
create policy world_preseason_teams_admin_read on public.world_preseason_teams for select to authenticated using (public.is_platform_admin());
create policy world_preseason_members_admin_read on public.world_preseason_team_members for select to authenticated using (public.is_platform_admin());
create policy world_preseason_applications_admin_read on public.world_preseason_team_applications for select to authenticated using (public.is_platform_admin());
create policy world_preseason_channels_admin_read on public.world_preseason_chat_channels for select to authenticated using (public.is_platform_admin());
create policy world_preseason_messages_admin_read on public.world_preseason_chat_messages for select to authenticated using (public.is_platform_admin());

revoke all on table public.world_preseason_seasons, public.world_preseason_teams, public.world_preseason_team_members, public.world_preseason_team_applications, public.world_preseason_chat_channels, public.world_preseason_chat_messages from anon, authenticated;
revoke all on function public.world_preseason_require_admin(), public.world_preseason_set_updated_at() from public, anon, authenticated;
grant execute on function public.world_preseason_create_team(text, text, text, smallint, text[]), public.world_preseason_apply_to_team(uuid, text), public.world_preseason_accept_application(uuid), public.world_preseason_set_my_preferences(text[]), public.world_preseason_set_my_readiness(boolean), public.world_preseason_post_message(uuid, text), public.get_world_preseason_admin_lobby() to authenticated;
