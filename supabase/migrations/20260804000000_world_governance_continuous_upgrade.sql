-- EconMind OS World Governance upgrade.
--
-- This release intentionally restarts only the persistent simulation state.
-- Profiles, schools, teams and authentication accounts are never touched.
-- The user explicitly chose a new world rather than an archive of the old one.

begin;

-- The seven-portfolio experiment is replaced by a six-office cabinet.
-- Research, resources, energy and environment are administered through the
-- Industry, Infrastructure & Innovation office.
delete from public.continuous_worlds;

alter table public.continuous_world_role_assignments
  drop constraint if exists continuous_world_role_assignments_role_type_check;
alter table public.continuous_world_role_assignments
  add constraint continuous_world_role_assignments_role_type_check check (
    role_type in (
      'country_captain',
      'central_bank_governor',
      'economic_policy_minister',
      'trade_minister',
      'infrastructure_investment_minister',
      'social_labour_minister'
    )
  );

alter table public.continuous_world_actions
  add column if not exists lifecycle_status text not null default 'announced'
    check (lifecycle_status in (
      'announced', 'waiting', 'ramping_up', 'full_effect', 'fading',
      'expired', 'blocked', 'cancelled'
    )),
  add column if not exists lifecycle jsonb not null default '{}'::jsonb
    check (jsonb_typeof(lifecycle) = 'object'),
  add column if not exists approval_state text not null default 'not_required'
    check (approval_state in ('not_required', 'pending', 'approved', 'rejected')),
  add column if not exists published_at timestamptz,
  add column if not exists reversal_cost jsonb not null default '{}'::jsonb
    check (jsonb_typeof(reversal_cost) = 'object');

create index if not exists continuous_world_actions_lifecycle_idx
  on public.continuous_world_actions(world_id, country_key, lifecycle_status, effective_at desc);

-- Approval rows are separate from the action so a single account can hold
-- several offices while each sign-off remains attributable and auditable.
create table if not exists public.continuous_world_action_approvals (
  id uuid primary key default extensions.gen_random_uuid(),
  action_id uuid not null references public.continuous_world_actions(id) on delete cascade,
  required_role text not null check (required_role in (
    'country_captain', 'central_bank_governor', 'economic_policy_minister',
    'trade_minister', 'infrastructure_investment_minister', 'social_labour_minister'
  )),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision_by uuid references public.profiles(user_id) on delete set null,
  decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (action_id, required_role)
);
create index if not exists continuous_world_action_approvals_action_idx
  on public.continuous_world_action_approvals(action_id, status);

create table if not exists public.continuous_world_cabinet_proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  country_key text not null check (country_key ~ '^[a-z0-9-]{2,80}$'),
  title text not null check (char_length(trim(title)) between 3 and 180),
  problem text not null check (char_length(trim(problem)) between 10 and 3000),
  objective text not null check (char_length(trim(objective)) between 10 and 3000),
  policy_action_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(policy_action_ids) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'requested', 'under_review', 'revision_requested', 'minister_approved', 'captain_approved', 'rejected', 'published', 'active', 'completed')),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists continuous_world_cabinet_proposals_country_idx
  on public.continuous_world_cabinet_proposals(world_id, country_key, status, updated_at desc);

create table if not exists public.continuous_world_budget_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  country_key text not null check (country_key ~ '^[a-z0-9-]{2,80}$'),
  requesting_role text not null check (requesting_role in (
    'country_captain', 'central_bank_governor', 'economic_policy_minister',
    'trade_minister', 'infrastructure_investment_minister', 'social_labour_minister'
  )),
  programme text not null check (char_length(trim(programme)) between 3 and 180),
  amount_pct_gdp numeric not null check (amount_pct_gdp > 0 and amount_pct_gdp <= 100),
  duration_days integer not null check (duration_days between 1 and 7300),
  expected_return text not null check (char_length(trim(expected_return)) between 10 and 2000),
  risk_note text not null check (char_length(trim(risk_note)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'partially_approved', 'approved', 'rejected')),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists continuous_world_budget_requests_country_idx
  on public.continuous_world_budget_requests(world_id, country_key, status, created_at desc);

create table if not exists public.continuous_world_contract_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  contract_id uuid not null references public.continuous_world_contracts(id) on delete cascade,
  author_country_key text not null check (author_country_key ~ '^[a-z0-9-]{2,80}$'),
  body text not null check (char_length(trim(body)) between 1 and 3000),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists continuous_world_contract_messages_contract_idx
  on public.continuous_world_contract_messages(contract_id, created_at);

create table if not exists public.continuous_world_projects (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  country_key text not null check (country_key ~ '^[a-z0-9-]{2,80}$'),
  project_type text not null check (char_length(project_type) between 3 and 100),
  title text not null check (char_length(trim(title)) between 3 and 180),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  status text not null default 'planned' check (status in ('planned', 'procurement', 'building', 'delayed', 'completed', 'destroyed')),
  completion_percent numeric not null default 0 check (completion_percent between 0 and 100),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists continuous_world_projects_country_idx
  on public.continuous_world_projects(world_id, country_key, status, updated_at desc);

-- Reports deliberately store compact explanation and aggregate state only.
-- Full before/after snapshots were removed: students can review history, but
-- cannot roll back an already-running world.
create table if not exists public.continuous_world_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  country_key text check (country_key is null or country_key ~ '^[a-z0-9-]{2,80}$'),
  simulation_day integer not null check (simulation_day >= 0),
  report_type text not null check (report_type in ('rolling_30_day', 'crisis', 'policy', 'contract', 'settlement')),
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (world_id, country_key, simulation_day, report_type)
);
create index if not exists continuous_world_reports_lookup_idx
  on public.continuous_world_reports(world_id, country_key, simulation_day desc);

create or replace function public.set_continuous_world_governance_updated_at()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin new.updated_at := timezone('utc', now()); return new; end; $$;

drop trigger if exists continuous_world_cabinet_proposals_updated_at on public.continuous_world_cabinet_proposals;
create trigger continuous_world_cabinet_proposals_updated_at before update on public.continuous_world_cabinet_proposals
for each row execute function public.set_continuous_world_governance_updated_at();
drop trigger if exists continuous_world_budget_requests_updated_at on public.continuous_world_budget_requests;
create trigger continuous_world_budget_requests_updated_at before update on public.continuous_world_budget_requests
for each row execute function public.set_continuous_world_governance_updated_at();
drop trigger if exists continuous_world_projects_updated_at on public.continuous_world_projects;
create trigger continuous_world_projects_updated_at before update on public.continuous_world_projects
for each row execute function public.set_continuous_world_governance_updated_at();

-- Captain has coordination and approval authority, not a back-door power to
-- write another ministry's policy. Teachers and authorised administrators
-- remain operational supervisors as previously agreed.
create or replace function public.continuous_world_action_role_allowed(
  p_world_id uuid, p_country_key text, p_action_type text, p_action_key text,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_administer_continuous_world(p_world_id, p_user_id)
    or (
      p_action_type = 'policy' and (
        (p_action_key like 'POL-CAP-%' and public.continuous_world_has_role(p_world_id, p_country_key, 'country_captain', p_user_id))
        or (p_action_key like 'POL-CB-%' and public.continuous_world_has_role(p_world_id, p_country_key, 'central_bank_governor', p_user_id))
        or ((p_action_key like 'POL-FIN-%' or p_action_key in ('government_spending', 'income_tax', 'business_tax', 'welfare', 'employment_support', 'energy_support', 'fiscal_reserve', 'public_services')) and public.continuous_world_has_role(p_world_id, p_country_key, 'economic_policy_minister', p_user_id))
        or (p_action_key like 'POL-TRADE-%' and public.continuous_world_has_role(p_world_id, p_country_key, 'trade_minister', p_user_id))
        or ((p_action_key like 'POL-IND-%' or p_action_key like 'POL-RES-%') and public.continuous_world_has_role(p_world_id, p_country_key, 'infrastructure_investment_minister', p_user_id))
        or (p_action_key like 'POL-SOC-%' and public.continuous_world_has_role(p_world_id, p_country_key, 'social_labour_minister', p_user_id))
      )
    )
    or (p_action_type = 'contract' and public.continuous_world_has_role(p_world_id, p_country_key, 'trade_minister', p_user_id))
    or (p_action_type = 'project' and public.continuous_world_has_role(p_world_id, p_country_key, 'infrastructure_investment_minister', p_user_id))
    or (p_action_type = 'announcement' and (
      public.continuous_world_has_role(p_world_id, p_country_key, 'country_captain', p_user_id)
      or public.continuous_world_has_role(p_world_id, p_country_key, 'social_labour_minister', p_user_id)
    ))
$$;

create or replace function public.claim_continuous_world_role(
  p_world_id uuid, p_country_key text, p_role_type text
)
returns public.continuous_world_role_assignments
language plpgsql security definer set search_path = public
as $$
declare role_assignment public.continuous_world_role_assignments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_type not in ('country_captain', 'central_bank_governor', 'economic_policy_minister', 'trade_minister', 'infrastructure_investment_minister', 'social_labour_minister') then raise exception 'Invalid world role'; end if;
  perform public.join_continuous_world(p_world_id);
  if not public.is_continuous_world_team_member(p_world_id, p_country_key, auth.uid()) and not public.can_administer_continuous_world(p_world_id, auth.uid()) then raise exception 'Your League team does not control this country'; end if;
  insert into public.continuous_world_role_assignments(world_id, country_key, user_id, role_type, assigned_by)
  values(p_world_id, p_country_key, auth.uid(), p_role_type, auth.uid())
  returning * into role_assignment;
  return role_assignment;
end;
$$;

create or replace function public.submit_continuous_world_action(
  p_world_id uuid, p_country_key text, p_action_type text, p_action_key text,
  p_parameters jsonb, p_effective_at timestamptz default timezone('utc', now()),
  p_expires_at timestamptz default null
)
returns public.continuous_world_actions
language plpgsql security definer set search_path = public
as $$
declare created public.continuous_world_actions%rowtype;
declare source_policy jsonb;
declare lifecycle_value jsonb := '{}'::jsonb;
declare required_roles text[] := array[]::text[];
declare needs_approval boolean := false;
declare fiscal_cost numeric := coalesce(nullif(p_parameters ->> 'fiscal_cost_pct_gdp', '')::numeric, 0);
declare reserve_use numeric := coalesce(nullif(p_parameters ->> 'reserve_use_percent', '')::numeric, 0);
declare political_cost numeric := coalesce(nullif(p_parameters ->> 'political_cost_percent', '')::numeric, 0);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_act_for_continuous_world_country(p_world_id, p_country_key, auth.uid()) then raise exception 'An assigned country role or world supervisor role is required'; end if;
  if not public.continuous_world_action_role_allowed(p_world_id, p_country_key, p_action_type, p_action_key, auth.uid()) then raise exception 'This office does not own the requested world action'; end if;
  if not public.continuous_world_state_allows_action(p_world_id, p_country_key, p_parameters) then raise exception 'The country state does not currently permit this new discretionary action'; end if;
  if p_action_type not in ('policy', 'contract', 'project', 'announcement') or p_action_key !~ '^[A-Za-z0-9_-]{2,100}$' then raise exception 'Invalid continuous-world action'; end if;
  if jsonb_typeof(p_parameters) <> 'object' then raise exception 'Action parameters must be an object'; end if;
  if p_effective_at < timezone('utc', now()) - interval '5 minutes' then raise exception 'Actions cannot be backdated'; end if;

  if p_action_type = 'policy' then
    select policy into source_policy
    from public.calibration_packages cp
    cross join lateral jsonb_array_elements(coalesce(cp.payload -> 'extended_policy_effect_library' -> 'policies', '[]'::jsonb)) policy
    where cp.package_key = 'final_world_teaching' and cp.status = 'active'
      and policy ->> 'policy_id' = p_action_key
    limit 1;
    if source_policy is null then raise exception 'Policy is not present in the active final teaching calibration'; end if;
    if not (p_parameters ? 'change') then raise exception 'A policy change value is required'; end if;
    if (p_parameters ->> 'change')::numeric < (source_policy -> 'allowed_range' ->> 0)::numeric
       or (p_parameters ->> 'change')::numeric > (source_policy -> 'allowed_range' ->> 1)::numeric then
      raise exception 'Policy parameter lies outside its calibrated range';
    end if;
    lifecycle_value := coalesce(source_policy -> 'lifecycle_days', '{}'::jsonb);
    if lower(coalesce(source_policy ->> 'approval_requirement', '')) like '%captain%' then required_roles := array_append(required_roles, 'country_captain'); end if;
    if lower(coalesce(source_policy ->> 'approval_requirement', '')) like '%finance%' then required_roles := array_append(required_roles, 'economic_policy_minister'); end if;
    if lower(coalesce(source_policy ->> 'approval_requirement', '')) like '%central bank%' then required_roles := array_append(required_roles, 'central_bank_governor'); end if;
    if lower(coalesce(source_policy ->> 'approval_requirement', '')) like '%trade%' then required_roles := array_append(required_roles, 'trade_minister'); end if;
    if lower(coalesce(source_policy ->> 'approval_requirement', '')) like '%social%' then required_roles := array_append(required_roles, 'social_labour_minister'); end if;
    if fiscal_cost > 4 or reserve_use > 20 or political_cost > 40 then required_roles := array_append(required_roles, 'country_captain'); end if;
    -- Submission by the owning minister is their own first sign-off. Only
    -- cross-office and threshold approvals remain pending in the queue.
    if p_action_key like 'POL-CAP-%' then required_roles := array_remove(required_roles, 'country_captain'); end if;
    if p_action_key like 'POL-CB-%' then required_roles := array_remove(required_roles, 'central_bank_governor'); end if;
    if p_action_key like 'POL-FIN-%' then required_roles := array_remove(required_roles, 'economic_policy_minister'); end if;
    if p_action_key like 'POL-TRADE-%' then required_roles := array_remove(required_roles, 'trade_minister'); end if;
    if p_action_key like 'POL-SOC-%' then required_roles := array_remove(required_roles, 'social_labour_minister'); end if;
    select coalesce(array_agg(distinct role_name), array[]::text[]) into required_roles from unnest(required_roles) role_name;
    needs_approval := cardinality(required_roles) > 0;
  end if;

  insert into public.continuous_world_actions(
    world_id, country_key, action_type, action_key, parameters, status,
    lifecycle_status, lifecycle, approval_state, effective_at, expires_at, submitted_by, published_at
  ) values (
    p_world_id, p_country_key, p_action_type, p_action_key,
    p_parameters || jsonb_build_object('reversible', coalesce((p_parameters ->> 'reversible')::boolean, true)),
    case when needs_approval then 'draft' else 'scheduled' end,
    case when needs_approval then 'blocked' else 'announced' end,
    lifecycle_value,
    case when needs_approval then 'pending' else 'not_required' end,
    greatest(p_effective_at, timezone('utc', now())), p_expires_at, auth.uid(), timezone('utc', now())
  ) returning * into created;

  if needs_approval then
    insert into public.continuous_world_action_approvals(action_id, required_role)
    select created.id, role_name from unnest(required_roles) role_name;
  end if;
  insert into public.continuous_world_audit_logs(world_id, actor_user_id, action_type, entity_type, entity_id, metadata)
  values(p_world_id, auth.uid(), 'action_submitted', 'continuous_world_action', created.id,
    jsonb_build_object('country_key', p_country_key, 'action_type', p_action_type, 'action_key', p_action_key, 'approval_state', created.approval_state));
  return created;
end;
$$;

create or replace function public.decide_continuous_world_action_approval(
  p_approval_id uuid, p_approve boolean, p_note text default null
)
returns public.continuous_world_action_approvals
language plpgsql security definer set search_path = public
as $$
declare approval_row public.continuous_world_action_approvals%rowtype;
declare action_row public.continuous_world_actions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into approval_row from public.continuous_world_action_approvals
  where id = p_approval_id for update;
  if not found then raise exception 'Approval item not found'; end if;
  select * into action_row from public.continuous_world_actions
  where id = approval_row.action_id for update;
  if not public.continuous_world_has_role(action_row.world_id, action_row.country_key, approval_row.required_role, auth.uid()) then raise exception 'The required office or a supervisor must decide this approval'; end if;
  update public.continuous_world_action_approvals
  set status = case when p_approve then 'approved' else 'rejected' end,
      decision_by = auth.uid(), decision_note = nullif(trim(coalesce(p_note, '')), ''), decided_at = timezone('utc', now())
  where id = p_approval_id returning * into approval_row;
  if not p_approve then
    update public.continuous_world_actions set approval_state = 'rejected', lifecycle_status = 'blocked', status = 'rejected' where id = action_row.id;
  elsif not exists(select 1 from public.continuous_world_action_approvals where action_id = action_row.id and status = 'pending') then
    update public.continuous_world_actions set approval_state = 'approved', lifecycle_status = 'announced', status = 'scheduled' where id = action_row.id;
  end if;
  return approval_row;
end;
$$;

create or replace function public.complete_continuous_world_tick(
  p_world_id uuid, p_claim_token uuid, p_previous_state_version integer,
  p_state_after jsonb, p_effect_summary jsonb
)
returns void language plpgsql security definer set search_path = public
as $$
declare previous_state jsonb;
declare next_state_version integer;
begin
  if jsonb_typeof(p_state_after) <> 'object' or jsonb_typeof(p_effect_summary) <> 'array' then raise exception 'Invalid continuous-world tick output'; end if;
  select current_state into previous_state from public.continuous_worlds
  where id = p_world_id and processing_lock_token = p_claim_token and state_version = p_previous_state_version for update;
  if previous_state is null then raise exception 'World tick lock or state version no longer matches'; end if;
  update public.continuous_worlds set current_state = p_state_after, state_version = state_version + 1,
    processing_lock_token = null, processing_locked_until = null, processing_failures = 0
  where id = p_world_id and processing_lock_token = p_claim_token and state_version = p_previous_state_version;
  if not found then raise exception 'World tick lock or state version no longer matches'; end if;
  next_state_version := p_previous_state_version + 1;
  -- No full rollback snapshot is retained. A compact 30-day report is enough
  -- for learning review and keeps the Hobby-tier database footprint modest.
  if mod(next_state_version, 30) = 0 then
    insert into public.continuous_world_reports(world_id, country_key, simulation_day, report_type, summary)
    values (p_world_id, null, next_state_version, 'rolling_30_day', jsonb_build_object('state_version', next_state_version, 'effects', p_effect_summary))
    on conflict (world_id, country_key, simulation_day, report_type) do nothing;
    insert into public.continuous_world_events(world_id, event_type, payload)
    values (p_world_id, 'state_change', jsonb_build_object('state_version', next_state_version, 'report_type', 'rolling_30_day', 'effects', p_effect_summary));
  end if;
end;
$$;

create or replace function public.apply_unclaimed_world_contract_default(p_contract_id uuid)
returns public.continuous_world_contracts
language plpgsql security definer set search_path = public
as $$
declare contract_row public.continuous_world_contracts%rowtype;
begin
  select * into contract_row from public.continuous_world_contracts where id = p_contract_id for update;
  if not found then raise exception 'Contract not found'; end if;
  if exists(select 1 from public.continuous_world_country_teams where world_id = contract_row.world_id and country_key = contract_row.importer_country_key) then return contract_row; end if;
  update public.continuous_world_contracts
  set importer_approved_at = coalesce(importer_approved_at, timezone('utc', now())),
      status = case when exporter_captain_approved_at is null then 'submitted' else 'scheduled' end,
      starts_at = case when exporter_captain_approved_at is null then starts_at else coalesce(starts_at, timezone('utc', now())) end,
      next_settlement_at = case when exporter_captain_approved_at is null then next_settlement_at else coalesce(next_settlement_at, timezone('utc', now())) end
  where id = p_contract_id returning * into contract_row;
  return contract_row;
end;
$$;

-- Existing full snapshots are removed as part of the world restart and no
-- authenticated learner can read a diagnostic checkpoint going forward.
delete from public.continuous_world_snapshots;
drop policy if exists continuous_world_snapshots_read_authenticated on public.continuous_world_snapshots;
create policy continuous_world_snapshots_admin_only on public.continuous_world_snapshots
for select to authenticated using (public.can_administer_continuous_world(world_id));

alter table public.continuous_world_action_approvals enable row level security;
alter table public.continuous_world_cabinet_proposals enable row level security;
alter table public.continuous_world_budget_requests enable row level security;
alter table public.continuous_world_contract_messages enable row level security;
alter table public.continuous_world_projects enable row level security;
alter table public.continuous_world_reports enable row level security;

create policy continuous_world_action_approvals_read_visible on public.continuous_world_action_approvals for select to authenticated using (
  exists(select 1 from public.continuous_world_actions a where a.id = action_id and (a.submitted_by = auth.uid() or public.can_act_for_continuous_world_country(a.world_id, a.country_key) or public.can_administer_continuous_world(a.world_id)))
);
create policy continuous_world_cabinet_proposals_read_visible on public.continuous_world_cabinet_proposals for select to authenticated using (public.can_act_for_continuous_world_country(world_id, country_key) or public.can_administer_continuous_world(world_id));
create policy continuous_world_budget_requests_read_visible on public.continuous_world_budget_requests for select to authenticated using (public.can_act_for_continuous_world_country(world_id, country_key) or public.can_administer_continuous_world(world_id));
create policy continuous_world_contract_messages_read_visible on public.continuous_world_contract_messages for select to authenticated using (exists(select 1 from public.continuous_world_contracts c where c.id = contract_id and (public.can_act_for_continuous_world_country(c.world_id, c.exporter_country_key) or public.can_act_for_continuous_world_country(c.world_id, c.importer_country_key) or public.can_administer_continuous_world(c.world_id))));
create policy continuous_world_projects_read_visible on public.continuous_world_projects for select to authenticated using (public.can_act_for_continuous_world_country(world_id, country_key) or public.can_administer_continuous_world(world_id));
create policy continuous_world_reports_read_authenticated on public.continuous_world_reports for select to authenticated using (auth.uid() is not null);

revoke all on function public.set_continuous_world_governance_updated_at() from public, anon, authenticated;
grant select on public.continuous_world_action_approvals, public.continuous_world_cabinet_proposals, public.continuous_world_budget_requests, public.continuous_world_contract_messages, public.continuous_world_projects, public.continuous_world_reports to authenticated;
grant execute on function public.decide_continuous_world_action_approval(uuid, boolean, text), public.apply_unclaimed_world_contract_default(uuid) to authenticated;

-- One tick equals one simulation day. The Edge Function is called every two
-- real hours; its existing lock token makes retries idempotent.
update public.continuous_worlds set tick_interval_seconds = 7200;

create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'econmind-continuous-world-every-two-hours';
select cron.schedule(
  'econmind-continuous-world-every-two-hours',
  '0 */2 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/process-continuous-world',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'continuous_world_cron_secret' limit 1)
      ),
      body := '{"limit":4}'::jsonb
    );
  $$
);

commit;
