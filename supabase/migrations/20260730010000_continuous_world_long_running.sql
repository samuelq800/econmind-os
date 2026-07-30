-- Long-running World Economy: team-owned countries, seven role portfolios,
-- natural-time actions and contracts.  Historic round-based League data stays
-- intact; this migration only extends the separate continuous-world system.

alter table public.calibration_packages drop constraint if exists calibration_packages_package_key_check;
alter table public.calibration_packages add constraint calibration_packages_package_key_check check (
  package_key in (
    'world_country_calibration', 'market_baselines', 'policy_effect_library',
    'shock_library', 'formula_catalog', 'practice_question_bank',
    'calibration_test_suite', 'final_world_teaching'
  )
);

alter table public.continuous_world_actions drop constraint if exists continuous_world_actions_action_key_check;
alter table public.continuous_world_actions add constraint continuous_world_actions_action_key_check check (action_key ~ '^[A-Za-z0-9_-]{2,100}$');
alter table public.continuous_world_actions add column if not exists supersedes_action_id uuid references public.continuous_world_actions(id) on delete set null;
alter table public.continuous_world_actions add column if not exists idempotency_key uuid not null default extensions.gen_random_uuid();
create unique index if not exists continuous_world_actions_idempotency_idx on public.continuous_world_actions(world_id, idempotency_key);

create table if not exists public.continuous_world_country_teams (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  country_key text not null check (country_key ~ '^[a-z0-9-]{2,80}$'),
  team_id uuid not null references public.teams(id) on delete restrict,
  claimed_by uuid not null references public.profiles(user_id) on delete restrict,
  claimed_at timestamptz not null default timezone('utc', now()),
  released_at timestamptz,
  unique (world_id, country_key),
  unique (world_id, team_id)
);
create index if not exists continuous_world_country_teams_team_idx on public.continuous_world_country_teams(team_id, world_id);

create table if not exists public.continuous_world_contracts (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  template_id text not null check (template_id ~ '^[A-Z0-9-]{3,100}$'),
  exporter_country_key text not null check (exporter_country_key ~ '^[a-z0-9-]{2,80}$'),
  importer_country_key text not null check (importer_country_key ~ '^[a-z0-9-]{2,80}$' and importer_country_key <> exporter_country_key),
  terms jsonb not null default '{}'::jsonb check (jsonb_typeof(terms) = 'object'),
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'approved', 'funded_or_deposited', 'scheduled',
    'in_transit_or_performing', 'partially_delivered', 'delivered',
    'invoice_due', 'paid', 'closed', 'late', 'default_notice', 'cure',
    'restructured', 'force_majeure_pending', 'force_majeure_confirmed', 'cancelled'
  )),
  starts_at timestamptz,
  ends_at timestamptz,
  next_settlement_at timestamptz,
  exporter_captain_approved_at timestamptz,
  importer_approved_at timestamptz,
  submitted_by uuid not null references public.profiles(user_id) on delete restrict,
  idempotency_key uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (world_id, idempotency_key),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists continuous_world_contracts_due_idx on public.continuous_world_contracts(world_id, status, next_settlement_at);
create index if not exists continuous_world_contracts_country_idx on public.continuous_world_contracts(world_id, exporter_country_key, importer_country_key, created_at desc);

create table if not exists public.continuous_world_shocks (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  shock_key text not null check (shock_key ~ '^[A-Za-z0-9_-]{3,100}$'),
  country_key text check (country_key is null or country_key ~ '^[a-z0-9-]{2,80}$'),
  source text not null check (source in ('automatic', 'teacher', 'league_admin', 'platform_admin')),
  effects jsonb not null default '{}'::jsonb check (jsonb_typeof(effects) = 'object'),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'expired', 'cancelled')),
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz not null,
  injected_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at)
);
create index if not exists continuous_world_shocks_active_idx on public.continuous_world_shocks(world_id, status, starts_at, ends_at);

-- Model Composer remains part of the learning system. Every signed-in learner
-- may retain private drafts; publication is deliberately limited to teachers
-- and platform administrators so reusable chains are curated rather than
-- silently becoming shared course material.
create table if not exists public.model_compositions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  model_chain jsonb not null check (jsonb_typeof(model_chain) = 'array' and jsonb_array_length(model_chain) between 2 and 4),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists model_compositions_owner_idx on public.model_compositions(user_id, updated_at desc);
create index if not exists model_compositions_published_idx on public.model_compositions(status, published_at desc) where status = 'published';

create or replace function public.set_model_compositions_updated_at()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin new.updated_at := timezone('utc', now()); return new; end; $$;
drop trigger if exists model_compositions_set_updated_at on public.model_compositions;
create trigger model_compositions_set_updated_at before update on public.model_compositions for each row execute function public.set_model_compositions_updated_at();

create or replace function public.set_continuous_world_contract_updated_at()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin new.updated_at := timezone('utc', now()); return new; end; $$;
drop trigger if exists continuous_world_contracts_set_updated_at on public.continuous_world_contracts;
create trigger continuous_world_contracts_set_updated_at before update on public.continuous_world_contracts for each row execute function public.set_continuous_world_contract_updated_at();

-- A League participant must belong to an approved school team. The existing
-- team membership model already guarantees one team per person.
create or replace function public.continuous_world_team_for_user(p_user_id uuid default auth.uid())
returns uuid language sql stable security definer set search_path = public
as $$
  select tm.team_id
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  join public.schools s on s.id = t.school_id
  where tm.user_id = p_user_id and s.status = 'approved'
  limit 1
$$;

create or replace function public.is_continuous_world_team_member(p_world_id uuid, p_country_key text, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.continuous_world_country_teams ct
    where ct.world_id = p_world_id and ct.country_key = p_country_key
      and ct.team_id = public.continuous_world_team_for_user(p_user_id)
  )
$$;

-- Teachers are authorized operational supervisors alongside existing League
-- and platform administrators, as confirmed for this persistent world.
create or replace function public.can_administer_continuous_world(p_world_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin(p_user_id)
    or public.has_platform_role('league_admin', p_user_id)
    or public.has_platform_role('teacher', p_user_id)
$$;

create or replace function public.can_act_for_continuous_world_country(p_world_id uuid, p_country_key text, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_administer_continuous_world(p_world_id, p_user_id)
    or exists(
      select 1
      from public.continuous_world_role_assignments r
      join public.continuous_world_memberships m on m.world_id = r.world_id and m.user_id = r.user_id and m.membership_status = 'active'
      where r.world_id = p_world_id and r.country_key = p_country_key and r.user_id = p_user_id
        and public.is_continuous_world_team_member(p_world_id, p_country_key, p_user_id)
    )
$$;

create or replace function public.continuous_world_has_role(p_world_id uuid, p_country_key text, p_role text, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_administer_continuous_world(p_world_id, p_user_id)
    or exists(select 1 from public.continuous_world_role_assignments where world_id = p_world_id and country_key = p_country_key and user_id = p_user_id and role_type = p_role)
$$;

create or replace function public.continuous_world_state_allows_action(p_world_id uuid, p_country_key text, p_parameters jsonb default '{}'::jsonb)
returns boolean language sql stable security definer set search_path = public
as $$
  with country as (
    select coalesce(item -> 'dynamics' ->> 'governanceState', 'normal') as governance_state
    from public.continuous_worlds w
    cross join lateral jsonb_array_elements(coalesce(w.current_state -> 'countries', '[]'::jsonb)) item
    where w.id = p_world_id and item ->> 'id' = p_country_key
  )
  select coalesce((select case governance_state
    when 'institutional_collapse' then false
    when 'empty_state' then false
    when 'government_crisis' then coalesce((p_parameters ->> 'reversible')::boolean, false)
    else true end from country), false)
$$;

create or replace function public.continuous_world_action_role_allowed(p_world_id uuid, p_country_key text, p_action_type text, p_action_key text, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.continuous_world_has_role(p_world_id, p_country_key, 'country_captain', p_user_id)
    or (
      p_action_type = 'contract'
      and public.continuous_world_has_role(p_world_id, p_country_key, 'trade_minister', p_user_id)
    )
    or (
      p_action_type = 'project'
      and public.continuous_world_has_role(p_world_id, p_country_key, 'infrastructure_investment_minister', p_user_id)
    )
    or (
      p_action_type = 'announcement'
      and (public.continuous_world_has_role(p_world_id, p_country_key, 'country_captain', p_user_id)
        or public.continuous_world_has_role(p_world_id, p_country_key, 'social_labour_minister', p_user_id))
    )
    or (
      p_action_type = 'policy' and (
        (p_action_key = 'policy_rate' or p_action_key like 'POL-CB-%') and public.continuous_world_has_role(p_world_id, p_country_key, 'central_bank_governor', p_user_id)
        or (p_action_key in ('government_spending', 'income_tax', 'business_tax', 'welfare', 'employment_support', 'energy_support', 'fiscal_reserve', 'public_services') or p_action_key like 'POL-FIN-%') and public.continuous_world_has_role(p_world_id, p_country_key, 'economic_policy_minister', p_user_id)
        or (p_action_key like 'POL-TRADE-%') and public.continuous_world_has_role(p_world_id, p_country_key, 'trade_minister', p_user_id)
        or (p_action_key like 'POL-IND-%' or p_action_key like 'POL-RES-%') and public.continuous_world_has_role(p_world_id, p_country_key, 'infrastructure_investment_minister', p_user_id)
        or (p_action_key like 'POL-SOC-%') and public.continuous_world_has_role(p_world_id, p_country_key, 'social_labour_minister', p_user_id)
        or (p_action_key like 'POL-RI-%') and public.continuous_world_has_role(p_world_id, p_country_key, 'research_innovation_minister', p_user_id)
      )
    )
$$;

create or replace function public.join_continuous_world(p_world_id uuid)
returns public.continuous_world_memberships
language plpgsql security definer set search_path = public
as $$
declare membership public.continuous_world_memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.continuous_world_team_for_user(auth.uid()) is null then raise exception 'Join an approved League school team before participating in World Economy'; end if;
  if not exists(select 1 from public.continuous_worlds where id = p_world_id and status in ('running', 'paused')) then raise exception 'World is not available for registration'; end if;
  insert into public.continuous_world_memberships(world_id, user_id, membership_status)
  values(p_world_id, auth.uid(), 'active')
  on conflict (world_id, user_id) do update set membership_status = 'active'
  returning * into membership;
  return membership;
end;
$$;

create or replace function public.claim_continuous_world_country(p_world_id uuid, p_country_key text)
returns public.continuous_world_country_teams
language plpgsql security definer set search_path = public
as $$
declare assigned public.continuous_world_country_teams%rowtype; team uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  team := public.continuous_world_team_for_user(auth.uid());
  if team is null then raise exception 'An approved League team is required'; end if;
  if not exists(select 1 from public.team_members where team_id = team and user_id = auth.uid() and team_role = 'captain')
     and not public.can_administer_continuous_world(p_world_id, auth.uid()) then raise exception 'Only the Team captain may claim a country'; end if;
  perform public.join_continuous_world(p_world_id);
  if not exists(
    select 1 from public.continuous_worlds w cross join lateral jsonb_array_elements(coalesce(w.current_state -> 'countries', '[]'::jsonb)) item
    where w.id = p_world_id and item ->> 'id' = p_country_key
  ) then raise exception 'Unknown fictional country'; end if;
  insert into public.continuous_world_country_teams(world_id, country_key, team_id, claimed_by)
  values(p_world_id, p_country_key, team, auth.uid())
  returning * into assigned;
  insert into public.continuous_world_role_assignments(world_id, country_key, user_id, role_type, assigned_by)
  values(p_world_id, p_country_key, auth.uid(), 'country_captain', auth.uid())
  on conflict (world_id, country_key, role_type) do nothing;
  insert into public.continuous_world_events(world_id, country_key, event_type, payload, created_by)
  values(p_world_id, p_country_key, 'notice', jsonb_build_object('message', 'A League team claimed this country.', 'team_id', team), auth.uid());
  return assigned;
end;
$$;

create or replace function public.claim_continuous_world_role(p_world_id uuid, p_country_key text, p_role_type text)
returns public.continuous_world_role_assignments
language plpgsql security definer set search_path = public
as $$
declare role_assignment public.continuous_world_role_assignments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_type not in ('country_captain', 'central_bank_governor', 'economic_policy_minister', 'trade_minister', 'infrastructure_investment_minister', 'social_labour_minister', 'research_innovation_minister') then raise exception 'Invalid world role'; end if;
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_act_for_continuous_world_country(p_world_id, p_country_key, auth.uid()) then raise exception 'An assigned country role or world supervisor role is required'; end if;
  if not public.continuous_world_action_role_allowed(p_world_id, p_country_key, p_action_type, p_action_key, auth.uid()) then raise exception 'This portfolio does not own the requested world action'; end if;
  if not public.continuous_world_state_allows_action(p_world_id, p_country_key, p_parameters) then raise exception 'The country state does not currently permit this new discretionary action'; end if;
  if p_action_type not in ('policy', 'contract', 'project', 'announcement') or p_action_key !~ '^[A-Za-z0-9_-]{2,100}$' then raise exception 'Invalid continuous-world action'; end if;
  if jsonb_typeof(p_parameters) <> 'object' then raise exception 'Action parameters must be an object'; end if;
  if p_effective_at < timezone('utc', now()) - interval '5 minutes' then raise exception 'Actions cannot be backdated'; end if;
  if p_action_type = 'policy' and not exists (
    select 1 from public.calibration_packages cp
    where cp.status = 'active' and (
      (cp.package_key = 'policy_effect_library' and cp.payload -> 'policies' @> jsonb_build_array(jsonb_build_object('id', p_action_key)))
      or (cp.package_key = 'final_world_teaching' and cp.payload -> 'extended_policy_effect_library' -> 'policies' @> jsonb_build_array(jsonb_build_object('policy_id', p_action_key)))
    )
  ) then raise exception 'Policy is not present in an active calibration package'; end if;
  insert into public.continuous_world_actions(world_id, country_key, action_type, action_key, parameters, effective_at, expires_at, submitted_by)
  values(p_world_id, p_country_key, p_action_type, p_action_key, p_parameters, greatest(p_effective_at, timezone('utc', now())), p_expires_at, auth.uid())
  returning * into created;
  insert into public.continuous_world_audit_logs(world_id, actor_user_id, action_type, entity_type, entity_id, metadata)
  values(p_world_id, auth.uid(), 'action_submitted', 'continuous_world_action', created.id, jsonb_build_object('country_key', p_country_key, 'action_type', p_action_type, 'action_key', p_action_key));
  return created;
end;
$$;

create or replace function public.amend_continuous_world_policy(p_action_id uuid, p_change numeric)
returns public.continuous_world_actions
language plpgsql security definer set search_path = public
as $$
declare original public.continuous_world_actions%rowtype; replacement public.continuous_world_actions%rowtype;
begin
  select * into original from public.continuous_world_actions where id = p_action_id for update;
  if not found then raise exception 'Policy action not found'; end if;
  if original.action_type <> 'policy' or original.status in ('cancelled', 'expired', 'rejected') then raise exception 'This policy cannot be amended'; end if;
  if not public.can_act_for_continuous_world_country(original.world_id, original.country_key, auth.uid())
     or not public.continuous_world_action_role_allowed(original.world_id, original.country_key, 'policy', original.action_key, auth.uid()) then raise exception 'You cannot amend this policy'; end if;
  update public.continuous_world_actions set status = 'cancelled', expires_at = timezone('utc', now()) where id = original.id;
  insert into public.continuous_world_actions(world_id, country_key, action_type, action_key, parameters, status, effective_at, expires_at, submitted_by, supersedes_action_id)
  values(original.world_id, original.country_key, 'policy', original.action_key, jsonb_set(original.parameters, '{change}', to_jsonb(p_change), true), 'scheduled', timezone('utc', now()), original.expires_at, auth.uid(), original.id)
  returning * into replacement;
  return replacement;
end;
$$;

create or replace function public.cancel_continuous_world_action(p_action_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare action_row public.continuous_world_actions%rowtype;
begin
  select * into action_row from public.continuous_world_actions where id = p_action_id for update;
  if not found then raise exception 'World action not found'; end if;
  if not public.can_act_for_continuous_world_country(action_row.world_id, action_row.country_key, auth.uid()) then raise exception 'You cannot cancel this action'; end if;
  update public.continuous_world_actions set status = 'cancelled', expires_at = timezone('utc', now()) where id = p_action_id and status in ('draft', 'scheduled', 'active');
end;
$$;

create or replace function public.create_continuous_world_contract(
  p_world_id uuid, p_exporter_country_key text, p_importer_country_key text,
  p_template_id text, p_terms jsonb, p_idempotency_key uuid default extensions.gen_random_uuid()
)
returns public.continuous_world_contracts
language plpgsql security definer set search_path = public
as $$
declare created public.continuous_world_contracts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_act_for_continuous_world_country(p_world_id, p_exporter_country_key, auth.uid())
     or not public.continuous_world_action_role_allowed(p_world_id, p_exporter_country_key, 'contract', p_template_id, auth.uid()) then raise exception 'Trade Minister or Captain permission is required'; end if;
  if jsonb_typeof(p_terms) <> 'object' or coalesce((p_terms ->> 'quantity')::numeric, 0) <= 0 or coalesce((p_terms ->> 'unit_price')::numeric, 0) <= 0 then raise exception 'Contract quantity and unit price must be positive'; end if;
  if not exists(select 1 from public.calibration_packages cp where cp.package_key = 'final_world_teaching' and cp.status = 'active' and cp.payload -> 'contract_templates' -> 'templates' @> jsonb_build_array(jsonb_build_object('template_id', p_template_id))) then raise exception 'Unknown contract template'; end if;
  insert into public.continuous_world_contracts(world_id, template_id, exporter_country_key, importer_country_key, terms, submitted_by, idempotency_key)
  values(p_world_id, p_template_id, p_exporter_country_key, p_importer_country_key, p_terms, auth.uid(), p_idempotency_key)
  on conflict (world_id, idempotency_key) do update set updated_at = public.continuous_world_contracts.updated_at
  returning * into created;
  return created;
end;
$$;

create or replace function public.approve_continuous_world_contract(p_contract_id uuid)
returns public.continuous_world_contracts
language plpgsql security definer set search_path = public
as $$
declare contract_row public.continuous_world_contracts%rowtype;
begin
  select * into contract_row from public.continuous_world_contracts where id = p_contract_id for update;
  if not found then raise exception 'Contract not found'; end if;
  if public.can_administer_continuous_world(contract_row.world_id, auth.uid()) then
    update public.continuous_world_contracts set exporter_captain_approved_at = coalesce(exporter_captain_approved_at, timezone('utc', now())), importer_approved_at = coalesce(importer_approved_at, timezone('utc', now())), status = 'scheduled', starts_at = coalesce(starts_at, timezone('utc', now())), next_settlement_at = coalesce(next_settlement_at, timezone('utc', now())) where id = p_contract_id returning * into contract_row;
  elsif public.continuous_world_has_role(contract_row.world_id, contract_row.exporter_country_key, 'country_captain', auth.uid()) then
    update public.continuous_world_contracts set exporter_captain_approved_at = timezone('utc', now()), status = case when importer_approved_at is null then 'submitted' else 'scheduled' end, starts_at = case when importer_approved_at is null then starts_at else coalesce(starts_at, timezone('utc', now())) end, next_settlement_at = case when importer_approved_at is null then next_settlement_at else coalesce(next_settlement_at, timezone('utc', now())) end where id = p_contract_id returning * into contract_row;
  elsif public.continuous_world_has_role(contract_row.world_id, contract_row.importer_country_key, 'trade_minister', auth.uid()) or public.continuous_world_has_role(contract_row.world_id, contract_row.importer_country_key, 'country_captain', auth.uid()) then
    update public.continuous_world_contracts set importer_approved_at = timezone('utc', now()), status = case when exporter_captain_approved_at is null then 'draft' else 'scheduled' end, starts_at = case when exporter_captain_approved_at is null then starts_at else coalesce(starts_at, timezone('utc', now())) end, next_settlement_at = case when exporter_captain_approved_at is null then next_settlement_at else coalesce(next_settlement_at, timezone('utc', now())) end where id = p_contract_id returning * into contract_row;
  else raise exception 'Captain approval from the exporter or Trade/Captain approval from the importer is required'; end if;
  return contract_row;
end;
$$;

create or replace function public.save_model_composition(p_title text, p_model_chain jsonb, p_links jsonb default '[]'::jsonb)
returns public.model_compositions
language plpgsql security definer set search_path = public
as $$
declare saved public.model_compositions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_model_chain) <> 'array' or jsonb_array_length(p_model_chain) not between 2 and 4 then raise exception 'Choose between two and four models'; end if;
  if jsonb_typeof(p_links) <> 'array' then raise exception 'Composition links must be an array'; end if;
  insert into public.model_compositions(user_id, title, model_chain, links)
  values(auth.uid(), trim(p_title), p_model_chain, p_links)
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.publish_model_composition(p_composition_id uuid)
returns public.model_compositions
language plpgsql security definer set search_path = public
as $$
declare published public.model_compositions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.has_platform_role('teacher', auth.uid())) then raise exception 'Only teachers and platform administrators can publish reusable compositions'; end if;
  update public.model_compositions
  set status = 'published', published_at = coalesce(published_at, timezone('utc', now()))
  where id = p_composition_id and user_id = auth.uid()
  returning * into published;
  if not found then raise exception 'Composition not found or not owned by current user'; end if;
  return published;
end;
$$;

create or replace function public.inject_continuous_world_shock(p_world_id uuid, p_shock_key text, p_country_key text, p_effects jsonb, p_duration_days integer)
returns public.continuous_world_shocks
language plpgsql security definer set search_path = public
as $$
declare created public.continuous_world_shocks%rowtype; actor_source text;
begin
  if not public.can_administer_continuous_world(p_world_id, auth.uid()) then raise exception 'Teacher, League administrator or Platform administrator role required'; end if;
  if jsonb_typeof(p_effects) <> 'object' or p_duration_days < 1 or p_duration_days > 730 then raise exception 'Invalid shock payload'; end if;
  actor_source := case when public.is_platform_admin(auth.uid()) then 'platform_admin' when public.has_platform_role('league_admin', auth.uid()) then 'league_admin' else 'teacher' end;
  insert into public.continuous_world_shocks(world_id, shock_key, country_key, source, effects, starts_at, ends_at, injected_by)
  values(p_world_id, p_shock_key, nullif(p_country_key, ''), actor_source, p_effects, timezone('utc', now()), timezone('utc', now()) + make_interval(days => p_duration_days), auth.uid())
  returning * into created;
  return created;
end;
$$;

alter table public.continuous_world_country_teams enable row level security;
alter table public.continuous_world_contracts enable row level security;
alter table public.continuous_world_shocks enable row level security;
alter table public.model_compositions enable row level security;

create policy continuous_world_country_teams_read_authenticated on public.continuous_world_country_teams for select to authenticated using (auth.uid() is not null);
create policy continuous_world_contracts_read_visible on public.continuous_world_contracts for select to authenticated using (
  status not in ('draft')
  or public.can_act_for_continuous_world_country(world_id, exporter_country_key)
  or public.can_act_for_continuous_world_country(world_id, importer_country_key)
  or public.can_administer_continuous_world(world_id)
);
create policy continuous_world_shocks_read_authenticated on public.continuous_world_shocks for select to authenticated using (auth.uid() is not null);
create policy model_compositions_read_owner_or_published on public.model_compositions for select to authenticated using (user_id = auth.uid() or status = 'published');

grant select on public.continuous_world_country_teams, public.continuous_world_contracts, public.continuous_world_shocks to authenticated;
grant select on public.model_compositions to authenticated;
grant execute on function public.continuous_world_team_for_user(uuid), public.is_continuous_world_team_member(uuid, text, uuid), public.continuous_world_has_role(uuid, text, text, uuid), public.continuous_world_state_allows_action(uuid, text, jsonb), public.continuous_world_action_role_allowed(uuid, text, text, text, uuid), public.join_continuous_world(uuid), public.claim_continuous_world_country(uuid, text), public.claim_continuous_world_role(uuid, text, text), public.submit_continuous_world_action(uuid, text, text, text, jsonb, timestamptz, timestamptz), public.amend_continuous_world_policy(uuid, numeric), public.cancel_continuous_world_action(uuid), public.create_continuous_world_contract(uuid, text, text, text, jsonb, uuid), public.approve_continuous_world_contract(uuid), public.inject_continuous_world_shock(uuid, text, text, jsonb, integer), public.save_model_composition(text, jsonb, jsonb), public.publish_model_composition(uuid) to authenticated;
