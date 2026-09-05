-- A participant can now hold more than one cabinet appointment. Keep the
-- participant record as the room identity and move each appointment into its
-- own row so policies, trade rights and releases remain office-specific.
create table if not exists public.live_world_seat_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_world_rooms(id) on delete cascade,
  participant_id uuid not null references public.live_world_participants(id) on delete cascade,
  country_key text not null check (country_key in ('aurora', 'borealis', 'cyrenia', 'demeria')),
  role_key text not null check (role_key in ('central_bank_governor', 'finance_domestic_minister', 'trade_industry_investment_minister', 'labour_social_development_minister', 'energy_climate_minister')),
  draft_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_policy) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(room_id, country_key, role_key),
  unique(participant_id, country_key, role_key)
);

insert into public.live_world_seat_assignments(room_id, participant_id, country_key, role_key, draft_policy)
select room_id, id, country_key, role_key, draft_policy
from public.live_world_participants
where country_key is not null and role_key is not null
on conflict (room_id, country_key, role_key) do nothing;

create table if not exists public.live_world_sanctions (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_world_rooms(id) on delete cascade,
  initiator_country_key text not null check (initiator_country_key in ('aurora', 'borealis', 'cyrenia', 'demeria')),
  target_country_key text not null check (target_country_key in ('aurora', 'borealis', 'cyrenia', 'demeria') and target_country_key <> initiator_country_key),
  tariff_rate integer not null check (tariff_rate between 1 and 40),
  status text not null default 'active' check (status in ('active', 'revoked')),
  imposed_by uuid not null references public.live_world_participants(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(room_id, initiator_country_key, target_country_key)
);

create table if not exists public.live_world_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_world_rooms(id) on delete cascade,
  participant_id uuid not null references public.live_world_participants(id) on delete cascade,
  country_key text check (country_key is null or country_key in ('aurora', 'borealis', 'cyrenia', 'demeria')),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.live_world_events add column if not exists details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object');
alter table public.live_world_seat_assignments enable row level security;
alter table public.live_world_sanctions enable row level security;
alter table public.live_world_messages enable row level security;

-- PostgreSQL does not permit CREATE OR REPLACE to change a function's return
-- type. The previous implementation returned a participant; appointments now
-- return their own assignment row.
drop function if exists public.claim_live_world_seat(uuid, text, text);

create or replace function public.claim_live_world_seat(p_room_id uuid, p_country_key text, p_role_key text)
returns public.live_world_seat_assignments language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
declare assignment_row public.live_world_seat_assignments%rowtype;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  if room_row.status <> 'waiting' then raise exception 'Seats are locked after the room starts'; end if;
  if p_country_key not in ('aurora', 'borealis', 'cyrenia', 'demeria') or p_role_key not in ('central_bank_governor', 'finance_domestic_minister', 'trade_industry_investment_minister', 'labour_social_development_minister', 'energy_climate_minister') then raise exception 'Invalid Live World seat'; end if;
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if not found or participant_row.access_type <> 'player' then raise exception 'Only a player may claim a seat'; end if;
  insert into public.live_world_seat_assignments(room_id, participant_id, country_key, role_key)
  values(p_room_id, participant_row.id, p_country_key, p_role_key)
  returning * into assignment_row;
  update public.live_world_participants set last_seen_at = timezone('utc', now()) where id = participant_row.id;
  insert into public.live_world_events(room_id, country_key, event_type, message)
  values(p_room_id, p_country_key, 'seat_claimed', participant_row.display_name || ' took the ' || replace(p_role_key, '_', ' ') || ' office in ' || initcap(p_country_key) || '.');
  return assignment_row;
exception when unique_violation then raise exception 'This cabinet office was just claimed by another participant';
end;
$$;

create or replace function public.release_live_world_seat(p_room_id uuid, p_country_key text, p_role_key text)
returns void language plpgsql security definer set search_path = public
as $$
declare room_status text;
begin
  select status into room_status from public.live_world_rooms where id = p_room_id for update;
  if room_status is distinct from 'waiting' then raise exception 'Seats are locked after the room starts'; end if;
  delete from public.live_world_seat_assignments a using public.live_world_participants p
  where a.room_id = p_room_id and a.country_key = p_country_key and a.role_key = p_role_key
    and a.participant_id = p.id and p.auth_user_id = auth.uid() and p.access_type = 'player';
  if not found then raise exception 'That cabinet office is not assigned to you'; end if;
end;
$$;

create or replace function public.save_live_world_draft(p_room_id uuid, p_country_key text, p_role_key text, p_policy jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare assignment_row public.live_world_seat_assignments%rowtype;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found or not public.live_world_room_active(room_row) then raise exception 'Drafting is available only while the room is live'; end if;
  select a.* into assignment_row from public.live_world_seat_assignments a join public.live_world_participants p on p.id = a.participant_id
  where a.room_id = p_room_id and a.country_key = p_country_key and a.role_key = p_role_key and p.auth_user_id = auth.uid() for update;
  if not found then raise exception 'This cabinet appointment is required'; end if;
  if not public.live_world_policy_allowed(p_role_key, p_policy) then raise exception 'This office may only save its own valid policy controls'; end if;
  update public.live_world_seat_assignments set draft_policy = p_policy, updated_at = timezone('utc', now()) where id = assignment_row.id;
end;
$$;

create or replace function public.publish_live_world_policy(p_room_id uuid, p_country_key text, p_role_key text)
returns void language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare assignment_row public.live_world_seat_assignments%rowtype;
declare participant_name text;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found or not public.live_world_room_active(room_row) then raise exception 'Publishing is available only while the room is live'; end if;
  select a.*, p.display_name into assignment_row, participant_name from public.live_world_seat_assignments a join public.live_world_participants p on p.id = a.participant_id
  where a.room_id = p_room_id and a.country_key = p_country_key and a.role_key = p_role_key and p.auth_user_id = auth.uid() for update;
  if not found then raise exception 'This cabinet appointment is required'; end if;
  update public.live_world_rooms set state = jsonb_set(jsonb_set(state, array['publishedPolicies', p_country_key], coalesce(state #> array['publishedPolicies', p_country_key], '{}'::jsonb), true), array['publishedPolicies', p_country_key, p_role_key], assignment_row.draft_policy, true) where id = p_room_id;
  insert into public.live_world_events(room_id, country_key, event_type, message)
  values(p_room_id, p_country_key, 'policy_published', participant_name || ' published a policy package for ' || initcap(p_country_key) || '.');
end;
$$;

create or replace function public.propose_live_world_agreement(p_room_id uuid, p_country_key text, p_receiver_country_key text, p_depth text)
returns public.live_world_agreements language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
declare agreement_row public.live_world_agreements%rowtype;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found or not public.live_world_room_active(room_row) then raise exception 'Trade proposals are available only while the room is live'; end if;
  select p.* into participant_row from public.live_world_participants p join public.live_world_seat_assignments a on a.participant_id = p.id
  where a.room_id = p_room_id and a.country_key = p_country_key and a.role_key = 'trade_industry_investment_minister' and p.auth_user_id = auth.uid() for update;
  if not found then raise exception 'Only the Trade, Industry & Investment Minister may propose an agreement'; end if;
  if p_receiver_country_key not in ('aurora', 'borealis', 'cyrenia', 'demeria') or p_receiver_country_key = p_country_key or p_depth not in ('limited', 'standard', 'deep') then raise exception 'Invalid agreement proposal'; end if;
  insert into public.live_world_agreements(room_id, proposer_country_key, receiver_country_key, depth, proposed_by) values(p_room_id, p_country_key, p_receiver_country_key, p_depth, participant_row.id) returning * into agreement_row;
  insert into public.live_world_events(room_id, country_key, event_type, message) values(p_room_id, p_country_key, 'trade_proposed', initcap(p_country_key) || ' proposed a ' || p_depth || ' agreement to ' || initcap(p_receiver_country_key) || '.');
  return agreement_row;
end;
$$;

create or replace function public.decide_live_world_agreement(p_agreement_id uuid, p_country_key text, p_accept boolean)
returns public.live_world_agreements language plpgsql security definer set search_path = public
as $$
declare agreement_row public.live_world_agreements%rowtype;
declare participant_row public.live_world_participants%rowtype;
declare room_row public.live_world_rooms%rowtype;
begin
  select * into agreement_row from public.live_world_agreements where id = p_agreement_id for update;
  if not found then raise exception 'Agreement proposal not found'; end if;
  select * into room_row from public.live_world_rooms where id = agreement_row.room_id for update;
  if not public.live_world_room_active(room_row) then raise exception 'Trade decisions are available only while the room is live'; end if;
  select p.* into participant_row from public.live_world_participants p join public.live_world_seat_assignments a on a.participant_id = p.id
  where a.room_id = agreement_row.room_id and a.country_key = p_country_key and a.role_key = 'trade_industry_investment_minister' and p.auth_user_id = auth.uid() for update;
  if not found or p_country_key <> agreement_row.receiver_country_key then raise exception 'Only the receiving Trade, Industry & Investment Minister may decide this agreement'; end if;
  if agreement_row.status <> 'proposed' then raise exception 'This agreement has already been decided'; end if;
  update public.live_world_agreements set status = case when p_accept then 'active' else 'rejected' end, decided_by = participant_row.id, decided_at = timezone('utc', now()) where id = agreement_row.id returning * into agreement_row;
  insert into public.live_world_events(room_id, country_key, event_type, message) values(agreement_row.room_id, p_country_key, case when p_accept then 'trade_accepted' else 'trade_rejected' end, initcap(p_country_key) || case when p_accept then ' accepted a trade agreement.' else ' rejected a trade agreement.' end);
  return agreement_row;
end;
$$;

create or replace function public.set_live_world_sanction(p_room_id uuid, p_country_key text, p_target_country_key text, p_tariff_rate integer)
returns void language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found or not public.live_world_room_active(room_row) then raise exception 'Sanctions are available only while the room is live'; end if;
  select p.* into participant_row from public.live_world_participants p join public.live_world_seat_assignments a on a.participant_id = p.id
  where a.room_id = p_room_id and a.country_key = p_country_key and a.role_key = 'trade_industry_investment_minister' and p.auth_user_id = auth.uid() for update;
  if not found then raise exception 'Only the Trade, Industry & Investment Minister may set a tariff sanction'; end if;
  if p_target_country_key not in ('aurora', 'borealis', 'cyrenia', 'demeria') or p_target_country_key = p_country_key then raise exception 'Choose another country for a sanction'; end if;
  if p_tariff_rate between 1 and 40 then
    insert into public.live_world_sanctions(room_id, initiator_country_key, target_country_key, tariff_rate, status, imposed_by)
    values(p_room_id, p_country_key, p_target_country_key, p_tariff_rate, 'active', participant_row.id)
    on conflict(room_id, initiator_country_key, target_country_key) do update set tariff_rate = excluded.tariff_rate, status = 'active', imposed_by = excluded.imposed_by, updated_at = timezone('utc', now());
    insert into public.live_world_events(room_id, country_key, event_type, message) values(p_room_id, p_country_key, 'sanction_imposed', initcap(p_country_key) || ' imposed a ' || p_tariff_rate || '% tariff on ' || initcap(p_target_country_key) || '.');
  elsif p_tariff_rate = 0 then
    update public.live_world_sanctions set status = 'revoked', updated_at = timezone('utc', now()) where room_id = p_room_id and initiator_country_key = p_country_key and target_country_key = p_target_country_key;
    insert into public.live_world_events(room_id, country_key, event_type, message) values(p_room_id, p_country_key, 'sanction_revoked', initcap(p_country_key) || ' revoked its tariff on ' || initcap(p_target_country_key) || '.');
  else raise exception 'Tariff rate must be between 0 and 40'; end if;
end;
$$;

create or replace function public.post_live_world_message(p_room_id uuid, p_body text, p_country_key text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare participant_row public.live_world_participants%rowtype;
begin
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Enter this Live World room first'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'Messages must contain between 1 and 500 characters'; end if;
  if p_country_key is not null and not exists(select 1 from public.live_world_seat_assignments where room_id = p_room_id and participant_id = participant_row.id and country_key = p_country_key) then raise exception 'You may only speak for a country you represent'; end if;
  insert into public.live_world_messages(room_id, participant_id, country_key, body) values(p_room_id, participant_row.id, p_country_key, trim(p_body));
end;
$$;

create or replace function public.inject_live_world_crisis(p_room_id uuid, p_crisis_key text, p_active boolean default true)
returns void language plpgsql security definer set search_path = public
as $$
declare crisis_details jsonb;
begin
  if not public.can_administer_live_world_room(p_room_id) then raise exception 'Live World administrator access is required'; end if;
  if p_crisis_key not in ('energy-price-spike', 'capital-flight', 'supply-chain-disruption', 'commodity-boom') then raise exception 'Invalid crisis'; end if;
  crisis_details := case p_crisis_key
    when 'energy-price-spike' then jsonb_build_object('title', 'Energy price spike', 'description', 'A sudden fuel-cost shock is spreading through import-dependent economies.', 'impacts', jsonb_build_array('Higher household and business costs', 'Pressure on prices and public budgets', 'Lower activity in energy-dependent sectors'), 'responseHint', 'Coordinate energy reserves, efficiency and targeted fiscal support.')
    when 'capital-flight' then jsonb_build_object('title', 'Capital flight', 'Investors are rapidly withdrawing funds from exposed markets.', 'impacts', jsonb_build_array('Tighter credit conditions', 'Stress on financial stability', 'Weaker investment and confidence'), 'responseHint', 'Balance liquidity support, reserve requirements and credible fiscal policy.')
    when 'supply-chain-disruption' then jsonb_build_object('title', 'Supply-chain disruption', 'Trade routes and intermediate inputs are unexpectedly constrained.', 'impacts', jsonb_build_array('Export and manufacturing delays', 'Higher input prices', 'Employment pressure in trade-linked sectors'), 'responseHint', 'Consider trade cooperation, targeted support and logistics resilience.')
    else jsonb_build_object('title', 'Commodity boom', 'Commodity demand and export prices have surged unexpectedly.', 'impacts', jsonb_build_array('A windfall for resource exporters', 'Higher import costs for some partners', 'Fiscal and price-management trade-offs'), 'responseHint', 'Use temporary gains carefully while protecting price stability.')
  end;
  insert into public.live_world_crises(room_id, crisis_key, active, activated_by, resolved_at) values(p_room_id, p_crisis_key, p_active, auth.uid(), case when p_active then null else timezone('utc', now()) end)
  on conflict(room_id, crisis_key) do update set active = excluded.active, activated_by = excluded.activated_by, activated_at = timezone('utc', now()), resolved_at = case when excluded.active then null else timezone('utc', now()) end;
  insert into public.live_world_events(room_id, event_type, message, details) values(p_room_id, case when p_active then 'crisis_activated' else 'crisis_resolved' end, replace(initcap(replace(p_crisis_key, '-', ' ')), ' ', ' ') || case when p_active then ' is active.' else ' is resolved.' end, crisis_details);
end;
$$;

create or replace function public.get_live_world_view(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
declare effective_status text;
begin
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid();
  if not found and not public.is_platform_admin(auth.uid()) then raise exception 'Enter this Live World room with an invitation code first'; end if;
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  if room_row.status = 'live' and not public.live_world_room_active(room_row) then update public.live_world_rooms set status = 'ended', ended_at = coalesce(ended_at, timezone('utc', now())), remaining_seconds = 0 where id = p_room_id returning * into room_row; insert into public.live_world_events(room_id, event_type, message) values(p_room_id, 'room_ended', 'The Live World timer ended and the final leaderboard is frozen.'); end if;
  effective_status := room_row.status;
  perform public.live_world_touch(p_room_id);
  return jsonb_build_object(
    'room', jsonb_build_object('id', room_row.id, 'name', room_row.name, 'status', effective_status, 'durationSeconds', room_row.duration_seconds, 'remainingSeconds', case when room_row.status = 'live' and room_row.started_at is not null then greatest(0, ceil(extract(epoch from (room_row.started_at + make_interval(secs => room_row.remaining_seconds) - timezone('utc', now()))))::integer) else room_row.remaining_seconds end, 'timerEndsAt', case when room_row.status = 'live' and room_row.started_at is not null then room_row.started_at + make_interval(secs => room_row.remaining_seconds) else null end, 'participantCapacity', room_row.participant_capacity, 'startedAt', room_row.started_at, 'endedAt', room_row.ended_at, 'createdAt', room_row.created_at),
    'access', jsonb_build_object('type', case when public.is_platform_admin(auth.uid()) then 'admin' else participant_row.access_type end, 'displayName', coalesce(participant_row.display_name, 'Platform Admin'), 'countryId', null, 'role', null),
    'seats', coalesce((select jsonb_agg(jsonb_build_object('countryId', a.country_key, 'role', a.role_key, 'displayName', p.display_name, 'mine', p.auth_user_id = auth.uid()) order by a.country_key, a.role_key) from public.live_world_seat_assignments a join public.live_world_participants p on p.id = a.participant_id where a.room_id = p_room_id), '[]'::jsonb),
    'state', jsonb_build_object('publishedPolicies', coalesce(room_row.state -> 'publishedPolicies', '{}'::jsonb), 'agreements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'proposerCountry', a.proposer_country_key, 'receiverCountry', a.receiver_country_key, 'depth', a.depth, 'status', a.status, 'createdAt', a.created_at, 'decidedAt', a.decided_at) order by a.created_at desc) from public.live_world_agreements a where a.room_id = p_room_id), '[]'::jsonb), 'crises', coalesce((select jsonb_agg(jsonb_build_object('id', c.crisis_key, 'active', c.active) order by c.activated_at desc) from public.live_world_crises c where c.room_id = p_room_id), '[]'::jsonb), 'sanctions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'initiatorCountry', s.initiator_country_key, 'targetCountry', s.target_country_key, 'tariffRate', s.tariff_rate, 'status', s.status, 'createdAt', s.created_at) order by s.updated_at desc) from public.live_world_sanctions s where s.room_id = p_room_id), '[]'::jsonb)),
    'messages', coalesce((select jsonb_agg(message_value order by created_at asc) from (select jsonb_build_object('id', m.id, 'countryId', m.country_key, 'displayName', p.display_name, 'body', m.body, 'createdAt', m.created_at) message_value, m.created_at from public.live_world_messages m join public.live_world_participants p on p.id = m.participant_id where m.room_id = p_room_id order by m.created_at desc limit 80) recent_messages), '[]'::jsonb),
    'drafts', case when public.is_platform_admin(auth.uid()) then coalesce((select jsonb_object_agg(country_key, role_drafts) from (select country_key, jsonb_object_agg(role_key, draft_policy) role_drafts from public.live_world_seat_assignments where room_id = p_room_id group by country_key) grouped), '{}'::jsonb) else coalesce((select jsonb_object_agg(country_key, role_drafts) from (select a.country_key, jsonb_object_agg(a.role_key, a.draft_policy) role_drafts from public.live_world_seat_assignments a where a.room_id = p_room_id and a.participant_id = participant_row.id group by a.country_key) grouped), '{}'::jsonb) end,
    'events', coalesce((select jsonb_agg(event_value order by created_at desc) from (select jsonb_build_object('id', e.id, 'type', e.event_type, 'message', e.message, 'countryId', e.country_key, 'createdAt', e.created_at, 'details', e.details) event_value, e.created_at from public.live_world_events e where e.room_id = p_room_id order by e.created_at desc limit 40) feed), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.claim_live_world_seat(uuid, text, text), public.release_live_world_seat(uuid, text, text), public.save_live_world_draft(uuid, text, text, jsonb), public.publish_live_world_policy(uuid, text, text), public.propose_live_world_agreement(uuid, text, text, text), public.decide_live_world_agreement(uuid, text, boolean), public.set_live_world_sanction(uuid, text, text, integer), public.post_live_world_message(uuid, text, text), public.inject_live_world_crisis(uuid, text, boolean), public.get_live_world_view(uuid) to authenticated;
