-- EconMind OS continuous world foundation.
-- This is intentionally additive: historic League competitions and their
-- round-based audit trail remain readable while the persistent world uses a
-- separate, server-processed state model.

create table if not exists public.profile_platform_roles (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('student', 'teacher', 'league_participant', 'league_admin', 'platform_admin')),
  assigned_by uuid references public.profiles(user_id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role)
);

create index if not exists profile_platform_roles_role_idx on public.profile_platform_roles(role, user_id);

create or replace function public.sync_profile_platform_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_platform_roles(user_id, role)
  values (new.user_id, case when new.role = 'teacher' then 'teacher' else 'student' end)
  on conflict do nothing;

  if new.platform_role = 'team_member' then
    insert into public.profile_platform_roles(user_id, role) values (new.user_id, 'league_participant') on conflict do nothing;
  elsif new.platform_role = 'school_leader' then
    insert into public.profile_platform_roles(user_id, role) values (new.user_id, 'league_admin') on conflict do nothing;
  elsif new.platform_role = 'platform_admin' then
    insert into public.profile_platform_roles(user_id, role) values (new.user_id, 'platform_admin') on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_platform_roles on public.profiles;
create trigger profiles_sync_platform_roles
after insert or update of role, platform_role on public.profiles
for each row execute function public.sync_profile_platform_roles();

-- Backfill the pre-existing single-role profile fields. No assignment is
-- removed here: an account may legitimately hold several world roles.
insert into public.profile_platform_roles(user_id, role)
select user_id, case when role = 'teacher' then 'teacher' else 'student' end
from public.profiles
on conflict do nothing;

insert into public.profile_platform_roles(user_id, role)
select user_id,
  case platform_role
    when 'team_member' then 'league_participant'
    when 'school_leader' then 'league_admin'
    when 'platform_admin' then 'platform_admin'
  end
from public.profiles
where platform_role in ('team_member', 'school_leader', 'platform_admin')
on conflict do nothing;

create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles p
    where p.user_id = p_user_id and p.platform_role = 'platform_admin'
  ) or exists(
    select 1 from public.profile_platform_roles r
    where r.user_id = p_user_id and r.role = 'platform_admin'
  )
$$;

create or replace function public.has_platform_role(p_role text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profile_platform_roles r
    where r.user_id = p_user_id and r.role = p_role
  )
  or (p_role = 'teacher' and exists(select 1 from public.profiles p where p.user_id = p_user_id and p.role = 'teacher'))
  or (p_role = 'league_participant' and exists(select 1 from public.profiles p where p.user_id = p_user_id and p.platform_role = 'team_member'))
  or (p_role = 'league_admin' and exists(select 1 from public.profiles p where p.user_id = p_user_id and p.platform_role = 'school_leader'))
  or (p_role = 'platform_admin' and public.is_platform_admin(p_user_id))
$$;

-- Existing profiles.role/platform_role are retained for legacy pages. This
-- guard prevents a normal client from granting itself either kind of role.
create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.uid() = new.user_id and not public.is_platform_admin(auth.uid()) then
    new.role := 'student';
    new.platform_role := 'user';
  elsif tg_op = 'UPDATE' and not public.is_platform_admin(auth.uid()) then
    new.role := old.role;
    new.platform_role := old.platform_role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_authorization_fields on public.profiles;
create trigger profiles_protect_authorization_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_authorization_fields();

create or replace function public.set_platform_role_assignment(p_user_id uuid, p_role text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_role not in ('student', 'teacher', 'league_participant', 'league_admin', 'platform_admin') then raise exception 'Invalid platform role'; end if;
  if p_enabled then
    insert into public.profile_platform_roles(user_id, role, assigned_by)
    values (p_user_id, p_role, auth.uid()) on conflict do nothing;
  else
    if p_role = 'platform_admin' and p_user_id = auth.uid()
      and (select count(*) from public.profile_platform_roles where role = 'platform_admin') <= 1 then
      raise exception 'The final platform administrator cannot remove their own access';
    end if;
    delete from public.profile_platform_roles where user_id = p_user_id and role = p_role;
  end if;
end;
$$;

create table if not exists public.calibration_packages (
  id uuid primary key default extensions.gen_random_uuid(),
  package_key text not null check (package_key in ('world_country_calibration', 'market_baselines', 'policy_effect_library', 'shock_library', 'formula_catalog', 'practice_question_bank', 'calibration_test_suite')),
  package_version text not null check (package_version ~ '^[0-9]+\.[0-9]+\.[0-9]+([-.][A-Za-z0-9.-]+)?$'),
  status text not null default 'draft' check (status in ('draft', 'validated', 'active', 'superseded', 'rejected')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  uploaded_by uuid references public.profiles(user_id) on delete set null,
  validated_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (package_key, package_version, checksum)
);

create unique index if not exists calibration_packages_one_active_key_idx
  on public.calibration_packages(package_key) where status = 'active';
create index if not exists calibration_packages_status_idx on public.calibration_packages(package_key, status, created_at desc);

create table if not exists public.continuous_worlds (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,100}$'),
  name text not null check (char_length(trim(name)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'faulted', 'archived')),
  calibration_version text not null check (calibration_version ~ '^[0-9]+\.[0-9]+\.[0-9]+([-.][A-Za-z0-9.-]+)?$'),
  calibration_manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(calibration_manifest) = 'object'),
  current_state jsonb not null default '{"schemaVersion":1,"countries":[],"markets":[]}'::jsonb check (jsonb_typeof(current_state) = 'object'),
  state_version integer not null default 0 check (state_version >= 0),
  tick_interval_seconds integer not null default 3600 check (tick_interval_seconds between 300 and 86400),
  next_tick_at timestamptz,
  processing_lock_token uuid,
  processing_locked_until timestamptz,
  processing_failures smallint not null default 0 check (processing_failures between 0 and 100),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists continuous_worlds_status_tick_idx on public.continuous_worlds(status, next_tick_at)
  where status = 'running';

create table if not exists public.continuous_world_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  membership_status text not null default 'active' check (membership_status in ('invited', 'active', 'suspended', 'left')),
  joined_at timestamptz not null default timezone('utc', now()),
  unique (world_id, user_id)
);

create table if not exists public.continuous_world_role_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  country_key text not null check (country_key ~ '^[a-z0-9-]{2,80}$'),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role_type text not null check (role_type in ('country_captain', 'central_bank_governor', 'economic_policy_minister', 'trade_minister', 'infrastructure_investment_minister', 'social_labour_minister', 'research_innovation_minister')),
  assigned_by uuid references public.profiles(user_id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  unique (world_id, country_key, role_type),
  unique (world_id, country_key, user_id, role_type)
);

create index if not exists continuous_world_memberships_user_idx on public.continuous_world_memberships(user_id, world_id);
create index if not exists continuous_world_roles_user_idx on public.continuous_world_role_assignments(user_id, world_id, country_key);

create table if not exists public.continuous_world_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  country_key text not null check (country_key ~ '^[a-z0-9-]{2,80}$'),
  action_type text not null check (action_type in ('policy', 'contract', 'project', 'announcement')),
  action_key text not null check (action_key ~ '^[a-z0-9-]{2,100}$'),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'active', 'expired', 'cancelled', 'rejected')),
  effective_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  submitted_by uuid not null references public.profiles(user_id) on delete restrict,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expires_at is null or expires_at > effective_at)
);

create index if not exists continuous_world_actions_tick_idx on public.continuous_world_actions(world_id, status, effective_at);
create index if not exists continuous_world_actions_author_idx on public.continuous_world_actions(submitted_by, created_at desc);

create table if not exists public.continuous_world_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  state_version integer not null check (state_version > 0),
  state_before jsonb not null check (jsonb_typeof(state_before) = 'object'),
  state_after jsonb not null check (jsonb_typeof(state_after) = 'object'),
  effect_summary jsonb not null default '[]'::jsonb check (jsonb_typeof(effect_summary) = 'array'),
  processed_at timestamptz not null default timezone('utc', now()),
  unique (world_id, state_version)
);

create index if not exists continuous_world_snapshots_world_idx on public.continuous_world_snapshots(world_id, state_version desc);

create table if not exists public.continuous_world_events (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  country_key text check (country_key is null or country_key ~ '^[a-z0-9-]{2,80}$'),
  event_type text not null check (event_type in ('policy_applied', 'market_cleared', 'shock', 'contract', 'project', 'state_change', 'notice')),
  visibility text not null default 'public' check (visibility in ('public', 'country_private', 'admin')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists continuous_world_events_world_idx on public.continuous_world_events(world_id, created_at desc);

create table if not exists public.continuous_world_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  world_id uuid not null references public.continuous_worlds(id) on delete cascade,
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  action_type text not null check (char_length(action_type) between 3 and 120),
  entity_type text not null check (char_length(entity_type) between 3 and 120),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists continuous_world_audit_logs_world_idx on public.continuous_world_audit_logs(world_id, created_at desc);

create or replace function public.set_continuous_world_updated_at()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin new.updated_at := timezone('utc', now()); return new; end; $$;

drop trigger if exists calibration_packages_set_updated_at on public.calibration_packages;
create trigger calibration_packages_set_updated_at before update on public.calibration_packages for each row execute function public.set_continuous_world_updated_at();
drop trigger if exists continuous_worlds_set_updated_at on public.continuous_worlds;
create trigger continuous_worlds_set_updated_at before update on public.continuous_worlds for each row execute function public.set_continuous_world_updated_at();
drop trigger if exists continuous_world_actions_set_updated_at on public.continuous_world_actions;
create trigger continuous_world_actions_set_updated_at before update on public.continuous_world_actions for each row execute function public.set_continuous_world_updated_at();

create or replace function public.can_administer_continuous_world(p_world_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin(p_user_id) or public.has_platform_role('league_admin', p_user_id)
$$;

create or replace function public.can_act_for_continuous_world_country(p_world_id uuid, p_country_key text, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_administer_continuous_world(p_world_id, p_user_id)
    or exists(
      select 1 from public.continuous_world_role_assignments r
      join public.continuous_world_memberships m on m.world_id = r.world_id and m.user_id = r.user_id and m.membership_status = 'active'
      where r.world_id = p_world_id and r.country_key = p_country_key and r.user_id = p_user_id
    )
$$;

create or replace function public.submit_continuous_world_action(
  p_world_id uuid,
  p_country_key text,
  p_action_type text,
  p_action_key text,
  p_parameters jsonb,
  p_effective_at timestamptz default timezone('utc', now()),
  p_expires_at timestamptz default null
)
returns public.continuous_world_actions
language plpgsql
security definer
set search_path = public
as $$
declare created public.continuous_world_actions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_act_for_continuous_world_country(p_world_id, p_country_key, auth.uid()) then raise exception 'An assigned country role or world administrator role is required'; end if;
  if p_action_type not in ('policy', 'contract', 'project', 'announcement') or p_action_key !~ '^[a-z0-9-]{2,100}$' then raise exception 'Invalid continuous-world action'; end if;
  if jsonb_typeof(p_parameters) <> 'object' then raise exception 'Action parameters must be an object'; end if;
  if p_effective_at < timezone('utc', now()) - interval '5 minutes' then raise exception 'Actions cannot be backdated'; end if;
  if p_action_type = 'policy' and not exists (
    select 1 from public.calibration_packages cp
    where cp.package_key = 'policy_effect_library' and cp.status = 'active'
      and cp.payload -> 'policies' @> jsonb_build_array(jsonb_build_object('id', p_action_key))
  ) then raise exception 'Policy is not present in the active calibration package'; end if;
  insert into public.continuous_world_actions(world_id, country_key, action_type, action_key, parameters, effective_at, expires_at, submitted_by)
  values(p_world_id, p_country_key, p_action_type, p_action_key, p_parameters, p_effective_at, p_expires_at, auth.uid())
  returning * into created;
  insert into public.continuous_world_audit_logs(world_id, actor_user_id, action_type, entity_type, entity_id, metadata)
  values(p_world_id, auth.uid(), 'action_submitted', 'continuous_world_action', created.id, jsonb_build_object('country_key', p_country_key, 'action_type', p_action_type, 'action_key', p_action_key));
  return created;
end;
$$;

-- Edge Functions call the following three procedures using their protected
-- service credential. They are not callable from browsers.
create or replace function public.claim_due_continuous_world_ticks(p_claim_token uuid, p_limit integer default 4)
returns table(world_id uuid, calibration_version text, calibration_manifest jsonb, current_state jsonb, state_version integer)
language plpgsql security definer set search_path = public
as $$
begin
  if p_claim_token is null or p_limit < 1 or p_limit > 12 then raise exception 'Invalid world tick claim'; end if;
  return query
  with due as (
    select w.id from public.continuous_worlds w
    where w.status = 'running'
      and coalesce(w.next_tick_at, timezone('utc', now())) <= timezone('utc', now())
      and (w.processing_locked_until is null or w.processing_locked_until < timezone('utc', now()))
    order by w.next_tick_at nulls first, w.id
    limit p_limit
    for update skip locked
  )
  update public.continuous_worlds w
  set processing_lock_token = p_claim_token,
      processing_locked_until = timezone('utc', now()) + interval '5 minutes',
      next_tick_at = timezone('utc', now()) + make_interval(secs => w.tick_interval_seconds)
  from due
  where w.id = due.id
  returning w.id, w.calibration_version, w.calibration_manifest, w.current_state, w.state_version;
end;
$$;

create or replace function public.complete_continuous_world_tick(
  p_world_id uuid,
  p_claim_token uuid,
  p_previous_state_version integer,
  p_state_after jsonb,
  p_effect_summary jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare previous_state jsonb;
declare next_state_version integer;
begin
  if jsonb_typeof(p_state_after) <> 'object' or jsonb_typeof(p_effect_summary) <> 'array' then raise exception 'Invalid continuous-world tick output'; end if;
  select current_state into previous_state
  from public.continuous_worlds
  where id = p_world_id and processing_lock_token = p_claim_token and state_version = p_previous_state_version
  for update;
  if previous_state is null then raise exception 'World tick lock or state version no longer matches'; end if;
  update public.continuous_worlds
  set current_state = p_state_after,
      state_version = state_version + 1,
      processing_lock_token = null,
      processing_locked_until = null,
      processing_failures = 0
  where id = p_world_id and processing_lock_token = p_claim_token and state_version = p_previous_state_version;
  if not found then raise exception 'World tick lock or state version no longer matches'; end if;
  next_state_version := p_previous_state_version + 1;
  insert into public.continuous_world_snapshots(world_id, state_version, state_before, state_after, effect_summary)
  values(p_world_id, next_state_version, previous_state, p_state_after, p_effect_summary);
  insert into public.continuous_world_events(world_id, event_type, payload)
  values(p_world_id, 'state_change', jsonb_build_object('state_version', p_previous_state_version + 1, 'effects', p_effect_summary));
end;
$$;

create or replace function public.fail_continuous_world_tick(p_world_id uuid, p_claim_token uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.continuous_worlds
  set processing_lock_token = null,
      processing_locked_until = null,
      processing_failures = processing_failures + 1,
      next_tick_at = timezone('utc', now()) + interval '5 minutes',
      status = case when processing_failures + 1 >= 5 then 'faulted' else status end
  where id = p_world_id and processing_lock_token = p_claim_token;
  insert into public.continuous_world_events(world_id, event_type, visibility, payload)
  values(p_world_id, 'notice', 'admin', jsonb_build_object('reason', left(coalesce(p_reason, 'Unknown world tick failure'), 2000)));
end;
$$;

alter table public.profile_platform_roles enable row level security;
alter table public.calibration_packages enable row level security;
alter table public.continuous_worlds enable row level security;
alter table public.continuous_world_memberships enable row level security;
alter table public.continuous_world_role_assignments enable row level security;
alter table public.continuous_world_actions enable row level security;
alter table public.continuous_world_snapshots enable row level security;
alter table public.continuous_world_events enable row level security;
alter table public.continuous_world_audit_logs enable row level security;

create policy profile_platform_roles_read_own_or_admin on public.profile_platform_roles for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy calibration_packages_read_active_or_admin on public.calibration_packages for select to authenticated using (status = 'active' or public.is_platform_admin());
create policy calibration_packages_admin_manage on public.calibration_packages for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy continuous_worlds_read_authenticated on public.continuous_worlds for select to authenticated using (auth.uid() is not null);
create policy continuous_worlds_admin_manage on public.continuous_worlds for all to authenticated using (public.can_administer_continuous_world(id)) with check (public.can_administer_continuous_world(id));
create policy continuous_world_memberships_read_own_or_admin on public.continuous_world_memberships for select to authenticated using (user_id = auth.uid() or public.can_administer_continuous_world(world_id));
create policy continuous_world_memberships_admin_manage on public.continuous_world_memberships for all to authenticated using (public.can_administer_continuous_world(world_id)) with check (public.can_administer_continuous_world(world_id));
create policy continuous_world_roles_read_authenticated on public.continuous_world_role_assignments for select to authenticated using (auth.uid() is not null);
create policy continuous_world_roles_admin_manage on public.continuous_world_role_assignments for all to authenticated using (public.can_administer_continuous_world(world_id)) with check (public.can_administer_continuous_world(world_id));
create policy continuous_world_actions_read_visible on public.continuous_world_actions for select to authenticated using (status in ('active', 'expired') or submitted_by = auth.uid() or public.can_act_for_continuous_world_country(world_id, country_key) or public.can_administer_continuous_world(world_id));
create policy continuous_world_snapshots_read_authenticated on public.continuous_world_snapshots for select to authenticated using (auth.uid() is not null);
create policy continuous_world_events_read_visible on public.continuous_world_events for select to authenticated using (visibility = 'public' or (visibility = 'country_private' and country_key is not null and public.can_act_for_continuous_world_country(world_id, country_key)) or public.can_administer_continuous_world(world_id));
create policy continuous_world_audit_logs_admin_only on public.continuous_world_audit_logs for select to authenticated using (public.can_administer_continuous_world(world_id));

revoke all on function public.sync_profile_platform_roles(), public.protect_profile_authorization_fields(), public.set_continuous_world_updated_at() from public, anon, authenticated;
revoke all on function public.claim_due_continuous_world_ticks(uuid, integer), public.complete_continuous_world_tick(uuid, uuid, integer, jsonb, jsonb), public.fail_continuous_world_tick(uuid, uuid, text) from public, anon, authenticated;
grant select on public.profile_platform_roles, public.calibration_packages, public.continuous_worlds, public.continuous_world_memberships, public.continuous_world_role_assignments, public.continuous_world_actions, public.continuous_world_snapshots, public.continuous_world_events, public.continuous_world_audit_logs to authenticated;
grant insert, update, delete on public.calibration_packages, public.continuous_worlds, public.continuous_world_memberships, public.continuous_world_role_assignments to authenticated;
grant execute on function public.is_platform_admin(uuid), public.has_platform_role(text, uuid), public.can_administer_continuous_world(uuid, uuid), public.can_act_for_continuous_world_country(uuid, text, uuid), public.set_platform_role_assignment(uuid, text, boolean), public.submit_continuous_world_action(uuid, text, text, text, jsonb, timestamptz, timestamptz) to authenticated;
grant execute on function public.claim_due_continuous_world_ticks(uuid, integer), public.complete_continuous_world_tick(uuid, uuid, integer, jsonb, jsonb), public.fail_continuous_world_tick(uuid, uuid, text) to service_role;
