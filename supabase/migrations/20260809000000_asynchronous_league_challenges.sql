-- EconMind OS asynchronous multi-format League.
-- This migration deliberately leaves the persistent continuous World
-- Simulation untouched. Its country ownership, seven existing portfolios and
-- natural-time settlement continue to use their existing tables and rules.

-- ---------------------------------------------------------------------------
-- A. A school may operate several independent teams.
-- ---------------------------------------------------------------------------
alter table public.teams
  add column if not exists slug text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz;

-- Earlier pilot versions limited a user to one team. Membership itself is now
-- many-to-many; school association on profiles still prevents cross-school
-- joins through the public invite flow.
alter table public.team_members drop constraint if exists team_members_user_id_key;

create or replace function public.make_league_team_slug(p_name text, p_team_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate text;
  suffix integer := 2;
begin
  base_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'team'; end if;
  candidate := left(base_slug, 72);
  while exists(select 1 from public.teams where slug = candidate and (p_team_id is null or id <> p_team_id)) loop
    candidate := left(base_slug, 67) || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;
  return candidate;
end;
$$;

update public.teams
set slug = public.make_league_team_slug(name, id),
    created_by = coalesce(created_by, captain_user_id)
where slug is null or slug = '' or created_by is null;

alter table public.teams alter column slug set not null;
create unique index if not exists teams_slug_key on public.teams(slug);
create index if not exists teams_school_status_idx on public.teams(school_id, status, created_at desc);
create index if not exists team_members_user_team_idx on public.team_members(user_id, team_id);

create or replace function public.create_school_team(p_school_id uuid, p_name text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  created_team public.teams%rowtype;
  clean_name text := trim(p_name);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(clean_name) < 2 or length(clean_name) > 100 then
    raise exception 'Team names must be between 2 and 100 characters';
  end if;
  if not (public.is_platform_admin(auth.uid()) or public.is_school_leader_for(p_school_id, auth.uid())) then
    raise exception 'Only this school''s School Leader or a platform administrator can create a team';
  end if;
  insert into public.teams(school_id, name, slug, captain_user_id, created_by, status)
  values(p_school_id, clean_name, public.make_league_team_slug(clean_name), auth.uid(), auth.uid(), 'active')
  returning * into created_team;
  return created_team;
end;
$$;

create or replace function public.rename_school_team(p_team_id uuid, p_name text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  renamed_team public.teams%rowtype;
  clean_name text := trim(p_name);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(clean_name) < 2 or length(clean_name) > 100 then
    raise exception 'Team names must be between 2 and 100 characters';
  end if;
  select * into renamed_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'Team not found'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.is_school_leader_for(renamed_team.school_id, auth.uid())) then
    raise exception 'Only this school''s School Leader or a platform administrator can rename a team';
  end if;
  update public.teams
  set name = clean_name, slug = public.make_league_team_slug(clean_name, p_team_id)
  where id = p_team_id
  returning * into renamed_team;
  return renamed_team;
end;
$$;

create or replace function public.set_school_team_status(p_team_id uuid, p_status text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  edited_team public.teams%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('active', 'inactive', 'archived') then raise exception 'Invalid team status'; end if;
  select * into edited_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'Team not found'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.is_school_leader_for(edited_team.school_id, auth.uid())) then
    raise exception 'Only this school''s School Leader or a platform administrator can manage a team';
  end if;
  update public.teams
  set status = p_status,
      archived_at = case when p_status = 'archived' then timezone('utc', now()) else null end
  where id = p_team_id
  returning * into edited_team;
  return edited_team;
end;
$$;

create or replace function public.move_school_team_member(
  p_user_id uuid,
  p_from_team_id uuid,
  p_to_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  from_team public.teams%rowtype;
  to_team public.teams%rowtype;
  prior_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into from_team from public.teams where id = p_from_team_id for update;
  select * into to_team from public.teams where id = p_to_team_id for update;
  if not found or from_team.school_id <> to_team.school_id then
    raise exception 'Teams must exist in the same school';
  end if;
  if from_team.captain_user_id = p_user_id then
    raise exception 'Transfer captaincy before moving a Team Captain';
  end if;
  if not (public.is_platform_admin(auth.uid()) or public.is_school_leader_for(from_team.school_id, auth.uid())) then
    raise exception 'Only this school''s School Leader or a platform administrator can move members';
  end if;
  select team_role into prior_role from public.team_members where team_id = p_from_team_id and user_id = p_user_id;
  if prior_role is null then raise exception 'Member is not in the source team'; end if;
  delete from public.team_members where team_id = p_from_team_id and user_id = p_user_id;
  insert into public.team_members(team_id, user_id, team_role)
  values(p_to_team_id, p_user_id, case when prior_role = 'captain' then 'member' else prior_role end)
  on conflict (team_id, user_id) do nothing;
end;
$$;

-- Keep the original same-school invite safeguard, while preventing archived
-- teams from receiving new members.
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
  select * into selected_team
  from public.teams
  where invite_code = upper(trim(p_invite_code)) and status = 'active';
  if not found then raise exception 'Active team invite code not found'; end if;
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

-- ---------------------------------------------------------------------------
-- B. Shared Challenge abstraction.
-- ---------------------------------------------------------------------------
create table if not exists public.league_seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.league_challenges (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.league_seasons(id) on delete set null,
  slug text not null unique,
  simulation_type text not null check (simulation_type in ('world', 'time_machine', 'industry')),
  title text not null,
  description text not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'archived')),
  scenario_snapshot jsonb not null default '{}'::jsonb,
  scoring_config jsonb not null default '{}'::jsonb,
  allow_practice boolean not null default true,
  official_attempt_limit smallint not null default 5 check (official_attempt_limit between 1 and 20),
  stage_count smallint not null check (stage_count between 1 and 12),
  replay_visibility text not null default 'after_submit' check (replay_visibility in ('immediate_private', 'after_submit', 'after_challenge_close')),
  ghost_identity_unlock_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.league_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.league_challenges(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  mode text not null check (mode in ('practice', 'official')),
  attempt_number smallint not null check (attempt_number > 0),
  status text not null default 'active' check (status in ('active', 'submitted', 'abandoned', 'reset')),
  current_stage smallint not null default 1 check (current_stage > 0),
  policy_state jsonb not null default '{}'::jsonb,
  simulation_state jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  final_score numeric(5,2),
  final_result jsonb not null default '{}'::jsonb,
  started_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  reset_by uuid references auth.users(id) on delete set null,
  reset_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(challenge_id, team_id, mode, attempt_number)
);

create table if not exists public.league_challenge_role_assignments (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.league_challenge_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_type text not null check (role_type in ('central_bank', 'economic_policy', 'trade', 'investment_resources')),
  is_primary boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique(attempt_id, role_type, user_id)
);

create unique index if not exists league_challenge_primary_role_idx
  on public.league_challenge_role_assignments(attempt_id, role_type)
  where is_primary;

create table if not exists public.league_challenge_stage_decisions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.league_challenge_attempts(id) on delete cascade,
  stage_number smallint not null check (stage_number > 0),
  policy_state jsonb not null,
  simulation_state jsonb not null,
  result jsonb not null default '{}'::jsonb,
  locked_by uuid not null references auth.users(id) on delete restrict,
  locked_at timestamptz not null default timezone('utc', now()),
  unique(attempt_id, stage_number)
);

create table if not exists public.league_ghost_strategies (
  id uuid primary key default gen_random_uuid(),
  source_attempt_id uuid references public.league_challenge_attempts(id) on delete set null,
  source_challenge_id uuid references public.league_challenges(id) on delete set null,
  source_team_id uuid references public.teams(id) on delete set null,
  source_school_id uuid references public.schools(id) on delete set null,
  simulation_type text not null check (simulation_type in ('world', 'time_machine', 'industry')),
  name text not null,
  visibility text not null default 'public_after_unlock' check (visibility in ('private', 'anonymous_league', 'public_after_unlock')),
  strategy_version smallint not null default 1,
  behaviour_type text not null check (behaviour_type in ('historical_sequence', 'conditional')),
  behaviour_data jsonb not null default '{}'::jsonb,
  source_revealed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists league_challenge_attempts_team_idx on public.league_challenge_attempts(team_id, challenge_id, mode, status);
create index if not exists league_challenge_attempts_leaderboard_idx on public.league_challenge_attempts(challenge_id, final_score desc) where status = 'submitted' and mode = 'official';
create index if not exists league_challenge_role_assignments_user_idx on public.league_challenge_role_assignments(user_id, attempt_id);
create index if not exists league_challenge_stage_decisions_attempt_idx on public.league_challenge_stage_decisions(attempt_id, stage_number);
create index if not exists league_ghost_strategies_challenge_idx on public.league_ghost_strategies(source_challenge_id, simulation_type, visibility);

-- ---------------------------------------------------------------------------
-- C. Permissions and immutable decision stages.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_league_challenge_team(p_team_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin(p_user_id)
    or public.is_team_member(p_team_id, p_user_id)
    or exists(
      select 1
      from public.teams team
      where team.id = p_team_id
        and public.is_school_leader_for(team.school_id, p_user_id)
    )
$$;

create or replace function public.can_access_league_challenge_attempt(p_attempt_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.league_challenge_attempts attempt
    where attempt.id = p_attempt_id
      and public.can_access_league_challenge_team(attempt.team_id, p_user_id)
  )
$$;

create or replace function public.can_control_league_challenge_attempt(p_attempt_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin(p_user_id)
    or exists(
      select 1 from public.league_challenge_role_assignments assignment
      where assignment.attempt_id = p_attempt_id and assignment.user_id = p_user_id
    )
$$;

create or replace function public.assign_league_challenge_role(
  p_attempt_id uuid,
  p_user_id uuid,
  p_role_type text,
  p_is_primary boolean default true
)
returns public.league_challenge_role_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment public.league_challenge_role_assignments%rowtype;
  attempt public.league_challenge_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_type not in ('central_bank', 'economic_policy', 'trade', 'investment_resources') then raise exception 'Invalid Challenge role'; end if;
  select * into attempt from public.league_challenge_attempts where id = p_attempt_id for update;
  if not found then raise exception 'Challenge attempt not found'; end if;
  if attempt.status <> 'active' then raise exception 'Roles cannot change after an attempt is submitted or reset'; end if;
  if not (public.is_platform_admin(auth.uid()) or exists(select 1 from public.team_members where team_id = attempt.team_id and user_id = auth.uid() and team_role = 'captain') or exists(select 1 from public.teams team where team.id = attempt.team_id and public.is_school_leader_for(team.school_id, auth.uid()))) then
    raise exception 'Only the Team Captain, School Leader or Platform Admin can assign Challenge roles';
  end if;
  if not exists(select 1 from public.team_members where team_id = attempt.team_id and user_id = p_user_id) then
    raise exception 'A role assignee must be a member of this team';
  end if;
  if p_is_primary then
    update public.league_challenge_role_assignments set is_primary = false
    where attempt_id = p_attempt_id and role_type = p_role_type;
  end if;
  insert into public.league_challenge_role_assignments(attempt_id, user_id, role_type, is_primary, assigned_by)
  values(p_attempt_id, p_user_id, p_role_type, p_is_primary, auth.uid())
  on conflict (attempt_id, role_type, user_id)
  do update set is_primary = excluded.is_primary, assigned_by = excluded.assigned_by
  returning * into assignment;
  return assignment;
end;
$$;

create or replace function public.start_league_challenge_attempt(
  p_challenge_slug text,
  p_mode text,
  p_team_id uuid default null
)
returns public.league_challenge_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  challenge public.league_challenges%rowtype;
  chosen_team public.teams%rowtype;
  created_attempt public.league_challenge_attempts%rowtype;
  next_number smallint;
  official_used smallint;
  role_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('practice', 'official') then raise exception 'Invalid Challenge mode'; end if;
  select * into challenge from public.league_challenges where slug = p_challenge_slug;
  if not found or challenge.status <> 'open' then raise exception 'This Challenge is not open'; end if;
  if p_mode = 'practice' and not challenge.allow_practice then raise exception 'Practice is not available for this Challenge'; end if;
  if p_team_id is null then
    select team.* into chosen_team
    from public.team_members member join public.teams team on team.id = member.team_id
    where member.user_id = auth.uid() and team.status = 'active'
    order by case when member.team_role = 'captain' then 0 else 1 end, member.joined_at
    limit 1;
  else
    select * into chosen_team from public.teams where id = p_team_id and status = 'active';
  end if;
  if not found then raise exception 'Join an active school team before starting an official League Challenge'; end if;
  if not public.can_access_league_challenge_team(chosen_team.id, auth.uid()) then raise exception 'This team is not available to you'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.is_team_member(chosen_team.id, auth.uid())) then
    raise exception 'Join this team before operating one of its Challenge portfolios';
  end if;
  if p_mode = 'official' then
    select count(*)::smallint into official_used
    from public.league_challenge_attempts
    where challenge_id = challenge.id and team_id = chosen_team.id and mode = 'official' and status <> 'reset';
    if official_used >= challenge.official_attempt_limit then
      raise exception 'This team has used its % official attempts for this Challenge', challenge.official_attempt_limit;
    end if;
  end if;
  select coalesce(max(attempt_number), 0)::smallint + 1 into next_number
  from public.league_challenge_attempts
  where challenge_id = challenge.id and team_id = chosen_team.id and mode = p_mode;
  insert into public.league_challenge_attempts(challenge_id, team_id, school_id, mode, attempt_number, started_by)
  values(challenge.id, chosen_team.id, chosen_team.school_id, p_mode, next_number, auth.uid())
  returning * into created_attempt;
  foreach role_name in array array['central_bank', 'economic_policy', 'trade', 'investment_resources'] loop
    insert into public.league_challenge_role_assignments(attempt_id, user_id, role_type, is_primary, assigned_by)
    values(created_attempt.id, auth.uid(), role_name, true, auth.uid());
  end loop;
  return created_attempt;
end;
$$;

create or replace function public.save_league_challenge_attempt(
  p_attempt_id uuid,
  p_policy_state jsonb,
  p_simulation_state jsonb
)
returns public.league_challenge_attempts
language plpgsql
security definer
set search_path = public
as $$
declare saved_attempt public.league_challenge_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into saved_attempt from public.league_challenge_attempts where id = p_attempt_id for update;
  if not found then raise exception 'Challenge attempt not found'; end if;
  if saved_attempt.status <> 'active' then raise exception 'Submitted or reset attempts cannot be changed'; end if;
  if not public.can_control_league_challenge_attempt(p_attempt_id, auth.uid()) then raise exception 'You do not hold a Challenge portfolio for this attempt'; end if;
  update public.league_challenge_attempts
  set policy_state = coalesce(p_policy_state, '{}'::jsonb), simulation_state = coalesce(p_simulation_state, '{}'::jsonb)
  where id = p_attempt_id
  returning * into saved_attempt;
  return saved_attempt;
end;
$$;

create or replace function public.lock_league_challenge_stage(
  p_attempt_id uuid,
  p_stage_number smallint,
  p_policy_state jsonb,
  p_simulation_state jsonb,
  p_result jsonb
)
returns public.league_challenge_attempts
language plpgsql
security definer
set search_path = public
as $$
declare locked_attempt public.league_challenge_attempts%rowtype;
declare challenge_stage_count smallint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into locked_attempt
  from public.league_challenge_attempts
  where id = p_attempt_id for update;
  if not found then raise exception 'Challenge attempt not found'; end if;
  select stage_count into challenge_stage_count
  from public.league_challenges where id = locked_attempt.challenge_id;
  if locked_attempt.status <> 'active' then raise exception 'Submitted or reset attempts cannot be changed'; end if;
  if not public.can_control_league_challenge_attempt(p_attempt_id, auth.uid()) then raise exception 'You do not hold a Challenge portfolio for this attempt'; end if;
  if locked_attempt.current_stage <> p_stage_number or p_stage_number > challenge_stage_count then
    raise exception 'Only the currently unlocked Decision Stage may be submitted';
  end if;
  insert into public.league_challenge_stage_decisions(attempt_id, stage_number, policy_state, simulation_state, result, locked_by)
  values(p_attempt_id, p_stage_number, coalesce(p_policy_state, '{}'::jsonb), coalesce(p_simulation_state, '{}'::jsonb), coalesce(p_result, '{}'::jsonb), auth.uid());
  update public.league_challenge_attempts
  set current_stage = p_stage_number + 1,
      policy_state = coalesce(p_policy_state, '{}'::jsonb),
      simulation_state = coalesce(p_simulation_state, '{}'::jsonb)
  where id = p_attempt_id
  returning * into locked_attempt;
  return locked_attempt;
end;
$$;

create or replace function public.derive_league_challenge_score(p_simulation_type text, p_state jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_simulation_type
    when 'world' then greatest(0, least(100,
      100
      - greatest(0, least(25, (2 - coalesce((p_state->>'growth')::numeric, 0)) * 6.25))
      - greatest(0, least(25, abs(coalesce((p_state->>'inflation')::numeric, 2) - 2) * 4.2))
      - greatest(0, least(25, (coalesce((p_state->>'unemployment')::numeric, 4) - 4) * 4.2))
      - greatest(0, least(25, (coalesce((p_state->>'debtToGdp')::numeric, 60) - 60) * .55))
    ))
    when 'time_machine' then greatest(0, least(100,
      greatest(0, least(40,
        40 - abs(coalesce((p_state->>'inflation')::numeric, 3) - 3) * 2.3
           - greatest(0, coalesce((p_state->>'unemployment')::numeric, 5) - 5) * 1.9
      ))
      + greatest(0, least(30,
        30 * ((coalesce((p_state->>'realOutput')::numeric, 70) - 70) / 65)
           + coalesce((p_state->>'recovery')::numeric, 0) * .12
      ))
      + greatest(0, least(30,
        30 - greatest(0, coalesce((p_state->>'debtToGdp')::numeric, 45) - 45) * .32
           - greatest(0, -coalesce((p_state->>'fiscalBalance')::numeric, -2) - 2) * .9
      ))
    ))
    when 'industry' then greatest(0, least(100,
      greatest(0, least(40,
        20 + coalesce((p_state->>'profit')::numeric, 0) * 8 + coalesce((p_state->>'revenue')::numeric, 0) * .7
      ))
      + greatest(0, least(30,
        coalesce((p_state->>'marketShare')::numeric, 0) * 1.15 + coalesce((p_state->>'brandStrength')::numeric, 0) * .09
      ))
      + greatest(0, least(30,
        coalesce((p_state->>'technologyLevel')::numeric, 0) * .18
          + greatest(0, 18 - coalesce((p_state->>'inventory')::numeric, 600) * .03)
          + coalesce((p_state->>'firmValue')::numeric, 0) * .04
      ))
    ))
    else 0
  end
$$;

create or replace function public.submit_league_challenge_attempt(
  p_attempt_id uuid,
  p_score_breakdown jsonb,
  p_final_result jsonb
)
returns public.league_challenge_attempts
language plpgsql
security definer
set search_path = public
as $$
declare submitted_attempt public.league_challenge_attempts%rowtype;
declare challenge public.league_challenges%rowtype;
declare deterministic_score numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into submitted_attempt
  from public.league_challenge_attempts
  where id = p_attempt_id for update;
  if not found then raise exception 'Challenge attempt not found'; end if;
  select * into challenge from public.league_challenges where id = submitted_attempt.challenge_id;
  if submitted_attempt.status <> 'active' then raise exception 'Only an active attempt can be submitted'; end if;
  if submitted_attempt.mode <> 'official' then raise exception 'Practice attempts do not submit to the League or generate Ghost Strategies'; end if;
  if not public.can_control_league_challenge_attempt(p_attempt_id, auth.uid()) then raise exception 'You do not hold a Challenge portfolio for this attempt'; end if;
  if submitted_attempt.current_stage <= challenge.stage_count then raise exception 'All Decision Stages must be locked before final submission'; end if;
  deterministic_score := public.derive_league_challenge_score(challenge.simulation_type, submitted_attempt.simulation_state);
  update public.league_challenge_attempts
  set status = 'submitted', final_score = round(deterministic_score, 2),
      score_breakdown = coalesce(p_score_breakdown, '{}'::jsonb),
      final_result = coalesce(p_final_result, '{}'::jsonb),
      submitted_at = timezone('utc', now())
  where id = p_attempt_id
  returning * into submitted_attempt;
  insert into public.league_ghost_strategies(
    source_attempt_id, source_challenge_id, source_team_id, source_school_id,
    simulation_type, name, visibility, behaviour_type, behaviour_data, created_by
  ) values (
    submitted_attempt.id, challenge.id, submitted_attempt.team_id, submitted_attempt.school_id,
    challenge.simulation_type, 'League Ghost', 'public_after_unlock', 'conditional',
    jsonb_build_object('policy_state', submitted_attempt.policy_state, 'source', 'completed_official_attempt'), auth.uid()
  );
  return submitted_attempt;
end;
$$;

create or replace function public.reset_league_challenge_attempt(p_attempt_id uuid)
returns public.league_challenge_attempts
language plpgsql
security definer
set search_path = public
as $$
declare reset_attempt public.league_challenge_attempts%rowtype;
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  update public.league_challenge_attempts
  set status = 'reset', reset_by = auth.uid(), reset_at = timezone('utc', now())
  where id = p_attempt_id and status <> 'reset'
  returning * into reset_attempt;
  if not found then raise exception 'Attempt not found or already reset'; end if;
  return reset_attempt;
end;
$$;

create or replace function public.get_league_challenge_leaderboard(p_challenge_slug text)
returns table(
  rank bigint,
  team_id uuid,
  team_name text,
  school_id uuid,
  school_name text,
  challenges_completed bigint,
  performance_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with selected_challenge as (
    select id from public.league_challenges where slug = p_challenge_slug and status in ('open', 'closed')
  ), best_attempt as (
    select distinct on (attempt.team_id)
      attempt.team_id, attempt.school_id, attempt.final_score
    from public.league_challenge_attempts attempt
    join selected_challenge challenge on challenge.id = attempt.challenge_id
    where attempt.mode = 'official' and attempt.status = 'submitted'
    order by attempt.team_id, attempt.final_score desc, attempt.submitted_at asc
  ), completed as (
    select attempt.team_id, count(*)::bigint as total
    from public.league_challenge_attempts attempt
    where attempt.mode = 'official' and attempt.status = 'submitted'
    group by attempt.team_id
  )
  select rank() over(order by best_attempt.final_score desc, team.name), best_attempt.team_id, team.name,
    school.id, school.name, coalesce(completed.total, 0), best_attempt.final_score
  from best_attempt
  join public.teams team on team.id = best_attempt.team_id
  join public.schools school on school.id = best_attempt.school_id
  left join completed on completed.team_id = best_attempt.team_id
  order by best_attempt.final_score desc, team.name
$$;

create or replace function public.get_league_challenge_ghosts(p_challenge_slug text)
returns table(
  id uuid,
  name text,
  simulation_type text,
  visibility text,
  behaviour_type text,
  source_name text,
  source_revealed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select ghost.id,
    case when challenge.status = 'closed' and ghost.visibility = 'public_after_unlock' then ghost.name else 'Anonymous League Ghost' end,
    ghost.simulation_type, ghost.visibility, ghost.behaviour_type,
    case when challenge.status = 'closed' and ghost.visibility = 'public_after_unlock' then team.name else null end,
    (challenge.status = 'closed' and ghost.visibility = 'public_after_unlock')
  from public.league_ghost_strategies ghost
  join public.league_challenges challenge on challenge.id = ghost.source_challenge_id
  left join public.teams team on team.id = ghost.source_team_id
  where challenge.slug = p_challenge_slug
    and ghost.visibility <> 'private'
$$;

create or replace function public.set_league_challenge_status(p_challenge_id uuid, p_status text)
returns public.league_challenges
language plpgsql
security definer
set search_path = public
as $$
declare updated_challenge public.league_challenges%rowtype;
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_status not in ('draft', 'open', 'closed', 'archived') then raise exception 'Invalid Challenge status'; end if;
  update public.league_challenges set status = p_status where id = p_challenge_id returning * into updated_challenge;
  if not found then raise exception 'Challenge not found'; end if;
  return updated_challenge;
end;
$$;

-- ---------------------------------------------------------------------------
-- D. Seed the three published Challenge definitions. This is idempotent and
-- does not generate student teams, attempts, results or school standings.
-- ---------------------------------------------------------------------------
insert into public.league_seasons(slug, title, status)
values('asynchronous-league-foundation', 'EconMind Asynchronous League', 'active')
on conflict (slug) do update set title = excluded.title, status = excluded.status;

insert into public.league_challenges(
  season_id, slug, simulation_type, title, description, status,
  scenario_snapshot, scoring_config, official_attempt_limit, stage_count, replay_visibility
)
select season.id, source.slug, source.simulation_type, source.title, source.description, 'open',
  source.scenario_snapshot, source.scoring_config, 5, source.stage_count, source.replay_visibility
from public.league_seasons season
cross join (values
  ('world-economy-foundations', 'world', 'World Economy: Stability under pressure',
   'Run a country from a fixed starting condition. Policies persist until changed; the public score shows macroeconomic trade-offs.',
   '{"growth":2.1,"inflation":2.4,"unemployment":4.4,"debtToGdp":63}'::jsonb,
   '{"formula":"100 - Growth Penalty - Inflation Penalty - Unemployment Penalty - Fiscal Sustainability Penalty","maximum_penalty_per_category":25}'::jsonb,
   4, 'after_submit'),
  ('time-machine-1973-oil-shock', 'time_machine', 'Economic Time Machine: 1973 Oil Shock',
   'Enter economic history without knowing the future. Each Decision Stage unlocks only information historically available by that date.',
   '{"event":"1973 Oil Shock","available_as":"1973-08-01"}'::jsonb,
   '{"economic_stability":40,"policy_effectiveness":30,"fiscal_sustainability":30}'::jsonb,
   5, 'after_challenge_close'),
  ('industry-arena-ev-competition', 'industry', 'Industry Arena: EV Competition',
   'Run a fictional electric-vehicle firm against standard competitor agents and anonymous League Ghosts.',
   '{"market":"fictional EV market","competitors":["Standard Agent Alpha","Standard Agent Beta","Anonymous League Ghost"]}'::jsonb,
   '{"profitability":40,"market_position":30,"firm_sustainability":30}'::jsonb,
   5, 'after_challenge_close')
) as source(slug, simulation_type, title, description, scenario_snapshot, scoring_config, stage_count, replay_visibility)
where season.slug = 'asynchronous-league-foundation'
on conflict (slug) do update
set title = excluded.title, description = excluded.description, simulation_type = excluded.simulation_type,
  scenario_snapshot = excluded.scenario_snapshot, scoring_config = excluded.scoring_config,
  official_attempt_limit = 5, stage_count = excluded.stage_count, replay_visibility = excluded.replay_visibility;

-- ---------------------------------------------------------------------------
-- E. RLS: all writes that need integrity go through the security-definer RPCs.
-- ---------------------------------------------------------------------------
alter table public.league_seasons enable row level security;
alter table public.league_challenges enable row level security;
alter table public.league_challenge_attempts enable row level security;
alter table public.league_challenge_role_assignments enable row level security;
alter table public.league_challenge_stage_decisions enable row level security;
alter table public.league_ghost_strategies enable row level security;

drop policy if exists league_seasons_read_active on public.league_seasons;
create policy league_seasons_read_active on public.league_seasons for select to authenticated
using (status = 'active' or public.is_platform_admin());

drop policy if exists league_challenges_read_available on public.league_challenges;
create policy league_challenges_read_available on public.league_challenges for select to authenticated
using (status in ('open', 'closed') or public.is_platform_admin());
drop policy if exists league_challenges_admin_manage on public.league_challenges;
create policy league_challenges_admin_manage on public.league_challenges for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists league_challenge_attempts_read_own_team on public.league_challenge_attempts;
create policy league_challenge_attempts_read_own_team on public.league_challenge_attempts for select to authenticated
using (public.can_access_league_challenge_attempt(id));
drop policy if exists league_challenge_role_assignments_read_own_attempt on public.league_challenge_role_assignments;
create policy league_challenge_role_assignments_read_own_attempt on public.league_challenge_role_assignments for select to authenticated
using (public.can_access_league_challenge_attempt(attempt_id));
drop policy if exists league_challenge_stage_decisions_read_own_attempt on public.league_challenge_stage_decisions;
create policy league_challenge_stage_decisions_read_own_attempt on public.league_challenge_stage_decisions for select to authenticated
using (public.can_access_league_challenge_attempt(attempt_id));
drop policy if exists league_ghost_strategies_source_only on public.league_ghost_strategies;
create policy league_ghost_strategies_source_only on public.league_ghost_strategies for select to authenticated
using (public.is_platform_admin() or (source_attempt_id is not null and public.can_access_league_challenge_attempt(source_attempt_id)));

drop trigger if exists league_seasons_set_updated_at on public.league_seasons;
drop trigger if exists league_challenges_set_updated_at on public.league_challenges;
drop trigger if exists league_challenge_attempts_set_updated_at on public.league_challenge_attempts;
create trigger league_seasons_set_updated_at before update on public.league_seasons for each row execute function public.set_league_updated_at();
create trigger league_challenges_set_updated_at before update on public.league_challenges for each row execute function public.set_league_updated_at();
create trigger league_challenge_attempts_set_updated_at before update on public.league_challenge_attempts for each row execute function public.set_league_updated_at();

-- Existing direct policies remain useful for legacy League screens, but these
-- mutable paths are reserved for their validated RPCs.
revoke insert, update, delete on public.teams, public.team_members from authenticated;
grant select on public.league_seasons, public.league_challenges, public.league_challenge_attempts,
  public.league_challenge_role_assignments, public.league_challenge_stage_decisions,
  public.league_ghost_strategies to authenticated;
grant execute on function public.make_league_team_slug(text, uuid),
  public.create_school_team(uuid, text), public.rename_school_team(uuid, text),
  public.set_school_team_status(uuid, text), public.move_school_team_member(uuid, uuid, uuid),
  public.can_access_league_challenge_team(uuid, uuid), public.can_access_league_challenge_attempt(uuid, uuid),
  public.can_control_league_challenge_attempt(uuid, uuid), public.assign_league_challenge_role(uuid, uuid, text, boolean),
  public.start_league_challenge_attempt(text, text, uuid), public.save_league_challenge_attempt(uuid, jsonb, jsonb),
  public.lock_league_challenge_stage(uuid, smallint, jsonb, jsonb, jsonb),
  public.submit_league_challenge_attempt(uuid, jsonb, jsonb), public.reset_league_challenge_attempt(uuid),
  public.get_league_challenge_leaderboard(text), public.get_league_challenge_ghosts(text),
  public.set_league_challenge_status(uuid, text) to authenticated;
