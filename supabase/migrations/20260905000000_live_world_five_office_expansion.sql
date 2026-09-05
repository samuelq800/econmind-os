-- Live World now has five independently controlled offices in each of its four
-- countries. A room may admit any number of players up to the 20 available
-- offices; default policies keep vacant offices from blocking a live session.
alter table public.live_world_rooms
  add column if not exists participant_capacity integer not null default 20
  check (participant_capacity between 1 and 20);

alter table public.live_world_participants
  drop constraint if exists live_world_participants_role_key_check;
alter table public.live_world_participants
  add constraint live_world_participants_role_key_check check (
    role_key is null or role_key in (
      'central_bank_governor',
      'finance_domestic_minister',
      'trade_industry_investment_minister',
      'labour_social_development_minister',
      'energy_climate_minister'
    )
  );

create or replace function public.live_world_default_policy(p_role text)
returns jsonb language sql immutable set search_path = public
as $$
  select case p_role
    when 'central_bank_governor' then jsonb_build_object('policy_rate', 5, 'liquidity_support', 8, 'reserve_requirement', 10)
    when 'finance_domestic_minister' then jsonb_build_object('government_spending', 32, 'tax_rate', 22, 'welfare', 14, 'infrastructure', 18)
    when 'trade_industry_investment_minister' then jsonb_build_object('tariff', 8, 'export_support', 10, 'industrial_subsidy', 10, 'fdi_openness', 12)
    when 'labour_social_development_minister' then jsonb_build_object('labour_market_activation', 12, 'skills_investment', 14, 'wage_support', 8)
    when 'energy_climate_minister' then jsonb_build_object('strategic_energy_reserve', 8, 'clean_energy_investment', 16, 'efficiency_standard', 10)
    else '{}'::jsonb
  end
$$;

create or replace function public.live_world_policy_allowed(p_role text, p_policy jsonb)
returns boolean language sql immutable set search_path = public
as $$
  select jsonb_typeof(p_policy) = 'object'
    and not exists(select 1 from jsonb_object_keys(p_policy) key where
      (p_role = 'central_bank_governor' and key not in ('policy_rate', 'liquidity_support', 'reserve_requirement')) or
      (p_role = 'finance_domestic_minister' and key not in ('government_spending', 'tax_rate', 'welfare', 'infrastructure')) or
      (p_role = 'trade_industry_investment_minister' and key not in ('tariff', 'export_support', 'industrial_subsidy', 'fdi_openness')) or
      (p_role = 'labour_social_development_minister' and key not in ('labour_market_activation', 'skills_investment', 'wage_support')) or
      (p_role = 'energy_climate_minister' and key not in ('strategic_energy_reserve', 'clean_energy_investment', 'efficiency_standard')) or
      p_role not in ('central_bank_governor', 'finance_domestic_minister', 'trade_industry_investment_minister', 'labour_social_development_minister', 'energy_climate_minister'))
    and not exists(select 1 from jsonb_each_text(p_policy) entry where entry.value !~ '^-?[0-9]+(\.[0-9]+)?$')
    and public.live_world_policy_value_between(p_policy, 'policy_rate', 0, 15)
    and public.live_world_policy_value_between(p_policy, 'liquidity_support', 0, 30)
    and public.live_world_policy_value_between(p_policy, 'reserve_requirement', 0, 25)
    and public.live_world_policy_value_between(p_policy, 'government_spending', 0, 65)
    and public.live_world_policy_value_between(p_policy, 'tax_rate', 5, 50)
    and public.live_world_policy_value_between(p_policy, 'welfare', 0, 40)
    and public.live_world_policy_value_between(p_policy, 'infrastructure', 0, 50)
    and public.live_world_policy_value_between(p_policy, 'tariff', 0, 40)
    and public.live_world_policy_value_between(p_policy, 'export_support', 0, 30)
    and public.live_world_policy_value_between(p_policy, 'industrial_subsidy', 0, 35)
    and public.live_world_policy_value_between(p_policy, 'fdi_openness', 0, 30)
    and public.live_world_policy_value_between(p_policy, 'labour_market_activation', 0, 40)
    and public.live_world_policy_value_between(p_policy, 'skills_investment', 0, 40)
    and public.live_world_policy_value_between(p_policy, 'wage_support', 0, 30)
    and public.live_world_policy_value_between(p_policy, 'strategic_energy_reserve', 0, 30)
    and public.live_world_policy_value_between(p_policy, 'clean_energy_investment', 0, 45)
    and public.live_world_policy_value_between(p_policy, 'efficiency_standard', 0, 30)
$$;

create or replace function public.live_world_seed_default_policies(p_room_id uuid)
returns integer language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare country_key text;
declare role_key text;
declare seeded integer := 0;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  foreach country_key in array array['aurora', 'borealis', 'cyrenia', 'demeria'] loop
    foreach role_key in array array['central_bank_governor', 'finance_domestic_minister', 'trade_industry_investment_minister', 'labour_social_development_minister', 'energy_climate_minister'] loop
      if room_row.state #> array['publishedPolicies', country_key, role_key] is null then
        room_row.state := jsonb_set(
          jsonb_set(room_row.state, array['publishedPolicies', country_key], coalesce(room_row.state #> array['publishedPolicies', country_key], '{}'::jsonb), true),
          array['publishedPolicies', country_key, role_key], public.live_world_default_policy(role_key), true
        );
        seeded := seeded + 1;
      end if;
    end loop;
  end loop;
  if seeded > 0 then update public.live_world_rooms set state = room_row.state where id = p_room_id; end if;
  return seeded;
end;
$$;

create or replace function public.create_live_world_room(p_name text, p_duration_seconds integer, p_participant_capacity integer)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare created public.live_world_rooms%rowtype;
declare player_code text := public.live_world_code('PLAY');
declare admin_code text := public.live_world_code('ADMIN');
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then raise exception 'Only a Platform Admin can create a Live World room'; end if;
  if p_duration_seconds < 300 or p_duration_seconds > 3600 then raise exception 'Duration must be between 5 and 60 minutes'; end if;
  if p_participant_capacity < 1 or p_participant_capacity > 20 then raise exception 'Player capacity must be between 1 and 20'; end if;
  insert into public.live_world_rooms(name, duration_seconds, remaining_seconds, participant_capacity, player_code_hash, admin_code_hash, created_by)
  values(trim(p_name), p_duration_seconds, p_duration_seconds, p_participant_capacity, encode(extensions.digest(player_code, 'sha256'), 'hex'), encode(extensions.digest(admin_code, 'sha256'), 'hex'), auth.uid())
  returning * into created;
  insert into public.live_world_events(room_id, event_type, message) values(created.id, 'room_created', 'Room created and waiting for participants.');
  return jsonb_build_object('room', jsonb_build_object('id', created.id, 'name', created.name, 'status', created.status, 'durationSeconds', created.duration_seconds, 'participantCapacity', created.participant_capacity, 'createdAt', created.created_at), 'playerCode', player_code, 'adminCode', admin_code);
end;
$$;

create or replace function public.join_live_world_room(p_room_id uuid, p_code text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
declare same_name_row public.live_world_participants%rowtype;
declare code_hash text := encode(extensions.digest(upper(trim(coalesce(p_code, ''))), 'sha256'), 'hex');
declare name_value text := trim(coalesce(p_display_name, ''));
declare name_key text := public.live_world_normalise_name(p_display_name);
declare is_admin_code boolean := false;
declare player_count integer;
begin
  if auth.uid() is null then raise exception 'A temporary room session is required'; end if;
  if char_length(name_value) not between 1 and 48 then raise exception 'Enter a display name between 1 and 48 characters'; end if;
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  is_admin_code := code_hash = room_row.admin_code_hash;
  if not is_admin_code and code_hash <> room_row.player_code_hash then raise exception 'This room code is invalid'; end if;
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if found then update public.live_world_participants set last_seen_at = timezone('utc', now()) where id = participant_row.id; return jsonb_build_object('accessType', participant_row.access_type, 'countryId', participant_row.country_key, 'role', participant_row.role_key); end if;
  select * into same_name_row from public.live_world_participants where room_id = p_room_id and display_name_key = name_key for update;
  if found then update public.live_world_participants set auth_user_id = auth.uid(), last_seen_at = timezone('utc', now()) where id = same_name_row.id returning * into participant_row; return jsonb_build_object('accessType', participant_row.access_type, 'countryId', participant_row.country_key, 'role', participant_row.role_key); end if;
  if not is_admin_code then select count(*) into player_count from public.live_world_participants where room_id = p_room_id and access_type = 'player'; end if;
  insert into public.live_world_participants(room_id, auth_user_id, display_name, display_name_key, access_type)
  values(p_room_id, auth.uid(), name_value, name_key, case when is_admin_code then 'admin' when coalesce(player_count, 0) >= room_row.participant_capacity then 'observer' else 'player' end)
  returning * into participant_row;
  insert into public.live_world_events(room_id, event_type, message) values(p_room_id, case when participant_row.access_type = 'observer' then 'observer_joined' else 'participant_joined' end, participant_row.display_name || case when participant_row.access_type = 'observer' then ' is observing the shared screen.' else ' joined the room.' end);
  return jsonb_build_object('accessType', participant_row.access_type, 'countryId', participant_row.country_key, 'role', participant_row.role_key);
exception when unique_violation then raise exception 'That display name is already in use for this room';
end;
$$;

create or replace function public.claim_live_world_seat(p_room_id uuid, p_country_key text, p_role_key text)
returns public.live_world_participants language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  if room_row.status <> 'waiting' then raise exception 'Seats are locked after the room starts'; end if;
  if p_country_key not in ('aurora', 'borealis', 'cyrenia', 'demeria') or p_role_key not in ('central_bank_governor', 'finance_domestic_minister', 'trade_industry_investment_minister', 'labour_social_development_minister', 'energy_climate_minister') then raise exception 'Invalid Live World seat'; end if;
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if not found or participant_row.access_type <> 'player' then raise exception 'Only a player may claim a seat'; end if;
  if exists(select 1 from public.live_world_participants where room_id = p_room_id and country_key = p_country_key and role_key = p_role_key and id <> participant_row.id) then raise exception 'This seat was just claimed by another participant'; end if;
  update public.live_world_participants set country_key = p_country_key, role_key = p_role_key, last_seen_at = timezone('utc', now()) where id = participant_row.id returning * into participant_row;
  insert into public.live_world_events(room_id, country_key, event_type, message) values(p_room_id, p_country_key, 'seat_claimed', participant_row.display_name || ' took a cabinet seat in ' || initcap(p_country_key) || '.');
  return participant_row;
end;
$$;

create or replace function public.set_live_world_participant_capacity(p_room_id uuid, p_participant_capacity integer)
returns public.live_world_rooms language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare player_count integer;
begin
  if not public.can_administer_live_world_room(p_room_id) then raise exception 'Live World administrator access is required'; end if;
  if p_participant_capacity < 1 or p_participant_capacity > 20 then raise exception 'Player capacity must be between 1 and 20'; end if;
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  if room_row.status <> 'waiting' then raise exception 'Player capacity is locked after the room starts'; end if;
  select count(*) into player_count from public.live_world_participants where room_id = p_room_id and access_type = 'player';
  if p_participant_capacity < player_count then raise exception 'Player capacity cannot be lower than the % players already admitted', player_count; end if;
  update public.live_world_rooms set participant_capacity = p_participant_capacity where id = p_room_id returning * into room_row;
  insert into public.live_world_events(room_id, event_type, message) values(p_room_id, 'player_capacity_updated', 'Player capacity was set to ' || p_participant_capacity || '.');
  return room_row;
end;
$$;

create or replace function public.live_world_set_status(p_room_id uuid, p_status text)
returns public.live_world_rooms language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare defaults_seeded integer := 0;
begin
  if p_status not in ('live', 'paused', 'ended') then raise exception 'Invalid room status'; end if;
  if not public.can_administer_live_world_room(p_room_id) then raise exception 'Live World administrator access is required'; end if;
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  if p_status = 'live' and room_row.status = 'waiting' then
    select public.live_world_seed_default_policies(p_room_id) into defaults_seeded;
    update public.live_world_rooms set status = 'live', started_at = timezone('utc', now()), remaining_seconds = duration_seconds where id = p_room_id returning * into room_row;
  elsif p_status = 'live' and room_row.status = 'paused' then update public.live_world_rooms set status = 'live', started_at = timezone('utc', now()) where id = p_room_id returning * into room_row;
  elsif p_status = 'paused' and room_row.status = 'live' then update public.live_world_rooms set status = 'paused', remaining_seconds = greatest(0, ceil(extract(epoch from (room_row.started_at + make_interval(secs => room_row.remaining_seconds) - timezone('utc', now()))))::integer), started_at = null where id = p_room_id returning * into room_row;
  elsif p_status = 'ended' and room_row.status <> 'ended' then update public.live_world_rooms set status = 'ended', ended_at = timezone('utc', now()), remaining_seconds = 0 where id = p_room_id returning * into room_row;
  else raise exception 'This status transition is not available'; end if;
  insert into public.live_world_events(room_id, event_type, message) values(p_room_id, 'room_' || p_status, case when p_status = 'live' and defaults_seeded > 0 then 'The Live World timer is running. Default policies are published for every office.' when p_status = 'live' then 'The Live World timer is running.' when p_status = 'paused' then 'The Live World is paused.' else 'The Live World has ended.' end);
  return room_row;
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
    'access', jsonb_build_object('type', case when public.is_platform_admin(auth.uid()) then 'admin' else participant_row.access_type end, 'displayName', coalesce(participant_row.display_name, 'Platform Admin'), 'countryId', participant_row.country_key, 'role', participant_row.role_key),
    'seats', coalesce((select jsonb_agg(jsonb_build_object('countryId', s.country_key, 'role', s.role_key, 'displayName', s.display_name, 'mine', s.auth_user_id = auth.uid()) order by s.country_key, s.role_key) from public.live_world_participants s where s.room_id = p_room_id and s.country_key is not null and s.role_key is not null), '[]'::jsonb),
    'state', jsonb_build_object('publishedPolicies', coalesce(room_row.state -> 'publishedPolicies', '{}'::jsonb), 'agreements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'proposerCountry', a.proposer_country_key, 'receiverCountry', a.receiver_country_key, 'depth', a.depth, 'status', a.status, 'createdAt', a.created_at, 'decidedAt', a.decided_at) order by a.created_at desc) from public.live_world_agreements a where a.room_id = p_room_id), '[]'::jsonb), 'crises', coalesce((select jsonb_agg(jsonb_build_object('id', c.crisis_key, 'active', c.active) order by c.activated_at desc) from public.live_world_crises c where c.room_id = p_room_id), '[]'::jsonb)),
    'drafts', case when public.is_platform_admin(auth.uid()) then coalesce((select jsonb_object_agg(country_key, role_drafts) from (select country_key, jsonb_object_agg(role_key, draft_policy) role_drafts from public.live_world_participants where room_id = p_room_id and country_key is not null and role_key is not null group by country_key) grouped), '{}'::jsonb) when participant_row.country_key is not null then coalesce((select jsonb_object_agg(country_key, role_drafts) from (select country_key, jsonb_object_agg(role_key, draft_policy) role_drafts from public.live_world_participants where room_id = p_room_id and country_key = participant_row.country_key and role_key is not null group by country_key) grouped), '{}'::jsonb) else '{}'::jsonb end,
    'events', coalesce((select jsonb_agg(event_value order by created_at desc) from (select jsonb_build_object('id', e.id, 'type', e.event_type, 'message', e.message, 'countryId', e.country_key, 'createdAt', e.created_at) event_value, e.created_at from public.live_world_events e where e.room_id = p_room_id order by e.created_at desc limit 40) feed), '[]'::jsonb)
  );
end;
$$;

drop function if exists public.list_live_world_rooms_for_admin();
create function public.list_live_world_rooms_for_admin()
returns table(id uuid, name text, status text, duration_seconds integer, started_at timestamptz, ended_at timestamptz, created_at timestamptz, participant_count bigint, participant_capacity integer)
language sql stable security definer set search_path = public
as $$
  select r.id, r.name, r.status, r.duration_seconds, r.started_at, r.ended_at, r.created_at, count(p.id), r.participant_capacity
  from public.live_world_rooms r left join public.live_world_participants p on p.room_id = r.id
  where public.is_platform_admin(auth.uid())
  group by r.id order by r.created_at desc
$$;

grant execute on function public.create_live_world_room(text, integer, integer), public.join_live_world_room(uuid, text, text), public.claim_live_world_seat(uuid, text, text), public.live_world_set_status(uuid, text), public.set_live_world_participant_capacity(uuid, integer), public.get_live_world_view(uuid), public.list_live_world_rooms_for_admin() to authenticated;

-- Existing active rooms gain the new office defaults immediately. They retain
-- their current clock and existing player seats.
do $$
declare active_room record;
begin
  for active_room in select id from public.live_world_rooms where status in ('live', 'paused') loop
    perform public.live_world_seed_default_policies(active_room.id);
  end loop;
end;
$$;
