-- Complete the reusable Pre-Season domain.  Nothing in this migration creates
-- or mutates an economic world, country, office, policy, clock, or ledger.

alter table public.world_preseason_seasons
  add column if not exists config jsonb not null default '{"minimumTeamSize":2,"maximumTeamSize":4,"roles":["Finance & Economy","Trade & Foreign Affairs","Industry & Technology","Labour & Social Development","Central Bank"],"languages":["English","Chinese","Bilingual"]}'::jsonb;

alter table public.world_preseason_teams
  add column if not exists description text not null default '' check (char_length(description) <= 500),
  add column if not exists recruitment_mode text not null default 'open' check (recruitment_mode in ('open','application_required','invite_only')),
  add column if not exists team_style text not null default 'balanced' check (team_style in ('competitive','balanced','learning')),
  add column if not exists preferred_language text not null default 'English' check (char_length(preferred_language) <= 40),
  add column if not exists status text not null default 'forming' check (status in ('forming','recruiting','full','ready','registered','active','frozen','dissolved')),
  add column if not exists frozen_at timestamptz,
  add column if not exists frozen_by uuid references public.profiles(user_id) on delete set null;

create table if not exists public.world_preseason_team_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  season_id uuid not null references public.world_preseason_seasons(id) on delete restrict,
  team_id uuid not null references public.world_preseason_teams(id) on delete cascade,
  invited_user_id uuid references public.profiles(user_id) on delete cascade,
  invited_by uuid not null references public.profiles(user_id) on delete restrict,
  code text not null unique check (code ~ '^EM-S[0-9]+-[A-Z0-9]{6}$'),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','revoked','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz
);

create unique index if not exists world_preseason_pending_personal_invite_idx
  on public.world_preseason_team_invites(season_id, team_id, invited_user_id)
  where status = 'pending' and invited_user_id is not null;

create table if not exists public.world_preseason_free_agents (
  season_id uuid not null references public.world_preseason_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  interests text not null default '' check (char_length(interests) <= 280),
  preferred_language text not null default 'English' check (char_length(preferred_language) <= 40),
  team_style_preference text not null default 'balanced' check (team_style_preference in ('competitive','balanced','learning','open')),
  availability_status text not null default 'available' check (availability_status in ('available','paused')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (season_id, user_id)
);

create table if not exists public.world_preseason_chat_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  season_id uuid not null references public.world_preseason_seasons(id) on delete cascade,
  message_id uuid not null references public.world_preseason_chat_messages(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(user_id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references public.profiles(user_id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, reporter_user_id)
);

create table if not exists public.world_preseason_lobby_mutes (
  season_id uuid not null references public.world_preseason_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  muted_by uuid not null references public.profiles(user_id) on delete restrict,
  reason text not null default '' check (char_length(reason) <= 500),
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (season_id, user_id)
);

alter table public.world_preseason_chat_messages
  add column if not exists message_type text not null default 'TEXT' check (message_type in ('TEXT','TEAM_CARD','SYSTEM')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists world_preseason_invites_team_idx on public.world_preseason_team_invites(team_id, status, created_at desc);
create index if not exists world_preseason_free_agents_available_idx on public.world_preseason_free_agents(season_id, availability_status, updated_at desc);
create index if not exists world_preseason_reports_open_idx on public.world_preseason_chat_reports(season_id, status, created_at desc);

drop trigger if exists world_preseason_free_agents_updated_at on public.world_preseason_free_agents;
create trigger world_preseason_free_agents_updated_at before update on public.world_preseason_free_agents for each row execute function public.world_preseason_set_updated_at();

create or replace function public.world_preseason_require_participant()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where user_id = auth.uid() and account_status = 'active') then
    raise exception 'An active authenticated account is required';
  end if;
end;
$$;

create or replace function public.world_preseason_refresh_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype; v_count integer; v_ready integer; v_minimum integer;
begin
  select * into v_team from public.world_preseason_teams where id = p_team_id for update;
  if not found or v_team.status in ('frozen','dissolved','registered','active') then return; end if;
  select count(*), count(*) filter (where is_ready) into v_count, v_ready from public.world_preseason_team_members where team_id = p_team_id;
  v_minimum := coalesce((select (config->>'minimumTeamSize')::integer from public.world_preseason_seasons where id = v_team.season_id), 2);
  update public.world_preseason_teams set recruiting = v_count < v_team.capacity and v_team.recruitment_mode <> 'invite_only', status = case when v_count >= v_minimum and v_ready = v_count then 'ready' when v_count >= v_team.capacity then 'full' when v_count > 0 then 'recruiting' else 'forming' end where id = p_team_id;
end;
$$;

drop function if exists public.world_preseason_create_team(text, text, text, smallint, text[]);
create function public.world_preseason_create_team(p_name text, p_description text default '', p_recruitment_mode text default 'open', p_team_style text default 'balanced', p_preferred_language text default 'English', p_role_preferences text[] default '{}'::text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_season public.world_preseason_seasons%rowtype; v_team_id uuid; v_capacity smallint;
begin
  perform public.world_preseason_require_participant();
  select * into v_season from public.world_preseason_seasons where code = 'season-1' and status in ('pre_season','registration_open');
  if not found then raise exception 'Season 1 is not available'; end if;
  if exists (select 1 from public.world_preseason_team_members where season_id = v_season.id and user_id = auth.uid()) then raise exception 'You already have an active team for this season'; end if;
  v_capacity := coalesce((v_season.config->>'maximumTeamSize')::smallint, 4);
  insert into public.world_preseason_teams(season_id,name,description,recruitment_focus,recruitment_mode,team_style,preferred_language,capacity,captain_user_id,created_by)
  values(v_season.id,trim(p_name),trim(coalesce(p_description,'')),trim(coalesce(p_description,'')),p_recruitment_mode,p_team_style,trim(p_preferred_language),v_capacity,auth.uid(),auth.uid()) returning id into v_team_id;
  insert into public.world_preseason_team_members(season_id,team_id,user_id,member_role,role_preferences) values(v_season.id,v_team_id,auth.uid(),'captain',coalesce(p_role_preferences,'{}'));
  insert into public.world_preseason_chat_channels(season_id,channel_type,team_id) values(v_season.id,'TEAM',v_team_id);
  perform public.world_preseason_refresh_team(v_team_id);
  return v_team_id;
end;
$$;

create or replace function public.world_preseason_set_free_agent(p_enabled boolean, p_interests text default '', p_preferred_language text default 'English', p_team_style_preference text default 'open')
returns void language plpgsql security definer set search_path = public as $$
declare v_season_id uuid;
begin
  perform public.world_preseason_require_participant(); select id into v_season_id from public.world_preseason_seasons where code = 'season-1';
  if p_enabled then
    if exists(select 1 from public.world_preseason_team_members where season_id=v_season_id and user_id=auth.uid()) then raise exception 'Leave your team before becoming a free agent'; end if;
    insert into public.world_preseason_free_agents(season_id,user_id,interests,preferred_language,team_style_preference) values(v_season_id,auth.uid(),trim(coalesce(p_interests,'')),trim(p_preferred_language),p_team_style_preference)
    on conflict(season_id,user_id) do update set interests=excluded.interests,preferred_language=excluded.preferred_language,team_style_preference=excluded.team_style_preference,availability_status='available';
  else delete from public.world_preseason_free_agents where season_id=v_season_id and user_id=auth.uid(); end if;
end;
$$;

create or replace function public.world_preseason_apply_to_team(p_team_id uuid, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype; v_id uuid;
begin
  perform public.world_preseason_require_participant(); select * into v_team from public.world_preseason_teams where id=p_team_id for update;
  if not found or not v_team.recruiting or v_team.status='frozen' then raise exception 'This team is not recruiting'; end if;
  if v_team.recruitment_mode='invite_only' then raise exception 'This team accepts invitations only'; end if;
  if exists(select 1 from public.world_preseason_team_members where season_id=v_team.season_id and user_id=auth.uid()) then raise exception 'You already have an active team for this season'; end if;
  insert into public.world_preseason_team_applications(season_id,team_id,applicant_user_id,note) values(v_team.season_id,v_team.id,auth.uid(),trim(coalesce(p_note,''))) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.world_preseason_set_my_preferences(p_role_preferences text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.world_preseason_require_participant();
  update public.world_preseason_team_members set role_preferences=coalesce(p_role_preferences,'{}'::text[]) where user_id=auth.uid() and season_id=(select id from public.world_preseason_seasons where code='season-1');
  if not found then raise exception 'Join a team before setting role preferences'; end if;
end;
$$;

create or replace function public.world_preseason_set_my_readiness(p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_team_id uuid;
begin
  perform public.world_preseason_require_participant();
  update public.world_preseason_team_members set is_ready=p_ready where user_id=auth.uid() and season_id=(select id from public.world_preseason_seasons where code='season-1') returning team_id into v_team_id;
  if v_team_id is null then raise exception 'Join a team before setting readiness'; end if; perform public.world_preseason_refresh_team(v_team_id);
end;
$$;

create or replace function public.world_preseason_post_message(p_team_id uuid, p_content text, p_message_type text default 'TEXT', p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_channel_id uuid; v_season_id uuid; v_message_id uuid;
begin
  perform public.world_preseason_require_participant(); if char_length(trim(coalesce(p_content,'')))=0 then raise exception 'Message cannot be empty'; end if;
  if p_team_id is null then
    select s.id,c.id into v_season_id,v_channel_id from public.world_preseason_seasons s join public.world_preseason_chat_channels c on c.season_id=s.id where s.code='season-1' and c.channel_type='LOBBY';
    if exists(select 1 from public.world_preseason_lobby_mutes where season_id=v_season_id and user_id=auth.uid() and (expires_at is null or expires_at>now())) then raise exception 'You are muted from the Season 1 lobby chat'; end if;
  else
    if not exists(select 1 from public.world_preseason_team_members where team_id=p_team_id and user_id=auth.uid()) then raise exception 'Active team membership required'; end if;
    select id into v_channel_id from public.world_preseason_chat_channels where team_id=p_team_id and channel_type='TEAM';
  end if;
  insert into public.world_preseason_chat_messages(channel_id,author_user_id,content,message_type,metadata) values(v_channel_id,auth.uid(),trim(p_content),p_message_type,coalesce(p_metadata,'{}')) returning id into v_message_id; return v_message_id;
end;
$$;

create or replace function public.world_preseason_review_application(p_application_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_application public.world_preseason_team_applications%rowtype; v_team public.world_preseason_teams%rowtype; v_count integer;
begin
  perform public.world_preseason_require_participant(); select * into v_application from public.world_preseason_team_applications where id=p_application_id and status='pending' for update;
  if not found then raise exception 'Pending application not found'; end if;
  select * into v_team from public.world_preseason_teams where id=v_application.team_id for update;
  if v_team.captain_user_id <> auth.uid() and not public.is_platform_admin(auth.uid()) then raise exception 'Only the team captain can review this application'; end if;
  if not p_accept then update public.world_preseason_team_applications set status='rejected',reviewed_by=auth.uid(),reviewed_at=timezone('utc',now()) where id=v_application.id; return; end if;
  select count(*) into v_count from public.world_preseason_team_members where team_id=v_team.id;
  if v_team.status='frozen' or v_count >= v_team.capacity then raise exception 'This team cannot accept another member'; end if;
  if exists(select 1 from public.world_preseason_team_members where season_id=v_team.season_id and user_id=v_application.applicant_user_id) then raise exception 'Applicant already belongs to a Season 1 team'; end if;
  insert into public.world_preseason_team_members(season_id,team_id,user_id) values(v_team.season_id,v_team.id,v_application.applicant_user_id);
  update public.world_preseason_team_applications set status='accepted',reviewed_by=auth.uid(),reviewed_at=timezone('utc',now()) where id=v_application.id;
  update public.world_preseason_team_applications set status='rejected',reviewed_by=auth.uid(),reviewed_at=timezone('utc',now()) where season_id=v_team.season_id and applicant_user_id=v_application.applicant_user_id and status='pending';
  delete from public.world_preseason_free_agents where season_id=v_team.season_id and user_id=v_application.applicant_user_id; perform public.world_preseason_refresh_team(v_team.id);
end;
$$;

create or replace function public.world_preseason_create_invite(p_team_id uuid, p_invited_user_id uuid default null, p_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype; v_code text; v_id uuid;
begin
  perform public.world_preseason_require_participant(); select * into v_team from public.world_preseason_teams where id=p_team_id for update;
  if not found or (v_team.captain_user_id <> auth.uid() and not public.is_platform_admin(auth.uid())) then raise exception 'Only the team captain can invite players'; end if;
  if v_team.status='frozen' then raise exception 'This team is frozen'; end if;
  v_code := 'EM-S1-' || upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,6));
  insert into public.world_preseason_team_invites(season_id,team_id,invited_user_id,invited_by,code,expires_at) values(v_team.season_id,v_team.id,p_invited_user_id,auth.uid(),v_code,p_expires_at) returning id into v_id;
  return jsonb_build_object('id',v_id,'code',v_code,'teamId',v_team.id);
end;
$$;

create or replace function public.world_preseason_respond_to_invite(p_code text, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_invite public.world_preseason_team_invites%rowtype; v_team public.world_preseason_teams%rowtype; v_count integer;
begin
  perform public.world_preseason_require_participant(); select * into v_invite from public.world_preseason_team_invites where code=upper(trim(p_code)) and status='pending' for update;
  if not found or (v_invite.expires_at is not null and v_invite.expires_at <= now()) then raise exception 'This invite is invalid or expired'; end if;
  if v_invite.invited_user_id is not null and v_invite.invited_user_id <> auth.uid() then raise exception 'This invite belongs to another account'; end if;
  if not p_accept then update public.world_preseason_team_invites set status='rejected',responded_at=timezone('utc',now()) where id=v_invite.id; return v_invite.team_id; end if;
  select * into v_team from public.world_preseason_teams where id=v_invite.team_id for update; select count(*) into v_count from public.world_preseason_team_members where team_id=v_team.id;
  if v_team.status='frozen' or v_count >= v_team.capacity or exists(select 1 from public.world_preseason_team_members where season_id=v_team.season_id and user_id=auth.uid()) then raise exception 'This invite can no longer be accepted'; end if;
  insert into public.world_preseason_team_members(season_id,team_id,user_id) values(v_team.season_id,v_team.id,auth.uid()); update public.world_preseason_team_invites set status='accepted',responded_at=timezone('utc',now()) where id=v_invite.id;
  delete from public.world_preseason_free_agents where season_id=v_team.season_id and user_id=auth.uid(); perform public.world_preseason_refresh_team(v_team.id); return v_team.id;
end;
$$;

create or replace function public.world_preseason_delete_own_message(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin perform public.world_preseason_require_participant(); update public.world_preseason_chat_messages set deleted_at=timezone('utc',now()),content='Message deleted' where id=p_message_id and author_user_id=auth.uid() and deleted_at is null; if not found then raise exception 'Message cannot be deleted'; end if; end;
$$;

create or replace function public.world_preseason_report_message(p_message_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_season_id uuid;
begin perform public.world_preseason_require_participant(); select channel.season_id into v_season_id from public.world_preseason_chat_messages message join public.world_preseason_chat_channels channel on channel.id=message.channel_id where message.id=p_message_id; if v_season_id is null then raise exception 'Message not found'; end if; insert into public.world_preseason_chat_reports(season_id,message_id,reporter_user_id,reason) values(v_season_id,p_message_id,auth.uid(),trim(p_reason)); end;
$$;

create or replace function public.world_preseason_admin_moderate(p_message_id uuid default null, p_mute_user_id uuid default null, p_mute boolean default false, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_season_id uuid;
begin
 perform public.world_preseason_require_admin(); select id into v_season_id from public.world_preseason_seasons where code='season-1';
 if p_message_id is not null then update public.world_preseason_chat_messages set deleted_at=timezone('utc',now()),content='Removed by moderation' where id=p_message_id and deleted_at is null; end if;
 if p_mute_user_id is not null and p_mute then insert into public.world_preseason_lobby_mutes(season_id,user_id,muted_by,reason) values(v_season_id,p_mute_user_id,auth.uid(),trim(p_reason)) on conflict(season_id,user_id) do update set muted_by=excluded.muted_by,reason=excluded.reason,expires_at=null; elsif p_mute_user_id is not null then delete from public.world_preseason_lobby_mutes where season_id=v_season_id and user_id=p_mute_user_id; end if;
end;
$$;

create or replace function public.get_world_preseason_lobby(p_message_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_season public.world_preseason_seasons%rowtype; v_team_id uuid;
begin
  perform public.world_preseason_require_participant(); select * into v_season from public.world_preseason_seasons where code='season-1'; if not found then raise exception 'Season 1 configuration is unavailable'; end if;
  select team_id into v_team_id from public.world_preseason_team_members where season_id=v_season.id and user_id=auth.uid();
  return jsonb_build_object(
    'season',jsonb_build_object('id',v_season.id,'code',v_season.code,'displayName',v_season.display_name,'registrationOpen',v_season.registration_open,'simulationLocked',v_season.simulation_locked,'config',v_season.config),
    'stats',jsonb_build_object('players',(select count(*) from public.profiles where account_status='active'),'teams',(select count(*) from public.world_preseason_teams where season_id=v_season.id and status <> 'dissolved'),'freeAgents',(select count(*) from public.world_preseason_free_agents where season_id=v_season.id and availability_status='available'),'recruitingTeams',(select count(*) from public.world_preseason_teams where season_id=v_season.id and recruiting)),
    'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'description',t.description,'focus',t.recruitment_focus,'capacity',t.capacity,'recruiting',t.recruiting,'recruitmentMode',t.recruitment_mode,'teamStyle',t.team_style,'preferredLanguage',t.preferred_language,'status',t.status,'memberCount',(select count(*) from public.world_preseason_team_members m where m.team_id=t.id),'readyCount',(select count(*) from public.world_preseason_team_members m where m.team_id=t.id and m.is_ready),'applicationCount',(select count(*) from public.world_preseason_team_applications a where a.team_id=t.id and a.status='pending'),'teamType',case when (select count(distinct p.school_id) from public.world_preseason_team_members m join public.profiles p on p.user_id=m.user_id where m.team_id=t.id and p.school_id is not null)=1 and (select count(*) from public.world_preseason_team_members m join public.profiles p on p.user_id=m.user_id where m.team_id=t.id)= (select count(*) from public.world_preseason_team_members m where m.team_id=t.id) then 'SCHOOL TEAM' when (select count(distinct p.school_id) from public.world_preseason_team_members m join public.profiles p on p.user_id=m.user_id where m.team_id=t.id and p.school_id is not null)>1 then 'CROSS-SCHOOL TEAM' else 'OPEN TEAM' end,'schools',coalesce((select jsonb_agg(distinct s.name) from public.world_preseason_team_members m join public.profiles p on p.user_id=m.user_id left join public.schools s on s.id=p.school_id where m.team_id=t.id and s.name is not null),'[]'::jsonb)) order by t.created_at desc) from public.world_preseason_teams t where t.season_id=v_season.id and t.status <> 'dissolved'),'[]'::jsonb),
    'freeAgents',coalesce((select jsonb_agg(jsonb_build_object('userId',p.user_id,'displayName',coalesce(p.display_name,'Participant'),'schoolName',s.name,'rolePreferences',coalesce((select m.role_preferences from public.world_preseason_team_members m where m.season_id=v_season.id and m.user_id=p.user_id),'{}'::text[]),'interests',f.interests,'preferredLanguage',f.preferred_language,'teamStylePreference',f.team_style_preference) order by f.updated_at desc) from public.world_preseason_free_agents f join public.profiles p on p.user_id=f.user_id left join public.schools s on s.id=p.school_id where f.season_id=v_season.id and f.availability_status='available'),'[]'::jsonb),
    'membership',(select jsonb_build_object('teamId',m.team_id,'memberRole',m.member_role,'rolePreferences',m.role_preferences,'isReady',m.is_ready) from public.world_preseason_team_members m where m.season_id=v_season.id and m.user_id=auth.uid()),
    'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',coalesce(p.display_name,'Participant'),'schoolName',s.name,'memberRole',m.member_role,'rolePreferences',m.role_preferences,'isReady',m.is_ready) order by m.member_role desc,m.joined_at) from public.world_preseason_team_members m join public.profiles p on p.user_id=m.user_id left join public.schools s on s.id=p.school_id where m.team_id=v_team_id),'[]'::jsonb),
    'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'teamId',a.team_id,'teamName',t.name,'applicantName',coalesce(p.display_name,'Participant'),'note',a.note) order by a.created_at) from public.world_preseason_team_applications a join public.world_preseason_teams t on t.id=a.team_id join public.profiles p on p.user_id=a.applicant_user_id where a.season_id=v_season.id and a.status='pending' and (a.applicant_user_id=auth.uid() or t.captain_user_id=auth.uid() or public.is_platform_admin(auth.uid()))),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'teamId',i.team_id,'teamName',t.name,'code',i.code,'status',i.status,'invitedUserId',i.invited_user_id) order by i.created_at desc) from public.world_preseason_team_invites i join public.world_preseason_teams t on t.id=i.team_id where i.season_id=v_season.id and i.status='pending' and (i.invited_user_id=auth.uid() or t.captain_user_id=auth.uid() or public.is_platform_admin(auth.uid()))),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(x order by (x->>'createdAt')::timestamptz asc) from (select jsonb_build_object('id',m.id,'content',m.content,'messageType',m.message_type,'metadata',m.metadata,'createdAt',m.created_at,'deletedAt',m.deleted_at,'authorName',coalesce(p.display_name,'Participant'),'authorId',m.author_user_id) x from public.world_preseason_chat_messages m join public.world_preseason_chat_channels c on c.id=m.channel_id left join public.profiles p on p.user_id=m.author_user_id where c.season_id=v_season.id and c.channel_type='LOBBY' order by m.created_at desc limit greatest(1,least(p_message_limit,100))) q),'[]'::jsonb),
    'teamMessages',coalesce((select jsonb_agg(x order by (x->>'createdAt')::timestamptz asc) from (select jsonb_build_object('id',m.id,'content',m.content,'messageType',m.message_type,'metadata',m.metadata,'createdAt',m.created_at,'deletedAt',m.deleted_at,'authorName',coalesce(p.display_name,'Participant'),'authorId',m.author_user_id) x from public.world_preseason_chat_messages m join public.world_preseason_chat_channels c on c.id=m.channel_id left join public.profiles p on p.user_id=m.author_user_id where c.team_id=v_team_id order by m.created_at desc limit greatest(1,least(p_message_limit,100))) q),'[]'::jsonb)
  );
end;
$$;

-- A participant may read only public team discovery data and chats they belong
-- to. Browser writes remain RPC-only; privileged review and moderation checks
-- are repeated inside the security-definer functions above.
alter table public.world_preseason_team_invites enable row level security;
alter table public.world_preseason_free_agents enable row level security;
alter table public.world_preseason_chat_reports enable row level security;
alter table public.world_preseason_lobby_mutes enable row level security;
grant select on public.world_preseason_teams, public.world_preseason_team_members, public.world_preseason_chat_channels, public.world_preseason_chat_messages, public.world_preseason_free_agents to authenticated;
create policy world_preseason_public_team_discovery on public.world_preseason_teams for select to authenticated using (exists(select 1 from public.world_preseason_seasons s where s.id=season_id));
create policy world_preseason_member_roster_read on public.world_preseason_team_members for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.world_preseason_team_members mine where mine.team_id=world_preseason_team_members.team_id and mine.user_id=auth.uid()) or public.is_platform_admin(auth.uid()));
create policy world_preseason_channel_read on public.world_preseason_chat_channels for select to authenticated using (channel_type='LOBBY' or exists(select 1 from public.world_preseason_team_members mine where mine.team_id=world_preseason_chat_channels.team_id and mine.user_id=auth.uid()) or public.is_platform_admin(auth.uid()));
create policy world_preseason_message_read on public.world_preseason_chat_messages for select to authenticated using (exists(select 1 from public.world_preseason_chat_channels c where c.id=channel_id and (c.channel_type='LOBBY' or public.is_platform_admin(auth.uid()) or exists(select 1 from public.world_preseason_team_members mine where mine.team_id=c.team_id and mine.user_id=auth.uid()))));
create policy world_preseason_free_agent_read on public.world_preseason_free_agents for select to authenticated using (availability_status='available' or user_id=auth.uid() or public.is_platform_admin(auth.uid()));

alter publication supabase_realtime add table public.world_preseason_chat_messages, public.world_preseason_team_members, public.world_preseason_team_applications, public.world_preseason_team_invites, public.world_preseason_free_agents;

grant execute on function public.world_preseason_create_team(text,text,text,text,text,text[]), public.world_preseason_set_free_agent(boolean,text,text,text), public.world_preseason_review_application(uuid,boolean), public.world_preseason_create_invite(uuid,uuid,timestamptz), public.world_preseason_respond_to_invite(text,boolean), public.world_preseason_delete_own_message(uuid), public.world_preseason_report_message(uuid,text), public.world_preseason_admin_moderate(uuid,uuid,boolean,text), public.get_world_preseason_lobby(integer) to authenticated;
