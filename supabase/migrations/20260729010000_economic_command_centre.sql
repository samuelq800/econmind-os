-- Economic Command Centre: a separate, explainable three-quarter sandbox.
-- Quick Policy Challenge remains in crisis_runs/crisis_decisions; these tables
-- avoid mixing its compact two-round record with a full sandbox state machine.

create table if not exists public.sandbox_scenarios (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,100}$'),
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text not null check (char_length(trim(description)) between 20 and 3000),
  initial_state jsonb not null check (jsonb_typeof(initial_state) = 'object'),
  round_config jsonb not null check (jsonb_typeof(round_config) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sandbox_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  scenario_id uuid not null references public.sandbox_scenarios(id) on delete restrict,
  mode text not null check (mode in ('personal', 'team')),
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'abandoned')),
  current_round smallint not null default 1 check (current_round between 1 and 3),
  current_state jsonb not null check (jsonb_typeof(current_state) = 'object'),
  final_state jsonb check (final_state is null or jsonb_typeof(final_state) = 'object'),
  final_score numeric(5,2) check (final_score is null or final_score between 0 and 100),
  result_type text check (result_type is null or char_length(result_type) between 3 and 100),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((mode = 'personal' and team_id is null) or (mode = 'team' and team_id is not null))
);

create table if not exists public.sandbox_rounds (
  id uuid primary key default extensions.gen_random_uuid(),
  run_id uuid not null references public.sandbox_runs(id) on delete cascade,
  round_number smallint not null check (round_number between 1 and 3),
  state_before jsonb not null check (jsonb_typeof(state_before) = 'object'),
  policy_package jsonb not null check (jsonb_typeof(policy_package) = 'object'),
  shock_applied jsonb check (shock_applied is null or jsonb_typeof(shock_applied) = 'object'),
  pending_effects_before jsonb not null default '[]'::jsonb check (jsonb_typeof(pending_effects_before) = 'array'),
  pending_effects_after jsonb not null default '[]'::jsonb check (jsonb_typeof(pending_effects_after) = 'array'),
  state_after jsonb not null check (jsonb_typeof(state_after) = 'object'),
  explanations jsonb not null check (jsonb_typeof(explanations) = 'object'),
  score_snapshot jsonb not null check (jsonb_typeof(score_snapshot) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (run_id, round_number)
);

create index if not exists sandbox_runs_user_status_idx on public.sandbox_runs(user_id, status, updated_at desc);
create index if not exists sandbox_runs_team_status_idx on public.sandbox_runs(team_id, status, updated_at desc) where team_id is not null;
create index if not exists sandbox_runs_scenario_idx on public.sandbox_runs(scenario_id, completed_at desc);
create index if not exists sandbox_rounds_run_round_idx on public.sandbox_rounds(run_id, round_number);

drop trigger if exists sandbox_scenarios_set_updated_at on public.sandbox_scenarios;
create trigger sandbox_scenarios_set_updated_at before update on public.sandbox_scenarios for each row execute function public.set_league_updated_at();
drop trigger if exists sandbox_runs_set_updated_at on public.sandbox_runs;
create trigger sandbox_runs_set_updated_at before update on public.sandbox_runs for each row execute function public.set_league_updated_at();

create or replace function public.is_team_captain_for(p_team_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.team_members where team_id = p_team_id and user_id = p_user_id and team_role = 'captain') $$;

create or replace function public.can_submit_team_sandbox(p_team_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_team_captain_for(p_team_id, p_user_id)
      or exists(select 1 from public.teams t where t.id = p_team_id and public.is_school_leader_for(t.school_id, p_user_id))
      or public.is_platform_admin(p_user_id)
$$;

create or replace function public.can_view_sandbox_run(p_run_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.sandbox_runs r left join public.teams t on t.id = r.team_id where r.id = p_run_id and (
    r.user_id = p_user_id or public.is_platform_admin(p_user_id)
    or (r.team_id is not null and public.is_team_member(r.team_id, p_user_id))
    or (t.school_id is not null and public.is_school_leader_for(t.school_id, p_user_id))
  ))
$$;

create or replace function public.can_manage_sandbox_run(p_run_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.sandbox_runs r where r.id = p_run_id and (
    public.is_platform_admin(p_user_id)
    or (r.mode = 'personal' and r.user_id = p_user_id)
    or (r.mode = 'team' and r.team_id is not null and public.can_submit_team_sandbox(r.team_id, p_user_id))
  ))
$$;

create or replace function public.create_sandbox_run(p_scenario_id uuid, p_mode text, p_team_id uuid, p_initial_state jsonb)
returns public.sandbox_runs language plpgsql security definer set search_path = public
as $$
declare created public.sandbox_runs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('personal', 'team') then raise exception 'Invalid sandbox mode'; end if;
  if jsonb_typeof(p_initial_state) <> 'object' then raise exception 'Initial state must be an object'; end if;
  if not exists(select 1 from public.sandbox_scenarios where id = p_scenario_id and is_active) then raise exception 'Scenario is not available'; end if;
  if p_mode = 'personal' and p_team_id is not null then raise exception 'Personal runs cannot have a team'; end if;
  if p_mode = 'team' and (p_team_id is null or not public.can_submit_team_sandbox(p_team_id, auth.uid())) then raise exception 'Only a team captain or school leader can create a team run'; end if;
  insert into public.sandbox_runs(user_id, team_id, scenario_id, mode, status, current_round, current_state)
  values(auth.uid(), p_team_id, p_scenario_id, p_mode, 'active', 1, p_initial_state)
  returning * into created;
  return created;
end;
$$;

create or replace function public.submit_sandbox_round(
  p_run_id uuid, p_round_number smallint, p_state_before jsonb, p_policy_package jsonb, p_shock_applied jsonb,
  p_pending_before jsonb, p_pending_after jsonb, p_state_after jsonb, p_explanations jsonb, p_score_snapshot jsonb,
  p_final_state jsonb default null, p_final_score numeric default null, p_result_type text default null
) returns public.sandbox_runs language plpgsql security definer set search_path = public
as $$
declare current_run public.sandbox_runs%rowtype; updated_run public.sandbox_runs%rowtype;
begin
  if auth.uid() is null or not public.can_manage_sandbox_run(p_run_id, auth.uid()) then raise exception 'You do not have permission to submit this sandbox policy'; end if;
  select * into current_run from public.sandbox_runs where id = p_run_id for update;
  if not found then raise exception 'Sandbox run not found'; end if;
  if current_run.status not in ('draft', 'active') or current_run.current_round <> p_round_number then raise exception 'This sandbox round is already locked or out of sequence'; end if;
  if p_round_number = 3 and (p_final_state is null or p_final_score is null or p_result_type is null) then raise exception 'Completed runs require final state, score and result type'; end if;
  insert into public.sandbox_rounds(run_id, round_number, state_before, policy_package, shock_applied, pending_effects_before, pending_effects_after, state_after, explanations, score_snapshot)
  values(p_run_id, p_round_number, p_state_before, p_policy_package, p_shock_applied, p_pending_before, p_pending_after, p_state_after, p_explanations, p_score_snapshot);
  update public.sandbox_runs set current_round = case when p_round_number = 3 then 3 else p_round_number + 1 end,
    current_state = p_state_after, status = case when p_round_number = 3 then 'completed' else 'active' end,
    final_state = case when p_round_number = 3 then p_final_state else final_state end,
    final_score = case when p_round_number = 3 then p_final_score else final_score end,
    result_type = case when p_round_number = 3 then p_result_type else result_type end,
    completed_at = case when p_round_number = 3 then timezone('utc', now()) else completed_at end
  where id = p_run_id returning * into updated_run;
  return updated_run;
end;
$$;

create or replace function public.duplicate_sandbox_run(p_source_run_id uuid, p_mode text, p_team_id uuid, p_state jsonb, p_start_round smallint)
returns public.sandbox_runs language plpgsql security definer set search_path = public
as $$
declare source_run public.sandbox_runs%rowtype; created public.sandbox_runs%rowtype;
begin
  if auth.uid() is null or not public.can_view_sandbox_run(p_source_run_id, auth.uid()) then raise exception 'You cannot duplicate this sandbox run'; end if;
  if p_mode not in ('personal', 'team') or p_start_round not between 1 and 3 or jsonb_typeof(p_state) <> 'object' then raise exception 'Invalid duplicate request'; end if;
  if p_mode = 'team' and (p_team_id is null or not public.can_submit_team_sandbox(p_team_id, auth.uid())) then raise exception 'Only a team captain or school leader can create a team run'; end if;
  select * into source_run from public.sandbox_runs where id = p_source_run_id;
  insert into public.sandbox_runs(user_id, team_id, scenario_id, mode, status, current_round, current_state)
  values(auth.uid(), case when p_mode = 'team' then p_team_id else null end, source_run.scenario_id, p_mode, 'active', p_start_round, p_state)
  returning * into created;
  return created;
end;
$$;

create or replace function public.abandon_sandbox_run(p_run_id uuid)
returns public.sandbox_runs language plpgsql security definer set search_path = public
as $$
declare updated_run public.sandbox_runs%rowtype;
begin
  if auth.uid() is null or not public.can_manage_sandbox_run(p_run_id, auth.uid()) then raise exception 'You do not have permission to abandon this sandbox run'; end if;
  update public.sandbox_runs set status = 'abandoned' where id = p_run_id and status in ('draft', 'active') returning * into updated_run;
  if not found then raise exception 'Only active sandbox runs can be abandoned'; end if;
  return updated_run;
end;
$$;

alter table public.sandbox_scenarios enable row level security;
alter table public.sandbox_runs enable row level security;
alter table public.sandbox_rounds enable row level security;

create policy sandbox_scenarios_select_active on public.sandbox_scenarios for select to authenticated using (is_active or public.is_platform_admin());
create policy sandbox_scenarios_admin_manage on public.sandbox_scenarios for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy sandbox_runs_select_visible on public.sandbox_runs for select to authenticated using (public.can_view_sandbox_run(id));
create policy sandbox_rounds_select_visible on public.sandbox_rounds for select to authenticated using (public.can_view_sandbox_run(run_id));

revoke all on public.sandbox_scenarios, public.sandbox_runs, public.sandbox_rounds from anon, authenticated;
grant select on public.sandbox_scenarios, public.sandbox_runs, public.sandbox_rounds to authenticated;
grant execute on function public.is_team_captain_for(uuid, uuid), public.can_submit_team_sandbox(uuid, uuid), public.can_view_sandbox_run(uuid, uuid), public.can_manage_sandbox_run(uuid, uuid), public.create_sandbox_run(uuid, text, uuid, jsonb), public.submit_sandbox_round(uuid, smallint, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, numeric, text), public.duplicate_sandbox_run(uuid, text, uuid, jsonb, smallint), public.abandon_sandbox_run(uuid) to authenticated;

insert into public.sandbox_scenarios(slug, title, description, initial_state, round_config, is_active)
values (
  'energy-inflation-dilemma',
  'The Energy-Inflation Dilemma',
  'A three-quarter educational simulation of weak growth, persistent inflation and imported-energy exposure. It is a stylised mechanism model, not a forecasting tool.',
  '{"growth":1.4,"inflation":5.2,"unemployment":6.8,"debt":72,"approval":55,"emissions":100,"productivity":100,"inequality":0.34}'::jsonb,
  '{"round_labels":["Fragile Recovery","Global Energy Shock","Secondary Crisis"],"shocks":[{"quarter":2,"id":"global-energy-shock","magnitude":"oil +40%"},{"quarter":3,"id":"capital-outflow"}]}'::jsonb,
  true
) on conflict (slug) do update set title = excluded.title, description = excluded.description, initial_state = excluded.initial_state, round_config = excluded.round_config, is_active = excluded.is_active;
