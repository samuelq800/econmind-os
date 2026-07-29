-- Teacher administrators (platform administrators) can operate every country
-- panel while a planning round is open. Ordinary participants remain limited to
-- the institution role they personally hold.

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
      join public.competitions competition on competition.id = role.competition_id
      where role.competition_id = p_competition_id
        and role.country_id = p_country_id
        and role.user_id = p_user_id
        and role.role_type = p_institution
        and competition.status in ('internal_planning', 'negotiation', 'submission_open')
    )
$$;

create or replace function public.approve_agreement_participant(p_participant_id uuid, p_approval text)
returns public.agreement_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  participant public.agreement_participants%rowtype;
  agreement public.international_agreements%rowtype;
begin
  if p_approval not in ('approved', 'rejected') then
    raise exception 'Invalid approval status';
  end if;

  select * into participant
  from public.agreement_participants
  where id = p_participant_id
  for update;

  select * into agreement
  from public.international_agreements
  where id = participant.agreement_id;

  if not found or not (
    public.is_competition_director(agreement.competition_id, auth.uid())
    or exists(
      select 1
      from public.competition_roles role
      where role.competition_id = agreement.competition_id
        and role.country_id = participant.country_id
        and role.user_id = auth.uid()
        and role.role_type = participant.required_role
    )
  ) then
    raise exception 'Only the required institution role or a teacher administrator can approve this agreement';
  end if;

  update public.agreement_participants
  set approval_status = p_approval,
      approved_by = auth.uid(),
      approved_at = timezone('utc', now())
  where id = p_participant_id
  returning * into participant;

  if p_approval = 'approved'
     and not exists(
       select 1
       from public.agreement_participants
       where agreement_id = agreement.id
         and approval_status <> 'approved'
     ) then
    update public.international_agreements
    set status = 'accepted'
    where id = agreement.id
      and status in ('draft', 'proposed', 'countered');
  end if;

  perform public.write_competition_audit(
    agreement.competition_id,
    'agreement_approval',
    'agreement_participant',
    participant.id,
    jsonb_build_object('agreement_id', agreement.id, 'approval', p_approval)
  );
  return participant;
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
  if not exists(
    select 1
    from public.competitions
    where id = p_competition_id
      and status in ('negotiation', 'submission_open')
  ) then
    raise exception 'Agreements can only be proposed during negotiation or submission';
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

grant execute on function public.can_edit_institution_draft(uuid, uuid, text, uuid),
  public.approve_agreement_participant(uuid, text),
  public.propose_international_agreement(uuid, uuid, text, jsonb, uuid[], text[], smallint, smallint)
to authenticated;
