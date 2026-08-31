-- A short, room-scoped simulation. It deliberately does not reuse or mutate
-- the persistent continuous-world tables: every room is a self-contained live
-- event with its own participants, drafts, published policies and activity.
create table if not exists public.live_world_rooms (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  status text not null default 'waiting' check (status in ('waiting', 'live', 'paused', 'ended')),
  duration_seconds integer not null default 600 check (duration_seconds between 300 and 3600),
  remaining_seconds integer not null default 600 check (remaining_seconds between 0 and 3600),
  player_code_hash text not null,
  admin_code_hash text not null,
  state jsonb not null default '{"publishedPolicies":{},"agreements":[],"crises":[]}'::jsonb check (jsonb_typeof(state) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.live_world_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_world_rooms(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 48),
  display_name_key text not null check (char_length(display_name_key) between 1 and 48),
  access_type text not null check (access_type in ('player', 'admin', 'observer')),
  country_key text check (country_key is null or country_key in ('aurora', 'borealis', 'cyrenia', 'demeria')),
  role_key text check (role_key is null or role_key in ('central_bank_governor', 'finance_domestic_minister', 'trade_industry_investment_minister')),
  draft_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_policy) = 'object'),
  joined_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique(room_id, auth_user_id),
  unique(room_id, display_name_key)
);
create unique index if not exists live_world_participants_unique_seat
  on public.live_world_participants(room_id, country_key, role_key)
  where country_key is not null and role_key is not null;

create table if not exists public.live_world_agreements (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_world_rooms(id) on delete cascade,
  proposer_country_key text not null check (proposer_country_key in ('aurora', 'borealis', 'cyrenia', 'demeria')),
  receiver_country_key text not null check (receiver_country_key in ('aurora', 'borealis', 'cyrenia', 'demeria') and receiver_country_key <> proposer_country_key),
  depth text not null check (depth in ('limited', 'standard', 'deep')),
  status text not null default 'proposed' check (status in ('proposed', 'active', 'rejected', 'withdrawn')),
  proposed_by uuid not null references public.live_world_participants(id) on delete restrict,
  decided_by uuid references public.live_world_participants(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  decided_at timestamptz
);

create table if not exists public.live_world_crises (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_world_rooms(id) on delete cascade,
  crisis_key text not null check (crisis_key in ('energy-price-spike', 'capital-flight', 'supply-chain-disruption', 'commodity-boom')),
  active boolean not null default true,
  activated_by uuid not null references auth.users(id) on delete restrict,
  activated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  unique(room_id, crisis_key)
);

create table if not exists public.live_world_events (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_world_rooms(id) on delete cascade,
  country_key text check (country_key is null or country_key in ('aurora', 'borealis', 'cyrenia', 'demeria')),
  event_type text not null check (event_type ~ '^[a-z_]{3,60}$'),
  message text not null check (char_length(message) between 1 and 280),
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists live_world_events_room_created_idx on public.live_world_events(room_id, created_at desc);

create or replace function public.live_world_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin new.updated_at := timezone('utc', now()); return new; end; $$;
drop trigger if exists live_world_rooms_updated_at on public.live_world_rooms;
create trigger live_world_rooms_updated_at before update on public.live_world_rooms
for each row execute function public.live_world_set_updated_at();

create or replace function public.live_world_normalise_name(p_name text)
returns text language sql immutable set search_path = public
as $$ select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g')) $$;

create or replace function public.live_world_code(p_prefix text)
returns text language sql volatile set search_path = public
as $$ select upper(p_prefix || '-' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 10)) $$;

create or replace function public.live_world_room_active(p_room public.live_world_rooms)
returns boolean language sql stable set search_path = public
as $$ select p_room.status = 'live' and p_room.started_at is not null and timezone('utc', now()) < p_room.started_at + make_interval(secs => p_room.remaining_seconds) $$;

create or replace function public.live_world_participant(p_room_id uuid, p_user_id uuid default auth.uid())
returns public.live_world_participants language sql stable security definer set search_path = public
as $$ select * from public.live_world_participants where room_id = p_room_id and auth_user_id = p_user_id limit 1 $$;

create or replace function public.can_view_live_world_room(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_platform_admin(p_user_id) or exists(select 1 from public.live_world_participants where room_id = p_room_id and auth_user_id = p_user_id) $$;

create or replace function public.can_administer_live_world_room(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_platform_admin(p_user_id) or exists(select 1 from public.live_world_participants where room_id = p_room_id and auth_user_id = p_user_id and access_type = 'admin') $$;

create or replace function public.live_world_touch(p_room_id uuid)
returns void language plpgsql security definer set search_path = public
as $$ begin update public.live_world_participants set last_seen_at = timezone('utc', now()) where room_id = p_room_id and auth_user_id = auth.uid(); end; $$;

create or replace function public.create_live_world_room(p_name text, p_duration_seconds integer default 600)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare created public.live_world_rooms%rowtype;
declare player_code text := public.live_world_code('PLAY');
declare admin_code text := public.live_world_code('ADMIN');
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then raise exception 'Only a Platform Admin can create a Live World room'; end if;
  if p_duration_seconds < 300 or p_duration_seconds > 3600 then raise exception 'Duration must be between 5 and 60 minutes'; end if;
  insert into public.live_world_rooms(name, duration_seconds, remaining_seconds, player_code_hash, admin_code_hash, created_by)
  values(trim(p_name), p_duration_seconds, p_duration_seconds, encode(extensions.digest(player_code, 'sha256'), 'hex'), encode(extensions.digest(admin_code, 'sha256'), 'hex'), auth.uid())
  returning * into created;
  insert into public.live_world_events(room_id, event_type, message) values(created.id, 'room_created', 'Room created and waiting for participants.');
  return jsonb_build_object('room', jsonb_build_object('id', created.id, 'name', created.name, 'status', created.status, 'durationSeconds', created.duration_seconds, 'createdAt', created.created_at), 'playerCode', player_code, 'adminCode', admin_code);
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
  if found then
    update public.live_world_participants set last_seen_at = timezone('utc', now()) where id = participant_row.id;
    return jsonb_build_object('accessType', participant_row.access_type, 'countryId', participant_row.country_key, 'role', participant_row.role_key);
  end if;
  -- A reconnect may get a fresh anonymous browser identity. The original
  -- event code plus the exact same room display name restores the existing
  -- event seat; a new name cannot take over that seat.
  select * into same_name_row from public.live_world_participants where room_id = p_room_id and display_name_key = name_key for update;
  if found then
    update public.live_world_participants set auth_user_id = auth.uid(), last_seen_at = timezone('utc', now()) where id = same_name_row.id returning * into participant_row;
    return jsonb_build_object('accessType', participant_row.access_type, 'countryId', participant_row.country_key, 'role', participant_row.role_key);
  end if;
  if not is_admin_code then
    select count(*) into player_count from public.live_world_participants where room_id = p_room_id and country_key is not null and role_key is not null;
  end if;
  insert into public.live_world_participants(room_id, auth_user_id, display_name, display_name_key, access_type)
  values(p_room_id, auth.uid(), name_value, name_key, case when is_admin_code then 'admin' when coalesce(player_count, 0) >= 12 then 'observer' else 'player' end)
  returning * into participant_row;
  insert into public.live_world_events(room_id, event_type, message)
  values(p_room_id, case when participant_row.access_type = 'observer' then 'observer_joined' else 'participant_joined' end, participant_row.display_name || case when participant_row.access_type = 'observer' then ' is observing the shared screen.' else ' joined the room.' end);
  return jsonb_build_object('accessType', participant_row.access_type, 'countryId', participant_row.country_key, 'role', participant_row.role_key);
exception when unique_violation then
  raise exception 'That display name is already in use for this room';
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
  if p_country_key not in ('aurora', 'borealis', 'cyrenia', 'demeria') or p_role_key not in ('central_bank_governor', 'finance_domestic_minister', 'trade_industry_investment_minister') then raise exception 'Invalid Live World seat'; end if;
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if not found or participant_row.access_type <> 'player' then raise exception 'Only a player may claim a seat'; end if;
  if exists(select 1 from public.live_world_participants where room_id = p_room_id and country_key = p_country_key and role_key = p_role_key and id <> participant_row.id) then raise exception 'This seat was just claimed by another participant'; end if;
  update public.live_world_participants set country_key = p_country_key, role_key = p_role_key, last_seen_at = timezone('utc', now()) where id = participant_row.id returning * into participant_row;
  insert into public.live_world_events(room_id, country_key, event_type, message) values(p_room_id, p_country_key, 'seat_claimed', participant_row.display_name || ' took a cabinet seat in ' || initcap(p_country_key) || '.');
  return participant_row;
end;
$$;

create or replace function public.release_live_world_seat(p_room_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare room_status text;
begin
  select status into room_status from public.live_world_rooms where id = p_room_id for update;
  if room_status is distinct from 'waiting' then raise exception 'Seats are locked after the room starts'; end if;
  update public.live_world_participants set country_key = null, role_key = null, draft_policy = '{}'::jsonb, last_seen_at = timezone('utc', now()) where room_id = p_room_id and auth_user_id = auth.uid() and access_type = 'player';
end;
$$;

create or replace function public.live_world_policy_value_between(p_policy jsonb, p_key text, p_low numeric, p_high numeric)
returns boolean language sql immutable set search_path = public
as $$
  select case
    when not (p_policy ? p_key) then true
    when (p_policy ->> p_key) !~ '^-?[0-9]+(\.[0-9]+)?$' then false
    else (p_policy ->> p_key)::numeric between p_low and p_high
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
      p_role not in ('central_bank_governor', 'finance_domestic_minister', 'trade_industry_investment_minister'))
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
$$;

create or replace function public.save_live_world_draft(p_room_id uuid, p_policy jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found or not public.live_world_room_active(room_row) then raise exception 'Drafting is available only while the room is live'; end if;
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if not found or participant_row.country_key is null or participant_row.role_key is null then raise exception 'A claimed cabinet seat is required'; end if;
  if not public.live_world_policy_allowed(participant_row.role_key, p_policy) then raise exception 'This office may only save its own valid policy controls'; end if;
  update public.live_world_participants set draft_policy = p_policy, last_seen_at = timezone('utc', now()) where id = participant_row.id;
end;
$$;

create or replace function public.publish_live_world_policy(p_room_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found or not public.live_world_room_active(room_row) then raise exception 'Publishing is available only while the room is live'; end if;
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if not found or participant_row.country_key is null or participant_row.role_key is null then raise exception 'A claimed cabinet seat is required'; end if;
  update public.live_world_rooms
  set state = jsonb_set(
    jsonb_set(
      state,
      array['publishedPolicies', participant_row.country_key],
      coalesce(state #> array['publishedPolicies', participant_row.country_key], '{}'::jsonb),
      true
    ),
    array['publishedPolicies', participant_row.country_key, participant_row.role_key],
    participant_row.draft_policy,
    true
  )
  where id = p_room_id;
  insert into public.live_world_events(room_id, country_key, event_type, message) values(p_room_id, participant_row.country_key, 'policy_published', participant_row.display_name || ' published a policy package for ' || initcap(participant_row.country_key) || '.');
end;
$$;

create or replace function public.propose_live_world_agreement(p_room_id uuid, p_receiver_country_key text, p_depth text)
returns public.live_world_agreements language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
declare participant_row public.live_world_participants%rowtype;
declare agreement_row public.live_world_agreements%rowtype;
begin
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found or not public.live_world_room_active(room_row) then raise exception 'Trade proposals are available only while the room is live'; end if;
  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if not found or participant_row.role_key <> 'trade_industry_investment_minister' then raise exception 'Only the Trade, Industry & Investment Minister may propose an agreement'; end if;
  if p_receiver_country_key not in ('aurora', 'borealis', 'cyrenia', 'demeria') or p_receiver_country_key = participant_row.country_key or p_depth not in ('limited', 'standard', 'deep') then raise exception 'Invalid agreement proposal'; end if;
  insert into public.live_world_agreements(room_id, proposer_country_key, receiver_country_key, depth, proposed_by)
  values(p_room_id, participant_row.country_key, p_receiver_country_key, p_depth, participant_row.id) returning * into agreement_row;
  insert into public.live_world_events(room_id, country_key, event_type, message) values(p_room_id, participant_row.country_key, 'trade_proposed', initcap(participant_row.country_key) || ' proposed a ' || p_depth || ' agreement to ' || initcap(p_receiver_country_key) || '.');
  return agreement_row;
end;
$$;

create or replace function public.decide_live_world_agreement(p_agreement_id uuid, p_accept boolean)
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
  select * into participant_row from public.live_world_participants where room_id = agreement_row.room_id and auth_user_id = auth.uid() for update;
  if not found or participant_row.role_key <> 'trade_industry_investment_minister' or participant_row.country_key <> agreement_row.receiver_country_key then raise exception 'Only the receiving Trade, Industry & Investment Minister may decide this agreement'; end if;
  if agreement_row.status <> 'proposed' then raise exception 'This agreement has already been decided'; end if;
  update public.live_world_agreements set status = case when p_accept then 'active' else 'rejected' end, decided_by = participant_row.id, decided_at = timezone('utc', now()) where id = agreement_row.id returning * into agreement_row;
  insert into public.live_world_events(room_id, country_key, event_type, message) values(agreement_row.room_id, participant_row.country_key, case when p_accept then 'trade_accepted' else 'trade_rejected' end, initcap(participant_row.country_key) || case when p_accept then ' accepted a trade agreement.' else ' rejected a trade agreement.' end);
  return agreement_row;
end;
$$;

create or replace function public.live_world_set_status(p_room_id uuid, p_status text)
returns public.live_world_rooms language plpgsql security definer set search_path = public
as $$
declare room_row public.live_world_rooms%rowtype;
begin
  if p_status not in ('live', 'paused', 'ended') then raise exception 'Invalid room status'; end if;
  if not public.can_administer_live_world_room(p_room_id) then raise exception 'Live World administrator access is required'; end if;
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  if p_status = 'live' and room_row.status = 'waiting' then update public.live_world_rooms set status = 'live', started_at = timezone('utc', now()), remaining_seconds = duration_seconds where id = p_room_id returning * into room_row;
  elsif p_status = 'live' and room_row.status = 'paused' then update public.live_world_rooms set status = 'live', started_at = timezone('utc', now()) where id = p_room_id returning * into room_row;
  elsif p_status = 'paused' and room_row.status = 'live' then update public.live_world_rooms set status = 'paused', remaining_seconds = greatest(0, ceil(extract(epoch from (room_row.started_at + make_interval(secs => room_row.remaining_seconds) - timezone('utc', now()))))::integer), started_at = null where id = p_room_id returning * into room_row;
  elsif p_status = 'ended' and room_row.status <> 'ended' then update public.live_world_rooms set status = 'ended', ended_at = timezone('utc', now()), remaining_seconds = 0 where id = p_room_id returning * into room_row;
  else raise exception 'This status transition is not available'; end if;
  insert into public.live_world_events(room_id, event_type, message) values(p_room_id, 'room_' || p_status, case when p_status = 'live' and room_row.started_at is not null then 'The Live World timer is running.' when p_status = 'paused' then 'The Live World is paused.' else 'The Live World has ended.' end);
  return room_row;
end;
$$;

create or replace function public.inject_live_world_crisis(p_room_id uuid, p_crisis_key text, p_active boolean default true)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_administer_live_world_room(p_room_id) then raise exception 'Live World administrator access is required'; end if;
  if p_crisis_key not in ('energy-price-spike', 'capital-flight', 'supply-chain-disruption', 'commodity-boom') then raise exception 'Invalid crisis'; end if;
  insert into public.live_world_crises(room_id, crisis_key, active, activated_by, resolved_at)
  values(p_room_id, p_crisis_key, p_active, auth.uid(), case when p_active then null else timezone('utc', now()) end)
  on conflict(room_id, crisis_key) do update set active = excluded.active, activated_by = excluded.activated_by, activated_at = timezone('utc', now()), resolved_at = case when excluded.active then null else timezone('utc', now()) end;
  insert into public.live_world_events(room_id, event_type, message) values(p_room_id, case when p_active then 'crisis_activated' else 'crisis_resolved' end, replace(initcap(replace(p_crisis_key, '-', ' ')), ' ', ' ') || case when p_active then ' is active.' else ' is resolved.' end);
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
    'room', jsonb_build_object('id', room_row.id, 'name', room_row.name, 'status', effective_status, 'durationSeconds', room_row.duration_seconds, 'remainingSeconds', case when room_row.status = 'live' and room_row.started_at is not null then greatest(0, ceil(extract(epoch from (room_row.started_at + make_interval(secs => room_row.remaining_seconds) - timezone('utc', now()))))::integer) else room_row.remaining_seconds end, 'startedAt', room_row.started_at, 'endedAt', room_row.ended_at, 'createdAt', room_row.created_at),
    'access', jsonb_build_object('type', case when public.is_platform_admin(auth.uid()) then 'admin' else participant_row.access_type end, 'displayName', coalesce(participant_row.display_name, 'Platform Admin'), 'countryId', participant_row.country_key, 'role', participant_row.role_key),
    'seats', coalesce((select jsonb_agg(jsonb_build_object('countryId', s.country_key, 'role', s.role_key, 'displayName', s.display_name, 'mine', s.auth_user_id = auth.uid()) order by s.country_key, s.role_key) from public.live_world_participants s where s.room_id = p_room_id and s.country_key is not null and s.role_key is not null), '[]'::jsonb),
    'state', jsonb_build_object('publishedPolicies', coalesce(room_row.state -> 'publishedPolicies', '{}'::jsonb), 'agreements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'proposerCountry', a.proposer_country_key, 'receiverCountry', a.receiver_country_key, 'depth', a.depth, 'status', a.status, 'createdAt', a.created_at, 'decidedAt', a.decided_at) order by a.created_at desc) from public.live_world_agreements a where a.room_id = p_room_id), '[]'::jsonb), 'crises', coalesce((select jsonb_agg(jsonb_build_object('id', c.crisis_key, 'active', c.active) order by c.activated_at desc) from public.live_world_crises c where c.room_id = p_room_id), '[]'::jsonb)),
    'drafts', case when public.is_platform_admin(auth.uid()) then coalesce((select jsonb_object_agg(country_key, role_drafts) from (select country_key, jsonb_object_agg(role_key, draft_policy) role_drafts from public.live_world_participants where room_id = p_room_id and country_key is not null and role_key is not null group by country_key) grouped), '{}'::jsonb) when participant_row.country_key is not null then coalesce((select jsonb_object_agg(country_key, role_drafts) from (select country_key, jsonb_object_agg(role_key, draft_policy) role_drafts from public.live_world_participants where room_id = p_room_id and country_key = participant_row.country_key and role_key is not null group by country_key) grouped), '{}'::jsonb) else '{}'::jsonb end,
    'events', coalesce((select jsonb_agg(event_value order by created_at desc) from (select jsonb_build_object('id', e.id, 'type', e.event_type, 'message', e.message, 'countryId', e.country_key, 'createdAt', e.created_at) event_value, e.created_at from public.live_world_events e where e.room_id = p_room_id order by e.created_at desc limit 40) feed), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_live_world_rooms_for_admin()
returns table(id uuid, name text, status text, duration_seconds integer, started_at timestamptz, ended_at timestamptz, created_at timestamptz, participant_count bigint)
language sql stable security definer set search_path = public
as $$
  select r.id, r.name, r.status, r.duration_seconds, r.started_at, r.ended_at, r.created_at, count(p.id)
  from public.live_world_rooms r left join public.live_world_participants p on p.room_id = r.id
  where public.is_platform_admin(auth.uid())
  group by r.id order by r.created_at desc
$$;

alter table public.live_world_rooms enable row level security;
alter table public.live_world_participants enable row level security;
alter table public.live_world_agreements enable row level security;
alter table public.live_world_crises enable row level security;
alter table public.live_world_events enable row level security;

create policy live_world_events_read_room_members on public.live_world_events for select to authenticated using (public.can_view_live_world_room(room_id));

-- All writes and all sensitive reads travel through the RPCs above. In
-- particular invitation hashes never have a SELECT policy and are never sent
-- to browser code. Realtime only emits safe activity messages to room members.
alter publication supabase_realtime add table public.live_world_events;

grant execute on function public.create_live_world_room(text, integer), public.join_live_world_room(uuid, text, text), public.claim_live_world_seat(uuid, text, text), public.release_live_world_seat(uuid), public.save_live_world_draft(uuid, jsonb), public.publish_live_world_policy(uuid), public.propose_live_world_agreement(uuid, text, text), public.decide_live_world_agreement(uuid, boolean), public.live_world_set_status(uuid, text), public.inject_live_world_crisis(uuid, text, boolean), public.get_live_world_view(uuid), public.list_live_world_rooms_for_admin() to authenticated;
