-- EconMind Inter-School Economic League
-- This migration extends the existing profile/auth model; it deliberately
-- keeps profiles.role untouched because the established experiment and
-- Daily Brief features use student/teacher roles.

create table if not exists public.schools (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  club_name text check (club_name is null or char_length(club_name) <= 160),
  city text check (city is null or char_length(city) <= 100),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid references public.profiles(user_id) on delete set null,
  liaison_user_id uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists platform_role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_platform_role_check;
alter table public.profiles add constraint profiles_platform_role_check check (platform_role in ('user', 'team_member', 'school_leader', 'platform_admin'));
alter table public.profiles add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.profiles add column if not exists graduation_year smallint check (graduation_year is null or graduation_year between 2024 and 2045);
alter table public.profiles add column if not exists economics_club_name text check (economics_club_name is null or char_length(economics_club_name) <= 160);
alter table public.profiles add column if not exists role_preference text check (role_preference is null or role_preference in ('participant', 'team_lead', 'school_liaison'));

create table if not exists public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  captain_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name)
);

create or replace function public.create_league_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.teams where invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.teams alter column invite_code set default public.create_league_invite_code();

create table if not exists public.team_members (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  team_role text not null default 'member' check (team_role in ('captain', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  unique (team_id, user_id),
  unique (user_id)
);

create table if not exists public.league_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  applicant_user_id uuid not null references public.profiles(user_id) on delete cascade,
  school_name text not null check (char_length(trim(school_name)) between 2 and 160),
  club_name text check (club_name is null or char_length(club_name) <= 160),
  contact_person text not null check (char_length(trim(contact_person)) between 2 and 120),
  expected_teams smallint not null check (expected_teams between 1 and 50),
  expected_members smallint not null check (expected_members between 1 and 500),
  preferred_language text not null check (preferred_language in ('English', 'Chinese', 'Bilingual')),
  preferred_format text not null check (preferred_format in ('online', 'offline', 'either')),
  organising_committee_interest boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crisis_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  scenario_id text not null default 'energy-inflation-dilemma' check (scenario_id ~ '^[a-z0-9-]{3,80}$'),
  current_round smallint not null default 2 check (current_round between 1 and 2),
  initial_metrics jsonb not null check (jsonb_typeof(initial_metrics) = 'object'),
  final_metrics jsonb not null check (jsonb_typeof(final_metrics) = 'object'),
  dimension_scores jsonb not null check (jsonb_typeof(dimension_scores) = 'object'),
  total_score numeric(5,2) not null check (total_score between 0 and 100),
  result_type text not null check (result_type in ('Balanced Economy', 'Inflation Fighter', 'Growth at All Costs', 'Socially Protective', 'Fiscal Conservative', 'Stable but Slow', 'Crisis Mismanagement')),
  result_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(result_summary) = 'object'),
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crisis_decisions (
  id uuid primary key default extensions.gen_random_uuid(),
  crisis_run_id uuid not null references public.crisis_runs(id) on delete cascade,
  round_number smallint not null check (round_number between 1 and 2),
  monetary_policy text not null check (monetary_policy in ('cut', 'hold', 'raise')),
  fiscal_policy text not null check (fiscal_policy in ('reduce', 'maintain', 'increase')),
  energy_policy text not null check (energy_policy in ('none', 'targeted', 'broad')),
  shock_id text check (shock_id is null or shock_id = 'oil-price-spike'),
  metrics_before jsonb not null check (jsonb_typeof(metrics_before) = 'object'),
  metrics_after jsonb not null check (jsonb_typeof(metrics_after) = 'object'),
  explanation jsonb not null check (jsonb_typeof(explanation) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (crisis_run_id, round_number)
);

create index if not exists profiles_school_id_idx on public.profiles(school_id);
create index if not exists teams_school_id_idx on public.teams(school_id);
create index if not exists team_members_team_id_idx on public.team_members(team_id);
create index if not exists league_applications_applicant_idx on public.league_applications(applicant_user_id, created_at desc);
create index if not exists league_applications_status_idx on public.league_applications(status, created_at desc);
create index if not exists crisis_runs_user_idx on public.crisis_runs(user_id, completed_at desc);
create index if not exists crisis_runs_team_idx on public.crisis_runs(team_id, completed_at desc) where team_id is not null;
create index if not exists crisis_decisions_run_idx on public.crisis_decisions(crisis_run_id, round_number);

create or replace function public.league_platform_role(p_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$ select platform_role from public.profiles where user_id = p_user_id $$;

create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.league_platform_role(p_user_id) = 'platform_admin', false) $$;

create or replace function public.is_school_member(p_school_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where user_id = p_user_id and school_id = p_school_id)
      or exists(select 1 from public.team_members tm join public.teams t on t.id = tm.team_id where tm.user_id = p_user_id and t.school_id = p_school_id)
$$;

create or replace function public.is_school_leader_for(p_school_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles p
    left join public.schools s on s.id = p_school_id
    where p.user_id = p_user_id
      and p.platform_role = 'school_leader'
      and (p.school_id = p_school_id or s.liaison_user_id = p_user_id)
  )
$$;

create or replace function public.is_team_member(p_team_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.team_members where team_id = p_team_id and user_id = p_user_id) $$;

create or replace function public.can_view_crisis_run(p_run_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.crisis_runs r
    left join public.teams t on t.id = r.team_id
    where r.id = p_run_id and (
      r.user_id = p_user_id
      or public.is_platform_admin(p_user_id)
      or (r.team_id is not null and public.is_team_member(r.team_id, p_user_id))
      or (t.school_id is not null and public.is_school_leader_for(t.school_id, p_user_id))
    )
  )
$$;

create or replace function public.add_team_captain_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_members(team_id, user_id, team_role)
  values (new.id, new.captain_user_id, 'captain')
  on conflict (team_id, user_id) do update set team_role = 'captain';
  return new;
end;
$$;

drop trigger if exists teams_add_captain_member on public.teams;
create trigger teams_add_captain_member after insert on public.teams for each row execute function public.add_team_captain_member();

create or replace function public.join_team_by_invite(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_team public.teams%rowtype;
  current_school uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into selected_team from public.teams where invite_code = upper(trim(p_invite_code));
  if not found then raise exception 'Invite code not found'; end if;
  select school_id into current_school from public.profiles where user_id = auth.uid();
  if current_school is not null and current_school <> selected_team.school_id then
    raise exception 'You are already associated with another school';
  end if;
  insert into public.team_members(team_id, user_id, team_role)
  values(selected_team.id, auth.uid(), 'member')
  on conflict (team_id, user_id) do nothing;
  update public.profiles
  set school_id = selected_team.school_id,
      platform_role = case when platform_role = 'user' then 'team_member' else platform_role end
  where user_id = auth.uid();
  return jsonb_build_object('team_id', selected_team.id, 'team_name', selected_team.name, 'school_id', selected_team.school_id);
end;
$$;

create or replace function public.review_league_application(p_application_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.league_applications%rowtype;
  new_school_id uuid;
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_status not in ('approved', 'rejected', 'under_review') then raise exception 'Invalid application status'; end if;
  select * into application from public.league_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if application.status in ('approved', 'rejected') then raise exception 'This application has already been decided'; end if;
  if p_status = 'approved' then
    insert into public.schools(name, club_name, status, created_by, liaison_user_id)
    values(application.school_name, application.club_name, 'approved', application.applicant_user_id, application.applicant_user_id)
    returning id into new_school_id;
    update public.profiles set school_id = new_school_id, platform_role = 'school_leader' where user_id = application.applicant_user_id;
  end if;
  update public.league_applications
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = timezone('utc', now())
  where id = application.id;
  return jsonb_build_object('application_id', application.id, 'status', p_status, 'school_id', new_school_id);
end;
$$;

create or replace function public.set_league_platform_role(p_user_id uuid, p_platform_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_platform_role not in ('user', 'team_member', 'school_leader', 'platform_admin') then raise exception 'Invalid platform role'; end if;
  update public.profiles set platform_role = p_platform_role where user_id = p_user_id;
end;
$$;

create or replace function public.set_league_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists schools_set_updated_at on public.schools;
drop trigger if exists teams_set_updated_at on public.teams;
drop trigger if exists league_applications_set_updated_at on public.league_applications;
drop trigger if exists crisis_runs_set_updated_at on public.crisis_runs;
create trigger schools_set_updated_at before update on public.schools for each row execute function public.set_league_updated_at();
create trigger teams_set_updated_at before update on public.teams for each row execute function public.set_league_updated_at();
create trigger league_applications_set_updated_at before update on public.league_applications for each row execute function public.set_league_updated_at();
create trigger crisis_runs_set_updated_at before update on public.crisis_runs for each row execute function public.set_league_updated_at();

alter table public.schools enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.league_applications enable row level security;
alter table public.crisis_runs enable row level security;
alter table public.crisis_decisions enable row level security;

create policy profiles_league_admin_select on public.profiles for select to authenticated using (public.is_platform_admin());
create policy profiles_school_leader_select on public.profiles for select to authenticated using (school_id is not null and public.is_school_leader_for(school_id));

create policy schools_select_members on public.schools for select to authenticated using (public.is_platform_admin() or public.is_school_member(id));
create policy schools_update_leaders on public.schools for update to authenticated using (public.is_platform_admin() or public.is_school_leader_for(id)) with check (public.is_platform_admin() or public.is_school_leader_for(id));

create policy teams_select_school_members on public.teams for select to authenticated using (public.is_platform_admin() or public.is_school_member(school_id));
create policy teams_insert_school_leaders on public.teams for insert to authenticated with check (captain_user_id = auth.uid() and public.is_school_leader_for(school_id));
create policy teams_update_school_leaders on public.teams for update to authenticated using (public.is_platform_admin() or public.is_school_leader_for(school_id)) with check (public.is_platform_admin() or public.is_school_leader_for(school_id));

create policy team_members_select_team on public.team_members for select to authenticated using (public.is_platform_admin() or public.is_team_member(team_id) or exists(select 1 from public.teams t where t.id = team_id and public.is_school_leader_for(t.school_id)));

create policy league_applications_insert_own on public.league_applications for insert to authenticated with check (applicant_user_id = auth.uid());
create policy league_applications_select_own_or_admin on public.league_applications for select to authenticated using (applicant_user_id = auth.uid() or public.is_platform_admin());

create policy crisis_runs_select_visible on public.crisis_runs for select to authenticated using (public.can_view_crisis_run(id));
create policy crisis_runs_insert_own on public.crisis_runs for insert to authenticated with check (user_id = auth.uid() and (team_id is null or public.is_team_member(team_id)));
create policy crisis_runs_update_own on public.crisis_runs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (team_id is null or public.is_team_member(team_id)));
create policy crisis_decisions_select_visible on public.crisis_decisions for select to authenticated using (public.can_view_crisis_run(crisis_run_id));
create policy crisis_decisions_insert_owner on public.crisis_decisions for insert to authenticated with check (exists(select 1 from public.crisis_runs r where r.id = crisis_run_id and r.user_id = auth.uid()));

revoke update on public.profiles from authenticated;
grant update(display_name, avatar_url, preferred_theme, graduation_year, economics_club_name, role_preference) on public.profiles to authenticated;
grant select, insert, update on public.schools, public.teams, public.team_members, public.league_applications, public.crisis_runs, public.crisis_decisions to authenticated;
revoke all on function public.create_league_invite_code() from public, anon, authenticated;
revoke all on function public.add_team_captain_member() from public, anon, authenticated;
grant execute on function public.create_league_invite_code(), public.join_team_by_invite(text), public.review_league_application(uuid, text), public.set_league_platform_role(uuid, text), public.is_platform_admin(uuid), public.is_school_member(uuid, uuid), public.is_school_leader_for(uuid, uuid), public.is_team_member(uuid, uuid), public.can_view_crisis_run(uuid, uuid) to authenticated;

-- One-time bootstrap. This only assigns the initial administrator; all later
-- role changes are governed by set_league_platform_role and database checks.
update public.profiles p
set platform_role = 'platform_admin'
from auth.users u
where p.user_id = u.id and lower(u.email) = lower('samuel.qian@szzx-intl.cn');
