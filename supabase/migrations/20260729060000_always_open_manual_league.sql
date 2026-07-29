-- League simplification: ordinary country work is always open.
-- Competition and round status remain as an audit trail for settlement and
-- released history, never as a browser-facing permission gate.

create or replace function public.can_edit_institution_draft(
  p_competition_id uuid,
  p_country_id uuid,
  p_institution text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_competition_director(p_competition_id, p_user_id)
    or exists(
      select 1
      from public.competition_roles role
      where role.competition_id = p_competition_id
        and role.country_id = p_country_id
        and role.user_id = p_user_id
        and role.role_type = p_institution
    )
$$;

-- Individual users may join open-world roles at any point. Legacy school-team
-- competitions still require membership of the assigned team.
create or replace function public.claim_competition_role(
  p_competition_id uuid,
  p_country_id uuid,
  p_role_type text,
  p_is_captain boolean default false
)
returns public.competition_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  country_row public.competition_countries%rowtype;
  competition_config jsonb;
  created public.competition_roles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_type not in ('country_captain', 'central_bank_governor', 'economic_policy_minister', 'trade_minister', 'investment_resources_minister') then
    raise exception 'Invalid competition role';
  end if;

  select country.*
    into country_row
  from public.competition_countries country
  where country.id = p_country_id
    and country.competition_id = p_competition_id;
  if not found then raise exception 'Country is not part of this competition'; end if;

  select config into competition_config
  from public.competitions
  where id = p_competition_id;
  if not coalesce((competition_config ->> 'openIndividualRegistration')::boolean, false)
     and (country_row.assigned_team_id is null or not public.is_team_member(country_row.assigned_team_id, auth.uid())) then
    raise exception 'Only a member of the assigned team can claim this role';
  end if;

  insert into public.competition_roles(competition_id, country_id, user_id, role_type, is_captain, assigned_by)
  values(p_competition_id, p_country_id, auth.uid(), p_role_type, p_is_captain or p_role_type = 'country_captain', auth.uid())
  returning * into created;

  perform public.write_competition_audit(
    p_competition_id,
    'role_claimed',
    'competition_role',
    created.id,
    jsonb_build_object('country_id', p_country_id, 'role_type', p_role_type, 'open_individual_registration', coalesce((competition_config ->> 'openIndividualRegistration')::boolean, false))
  );
  return created;
exception when unique_violation then
  raise exception 'This role has already been claimed';
end;
$$;

create or replace function public.save_institution_draft(
  p_competition_id uuid,
  p_round_id uuid,
  p_country_id uuid,
  p_institution_type text,
  p_draft_state jsonb
)
returns public.institution_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_row public.institution_drafts%rowtype;
begin
  if auth.uid() is null
     or not public.can_edit_institution_draft(p_competition_id, p_country_id, p_institution_type, auth.uid()) then
    raise exception 'You can only edit your own assigned institution draft';
  end if;
  if jsonb_typeof(p_draft_state) <> 'object' then raise exception 'Draft state must be an object'; end if;
  if not exists(
    select 1
    from public.competition_rounds
    where id = p_round_id
      and competition_id = p_competition_id
  ) then
    raise exception 'Competition round not found';
  end if;

  insert into public.institution_drafts(competition_id, round_id, country_id, institution_type, created_by, draft_state, status)
  values(p_competition_id, p_round_id, p_country_id, p_institution_type, auth.uid(), p_draft_state, 'draft')
  on conflict (round_id, country_id, institution_type) do update
    set draft_state = excluded.draft_state,
        updated_at = timezone('utc', now())
    where public.institution_drafts.status in ('draft', 'unlocked')
      and public.institution_drafts.created_by = auth.uid()
  returning * into draft_row;

  if draft_row.id is null then raise exception 'A locked or settled draft cannot be changed'; end if;
  return draft_row;
end;
$$;

create or replace function public.finalise_country_submission(
  p_competition_id uuid,
  p_round_id uuid,
  p_country_id uuid,
  p_policy_package jsonb,
  p_agreement_actions jsonb default '[]'::jsonb
)
returns public.country_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  submission public.country_submissions%rowtype;
  locked_count integer;
  server_policy_package jsonb;
begin
  if auth.uid() is null
     or not public.can_finalise_country_submission(p_competition_id, p_country_id, auth.uid()) then
    raise exception 'Only the country captain or competition director can finalise this country';
  end if;
  if jsonb_typeof(p_policy_package) <> 'object' or jsonb_typeof(p_agreement_actions) <> 'array' then
    raise exception 'Submission payload has an invalid shape';
  end if;
  if not exists(
    select 1
    from public.competition_rounds
    where id = p_round_id
      and competition_id = p_competition_id
  ) then
    raise exception 'Competition round not found';
  end if;

  select count(*) into locked_count
  from public.institution_drafts
  where competition_id = p_competition_id
    and round_id = p_round_id
    and country_id = p_country_id
    and status = 'locked';
  if locked_count < 4 then raise exception 'All four institution drafts must be locked before country finalisation'; end if;

  select jsonb_build_object('decisions', jsonb_object_agg(institution_type, locked_state))
    into server_policy_package
  from public.institution_drafts
  where competition_id = p_competition_id
    and round_id = p_round_id
    and country_id = p_country_id
    and status = 'locked';
  if server_policy_package is null then raise exception 'No locked institution decisions were found'; end if;

  insert into public.country_submissions(competition_id, round_id, country_id, policy_package, agreement_actions, status, finalised_by, finalised_at)
  values(p_competition_id, p_round_id, p_country_id, server_policy_package, p_agreement_actions, 'finalised', auth.uid(), timezone('utc', now()))
  on conflict (round_id, country_id) do update
    set policy_package = excluded.policy_package,
        agreement_actions = excluded.agreement_actions,
        status = 'finalised',
        finalised_by = auth.uid(),
        finalised_at = timezone('utc', now())
    where public.country_submissions.status = 'draft'
  returning * into submission;

  if submission.id is null then raise exception 'This country submission is already locked'; end if;
  perform public.write_competition_audit(p_competition_id, 'country_finalised', 'country_submission', submission.id, jsonb_build_object('country_id', p_country_id));
  return submission;
end;
$$;

create or replace function public.propose_international_agreement(
  p_competition_id uuid,
  p_proposer_country_id uuid,
  p_agreement_type text,
  p_terms jsonb,
  p_participant_country_ids uuid[],
  p_required_roles text[],
  p_starts_round smallint,
  p_ends_round smallint
)
returns public.international_agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.international_agreements%rowtype;
  participant_country uuid;
  required_role text;
begin
  if p_agreement_type not in ('trade', 'energy_supply', 'investment', 'technology_partnership', 'currency_swap', 'climate_fund') then
    raise exception 'Invalid agreement type';
  end if;
  if jsonb_typeof(p_terms) <> 'object'
     or coalesce(array_length(p_participant_country_ids, 1), 0) < 1
     or coalesce(array_length(p_required_roles, 1), 0) < 1 then
    raise exception 'Agreement terms, countries and required roles are required';
  end if;
  if not (
    public.is_competition_director(p_competition_id, auth.uid())
    or exists(
      select 1
      from public.competition_roles role
      where role.competition_id = p_competition_id
        and role.country_id = p_proposer_country_id
        and role.user_id = auth.uid()
        and role.role_type = any(p_required_roles)
    )
  ) then
    raise exception 'You do not hold a required institution role for this proposal';
  end if;
  if exists(
    select 1
    from unnest(p_required_roles) as role_name
    where role_name not in ('central_bank_governor', 'economic_policy_minister', 'trade_minister', 'investment_resources_minister')
  ) then
    raise exception 'Invalid required institution role';
  end if;
  if exists(
    select 1
    from unnest(p_participant_country_ids) as country_id
    where not exists(
      select 1
      from public.competition_countries country
      where country.id = country_id
        and country.competition_id = p_competition_id
    )
  ) then
    raise exception 'Every agreement country must belong to this competition';
  end if;

  insert into public.international_agreements(
    competition_id,
    agreement_type,
    proposer_country_id,
    status,
    terms,
    starts_round,
    ends_round
  )
  values(
    p_competition_id,
    p_agreement_type,
    p_proposer_country_id,
    'proposed',
    p_terms,
    p_starts_round,
    p_ends_round
  )
  returning * into created;

  for participant_country in
    select distinct participant_id
    from unnest(array_append(p_participant_country_ids, p_proposer_country_id)) as participant_country_source(participant_id)
  loop
    foreach required_role in array p_required_roles loop
      insert into public.agreement_participants(agreement_id, country_id, required_role)
      values(created.id, participant_country, required_role)
      on conflict (agreement_id, country_id, required_role) do nothing;
    end loop;
  end loop;

  perform public.write_competition_audit(
    p_competition_id,
    'agreement_proposed',
    'international_agreement',
    created.id,
    jsonb_build_object('type', p_agreement_type, 'starts_round', p_starts_round)
  );
  return created;
end;
$$;

create or replace function public.claim_world_processing(
  p_competition_id uuid,
  p_round_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  round_row public.competition_rounds%rowtype;
  expected_countries integer;
  finalised_countries integer;
begin
  if not public.is_competition_director(p_competition_id, auth.uid()) then
    raise exception 'Competition director permission required';
  end if;

  select * into round_row
  from public.competition_rounds
  where id = p_round_id
    and competition_id = p_competition_id
  for update;
  if not found then raise exception 'Competition round not found'; end if;
  if round_row.status in ('processed', 'published') then
    return jsonb_build_object('claimed', false, 'reason', 'already_processed');
  end if;
  if round_row.status = 'processing' and round_row.processing_idempotency_key = p_idempotency_key then
    return jsonb_build_object('claimed', false, 'reason', 'already_processing');
  end if;
  if round_row.status = 'processing' and round_row.processing_idempotency_key <> p_idempotency_key then
    raise exception 'World processing is already locked';
  end if;

  select count(*) into expected_countries
  from public.competition_countries
  where competition_id = p_competition_id;
  select count(*) into finalised_countries
  from public.country_submissions
  where competition_id = p_competition_id
    and round_id = p_round_id
    and status = 'finalised';
  if expected_countries = 0 or finalised_countries <> expected_countries then
    raise exception 'All % countries must finalise a submission before manual settlement', expected_countries;
  end if;

  update public.competition_rounds
  set status = 'processing',
      processing_started_at = coalesce(processing_started_at, timezone('utc', now())),
      processing_idempotency_key = p_idempotency_key,
      processing_error = null
  where id = p_round_id;
  perform public.write_competition_audit(
    p_competition_id,
    'world_processing_claimed',
    'competition_round',
    p_round_id,
    jsonb_build_object('idempotency_key', p_idempotency_key, 'manual_settlement', true)
  );
  return jsonb_build_object('claimed', true, 'round_id', p_round_id);
end;
$$;

create or replace function public.publish_competition_round(
  p_competition_id uuid,
  p_round_id uuid
)
returns public.competition_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  published public.competition_rounds%rowtype;
  next_round smallint;
begin
  if not public.is_competition_director(p_competition_id, auth.uid()) then
    raise exception 'Competition director permission required';
  end if;

  update public.competition_rounds
  set status = 'published',
      published_at = coalesce(published_at, timezone('utc', now()))
  where id = p_round_id
    and competition_id = p_competition_id
    and status = 'processed'
  returning * into published;
  if published.id is null then raise exception 'Only a processed round can be published'; end if;

  select round_number into next_round
  from public.competition_rounds
  where competition_id = p_competition_id
    and round_number > published.round_number
  order by round_number
  limit 1;

  update public.competitions
  set current_round = coalesce(next_round, current_round),
      status = case when next_round is null then 'completed' else 'registration' end,
      completed_at = case when next_round is null then timezone('utc', now()) else completed_at end,
      state_changed_at = timezone('utc', now())
  where id = p_competition_id;

  insert into public.competition_events(competition_id, round_id, event_type, payload, created_by)
  values(
    p_competition_id,
    p_round_id,
    'round_published',
    jsonb_build_object('round_number', published.round_number, 'next_round', next_round, 'manual_settlement', true),
    auth.uid()
  );
  perform public.write_competition_audit(p_competition_id, 'round_published', 'competition_round', p_round_id, jsonb_build_object('next_round', next_round));
  return published;
end;
$$;

grant execute on function
  public.can_edit_institution_draft(uuid, uuid, text, uuid),
  public.claim_competition_role(uuid, uuid, text, boolean),
  public.save_institution_draft(uuid, uuid, uuid, text, jsonb),
  public.finalise_country_submission(uuid, uuid, uuid, jsonb, jsonb),
  public.propose_international_agreement(uuid, uuid, text, jsonb, uuid[], text[], smallint, smallint),
  public.claim_world_processing(uuid, uuid, text),
  public.publish_competition_round(uuid, uuid)
to authenticated;
