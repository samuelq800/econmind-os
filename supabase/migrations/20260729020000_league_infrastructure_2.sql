-- EconMind OS League Infrastructure 2.0
-- Extends the existing school/team/Command Centre data model. It does not
-- replace authentication, existing League tables, or the domestic sandbox.

create table if not exists public.scenario_definitions (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,100}$'),
  description text not null check (char_length(trim(description)) between 20 and 4000),
  scenario_type text not null check (scenario_type in ('domestic', 'league_world', 'command_centre')),
  status text not null default 'draft' check (status in ('draft', 'validating', 'invalid', 'ready_for_test', 'testing', 'published', 'archived')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_by uuid references public.profiles(user_id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.country_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  scenario_id uuid not null references public.scenario_definitions(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{3,100}$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  specialisation text not null check (char_length(trim(specialisation)) between 2 and 240),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  balance_score numeric(6,2) not null default 100 check (balance_score between 50 and 150),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (scenario_id, slug)
);

create table if not exists public.scenario_validations (
  id uuid primary key default extensions.gen_random_uuid(),
  scenario_id uuid not null references public.scenario_definitions(id) on delete cascade,
  validation_status text not null check (validation_status in ('pending', 'valid', 'invalid', 'warning')),
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.competitions (
  id uuid primary key default extensions.gen_random_uuid(),
  scenario_id uuid not null references public.scenario_definitions(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'draft' check (status in ('draft', 'registration', 'country_assignment', 'role_assignment', 'briefing', 'internal_planning', 'negotiation', 'submission_open', 'submission_locked', 'domestic_processing', 'world_processing', 'round_results', 'shock', 'next_round', 'completed', 'paused', 'cancelled')),
  current_round smallint not null default 1 check (current_round between 1 and 3),
  round_duration_seconds integer check (round_duration_seconds is null or round_duration_seconds between 60 and 604800),
  leaderboard_visibility text not null default 'after_round' check (leaderboard_visibility in ('hidden', 'after_round', 'always')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_by uuid references public.profiles(user_id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  paused_from_status text,
  state_changed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (name)
);

create table if not exists public.competition_schools (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'withdrawn', 'removed')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (competition_id, school_id)
);

create table if not exists public.competition_countries (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  country_template_id uuid not null references public.country_templates(id) on delete restrict,
  assigned_school_id uuid references public.schools(id) on delete set null,
  assigned_team_id uuid references public.teams(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  status text not null default 'unassigned' check (status in ('unassigned', 'assigned', 'ready', 'active', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (competition_id, country_template_id),
  unique (competition_id, display_name),
  check ((assigned_team_id is null and assigned_school_id is null) or assigned_school_id is not null)
);

create table if not exists public.competition_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  country_id uuid references public.competition_countries(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role_type text not null check (role_type in ('country_captain', 'central_bank_governor', 'economic_policy_minister', 'trade_minister', 'investment_resources_minister', 'observer')),
  is_captain boolean not null default false,
  assigned_at timestamptz not null default timezone('utc', now()),
  assigned_by uuid references public.profiles(user_id) on delete set null,
  unique (competition_id, country_id, role_type),
  unique (competition_id, country_id, user_id, role_type),
  check ((role_type = 'observer' and country_id is null) or (role_type <> 'observer' and country_id is not null))
);

create table if not exists public.competition_rounds (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_number smallint not null check (round_number between 1 and 3),
  status text not null default 'pending' check (status in ('pending', 'briefing', 'planning', 'negotiation', 'submission_open', 'locked', 'processing', 'processed', 'published', 'failed')),
  opens_at timestamptz,
  locks_at timestamptz,
  processing_started_at timestamptz,
  processed_at timestamptz,
  published_at timestamptz,
  processing_idempotency_key text,
  processing_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (competition_id, round_number),
  unique (competition_id, processing_idempotency_key)
);

create table if not exists public.institution_drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_id uuid not null references public.competition_rounds(id) on delete cascade,
  country_id uuid not null references public.competition_countries(id) on delete cascade,
  institution_type text not null check (institution_type in ('central_bank_governor', 'economic_policy_minister', 'trade_minister', 'investment_resources_minister')),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  draft_state jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_state) = 'object'),
  locked_state jsonb check (locked_state is null or jsonb_typeof(locked_state) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'locked', 'unlocked')),
  locked_at timestamptz,
  unlocked_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (round_id, country_id, institution_type)
);

create table if not exists public.country_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_id uuid not null references public.competition_rounds(id) on delete cascade,
  country_id uuid not null references public.competition_countries(id) on delete cascade,
  policy_package jsonb not null check (jsonb_typeof(policy_package) = 'object'),
  agreement_actions jsonb not null default '[]'::jsonb check (jsonb_typeof(agreement_actions) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'finalised', 'locked', 'processed')),
  finalised_by uuid references public.profiles(user_id) on delete set null,
  finalised_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id, country_id)
);

create table if not exists public.world_states (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_id uuid not null references public.competition_rounds(id) on delete restrict,
  version integer not null check (version >= 1),
  state_before jsonb not null check (jsonb_typeof(state_before) = 'object'),
  state_after jsonb not null check (jsonb_typeof(state_after) = 'object'),
  settlement_hash text not null check (settlement_hash ~ '^w[0-9a-f]{8}$'),
  processing_status text not null check (processing_status in ('processing', 'completed', 'failed')),
  processed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (round_id, version),
  unique (round_id, settlement_hash)
);

create table if not exists public.country_round_results (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_id uuid not null references public.competition_rounds(id) on delete restrict,
  country_id uuid not null references public.competition_countries(id) on delete restrict,
  state_before jsonb not null check (jsonb_typeof(state_before) = 'object'),
  decisions jsonb not null check (jsonb_typeof(decisions) = 'object'),
  domestic_effects jsonb not null check (jsonb_typeof(domestic_effects) = 'array'),
  international_effects jsonb not null check (jsonb_typeof(international_effects) = 'array'),
  state_after jsonb not null check (jsonb_typeof(state_after) = 'object'),
  scores jsonb not null check (jsonb_typeof(scores) = 'object'),
  explanations jsonb not null check (jsonb_typeof(explanations) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (round_id, country_id)
);

create table if not exists public.international_agreements (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  agreement_type text not null check (agreement_type in ('trade', 'energy_supply', 'investment', 'technology_partnership', 'currency_swap', 'climate_fund')),
  proposer_country_id uuid not null references public.competition_countries(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'proposed', 'countered', 'accepted', 'active', 'completed', 'breached', 'cancelled', 'expired')),
  terms jsonb not null default '{}'::jsonb check (jsonb_typeof(terms) = 'object'),
  starts_round smallint not null check (starts_round between 1 and 3),
  ends_round smallint not null check (ends_round between 1 and 3 and ends_round >= starts_round),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agreement_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  agreement_id uuid not null references public.international_agreements(id) on delete cascade,
  country_id uuid not null references public.competition_countries(id) on delete cascade,
  required_role text not null check (required_role in ('central_bank_governor', 'economic_policy_minister', 'trade_minister', 'investment_resources_minister')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles(user_id) on delete set null,
  approved_at timestamptz,
  unique (agreement_id, country_id, required_role)
);

-- Kept as rows (as well as in the immutable world-state snapshot) so a
-- released round can be exported as a trade matrix without client inference.
create table if not exists public.trade_flows (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_id uuid not null references public.competition_rounds(id) on delete cascade,
  exporter_country_id uuid not null references public.competition_countries(id) on delete restrict,
  importer_country_id uuid not null references public.competition_countries(id) on delete restrict,
  commodity text not null check (commodity in ('energy', 'food', 'manufactured_goods', 'technology_services')),
  quantity numeric(12,3) not null check (quantity >= 0),
  base_price numeric(12,3) not null check (base_price >= 0),
  tariff numeric(7,3) not null check (tariff between 0 and 100),
  transport_cost numeric(12,3) not null check (transport_cost >= 0),
  agreement_id uuid references public.international_agreements(id) on delete set null,
  fulfilment_ratio numeric(6,4) not null check (fulfilment_ratio between 0 and 1),
  status text not null check (status in ('active', 'partial', 'fulfilled')),
  created_at timestamptz not null default timezone('utc', now()),
  check (exporter_country_id <> importer_country_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  action_type text not null check (char_length(action_type) between 3 and 120),
  entity_type text not null check (char_length(entity_type) between 3 and 120),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

-- Durable public events complement Realtime; reconnecting clients can load
-- these rows instead of relying on a browser-local timer or missed broadcast.
create table if not exists public.competition_events (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_id uuid references public.competition_rounds(id) on delete set null,
  event_type text not null check (event_type in ('announcement', 'state_change', 'shock', 'round_published', 'processing', 'recovery')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists scenario_definitions_status_idx on public.scenario_definitions(status, created_at desc);
create index if not exists country_templates_scenario_idx on public.country_templates(scenario_id);
create index if not exists competitions_status_idx on public.competitions(status, updated_at desc);
create index if not exists competition_schools_school_idx on public.competition_schools(school_id, competition_id);
create index if not exists competition_countries_competition_idx on public.competition_countries(competition_id, assigned_team_id);
create index if not exists competition_roles_user_idx on public.competition_roles(user_id, competition_id);
create index if not exists competition_rounds_competition_idx on public.competition_rounds(competition_id, round_number);
create index if not exists institution_drafts_country_idx on public.institution_drafts(competition_id, round_id, country_id);
create index if not exists country_submissions_round_idx on public.country_submissions(round_id, status);
create index if not exists world_states_competition_idx on public.world_states(competition_id, round_id, version desc);
create index if not exists country_round_results_competition_idx on public.country_round_results(competition_id, round_id, country_id);
create index if not exists trade_flows_round_idx on public.trade_flows(round_id, commodity, exporter_country_id, importer_country_id);
create index if not exists international_agreements_competition_idx on public.international_agreements(competition_id, status, starts_round);
create index if not exists agreement_participants_country_idx on public.agreement_participants(country_id, approval_status);
create index if not exists audit_logs_competition_idx on public.audit_logs(competition_id, created_at desc);
create index if not exists competition_events_competition_idx on public.competition_events(competition_id, created_at desc);

drop trigger if exists scenario_definitions_set_updated_at on public.scenario_definitions;
create trigger scenario_definitions_set_updated_at before update on public.scenario_definitions for each row execute function public.set_league_updated_at();
drop trigger if exists country_templates_set_updated_at on public.country_templates;
create trigger country_templates_set_updated_at before update on public.country_templates for each row execute function public.set_league_updated_at();
drop trigger if exists competitions_set_updated_at on public.competitions;
create trigger competitions_set_updated_at before update on public.competitions for each row execute function public.set_league_updated_at();
drop trigger if exists competition_rounds_set_updated_at on public.competition_rounds;
create trigger competition_rounds_set_updated_at before update on public.competition_rounds for each row execute function public.set_league_updated_at();
drop trigger if exists institution_drafts_set_updated_at on public.institution_drafts;
create trigger institution_drafts_set_updated_at before update on public.institution_drafts for each row execute function public.set_league_updated_at();
drop trigger if exists country_submissions_set_updated_at on public.country_submissions;
create trigger country_submissions_set_updated_at before update on public.country_submissions for each row execute function public.set_league_updated_at();
drop trigger if exists international_agreements_set_updated_at on public.international_agreements;
create trigger international_agreements_set_updated_at before update on public.international_agreements for each row execute function public.set_league_updated_at();

create or replace function public.is_competition_director(p_competition_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_platform_admin(p_user_id) $$;

create or replace function public.is_competition_country_member(p_competition_id uuid, p_country_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_competition_director(p_competition_id, p_user_id)
    or exists(select 1 from public.competition_roles r where r.competition_id = p_competition_id and r.country_id = p_country_id and r.user_id = p_user_id)
$$;

create or replace function public.can_view_competition_private_country(p_competition_id uuid, p_country_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_competition_country_member(p_competition_id, p_country_id, p_user_id) $$;

create or replace function public.competition_round_is_published(p_round_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.competition_rounds where id = p_round_id and published_at is not null) $$;

create or replace function public.can_edit_institution_draft(p_competition_id uuid, p_country_id uuid, p_institution text, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.competition_roles r join public.competitions c on c.id = r.competition_id
    where r.competition_id = p_competition_id and r.country_id = p_country_id and r.user_id = p_user_id
      and r.role_type = p_institution and c.status in ('internal_planning', 'negotiation', 'submission_open')
  )
$$;

create or replace function public.can_finalise_country_submission(p_competition_id uuid, p_country_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_competition_director(p_competition_id, p_user_id) or exists(
    select 1 from public.competition_roles where competition_id = p_competition_id and country_id = p_country_id and user_id = p_user_id and (role_type = 'country_captain' or is_captain)
  )
$$;

create or replace function public.write_competition_audit(p_competition_id uuid, p_action text, p_entity_type text, p_entity_id uuid default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public
as $$ begin
  insert into public.audit_logs(competition_id, actor_user_id, action_type, entity_type, entity_id, metadata)
  values(p_competition_id, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end; $$;

create or replace function public.claim_competition_role(p_competition_id uuid, p_country_id uuid, p_role_type text, p_is_captain boolean default false)
returns public.competition_roles language plpgsql security definer set search_path = public
as $$
declare country_row public.competition_countries%rowtype; created public.competition_roles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_type not in ('country_captain', 'central_bank_governor', 'economic_policy_minister', 'trade_minister', 'investment_resources_minister') then raise exception 'Invalid competition role'; end if;
  select * into country_row from public.competition_countries where id = p_country_id and competition_id = p_competition_id;
  if not found then raise exception 'Country is not part of this competition'; end if;
  if country_row.assigned_team_id is null or not public.is_team_member(country_row.assigned_team_id, auth.uid()) then raise exception 'Only a member of the assigned team can claim this role'; end if;
  if not exists(select 1 from public.competitions where id = p_competition_id and status in ('registration', 'country_assignment', 'role_assignment')) then raise exception 'Roles cannot be claimed in the current competition state'; end if;
  insert into public.competition_roles(competition_id, country_id, user_id, role_type, is_captain, assigned_by)
  values(p_competition_id, p_country_id, auth.uid(), p_role_type, p_is_captain, auth.uid())
  returning * into created;
  perform public.write_competition_audit(p_competition_id, 'role_claimed', 'competition_role', created.id, jsonb_build_object('country_id', p_country_id, 'role_type', p_role_type));
  return created;
exception when unique_violation then raise exception 'This role has already been claimed';
end; $$;

create or replace function public.save_institution_draft(p_competition_id uuid, p_round_id uuid, p_country_id uuid, p_institution_type text, p_draft_state jsonb)
returns public.institution_drafts language plpgsql security definer set search_path = public
as $$
declare draft_row public.institution_drafts%rowtype;
begin
  if auth.uid() is null or not public.can_edit_institution_draft(p_competition_id, p_country_id, p_institution_type, auth.uid()) then raise exception 'You can only edit your own assigned institution draft while planning is open'; end if;
  if jsonb_typeof(p_draft_state) <> 'object' then raise exception 'Draft state must be an object'; end if;
  if not exists(select 1 from public.competition_rounds where id = p_round_id and competition_id = p_competition_id and status in ('planning', 'negotiation', 'submission_open')) then raise exception 'This round is not open for drafting'; end if;
  insert into public.institution_drafts(competition_id, round_id, country_id, institution_type, created_by, draft_state, status)
  values(p_competition_id, p_round_id, p_country_id, p_institution_type, auth.uid(), p_draft_state, 'draft')
  on conflict (round_id, country_id, institution_type) do update set draft_state = excluded.draft_state, updated_at = timezone('utc', now())
    where public.institution_drafts.status in ('draft', 'unlocked') and public.institution_drafts.created_by = auth.uid()
  returning * into draft_row;
  if draft_row.id is null then raise exception 'A locked draft cannot be changed'; end if;
  return draft_row;
end; $$;

create or replace function public.lock_institution_draft(p_draft_id uuid)
returns public.institution_drafts language plpgsql security definer set search_path = public
as $$
declare draft_row public.institution_drafts%rowtype;
begin
  select * into draft_row from public.institution_drafts where id = p_draft_id for update;
  if not found or not public.can_edit_institution_draft(draft_row.competition_id, draft_row.country_id, draft_row.institution_type, auth.uid()) then raise exception 'Only the assigned institution holder can lock this draft'; end if;
  if draft_row.status = 'locked' then return draft_row; end if;
  update public.institution_drafts set locked_state = draft_state, status = 'locked', locked_at = timezone('utc', now()) where id = p_draft_id returning * into draft_row;
  perform public.write_competition_audit(draft_row.competition_id, 'institution_locked', 'institution_draft', draft_row.id, jsonb_build_object('country_id', draft_row.country_id, 'institution', draft_row.institution_type));
  return draft_row;
end; $$;

create or replace function public.finalise_country_submission(p_competition_id uuid, p_round_id uuid, p_country_id uuid, p_policy_package jsonb, p_agreement_actions jsonb default '[]'::jsonb)
returns public.country_submissions language plpgsql security definer set search_path = public
as $$
declare submission public.country_submissions%rowtype; locked_count integer; server_policy_package jsonb;
begin
  if auth.uid() is null or not public.can_finalise_country_submission(p_competition_id, p_country_id, auth.uid()) then raise exception 'Only the country captain or competition director can finalise this country'; end if;
  if jsonb_typeof(p_policy_package) <> 'object' or jsonb_typeof(p_agreement_actions) <> 'array' then raise exception 'Submission payload has an invalid shape'; end if;
  if not exists(select 1 from public.competition_rounds where id = p_round_id and competition_id = p_competition_id and status = 'submission_open') then raise exception 'Submission is not open'; end if;
  select count(*) into locked_count from public.institution_drafts where competition_id = p_competition_id and round_id = p_round_id and country_id = p_country_id and status = 'locked';
  if locked_count < 4 then raise exception 'All four institution drafts must be locked before country finalisation'; end if;
  select jsonb_build_object('decisions', jsonb_object_agg(institution_type, locked_state))
    into server_policy_package
  from public.institution_drafts
  where competition_id = p_competition_id and round_id = p_round_id and country_id = p_country_id and status = 'locked';
  if server_policy_package is null then raise exception 'No locked institution decisions were found'; end if;
  insert into public.country_submissions(competition_id, round_id, country_id, policy_package, agreement_actions, status, finalised_by, finalised_at)
  values(p_competition_id, p_round_id, p_country_id, server_policy_package, p_agreement_actions, 'finalised', auth.uid(), timezone('utc', now()))
  on conflict (round_id, country_id) do update set policy_package = excluded.policy_package, agreement_actions = excluded.agreement_actions, status = 'finalised', finalised_by = auth.uid(), finalised_at = timezone('utc', now())
    where public.country_submissions.status = 'draft'
  returning * into submission;
  if submission.id is null then raise exception 'This country submission is already locked'; end if;
  perform public.write_competition_audit(p_competition_id, 'country_finalised', 'country_submission', submission.id, jsonb_build_object('country_id', p_country_id));
  return submission;
end; $$;

create or replace function public.transition_competition_state(p_competition_id uuid, p_next_status text, p_note text default null)
returns public.competitions language plpgsql security definer set search_path = public
as $$
declare current_row public.competitions%rowtype; previous_status text; allowed boolean := false;
begin
  if not public.is_competition_director(p_competition_id, auth.uid()) then raise exception 'Competition director permission required'; end if;
  select * into current_row from public.competitions where id = p_competition_id for update;
  if not found then raise exception 'Competition not found'; end if;
  if p_next_status not in ('draft', 'registration', 'country_assignment', 'role_assignment', 'briefing', 'internal_planning', 'negotiation', 'submission_open', 'submission_locked', 'domestic_processing', 'world_processing', 'round_results', 'shock', 'next_round', 'completed', 'paused', 'cancelled') then raise exception 'Invalid competition status'; end if;
  allowed := (current_row.status = 'draft' and p_next_status in ('registration', 'cancelled'))
    or (current_row.status = 'registration' and p_next_status in ('country_assignment', 'paused', 'cancelled'))
    or (current_row.status = 'country_assignment' and p_next_status in ('role_assignment', 'paused', 'cancelled'))
    or (current_row.status = 'role_assignment' and p_next_status in ('briefing', 'paused', 'cancelled'))
    or (current_row.status = 'briefing' and p_next_status in ('internal_planning', 'paused', 'cancelled'))
    or (current_row.status = 'internal_planning' and p_next_status in ('negotiation', 'submission_open', 'paused', 'cancelled'))
    or (current_row.status = 'negotiation' and p_next_status in ('submission_open', 'paused', 'cancelled'))
    or (current_row.status = 'submission_open' and p_next_status in ('submission_locked', 'paused', 'cancelled'))
    or (current_row.status = 'submission_locked' and p_next_status in ('domestic_processing', 'paused', 'cancelled'))
    or (current_row.status = 'domestic_processing' and p_next_status in ('world_processing', 'paused', 'cancelled'))
    or (current_row.status = 'world_processing' and p_next_status in ('round_results', 'paused', 'cancelled'))
    or (current_row.status = 'round_results' and p_next_status in ('shock', 'next_round', 'completed', 'paused', 'cancelled'))
    or (current_row.status = 'shock' and p_next_status in ('next_round', 'paused', 'cancelled'))
    or (current_row.status = 'next_round' and p_next_status in ('briefing', 'completed', 'paused', 'cancelled'))
    or (current_row.status = 'paused' and p_next_status in ('registration', 'country_assignment', 'role_assignment', 'briefing', 'internal_planning', 'negotiation', 'submission_open', 'submission_locked', 'domestic_processing', 'world_processing', 'round_results', 'shock', 'next_round', 'cancelled'));
  if not allowed then raise exception 'Illegal competition state transition from % to %', current_row.status, p_next_status; end if;
  previous_status := current_row.status;
  update public.competitions set status = p_next_status, current_round = case when previous_status = 'next_round' and p_next_status = 'briefing' then least(3, current_row.current_round + 1) else current_row.current_round end, paused_from_status = case when p_next_status = 'paused' then current_row.status else paused_from_status end, started_at = case when p_next_status = 'briefing' and started_at is null then timezone('utc', now()) else started_at end, completed_at = case when p_next_status = 'completed' then timezone('utc', now()) else completed_at end, state_changed_at = timezone('utc', now()) where id = p_competition_id returning * into current_row;
  update public.competition_rounds set status = case p_next_status when 'briefing' then 'briefing' when 'internal_planning' then 'planning' when 'negotiation' then 'negotiation' when 'submission_open' then 'submission_open' when 'submission_locked' then 'locked' else status end, opens_at = case when p_next_status = 'submission_open' then timezone('utc', now()) else opens_at end, locks_at = case when p_next_status = 'submission_locked' then timezone('utc', now()) else locks_at end where competition_id = p_competition_id and round_number = current_row.current_round;
  insert into public.competition_events(competition_id, event_type, payload, created_by) values(p_competition_id, 'state_change', jsonb_build_object('from', previous_status, 'to', p_next_status, 'note', p_note), auth.uid());
  perform public.write_competition_audit(p_competition_id, 'state_transition', 'competition', p_competition_id, jsonb_build_object('to', p_next_status, 'note', p_note));
  return current_row;
end; $$;

create or replace function public.approve_agreement_participant(p_participant_id uuid, p_approval text)
returns public.agreement_participants language plpgsql security definer set search_path = public
as $$
declare participant public.agreement_participants%rowtype; agreement public.international_agreements%rowtype;
begin
  if p_approval not in ('approved', 'rejected') then raise exception 'Invalid approval status'; end if;
  select * into participant from public.agreement_participants where id = p_participant_id for update;
  select * into agreement from public.international_agreements where id = participant.agreement_id;
  if not found or not exists(select 1 from public.competition_roles where competition_id = agreement.competition_id and country_id = participant.country_id and user_id = auth.uid() and role_type = participant.required_role) then raise exception 'Only the required institution role can approve this agreement'; end if;
  update public.agreement_participants set approval_status = p_approval, approved_by = auth.uid(), approved_at = timezone('utc', now()) where id = p_participant_id returning * into participant;
  if p_approval = 'approved' and not exists(select 1 from public.agreement_participants where agreement_id = agreement.id and approval_status <> 'approved') then update public.international_agreements set status = 'accepted' where id = agreement.id and status in ('draft', 'proposed', 'countered'); end if;
  perform public.write_competition_audit(agreement.competition_id, 'agreement_approval', 'agreement_participant', participant.id, jsonb_build_object('agreement_id', agreement.id, 'approval', p_approval));
  return participant;
end; $$;

create or replace function public.claim_world_processing(p_competition_id uuid, p_round_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare round_row public.competition_rounds%rowtype;
begin
  if not public.is_competition_director(p_competition_id, auth.uid()) then raise exception 'Competition director permission required'; end if;
  select * into round_row from public.competition_rounds where id = p_round_id and competition_id = p_competition_id for update;
  if not found then raise exception 'Competition round not found'; end if;
  if round_row.status = 'processed' or round_row.status = 'published' then return jsonb_build_object('claimed', false, 'reason', 'already_processed'); end if;
  if round_row.status = 'processing' and round_row.processing_idempotency_key = p_idempotency_key then return jsonb_build_object('claimed', false, 'reason', 'already_processing'); end if;
  if round_row.status = 'processing' and round_row.processing_idempotency_key <> p_idempotency_key then raise exception 'World processing is already locked'; end if;
  if round_row.status not in ('locked', 'processing', 'failed') then raise exception 'Round must be locked before world processing'; end if;
  update public.competition_rounds set status = 'processing', processing_started_at = coalesce(processing_started_at, timezone('utc', now())), processing_idempotency_key = p_idempotency_key, processing_error = null where id = p_round_id;
  perform public.write_competition_audit(p_competition_id, 'world_processing_claimed', 'competition_round', p_round_id, jsonb_build_object('idempotency_key', p_idempotency_key));
  return jsonb_build_object('claimed', true, 'round_id', p_round_id);
end; $$;

create or replace function public.recover_world_processing(p_competition_id uuid, p_round_id uuid, p_note text)
returns public.competition_rounds language plpgsql security definer set search_path = public
as $$
declare round_row public.competition_rounds%rowtype;
begin
  if not public.is_competition_director(p_competition_id, auth.uid()) then raise exception 'Competition director permission required'; end if;
  update public.competition_rounds set status = 'failed', processing_error = p_note where id = p_round_id and competition_id = p_competition_id and status = 'processing' returning * into round_row;
  if round_row.id is null then raise exception 'Only an in-progress round can be marked for recovery'; end if;
  insert into public.competition_events(competition_id, round_id, event_type, payload, created_by) values(p_competition_id, p_round_id, 'recovery', jsonb_build_object('note', p_note), auth.uid());
  perform public.write_competition_audit(p_competition_id, 'world_processing_recovery', 'competition_round', p_round_id, jsonb_build_object('note', p_note));
  return round_row;
end; $$;

create or replace function public.create_league_competition(p_scenario_id uuid, p_name text, p_description text default '', p_assignment_method text default 'manual')
returns public.competitions language plpgsql security definer set search_path = public
as $$
declare created public.competitions%rowtype; rounds_count integer;
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_assignment_method not in ('manual', 'random', 'balanced_random') then raise exception 'Invalid country-assignment method'; end if;
  if not exists(select 1 from public.scenario_definitions where id = p_scenario_id and status = 'published') then raise exception 'Only a published scenario can create a competition'; end if;
  insert into public.competitions(scenario_id, name, description, status, config, created_by)
  values(p_scenario_id, trim(p_name), coalesce(p_description, ''), 'draft', jsonb_build_object('countryAssignment', p_assignment_method, 'minimumTeamSize', 1, 'maximumTeamSize', 20, 'observerAccess', 'authenticated_public'), auth.uid())
  returning * into created;
  select coalesce((config ->> 'numberOfRounds')::integer, 3) into rounds_count from public.scenario_definitions where id = p_scenario_id;
  insert into public.competition_countries(competition_id, country_template_id, display_name, status)
  select created.id, template.id, template.name, 'unassigned'
  from public.country_templates template
  where template.scenario_id = p_scenario_id;
  insert into public.competition_rounds(competition_id, round_number)
  select created.id, round_number from generate_series(1, least(3, greatest(1, rounds_count))) as round_number;
  perform public.write_competition_audit(created.id, 'competition_created', 'competition', created.id, jsonb_build_object('scenario_id', p_scenario_id, 'country_assignment', p_assignment_method));
  return created;
end; $$;

create or replace function public.propose_international_agreement(p_competition_id uuid, p_proposer_country_id uuid, p_agreement_type text, p_terms jsonb, p_participant_country_ids uuid[], p_required_roles text[], p_starts_round smallint, p_ends_round smallint)
returns public.international_agreements language plpgsql security definer set search_path = public
as $$
declare created public.international_agreements%rowtype; participant_country uuid; required_role text;
begin
  if p_agreement_type not in ('trade', 'energy_supply', 'investment', 'technology_partnership', 'currency_swap', 'climate_fund') then raise exception 'Invalid agreement type'; end if;
  if jsonb_typeof(p_terms) <> 'object' or coalesce(array_length(p_participant_country_ids, 1), 0) < 1 or coalesce(array_length(p_required_roles, 1), 0) < 1 then raise exception 'Agreement terms, countries and required roles are required'; end if;
  if not exists(select 1 from public.competitions where id = p_competition_id and status in ('negotiation', 'submission_open')) then raise exception 'Agreements can only be proposed during negotiation or submission'; end if;
  if not exists(select 1 from public.competition_roles where competition_id = p_competition_id and country_id = p_proposer_country_id and user_id = auth.uid() and role_type = any(p_required_roles)) then raise exception 'You do not hold a required institution role for this proposal'; end if;
  if exists(select 1 from unnest(p_required_roles) as role_name where role_name not in ('central_bank_governor', 'economic_policy_minister', 'trade_minister', 'investment_resources_minister')) then raise exception 'Invalid required institution role'; end if;
  if exists(select 1 from unnest(p_participant_country_ids) as country_id where not exists(select 1 from public.competition_countries c where c.id = country_id and c.competition_id = p_competition_id)) then raise exception 'Every agreement country must belong to this competition'; end if;
  insert into public.international_agreements(competition_id, agreement_type, proposer_country_id, status, terms, starts_round, ends_round)
  values(p_competition_id, p_agreement_type, p_proposer_country_id, 'proposed', p_terms, p_starts_round, p_ends_round)
  returning * into created;
  for participant_country in select distinct participant_id from unnest(array_append(p_participant_country_ids, p_proposer_country_id)) as participant_country_source(participant_id) loop
    foreach required_role in array p_required_roles loop
      insert into public.agreement_participants(agreement_id, country_id, required_role)
      values(created.id, participant_country, required_role)
      on conflict (agreement_id, country_id, required_role) do nothing;
    end loop;
  end loop;
  perform public.write_competition_audit(p_competition_id, 'agreement_proposed', 'international_agreement', created.id, jsonb_build_object('type', p_agreement_type, 'starts_round', p_starts_round));
  return created;
end; $$;

create or replace function public.publish_competition_round(p_competition_id uuid, p_round_id uuid)
returns public.competition_rounds language plpgsql security definer set search_path = public
as $$
declare published public.competition_rounds%rowtype;
begin
  if not public.is_competition_director(p_competition_id, auth.uid()) then raise exception 'Competition director permission required'; end if;
  update public.competition_rounds set status = 'published', published_at = coalesce(published_at, timezone('utc', now())) where id = p_round_id and competition_id = p_competition_id and status = 'processed' returning * into published;
  if published.id is null then raise exception 'Only a processed round can be published'; end if;
  update public.competitions set status = 'round_results' where id = p_competition_id;
  insert into public.competition_events(competition_id, round_id, event_type, payload, created_by) values(p_competition_id, p_round_id, 'round_published', jsonb_build_object('round_number', published.round_number), auth.uid());
  perform public.write_competition_audit(p_competition_id, 'round_published', 'competition_round', p_round_id);
  return published;
end; $$;

alter table public.scenario_definitions enable row level security;
alter table public.country_templates enable row level security;
alter table public.scenario_validations enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_schools enable row level security;
alter table public.competition_countries enable row level security;
alter table public.competition_roles enable row level security;
alter table public.competition_rounds enable row level security;
alter table public.institution_drafts enable row level security;
alter table public.country_submissions enable row level security;
alter table public.world_states enable row level security;
alter table public.country_round_results enable row level security;
alter table public.trade_flows enable row level security;
alter table public.international_agreements enable row level security;
alter table public.agreement_participants enable row level security;
alter table public.audit_logs enable row level security;
alter table public.competition_events enable row level security;

create policy scenario_definitions_read_published on public.scenario_definitions for select to authenticated using (status = 'published' or public.is_platform_admin());
create policy scenario_definitions_admin_manage on public.scenario_definitions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy country_templates_read_published on public.country_templates for select to authenticated using (public.is_platform_admin() or exists(select 1 from public.scenario_definitions s where s.id = scenario_id and s.status = 'published'));
create policy country_templates_admin_manage on public.country_templates for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy scenario_validations_admin_only on public.scenario_validations for select to authenticated using (public.is_platform_admin());
create policy competitions_read_authenticated on public.competitions for select to authenticated using (auth.uid() is not null);
create policy competitions_admin_manage on public.competitions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy competition_schools_read_authenticated on public.competition_schools for select to authenticated using (auth.uid() is not null);
create policy competition_schools_admin_manage on public.competition_schools for all to authenticated using (public.is_competition_director(competition_id)) with check (public.is_competition_director(competition_id));
create policy competition_countries_read_authenticated on public.competition_countries for select to authenticated using (auth.uid() is not null);
create policy competition_countries_admin_manage on public.competition_countries for all to authenticated using (public.is_competition_director(competition_id)) with check (public.is_competition_director(competition_id));
create policy competition_roles_read_authenticated on public.competition_roles for select to authenticated using (auth.uid() is not null);
create policy competition_roles_admin_manage on public.competition_roles for all to authenticated using (public.is_competition_director(competition_id)) with check (public.is_competition_director(competition_id));
create policy competition_rounds_read_authenticated on public.competition_rounds for select to authenticated using (auth.uid() is not null);
create policy competition_rounds_admin_manage on public.competition_rounds for all to authenticated using (public.is_competition_director(competition_id)) with check (public.is_competition_director(competition_id));
create policy institution_drafts_private_read on public.institution_drafts for select to authenticated using (public.can_view_competition_private_country(competition_id, country_id));
create policy country_submissions_private_or_published_read on public.country_submissions for select to authenticated using (public.can_view_competition_private_country(competition_id, country_id) or public.competition_round_is_published(round_id));
create policy world_states_admin_only on public.world_states for select to authenticated using (public.is_competition_director(competition_id));
create policy country_round_results_member_or_published on public.country_round_results for select to authenticated using (public.can_view_competition_private_country(competition_id, country_id) or public.competition_round_is_published(round_id));
create policy trade_flows_member_or_published on public.trade_flows for select to authenticated using (public.is_competition_director(competition_id) or public.competition_round_is_published(round_id));
create policy international_agreements_visible_to_participants_or_public on public.international_agreements for select to authenticated using (status in ('active', 'completed', 'breached', 'expired') or public.is_competition_director(competition_id) or exists(select 1 from public.agreement_participants ap where ap.agreement_id = public.international_agreements.id and public.can_view_competition_private_country(public.international_agreements.competition_id, ap.country_id)));
create policy agreement_participants_visible_to_participants on public.agreement_participants for select to authenticated using (exists(select 1 from public.international_agreements a where a.id = agreement_id and (public.is_competition_director(a.competition_id) or public.can_view_competition_private_country(a.competition_id, country_id) or a.status in ('active', 'completed', 'breached', 'expired'))));
create policy audit_logs_director_only on public.audit_logs for select to authenticated using (public.is_competition_director(competition_id));
create policy competition_events_read_authenticated on public.competition_events for select to authenticated using (auth.uid() is not null);

revoke all on public.scenario_definitions, public.country_templates, public.scenario_validations, public.competitions, public.competition_schools, public.competition_countries, public.competition_roles, public.competition_rounds, public.institution_drafts, public.country_submissions, public.world_states, public.country_round_results, public.trade_flows, public.international_agreements, public.agreement_participants, public.audit_logs, public.competition_events from anon, authenticated;
grant select on public.scenario_definitions, public.country_templates, public.scenario_validations, public.competitions, public.competition_schools, public.competition_countries, public.competition_roles, public.competition_rounds, public.institution_drafts, public.country_submissions, public.world_states, public.country_round_results, public.trade_flows, public.international_agreements, public.agreement_participants, public.audit_logs, public.competition_events to authenticated;
grant insert, update, delete on public.scenario_definitions, public.country_templates, public.competitions, public.competition_schools, public.competition_countries, public.competition_roles, public.competition_rounds, public.international_agreements, public.agreement_participants to authenticated;
grant execute on function public.is_competition_director(uuid, uuid), public.is_competition_country_member(uuid, uuid, uuid), public.can_view_competition_private_country(uuid, uuid, uuid), public.competition_round_is_published(uuid), public.can_edit_institution_draft(uuid, uuid, text, uuid), public.can_finalise_country_submission(uuid, uuid, uuid), public.claim_competition_role(uuid, uuid, text, boolean), public.save_institution_draft(uuid, uuid, uuid, text, jsonb), public.lock_institution_draft(uuid), public.finalise_country_submission(uuid, uuid, uuid, jsonb, jsonb), public.transition_competition_state(uuid, text, text), public.approve_agreement_participant(uuid, text), public.claim_world_processing(uuid, uuid, text), public.recover_world_processing(uuid, uuid, text), public.create_league_competition(uuid, text, text, text), public.propose_international_agreement(uuid, uuid, text, jsonb, uuid[], text[], smallint, smallint), public.publish_competition_round(uuid, uuid) to authenticated;

-- Realtime is a synchronization layer only. Server/database state remains the
-- source of truth for status, locks, results and the long-running schedule.
alter table public.competitions replica identity full;
alter table public.competition_rounds replica identity full;
alter table public.institution_drafts replica identity full;
alter table public.country_submissions replica identity full;
alter table public.trade_flows replica identity full;
alter table public.international_agreements replica identity full;
alter table public.agreement_participants replica identity full;
alter table public.competition_events replica identity full;
alter publication supabase_realtime add table public.competitions, public.competition_rounds, public.institution_drafts, public.country_submissions, public.trade_flows, public.international_agreements, public.agreement_participants, public.competition_events;

-- Seed the single long-running default scenario and competition. No fictional
-- schools, users, teams, submissions or results are created.
insert into public.scenario_definitions(title, slug, description, scenario_type, status, config, created_by, published_at)
select 'Four Nations: Interconnected World Economy', 'four-nations-interconnected-world', 'A three-quarter deterministic four-country League scenario covering domestic coordination, trade, commodity markets, currencies, capital flows and global shocks.', 'league_world', 'published',
  jsonb_build_object('version', 1, 'numberOfCountries', 4, 'numberOfRounds', 3, 'roundDurationSeconds', null, 'enabledAgreements', jsonb_build_array('trade', 'energy_supply', 'technology_partnership'), 'enabledMarkets', jsonb_build_array('energy', 'food', 'manufactured_goods', 'technology_services'), 'scoringWeights', jsonb_build_object('domesticEconomicPerformance',25,'institutionalGovernance',20,'internationalEconomicPosition',15,'crisisResilience',20,'longTermDevelopment',10,'globalContribution',10), 'assumptions', jsonb_build_array('Deterministic world clearing', 'No opening country has a structural advantage above 12 percent')),
  (select user_id from public.profiles where platform_role = 'platform_admin' order by created_at limit 1), timezone('utc', now())
where not exists(select 1 from public.scenario_definitions where slug = 'four-nations-interconnected-world');

insert into public.country_templates(scenario_id, slug, name, specialisation, config, balance_score)
select s.id, v.slug, v.name, v.specialisation, v.config::jsonb, v.balance_score
from public.scenario_definitions s
cross join (values
  ('techoria', 'Techoria', 'Technology and R&D', '{"sectorAdvantages":{"technology":8},"commodityAdvantages":{"technology_services":8},"vulnerabilities":{"interestRateSensitivity":7,"skilledLabourCostPressure":5},"productivityModifier":8,"fiscalModifier":0,"tradeModifier":2,"resourceModifier":0,"capitalAttractionModifier":4}', 104::numeric),
  ('manufactura', 'Manufactura', 'Manufacturing and exports', '{"sectorAdvantages":{"manufacturing":9},"commodityAdvantages":{"manufactured_goods":9},"vulnerabilities":{"importedEnergyDependency":8,"globalDemandSensitivity":6},"productivityModifier":2,"fiscalModifier":0,"tradeModifier":7,"resourceModifier":0,"capitalAttractionModifier":0}', 103::numeric),
  ('greenovia', 'Greenovia', 'Green transition', '{"sectorAdvantages":{"energy":8},"commodityAdvantages":{"energy":8},"vulnerabilities":{"shortRunInvestmentCost":6,"initialFiscalPressure":5},"productivityModifier":3,"fiscalModifier":-3,"tradeModifier":1,"resourceModifier":7,"capitalAttractionModifier":1}', 102::numeric),
  ('agritania', 'Agritania', 'Agriculture and land resources', '{"sectorAdvantages":{"services":1},"commodityAdvantages":{"food":9},"vulnerabilities":{"climateVulnerability":7,"productivityCeiling":5},"productivityModifier":-2,"fiscalModifier":1,"tradeModifier":4,"resourceModifier":8,"capitalAttractionModifier":-1}', 101::numeric)
) as v(slug, name, specialisation, config, balance_score)
where s.slug = 'four-nations-interconnected-world'
on conflict (scenario_id, slug) do update set name = excluded.name, specialisation = excluded.specialisation, config = excluded.config, balance_score = excluded.balance_score;

insert into public.competitions(scenario_id, name, description, status, current_round, round_duration_seconds, leaderboard_visibility, config, created_by)
select s.id, 'EconMind Global League', 'A long-running four-nation League competition. Directors manually advance each asynchronous quarter after all countries finalise.', 'registration', 1, null, 'after_round', jsonb_build_object('countryAssignment', 'manual', 'minimumTeamSize', 1, 'maximumTeamSize', 20, 'observerAccess', 'authenticated_public', 'defaultCompetition', true), (select user_id from public.profiles where platform_role = 'platform_admin' order by created_at limit 1)
from public.scenario_definitions s where s.slug = 'four-nations-interconnected-world'
on conflict (name) do nothing;

insert into public.competition_countries(competition_id, country_template_id, display_name, status)
select c.id, ct.id, ct.name, 'unassigned'
from public.competitions c join public.scenario_definitions s on s.id = c.scenario_id join public.country_templates ct on ct.scenario_id = s.id
where c.name = 'EconMind Global League'
on conflict (competition_id, country_template_id) do nothing;

insert into public.competition_rounds(competition_id, round_number, status)
select c.id, r.round_number, case when r.round_number = 1 then 'pending' else 'pending' end
from public.competitions c cross join (values (1), (2), (3)) as r(round_number)
where c.name = 'EconMind Global League'
on conflict (competition_id, round_number) do nothing;
