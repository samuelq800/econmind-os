-- NEC / IEO matching is independent of League and Season 1 membership.
begin;

create table public.competition_rules (
  competition text not null check (competition in ('NEC','IEO')),
  division text not null,
  min_team_size integer not null check (min_team_size between 1 and 20),
  max_team_size integer not null check (max_team_size between min_team_size and 20),
  stages text[] not null default '{}',
  awards text[] not null default '{}',
  season text not null default '2026',
  active boolean not null default true,
  primary key (competition,division)
);
insert into public.competition_rules(competition,division,min_team_size,max_team_size) values
('NEC','PRE',2,4),('NEC','DR',2,4),('NEC','AS',2,4),
('IEO','Junior',2,4),('IEO','Junior High',2,4),('IEO','Senior',2,4);
update public.competition_rules set
  stages=array['China Stage','International Stage','Other'],
  awards=array['Participant','Qualifier','Honorable Mention','Bronze','Silver','Gold','Champion','Other'];

create table public.academic_profiles (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  country text not null default '' check (char_length(country)<=80),
  location text not null default '' check (char_length(location)<=120),
  curriculum text not null default '' check (curriculum in ('','AP','A-Level','IB','Other','Mixed')),
  curriculum_detail jsonb not null default '{}',
  graduation_year integer check (graduation_year between 2024 and 2045),
  gpa numeric(7,3),
  gpa_scale text not null default '' check (char_length(gpa_scale)<=40),
  gpa_system text not null default '' check (char_length(gpa_system)<=80),
  english_tests jsonb not null default '[]',
  standardized_tests jsonb not null default '[]',
  amc_records jsonb not null default '[]',
  competition_records jsonb not null default '[]',
  visibility jsonb not null default '{"school":"public","gpa":"matches","economics":"public","english_tests":"matches","standardized_tests":"matches","amc_records":"matches","competition_records":"public"}',
  bio text not null default '' check (char_length(bio)<=600),
  updated_at timestamptz not null default now(),
  check (gpa is null or (gpa>=0 and case when gpa_scale in ('4.0','4.3','5.0','100') then gpa<=gpa_scale::numeric else true end)),
  check (jsonb_typeof(curriculum_detail)='object' and jsonb_typeof(english_tests)='array' and jsonb_typeof(standardized_tests)='array' and jsonb_typeof(amc_records)='array' and jsonb_typeof(competition_records)='array' and jsonb_typeof(visibility)='object')
);
create table public.competition_matching_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  competition text not null,
  division text not null,
  status text not null default 'looking_for_team' check (status in ('looking_for_team','looking_for_teammates','on_team','inactive')),
  target text not null default '' check (char_length(target)<=120),
  strengths text[] not null default '{}',
  needs text[] not null default '{}',
  preferences jsonb not null default '{}',
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  unique(user_id,competition,division),
  unique(id,user_id),
  foreign key(competition,division) references public.competition_rules(competition,division),
  check (cardinality(strengths)<=5 and cardinality(needs)<=5 and jsonb_typeof(preferences)='object')
);
create table public.competition_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id),
  competition text not null,
  division text not null,
  name text not null check (char_length(trim(name)) between 2 and 80),
  introduction text not null default '' check (char_length(introduction)<=600),
  target text not null default '' check (char_length(target)<=120),
  recruiting boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key(competition,division) references public.competition_rules(competition,division)
);
create table public.competition_team_members (
  team_id uuid not null references public.competition_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  competition text not null,
  division text not null,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key(team_id,user_id),
  unique(user_id,competition,division),
  foreign key(competition,division) references public.competition_rules(competition,division)
);
create table public.competition_team_placeholders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.competition_teams(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  school text not null default '' check (char_length(school)<=160),
  claimed_by_user_id uuid references public.profiles(user_id),
  created_at timestamptz not null default now()
);
create table public.competition_recruitment_needs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.competition_teams(id) on delete cascade,
  strength_tags text[] not null default '{}',
  academic_preferences jsonb not null default '{}',
  note text not null default '' check (char_length(note)<=300),
  active boolean not null default true
);
create table public.competition_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.competition_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null check (kind in ('application','invitation')),
  placeholder_id uuid references public.competition_team_placeholders(id) on delete set null,
  initiated_by uuid not null references public.profiles(user_id),
  message text not null default '' check (char_length(message)<=300),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index competition_one_pending_request on public.competition_requests(team_id,user_id,kind) where status='pending';
create index competition_requests_recipient on public.competition_requests(user_id,status,created_at desc);
create index competition_profiles_discovery on public.competition_matching_profiles(competition,division,status,updated_at desc) where active;
create index competition_teams_discovery on public.competition_teams(competition,division,created_at desc) where active and recruiting;
create table public.competition_posts (
  id uuid primary key default gen_random_uuid(),
  matching_profile_id uuid not null references public.competition_matching_profiles(id) on delete cascade,
  team_id uuid references public.competition_teams(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index competition_posts_recent on public.competition_posts(active,created_at desc);
create table public.competition_team_messages (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.competition_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id),
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now()
);
create table public.competition_lobby_messages (
  id bigint generated always as identity primary key,
  competition text not null,
  division text not null,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  foreign key(competition,division) references public.competition_rules(competition,division)
);
create index competition_lobby_messages_recent on public.competition_lobby_messages(competition,division,id desc);
create table public.competition_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.competition_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(user_id),
  target_user_id uuid references public.profiles(user_id),
  target_team_id uuid references public.competition_teams(id),
  reason text not null check (char_length(reason) between 5 and 500),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(target_user_id,target_team_id)=1)
);
create table public.competition_blocks (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(user_id) on delete cascade,
  primary key(user_id,blocked_user_id),
  check(user_id<>blocked_user_id)
);

-- Sensitive tables have no direct client grants. RPCs return explicit field allowlists.
do $$ declare t text; begin
  foreach t in array array['competition_rules','academic_profiles','competition_matching_profiles','competition_teams','competition_team_members','competition_team_placeholders','competition_recruitment_needs','competition_requests','competition_posts','competition_team_messages','competition_lobby_messages','competition_notifications','competition_reports','competition_blocks'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
  end loop;
end $$;
create policy competition_rules_read on public.competition_rules for select to authenticated using (true);
grant select on public.competition_rules to authenticated;
create policy academic_owner_read on public.academic_profiles for select to authenticated using (user_id=auth.uid());
grant select on public.academic_profiles to authenticated;

create or replace function public.save_competition_academic_profile(p_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_visibility jsonb;
begin
  if jsonb_typeof(p_data)<>'object' or length(p_data::text)>16000 then raise exception 'Invalid academic profile'; end if;
  if not exists(select 1 from public.profiles where user_id=v_user and school_id is not null) then raise exception 'Select your school before saving Academic Profile'; end if;
  if nullif(trim(p_data->>'country'),'') is null or nullif(trim(p_data->>'location'),'') is null then raise exception 'Country and city are required'; end if;
  if p_data->>'curriculum' not in ('AP','A-Level','IB','Other','Mixed') then raise exception 'Choose a curriculum'; end if;
  v_visibility := coalesce(p_data->'visibility','{}'::jsonb);
  if jsonb_typeof(v_visibility)<>'object' or exists(select 1 from jsonb_each_text(v_visibility) v where v.value not in ('public','matches','private')) then raise exception 'Invalid visibility'; end if;
  insert into public.academic_profiles(user_id,country,location,curriculum,curriculum_detail,graduation_year,gpa,gpa_scale,gpa_system,english_tests,standardized_tests,amc_records,competition_records,visibility,bio)
  values(v_user,coalesce(p_data->>'country',''),coalesce(p_data->>'location',''),coalesce(p_data->>'curriculum',''),coalesce(p_data->'curriculum_detail','{}'),nullif(p_data->>'graduation_year','')::integer,nullif(p_data->>'gpa','')::numeric,coalesce(p_data->>'gpa_scale',''),coalesce(p_data->>'gpa_system',''),coalesce(p_data->'english_tests','[]'),coalesce(p_data->'standardized_tests','[]'),coalesce(p_data->'amc_records','[]'),coalesce(p_data->'competition_records','[]'),v_visibility,coalesce(p_data->>'bio',''))
  on conflict(user_id) do update set country=excluded.country,location=excluded.location,curriculum=excluded.curriculum,curriculum_detail=excluded.curriculum_detail,graduation_year=excluded.graduation_year,gpa=excluded.gpa,gpa_scale=excluded.gpa_scale,gpa_system=excluded.gpa_system,english_tests=excluded.english_tests,standardized_tests=excluded.standardized_tests,amc_records=excluded.amc_records,competition_records=excluded.competition_records,visibility=excluded.visibility,bio=excluded.bio,updated_at=now();
end $$;

create or replace function public.save_competition_matching_profile(p_competition text,p_division text,p_status text,p_target text,p_strengths text[],p_needs text[],p_preferences jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_id uuid;
begin
  if not exists(select 1 from public.academic_profiles where user_id=v_user) then raise exception 'Complete Academic Profile first'; end if;
  if not exists(select 1 from public.competition_rules where competition=p_competition and division=p_division and active) then raise exception 'Competition division unavailable'; end if;
  if p_status not in ('looking_for_team','looking_for_teammates') then raise exception 'Invalid matching status'; end if;
  insert into public.competition_matching_profiles(user_id,competition,division,status,target,strengths,needs,preferences)
  values(v_user,p_competition,p_division,p_status,coalesce(p_target,''),coalesce(p_strengths,'{}'),coalesce(p_needs,'{}'),coalesce(p_preferences,'{}'))
  on conflict(user_id,competition,division) do update set status=case when exists(select 1 from public.competition_team_members m where m.user_id=v_user and m.competition=p_competition and m.division=p_division) then 'on_team' else excluded.status end,target=excluded.target,strengths=excluded.strengths,needs=excluded.needs,preferences=excluded.preferences,active=true,updated_at=now(),last_opened_at=now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.open_competition_context(p_competition text,p_division text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  update public.competition_matching_profiles set last_opened_at=now() where user_id=v_user and competition=p_competition and division=p_division and active;
  if not found then raise exception 'Matching profile not found'; end if;
end $$;

create or replace function public.create_competition_team(p_competition text,p_division text,p_name text,p_intro text,p_target text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_id uuid;
begin
  if not exists(select 1 from public.competition_matching_profiles where user_id=v_user and competition=p_competition and division=p_division and active) then raise exception 'Create a matching profile first'; end if;
  if exists(select 1 from public.competition_team_members where user_id=v_user and competition=p_competition and division=p_division) then raise exception 'Already on a team in this division'; end if;
  if not exists(select 1 from public.competition_rules where competition=p_competition and division=p_division and active) then raise exception 'Competition division unavailable'; end if;
  insert into public.competition_teams(owner_id,competition,division,name,introduction,target) values(v_user,p_competition,p_division,trim(p_name),coalesce(p_intro,''),coalesce(p_target,'')) returning id into v_id;
  insert into public.competition_team_members(team_id,user_id,competition,division,role) values(v_id,v_user,p_competition,p_division,'owner');
  insert into public.competition_recruitment_needs(team_id,strength_tags) select v_id,needs from public.competition_matching_profiles where user_id=v_user and competition=p_competition and division=p_division and cardinality(needs)>0;
  update public.competition_matching_profiles set status='on_team',updated_at=now() where user_id=v_user and competition=p_competition and division=p_division;
  return v_id;
end $$;

create or replace function public.request_competition_team(p_team_id uuid,p_kind text,p_message text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_team public.competition_teams%rowtype; v_target uuid; v_id uuid; v_max integer;
begin
  select * into v_team from public.competition_teams where id=p_team_id and active for update;
  if not found then raise exception 'Team unavailable'; end if;
  select max_team_size into v_max from public.competition_rules where competition=v_team.competition and division=v_team.division;
  if p_kind='application' then
    v_target:=v_user;
    if not v_team.recruiting then raise exception 'Recruitment is closed'; end if;
  elsif p_kind='invitation' then
    if v_team.owner_id<>v_user then raise exception 'Only the team owner can invite'; end if;
    raise exception 'Use invite_competition_player with a recipient';
  else raise exception 'Invalid request'; end if;
  if (select count(*) from public.competition_team_members where team_id=p_team_id)+(select count(*) from public.competition_team_placeholders where team_id=p_team_id and claimed_by_user_id is null)>=v_max then raise exception 'Team is full'; end if;
  if not exists(select 1 from public.competition_matching_profiles where user_id=v_target and competition=v_team.competition and division=v_team.division and active) then raise exception 'Matching profile required'; end if;
  if exists(select 1 from public.competition_team_members where user_id=v_target and competition=v_team.competition and division=v_team.division) then raise exception 'Already on a team in this division'; end if;
  if exists(select 1 from public.competition_blocks where (user_id=v_user and blocked_user_id=v_team.owner_id) or (user_id=v_team.owner_id and blocked_user_id=v_user)) then raise exception 'Request unavailable'; end if;
  insert into public.competition_requests(team_id,user_id,kind,initiated_by,message) values(p_team_id,v_target,p_kind,v_user,coalesce(p_message,'')) returning id into v_id;
  insert into public.competition_notifications(user_id,kind,payload) values(v_team.owner_id,'application',jsonb_build_object('team_id',p_team_id,'request_id',v_id));
  return v_id;
end $$;

create or replace function public.invite_competition_player(p_team_id uuid,p_user_id uuid,p_message text default '',p_placeholder_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_team public.competition_teams%rowtype; v_id uuid; v_max integer;
begin
  select * into v_team from public.competition_teams where id=p_team_id and active for update;
  if not found or v_team.owner_id<>v_user then raise exception 'Only the team owner can invite'; end if;
  select max_team_size into v_max from public.competition_rules where competition=v_team.competition and division=v_team.division;
  if p_placeholder_id is not null and not exists(select 1 from public.competition_team_placeholders where id=p_placeholder_id and team_id=p_team_id and claimed_by_user_id is null) then raise exception 'Reserved seat unavailable'; end if;
  if (select count(*) from public.competition_team_members where team_id=p_team_id)+(select count(*) from public.competition_team_placeholders where team_id=p_team_id and claimed_by_user_id is null)>=v_max and p_placeholder_id is null then raise exception 'Team is full'; end if;
  if not exists(select 1 from public.competition_matching_profiles where user_id=p_user_id and competition=v_team.competition and division=v_team.division and active and status='looking_for_team') then raise exception 'Player unavailable'; end if;
  if exists(select 1 from public.competition_blocks where (user_id=v_user and blocked_user_id=p_user_id) or (user_id=p_user_id and blocked_user_id=v_user)) then raise exception 'Player unavailable'; end if;
  insert into public.competition_requests(team_id,user_id,kind,initiated_by,message,placeholder_id) values(p_team_id,p_user_id,'invitation',v_user,coalesce(p_message,''),p_placeholder_id) returning id into v_id;
  insert into public.competition_notifications(user_id,kind,payload) values(p_user_id,'invitation',jsonb_build_object('team_id',p_team_id,'request_id',v_id));
  return v_id;
end $$;

create or replace function public.resolve_competition_request(p_request_id uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_request public.competition_requests%rowtype; v_team public.competition_teams%rowtype; v_max integer; v_used integer;
begin
  select * into v_request from public.competition_requests where id=p_request_id;
  if not found then raise exception 'Request unavailable'; end if;
  select * into v_team from public.competition_teams where id=v_request.team_id for update;
  select * into v_request from public.competition_requests where id=p_request_id for update;
  if v_request.status<>'pending' or not v_team.active then raise exception 'Request is no longer pending'; end if;
  if (v_request.kind='application' and v_user<>v_team.owner_id) or (v_request.kind='invitation' and v_user<>v_request.user_id) then raise exception 'Not authorized to decide this request'; end if;
  if p_action not in ('accepted','declined') then raise exception 'Invalid decision'; end if;
  if p_action='accepted' then
    select max_team_size into v_max from public.competition_rules where competition=v_team.competition and division=v_team.division;
    if v_request.placeholder_id is not null and not exists(select 1 from public.competition_team_placeholders where id=v_request.placeholder_id and team_id=v_team.id and claimed_by_user_id is null) then raise exception 'Reserved seat unavailable'; end if;
    select count(*) into v_used from public.competition_team_members where team_id=v_team.id;
    select v_used + count(*) - case when v_request.placeholder_id is null then 0 else 1 end into v_used from public.competition_team_placeholders where team_id=v_team.id and claimed_by_user_id is null;
    if v_used>=v_max then raise exception 'Team is full'; end if;
    if not exists(select 1 from public.competition_matching_profiles where user_id=v_request.user_id and competition=v_team.competition and division=v_team.division and active) then raise exception 'Matching profile unavailable'; end if;
    if exists(select 1 from public.competition_team_members where user_id=v_request.user_id and competition=v_team.competition and division=v_team.division) then raise exception 'Already on a team in this division'; end if;
    insert into public.competition_team_members(team_id,user_id,competition,division) values(v_team.id,v_request.user_id,v_team.competition,v_team.division);
    if v_request.placeholder_id is not null then update public.competition_team_placeholders set claimed_by_user_id=v_request.user_id where id=v_request.placeholder_id and team_id=v_team.id; end if;
    update public.competition_matching_profiles set status='on_team',updated_at=now() where user_id=v_request.user_id and competition=v_team.competition and division=v_team.division;
    update public.competition_requests set status='expired',updated_at=now() where user_id=v_request.user_id and id<>p_request_id and status='pending' and team_id in (select id from public.competition_teams where competition=v_team.competition and division=v_team.division);
  end if;
  update public.competition_requests set status=p_action,updated_at=now() where id=p_request_id;
  insert into public.competition_notifications(user_id,kind,payload) values(case when v_request.kind='application' then v_request.user_id else v_team.owner_id end,p_action,jsonb_build_object('team_id',v_team.id,'request_id',p_request_id));
end $$;

create or replace function public.withdraw_competition_request(p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_request public.competition_requests%rowtype;
begin
  select * into v_request from public.competition_requests where id=p_request_id for update;
  if not found or v_request.initiated_by<>v_user or v_request.status<>'pending' then raise exception 'Pending request not found'; end if;
  update public.competition_requests set status='withdrawn',updated_at=now() where id=p_request_id;
end $$;

create or replace function public.leave_competition_team(p_team_id uuid,p_user_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_team public.competition_teams%rowtype; v_target uuid:=coalesce(p_user_id,v_user);
begin
  select * into v_team from public.competition_teams where id=p_team_id for update;
  if not found or (v_target<>v_user and v_team.owner_id<>v_user) then raise exception 'Not authorized'; end if;
  if v_target=v_team.owner_id then raise exception 'Team owner must transfer or close the team'; end if;
  delete from public.competition_team_members where team_id=p_team_id and user_id=v_target;
  if not found then raise exception 'Member not found'; end if;
  update public.competition_matching_profiles set status='looking_for_team',updated_at=now() where user_id=v_target and competition=v_team.competition and division=v_team.division;
  insert into public.competition_notifications(user_id,kind,payload) values(v_team.owner_id,'member_left',jsonb_build_object('team_id',p_team_id,'user_id',v_target));
end $$;

create or replace function public.transfer_competition_team(p_team_id uuid,p_new_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_team public.competition_teams%rowtype;
begin
  select * into v_team from public.competition_teams where id=p_team_id and active for update;
  if not found or v_team.owner_id<>v_user then raise exception 'Owner only'; end if;
  if p_new_owner=v_user or not exists(select 1 from public.competition_team_members where team_id=p_team_id and user_id=p_new_owner) then raise exception 'Choose another current member'; end if;
  update public.competition_team_members set role='member' where team_id=p_team_id and user_id=v_user;
  update public.competition_team_members set role='owner' where team_id=p_team_id and user_id=p_new_owner;
  update public.competition_teams set owner_id=p_new_owner where id=p_team_id;
  insert into public.competition_notifications(user_id,kind,payload) values(p_new_owner,'ownership_transferred',jsonb_build_object('team_id',p_team_id));
end $$;

create or replace function public.visible_competition_academic(p_target uuid,p_viewer uuid,p_viewer_team uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.academic_profiles%rowtype; v_match boolean;
begin
  if p_viewer is distinct from auth.uid() or (p_viewer_team is not null and not exists(select 1 from public.competition_team_members where team_id=p_viewer_team and user_id=p_viewer)) then raise exception 'Not authorized'; end if;
  select * into a from public.academic_profiles where user_id=p_target;
  if not found then return '{}'::jsonb; end if;
  v_match := p_viewer_team is not null and (exists(select 1 from public.competition_requests q where q.team_id=p_viewer_team and q.user_id=p_target and q.status='accepted') or exists(select 1 from public.competition_team_members m where m.team_id=p_viewer_team and m.user_id=p_target));
  return jsonb_build_object(
    'school',case when a.visibility->>'school'='public' or (a.visibility->>'school'='matches' and v_match) then (select s.name from public.profiles p left join public.schools s on s.id=p.school_id where p.user_id=p_target) else null end,
    'gpa',case when a.visibility->>'gpa'='public' or (a.visibility->>'gpa'='matches' and v_match) then a.gpa else null end,
    'gpaScale',case when a.visibility->>'gpa'='public' or (a.visibility->>'gpa'='matches' and v_match) then a.gpa_scale else null end,
    'economics',case when a.visibility->>'economics'='public' or (a.visibility->>'economics'='matches' and v_match) then a.curriculum_detail else '{}'::jsonb end,
    'englishTests',case when a.visibility->>'english_tests'='public' or (a.visibility->>'english_tests'='matches' and v_match) then a.english_tests else '[]'::jsonb end,
    'standardizedTests',case when a.visibility->>'standardized_tests'='public' or (a.visibility->>'standardized_tests'='matches' and v_match) then a.standardized_tests else '[]'::jsonb end,
    'amcRecords',case when a.visibility->>'amc_records'='public' or (a.visibility->>'amc_records'='matches' and v_match) then a.amc_records else '[]'::jsonb end,
    'competitionRecords',case when a.visibility->>'competition_records'='public' or (a.visibility->>'competition_records'='matches' and v_match) then a.competition_records else '[]'::jsonb end
  );
end $$;
revoke all on function public.visible_competition_academic(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.get_competition_home(p_competition text default null,p_division text default null,p_offset integer default 0,p_query text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_context public.competition_matching_profiles%rowtype; v_team_id uuid; v_result jsonb;
begin
  if char_length(p_query)>80 then raise exception 'Search is too long'; end if;
  if p_competition is null then select * into v_context from public.competition_matching_profiles where user_id=v_user and active order by last_opened_at desc limit 1;
  else select * into v_context from public.competition_matching_profiles where user_id=v_user and competition=p_competition and division=p_division and active; end if;
  if v_context.id is not null then select team_id into v_team_id from public.competition_team_members where user_id=v_user and competition=v_context.competition and division=v_context.division; end if;
  select jsonb_build_object(
    'identity',(select jsonb_build_object('name',p.display_name,'school',s.name,'city',s.city,'grade',d.grade,'avatar',p.avatar_url) from public.profiles p left join public.schools s on s.id=p.school_id left join public.member_profile_details d on d.user_id=p.user_id where p.user_id=v_user),
    'academic',(select to_jsonb(a) from public.academic_profiles a where a.user_id=v_user),
    'rules',(select coalesce(jsonb_agg(to_jsonb(r) order by r.competition,r.division),'[]'::jsonb) from public.competition_rules r where r.active),
    'profiles',(select coalesce(jsonb_agg(to_jsonb(m) order by m.last_opened_at desc),'[]'::jsonb) from public.competition_matching_profiles m where m.user_id=v_user and m.active),
    'context',case when v_context.id is null then null else to_jsonb(v_context) end,
    'stats',case when v_context.id is null then null else jsonb_build_object('players',(select count(*) from public.competition_matching_profiles m where m.competition=v_context.competition and m.division=v_context.division and m.active and m.status='looking_for_team'),'teams',(select count(*) from public.competition_teams t where t.competition=v_context.competition and t.division=v_context.division and t.active),'recruiting',(select count(*) from public.competition_teams t where t.competition=v_context.competition and t.division=v_context.division and t.active and t.recruiting)) end,
    'teams',case when v_context.id is null then '[]'::jsonb else (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select jsonb_build_object('id',t.id,'name',t.name,'introduction',t.introduction,'target',t.target,'ownerId',t.owner_id,'ownerName',p.display_name,'school',public.visible_competition_academic(t.owner_id,v_user,v_team_id)->>'school','recruiting',t.recruiting,'members',(select count(*) from public.competition_team_members z where z.team_id=t.id),'placeholders',(select count(*) from public.competition_team_placeholders z where z.team_id=t.id and z.claimed_by_user_id is null),'capacity',r.max_team_size,'needs',(select coalesce(jsonb_agg(n.strength_tags),'[]'::jsonb) from public.competition_recruitment_needs n where n.team_id=t.id and n.active)) x from public.competition_teams t join public.competition_rules r on (r.competition,r.division)=(t.competition,t.division) join public.profiles p on p.user_id=t.owner_id left join public.schools s on s.id=p.school_id where t.competition=v_context.competition and t.division=v_context.division and t.active and (p_query='' or t.name ilike '%'||p_query||'%' or (coalesce((select a.visibility->>'school' from public.academic_profiles a where a.user_id=t.owner_id),'public')='public' and s.name ilike '%'||p_query||'%')) and not exists(select 1 from public.competition_blocks b where (b.user_id=v_user and b.blocked_user_id=t.owner_id) or (b.user_id=t.owner_id and b.blocked_user_id=v_user)) order by t.created_at desc limit 20 offset greatest(0,least(p_offset,10000))) q) end,
    'players',case when v_context.id is null then '[]'::jsonb else (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select jsonb_build_object('id',m.user_id,'name',p.display_name,'avatar',p.avatar_url,'school',public.visible_competition_academic(m.user_id,v_user,v_team_id)->>'school','curriculum',a.curriculum,'bio',a.bio,'strengths',m.strengths,'target',m.target,'academicDetails',public.visible_competition_academic(m.user_id,v_user,v_team_id)) x from public.competition_matching_profiles m join public.profiles p on p.user_id=m.user_id left join public.schools s on s.id=p.school_id left join public.academic_profiles a on a.user_id=m.user_id where m.competition=v_context.competition and m.division=v_context.division and m.active and m.status='looking_for_team' and m.user_id<>v_user and (p_query='' or p.display_name ilike '%'||p_query||'%' or (coalesce(a.visibility->>'school','public')='public' and s.name ilike '%'||p_query||'%')) and not exists(select 1 from public.competition_blocks b where (b.user_id=v_user and b.blocked_user_id=m.user_id) or (b.user_id=m.user_id and b.blocked_user_id=v_user)) order by m.updated_at desc limit 20 offset greatest(0,least(p_offset,10000))) q) end,
    'myTeam',case when v_team_id is null then null else (select jsonb_build_object('id',t.id,'name',t.name,'introduction',t.introduction,'target',t.target,'ownerId',t.owner_id,'recruiting',t.recruiting,'competition',t.competition,'division',t.division,'capacity',r.max_team_size,'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name,'avatar',p.avatar_url,'role',m.role,'school',s.name)),'[]'::jsonb) from public.competition_team_members m join public.profiles p on p.user_id=m.user_id left join public.schools s on s.id=p.school_id where m.team_id=t.id),'placeholders',(select coalesce(jsonb_agg(jsonb_build_object('id',z.id,'name',z.display_name,'school',z.school)),'[]'::jsonb) from public.competition_team_placeholders z where z.team_id=t.id and z.claimed_by_user_id is null),'needs',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'tags',n.strength_tags,'note',n.note)),'[]'::jsonb) from public.competition_recruitment_needs n where n.team_id=t.id and n.active),'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',p.display_name,'body',q.body,'at',q.created_at) order by q.id),'[]'::jsonb) from (select * from public.competition_team_messages where team_id=t.id order by id desc limit 50) q join public.profiles p on p.user_id=q.user_id)) from public.competition_teams t join public.competition_rules r on (r.competition,r.division)=(t.competition,t.division) where t.id=v_team_id) end,
    'requests',case when v_context.id is null then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'teamId',q.team_id,'teamName',t.name,'userId',q.user_id,'userName',p.display_name,'initiatedBy',q.initiated_by,'kind',q.kind,'status',q.status,'message',q.message,'createdAt',q.created_at) order by q.created_at desc),'[]'::jsonb) from public.competition_requests q join public.competition_teams t on t.id=q.team_id join public.profiles p on p.user_id=q.user_id where t.competition=v_context.competition and t.division=v_context.division and (q.user_id=v_user or t.owner_id=v_user) and q.created_at>now()-interval '90 days') end,
    'notifications',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'payload',n.payload,'createdAt',n.created_at)),'[]'::jsonb) from (select * from public.competition_notifications where user_id=v_user and read_at is null order by id desc limit 20) n)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.post_competition_team_message(p_team_id uuid,p_body text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  if not exists(select 1 from public.competition_team_members where team_id=p_team_id and user_id=v_user) then raise exception 'Members only'; end if;
  insert into public.competition_team_messages(team_id,user_id,body) values(p_team_id,v_user,trim(p_body));
end $$;
create or replace function public.get_competition_lounge(p_competition text,p_division text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  if not exists(select 1 from public.competition_matching_profiles where user_id=v_user and competition=p_competition and division=p_division and active) then raise exception 'Join this competition division first'; end if;
  return jsonb_build_object(
    'posts',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',p.display_name,'school',case when a.visibility->>'school'='public' then s.name else null end,'note',q.body,'teamId',q.team_id,'teamName',t.name,'strengths',m.strengths,'needs',m.needs,'createdAt',q.created_at) order by q.created_at desc),'[]'::jsonb) from (select z.* from public.competition_posts z join public.competition_matching_profiles mp on mp.id=z.matching_profile_id where mp.competition=p_competition and mp.division=p_division and mp.active and z.active and not exists(select 1 from public.competition_blocks b where (b.user_id=v_user and b.blocked_user_id=mp.user_id) or (b.user_id=mp.user_id and b.blocked_user_id=v_user)) order by z.created_at desc limit 40) q join public.competition_matching_profiles m on m.id=q.matching_profile_id join public.profiles p on p.user_id=m.user_id left join public.schools s on s.id=p.school_id left join public.academic_profiles a on a.user_id=m.user_id left join public.competition_teams t on t.id=q.team_id where (q.team_id is null and m.status='looking_for_team') or (q.team_id is not null and t.active and t.recruiting)),
    'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',p.display_name,'body',q.body,'createdAt',q.created_at) order by q.id),'[]'::jsonb) from (select z.* from public.competition_lobby_messages z where z.competition=p_competition and z.division=p_division and not exists(select 1 from public.competition_blocks b where (b.user_id=v_user and b.blocked_user_id=z.user_id) or (b.user_id=z.user_id and b.blocked_user_id=v_user)) order by z.id desc limit 50) q join public.profiles p on p.user_id=q.user_id)
  );
end $$;
create or replace function public.post_competition_recruitment(p_competition text,p_division text,p_body text,p_team_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_profile uuid;
begin
  select id into v_profile from public.competition_matching_profiles where user_id=v_user and competition=p_competition and division=p_division and active;
  if v_profile is null then raise exception 'Join this competition division first'; end if;
  if p_team_id is not null and not exists(select 1 from public.competition_teams where id=p_team_id and owner_id=v_user and competition=p_competition and division=p_division and active and recruiting) then raise exception 'Only a recruiting team owner may post for a team'; end if;
  insert into public.competition_posts(matching_profile_id,team_id,body) values(v_profile,p_team_id,trim(p_body));
end $$;
create or replace function public.post_competition_lobby_message(p_competition text,p_division text,p_body text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  if not exists(select 1 from public.competition_matching_profiles where user_id=v_user and competition=p_competition and division=p_division and active) then raise exception 'Join this competition division first'; end if;
  insert into public.competition_lobby_messages(competition,division,user_id,body) values(p_competition,p_division,v_user,trim(p_body));
end $$;
create or replace function public.mark_competition_notifications_read() returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  update public.competition_notifications set read_at=now() where user_id=v_user and read_at is null;
end $$;
create or replace function public.add_competition_placeholder(p_team_id uuid,p_name text,p_school text default '') returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user(); v_team public.competition_teams%rowtype; v_max integer;
begin
  select * into v_team from public.competition_teams where id=p_team_id and active for update;
  if not found or v_team.owner_id<>v_user then raise exception 'Owner only'; end if;
  select max_team_size into v_max from public.competition_rules where competition=v_team.competition and division=v_team.division;
  if (select count(*) from public.competition_team_members where team_id=p_team_id)+(select count(*) from public.competition_team_placeholders where team_id=p_team_id and claimed_by_user_id is null)>=v_max then raise exception 'Team is full'; end if;
  insert into public.competition_team_placeholders(team_id,display_name,school) values(p_team_id,trim(p_name),coalesce(p_school,''));
end $$;
create or replace function public.remove_competition_placeholder(p_placeholder_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  delete from public.competition_team_placeholders z using public.competition_teams t where z.id=p_placeholder_id and z.team_id=t.id and t.owner_id=v_user and z.claimed_by_user_id is null;
  if not found then raise exception 'Reserved seat unavailable'; end if;
end $$;
create or replace function public.add_competition_need(p_team_id uuid,p_tags text[],p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  if not exists(select 1 from public.competition_teams where id=p_team_id and owner_id=v_user and active) then raise exception 'Owner only'; end if;
  insert into public.competition_recruitment_needs(team_id,strength_tags,note) values(p_team_id,coalesce(p_tags,'{}'),coalesce(p_note,''));
end $$;
create or replace function public.set_competition_recruiting(p_team_id uuid,p_recruiting boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  update public.competition_teams set recruiting=p_recruiting where id=p_team_id and owner_id=v_user and active;
  if not found then raise exception 'Owner only'; end if;
  insert into public.competition_notifications(user_id,kind,payload)
  select m.user_id,case when p_recruiting then 'recruitment_reopened' else 'recruitment_closed' end,jsonb_build_object('team_id',p_team_id)
  from public.competition_team_members m where m.team_id=p_team_id and m.user_id<>v_user;
end $$;
create or replace function public.report_competition_content(p_user_id uuid,p_team_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  insert into public.competition_reports(reporter_id,target_user_id,target_team_id,reason) values(v_user,p_user_id,p_team_id,trim(p_reason));
end $$;
create or replace function public.block_competition_user(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin insert into public.competition_blocks(user_id,blocked_user_id) values(v_user,p_user_id) on conflict do nothing; end $$;

create or replace function public.get_competition_admin() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator required'; end if;
  return jsonb_build_object(
    'rules',(select coalesce(jsonb_agg(to_jsonb(r) order by r.competition,r.division),'[]'::jsonb) from public.competition_rules r),
    'reports',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (select * from public.competition_reports order by created_at desc limit 100) x),
    'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'competition',t.competition,'division',t.division,'active',t.active) order by t.created_at desc),'[]'::jsonb) from (select * from public.competition_teams order by created_at desc limit 100) t),
    'posts',(select coalesce(jsonb_agg(jsonb_build_object('id',z.id,'body',z.body,'active',z.active) order by z.created_at desc),'[]'::jsonb) from (select * from public.competition_posts order by created_at desc limit 100) z),
    'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'userId',m.user_id,'competition',m.competition,'division',m.division,'active',m.active) order by m.updated_at desc),'[]'::jsonb) from (select * from public.competition_matching_profiles order by updated_at desc limit 100) m)
  );
end $$;
create or replace function public.moderate_competition(p_action text,p_id text,p_data jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid := public.require_member_profile_user();
begin
  if not public.is_platform_admin(v_user) then raise exception 'Platform administrator required'; end if;
  if p_action='disable_team' then
    update public.competition_teams set active=false,recruiting=false where id=p_id::uuid and active;
    if not found then raise exception 'Active team not found'; end if;
    update public.competition_matching_profiles m set status='looking_for_team',updated_at=now() from public.competition_team_members x where x.team_id=p_id::uuid and x.user_id=m.user_id and x.competition=m.competition and x.division=m.division;
    delete from public.competition_team_members where team_id=p_id::uuid;
    update public.competition_requests set status='expired',updated_at=now() where team_id=p_id::uuid and status='pending';
    return;
  elsif p_action='disable_profile' then update public.competition_matching_profiles set active=false where id=p_id::uuid;
  elsif p_action='remove_post' then update public.competition_posts set active=false where id=p_id::uuid;
  elsif p_action='close_report' then update public.competition_reports set status='closed' where id=p_id::bigint;
  elsif p_action='update_rule' then
    if p_data ? 'max_team_size' and exists(select 1 from public.competition_teams t where t.competition=split_part(p_id,':',1) and t.division=split_part(p_id,':',2) and t.active and (select count(*) from public.competition_team_members m where m.team_id=t.id)+(select count(*) from public.competition_team_placeholders z where z.team_id=t.id and z.claimed_by_user_id is null)>(p_data->>'max_team_size')::integer) then raise exception 'New team size is below an active roster'; end if;
    update public.competition_rules set min_team_size=coalesce((p_data->>'min_team_size')::integer,min_team_size),max_team_size=coalesce((p_data->>'max_team_size')::integer,max_team_size),stages=case when p_data ? 'stages' then array(select jsonb_array_elements_text(p_data->'stages')) else stages end,awards=case when p_data ? 'awards' then array(select jsonb_array_elements_text(p_data->'awards')) else awards end,season=coalesce(p_data->>'season',season),active=coalesce((p_data->>'active')::boolean,active) where competition=split_part(p_id,':',1) and division=split_part(p_id,':',2);
  else raise exception 'Invalid moderation action'; end if;
  if not found then raise exception 'Target not found'; end if;
end $$;

revoke all on function public.save_competition_academic_profile(jsonb),public.save_competition_matching_profile(text,text,text,text,text[],text[],jsonb),public.open_competition_context(text,text),public.create_competition_team(text,text,text,text,text),public.request_competition_team(uuid,text,text),public.invite_competition_player(uuid,uuid,text,uuid),public.resolve_competition_request(uuid,text),public.withdraw_competition_request(uuid),public.leave_competition_team(uuid,uuid),public.transfer_competition_team(uuid,uuid),public.get_competition_home(text,text,integer,text),public.get_competition_lounge(text,text),public.post_competition_recruitment(text,text,text,uuid),public.post_competition_lobby_message(text,text,text),public.mark_competition_notifications_read(),public.post_competition_team_message(uuid,text),public.add_competition_placeholder(uuid,text,text),public.remove_competition_placeholder(uuid),public.add_competition_need(uuid,text[],text),public.set_competition_recruiting(uuid,boolean),public.report_competition_content(uuid,uuid,text),public.block_competition_user(uuid),public.get_competition_admin(),public.moderate_competition(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_competition_academic_profile(jsonb),public.save_competition_matching_profile(text,text,text,text,text[],text[],jsonb),public.open_competition_context(text,text),public.create_competition_team(text,text,text,text,text),public.request_competition_team(uuid,text,text),public.invite_competition_player(uuid,uuid,text,uuid),public.resolve_competition_request(uuid,text),public.withdraw_competition_request(uuid),public.leave_competition_team(uuid,uuid),public.transfer_competition_team(uuid,uuid),public.get_competition_home(text,text,integer,text),public.get_competition_lounge(text,text),public.post_competition_recruitment(text,text,text,uuid),public.post_competition_lobby_message(text,text,text),public.mark_competition_notifications_read(),public.post_competition_team_message(uuid,text),public.add_competition_placeholder(uuid,text,text),public.remove_competition_placeholder(uuid),public.add_competition_need(uuid,text[],text),public.set_competition_recruiting(uuid,boolean),public.report_competition_content(uuid,uuid,text),public.block_competition_user(uuid),public.get_competition_admin(),public.moderate_competition(text,text,jsonb) to authenticated;
commit;
