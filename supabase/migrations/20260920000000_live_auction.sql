-- Live Auction is a room-only classroom market. It deliberately has no
-- dependency on ordinary EconMind identities or on Live World tables.
create table public.live_auction_rooms (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  participant_capacity integer not null default 30 check (participant_capacity between 1 and 100),
  starting_balance numeric(12,2) not null default 100 check (starting_balance >= 0 and starting_balance <= 1000000),
  player_code_hash text not null,
  admin_code_hash text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.live_auction_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_auction_rooms(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 48),
  display_name_key text not null check (char_length(display_name_key) between 1 and 48),
  access_type text not null check (access_type in ('player', 'admin', 'observer')),
  current_balance numeric(12,2) not null check (current_balance >= 0 and current_balance <= 1000000),
  removed_at timestamptz,
  joined_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique(room_id, auth_user_id),
  unique(room_id, display_name_key)
);
create index live_auction_participants_room_idx on public.live_auction_participants(room_id) where removed_at is null;

create table public.auction_items (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_auction_rooms(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  auction_type text not null check (auction_type in ('OPEN', 'SEALED')),
  open_bidding_mode text check (open_bidding_mode is null or open_bidding_mode in ('ONLINE', 'OFFLINE')),
  starting_price numeric(12,2) not null check (starting_price >= 0),
  current_price numeric(12,2) not null check (current_price >= 0),
  bid_increment numeric(12,2) not null check (bid_increment > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'LIVE', 'CLOSED', 'DEBRIEF')),
  value_assignment jsonb not null check (jsonb_typeof(value_assignment) = 'object'),
  current_leader_id uuid references public.live_auction_participants(id) on delete set null,
  winner_id uuid references public.live_auction_participants(id) on delete set null,
  winning_price numeric(12,2) check (winning_price is null or winning_price >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  check ((auction_type = 'OPEN' and open_bidding_mode is not null) or (auction_type = 'SEALED' and open_bidding_mode is null))
);
create index auction_items_room_idx on public.auction_items(room_id, created_at desc);

create table public.auction_item_values (
  item_id uuid not null references public.auction_items(id) on delete cascade,
  participant_id uuid not null references public.live_auction_participants(id) on delete restrict,
  private_value numeric(12,2) not null check (private_value >= 0),
  primary key(item_id, participant_id)
);
create table public.auction_bids (
  id uuid primary key default extensions.gen_random_uuid(),
  item_id uuid not null references public.auction_items(id) on delete cascade,
  participant_id uuid not null references public.live_auction_participants(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  bid_type text not null check (bid_type in ('ONLINE', 'SEALED')),
  created_at timestamptz not null default timezone('utc', now())
);
create unique index auction_sealed_bid_per_participant on public.auction_bids(item_id, participant_id) where bid_type = 'SEALED';
create index auction_bids_item_idx on public.auction_bids(item_id, amount desc, created_at);
create table public.auction_price_history (
  id uuid primary key default extensions.gen_random_uuid(),
  item_id uuid not null references public.auction_items(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  leader_id uuid references public.live_auction_participants(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);
create index auction_price_history_item_idx on public.auction_price_history(item_id, created_at);
create table public.auction_results (
  item_id uuid primary key references public.auction_items(id) on delete cascade,
  winner_id uuid not null references public.live_auction_participants(id) on delete restrict,
  winning_price numeric(12,2) not null check (winning_price >= 0),
  private_value numeric(12,2) not null check (private_value >= 0),
  consumer_surplus numeric(12,2) not null,
  settled_at timestamptz not null default timezone('utc', now())
);
create table public.live_auction_events (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.live_auction_rooms(id) on delete cascade,
  event_type text not null check (event_type ~ '^[a-z_]{3,60}$'),
  created_at timestamptz not null default timezone('utc', now())
);
create index live_auction_events_room_idx on public.live_auction_events(room_id, created_at desc);

create or replace function public.live_auction_normalise_name(p_name text) returns text language sql immutable set search_path = public
as $$ select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g')) $$;
create or replace function public.live_auction_code(p_prefix text) returns text language sql volatile set search_path = public
as $$ select upper(p_prefix || '-' || substring(replace(extensions.gen_random_uuid()::text, '-', '') from 1 for 10)) $$;
create or replace function public.live_auction_participant(p_room_id uuid, p_user_id uuid default auth.uid()) returns public.live_auction_participants language sql stable security definer set search_path = public
as $$ select p from public.live_auction_participants p where p.room_id = p_room_id and p.auth_user_id = p_user_id and p.removed_at is null limit 1 $$;
create or replace function public.can_administer_live_auction_room(p_room_id uuid, p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.live_auction_participants p where p.room_id = p_room_id and p.auth_user_id = p_user_id and p.access_type = 'admin' and p.removed_at is null) $$;
create or replace function public.can_view_live_auction_room(p_room_id uuid, p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.live_auction_participants p where p.room_id = p_room_id and p.auth_user_id = p_user_id and p.removed_at is null) $$;
create or replace function public.live_auction_emit(p_room_id uuid, p_event_type text) returns void language plpgsql security definer set search_path = public
as $$ begin insert into public.live_auction_events(room_id, event_type) values(p_room_id, p_event_type); end $$;
revoke all on function public.live_auction_code(text), public.live_auction_participant(uuid,uuid), public.can_administer_live_auction_room(uuid,uuid), public.live_auction_emit(uuid,text) from public, anon, authenticated;

create or replace function public.create_live_auction_room(p_name text, p_participant_capacity integer default 30, p_starting_balance numeric default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare player_code text := public.live_auction_code('PLAY'); admin_code text := public.live_auction_code('ADMIN'); created public.live_auction_rooms%rowtype;
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Only a Platform Admin can create a Live Auction room'; end if;
  if p_participant_capacity not between 1 and 100 or p_starting_balance not between 0 and 1000000 then raise exception 'Invalid Live Auction room settings'; end if;
  insert into public.live_auction_rooms(name, participant_capacity, starting_balance, player_code_hash, admin_code_hash, created_by)
  values(trim(p_name), p_participant_capacity, p_starting_balance, encode(extensions.digest(player_code, 'sha256'), 'hex'), encode(extensions.digest(admin_code, 'sha256'), 'hex'), auth.uid()) returning * into created;
  perform public.live_auction_emit(created.id, 'room_created');
  return jsonb_build_object('room', jsonb_build_object('id', created.id, 'name', created.name, 'participantCapacity', created.participant_capacity, 'startingBalance', created.starting_balance, 'createdAt', created.created_at), 'playerCode', player_code, 'adminCode', admin_code);
end $$;

create or replace function public.list_live_auction_rooms_for_admin() returns table(id uuid, name text, participant_count bigint, participant_capacity integer, item_count bigint, created_at timestamptz) language sql security definer set search_path = public
as $$ select r.id, r.name, count(distinct p.id) filter (where p.access_type = 'player' and p.removed_at is null), r.participant_capacity, count(distinct i.id), r.created_at from public.live_auction_rooms r left join public.live_auction_participants p on p.room_id = r.id left join public.auction_items i on i.room_id = r.id where public.is_platform_admin(auth.uid()) group by r.id order by r.created_at desc $$;

create or replace function public.join_live_auction_room(p_room_id uuid, p_code text, p_display_name text) returns jsonb language plpgsql security definer set search_path = public as $$
declare room_row public.live_auction_rooms%rowtype; participant_row public.live_auction_participants%rowtype; same_name_row public.live_auction_participants%rowtype;
  code_hash text := encode(extensions.digest(upper(trim(coalesce(p_code, ''))), 'sha256'), 'hex'); name_value text := trim(coalesce(p_display_name, '')); name_key text := public.live_auction_normalise_name(p_display_name); requested_access text; player_count integer; is_admin_code boolean;
begin
  if auth.uid() is null then raise exception 'A temporary auction session is required'; end if;
  if char_length(name_value) not between 1 and 48 then raise exception 'Enter a display name between 1 and 48 characters'; end if;
  select * into room_row from public.live_auction_rooms where id = p_room_id for update; if not found then raise exception 'Live Auction room not found'; end if;
  is_admin_code := code_hash = room_row.admin_code_hash; if not is_admin_code and code_hash <> room_row.player_code_hash then raise exception 'This room code is invalid'; end if;
  select count(*) into player_count from public.live_auction_participants where room_id = p_room_id and access_type = 'player' and removed_at is null;
  requested_access := case when is_admin_code then 'admin' when player_count >= room_row.participant_capacity then 'observer' else 'player' end;
  select * into participant_row from public.live_auction_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  if found then update public.live_auction_participants set access_type = requested_access, last_seen_at = timezone('utc', now()) where id = participant_row.id returning * into participant_row; return jsonb_build_object('accessType', participant_row.access_type); end if;
  select * into same_name_row from public.live_auction_participants where room_id = p_room_id and display_name_key = name_key for update;
  if found then
    if same_name_row.access_type = 'admin' and not is_admin_code then raise exception 'That display name is reserved for an administrator. Choose another display name.'; end if;
    update public.live_auction_participants set auth_user_id = auth.uid(), access_type = requested_access, removed_at = null, last_seen_at = timezone('utc', now()) where id = same_name_row.id returning * into participant_row;
    return jsonb_build_object('accessType', participant_row.access_type);
  end if;
  if requested_access = 'player' and exists(select 1 from public.auction_items i where i.room_id = p_room_id and i.value_assignment ->> 'mode' = 'manual') then raise exception 'Players cannot join after an item with manually assigned values has been created'; end if;
  insert into public.live_auction_participants(room_id, auth_user_id, display_name, display_name_key, access_type, current_balance) values(p_room_id, auth.uid(), name_value, name_key, requested_access, room_row.starting_balance) returning * into participant_row;
  if requested_access = 'player' then
    insert into public.auction_item_values(item_id, participant_id, private_value)
    select i.id, participant_row.id, case when i.value_assignment ->> 'mode' = 'same' then (i.value_assignment ->> 'value')::numeric else floor(random() * ((i.value_assignment ->> 'max')::numeric - (i.value_assignment ->> 'min')::numeric + 1)) + (i.value_assignment ->> 'min')::numeric end
    from public.auction_items i where i.room_id = p_room_id and i.value_assignment ->> 'mode' in ('same', 'random');
  end if;
  perform public.live_auction_emit(p_room_id, 'participant_joined'); return jsonb_build_object('accessType', participant_row.access_type);
exception when unique_violation then raise exception 'That display name is already in use for this room'; end $$;

create or replace function public.set_live_auction_balance(p_participant_id uuid, p_balance numeric) returns void language plpgsql security definer set search_path = public as $$
declare participant_row public.live_auction_participants%rowtype; begin
  if p_balance not between 0 and 1000000 then raise exception 'Balance must be between E$0 and E$1,000,000'; end if;
  select * into participant_row from public.live_auction_participants where id = p_participant_id for update; if not found or not public.can_administer_live_auction_room(participant_row.room_id) then raise exception 'Live Auction administrator access is required'; end if;
  update public.live_auction_participants set current_balance = p_balance where id = p_participant_id; perform public.live_auction_emit(participant_row.room_id, 'balance_updated'); end $$;
create or replace function public.remove_live_auction_participant(p_participant_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare participant_row public.live_auction_participants%rowtype; begin select * into participant_row from public.live_auction_participants where id = p_participant_id for update; if not found or not public.can_administer_live_auction_room(participant_row.room_id) then raise exception 'Live Auction administrator access is required'; end if; if participant_row.access_type = 'admin' then raise exception 'An administrator cannot be removed from the room'; end if; update public.live_auction_participants set removed_at = timezone('utc', now()) where id = p_participant_id; perform public.live_auction_emit(participant_row.room_id, 'participant_removed'); end $$;

create or replace function public.create_live_auction_item(p_room_id uuid, p_name text, p_description text, p_starting_price numeric, p_bid_increment numeric, p_auction_type text, p_open_bidding_mode text, p_value_assignment jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare item_row public.auction_items%rowtype; participant_count integer; supplied_count integer; mode_value text := p_value_assignment ->> 'mode';
begin
  if not public.can_administer_live_auction_room(p_room_id) then raise exception 'Live Auction administrator access is required'; end if;
  if p_starting_price < 0 or p_bid_increment <= 0 or p_auction_type not in ('OPEN','SEALED') or (p_auction_type = 'OPEN' and p_open_bidding_mode not in ('ONLINE','OFFLINE')) or (p_auction_type = 'SEALED' and p_open_bidding_mode is not null) then raise exception 'Invalid auction settings'; end if;
  if mode_value = 'same' and coalesce((p_value_assignment ->> 'value')::numeric, -1) >= 0 then null;
  elsif mode_value = 'random' and coalesce((p_value_assignment ->> 'min')::numeric, -1) >= 0 and coalesce((p_value_assignment ->> 'max')::numeric, -1) >= coalesce((p_value_assignment ->> 'min')::numeric, 0) then null;
  elsif mode_value = 'manual' and jsonb_typeof(p_value_assignment -> 'values') = 'object' then null;
  else raise exception 'Invalid private-value assignment'; end if;
  select count(*) into participant_count from public.live_auction_participants where room_id = p_room_id and access_type = 'player' and removed_at is null;
  if participant_count = 0 then raise exception 'At least one buyer must join before an item is created'; end if;
  if mode_value = 'manual' then
    select count(*) into supplied_count from jsonb_object_keys(p_value_assignment -> 'values');
    if supplied_count <> participant_count or exists(select 1 from jsonb_each_text(p_value_assignment -> 'values') e where e.value !~ '^[0-9]+(\\.[0-9]+)?$' or e.value::numeric > 1000000) then raise exception 'Enter one non-negative private value for every buyer'; end if;
  end if;
  insert into public.auction_items(room_id,name,description,auction_type,open_bidding_mode,starting_price,current_price,bid_increment,value_assignment) values(p_room_id,trim(p_name),nullif(trim(p_description),''),p_auction_type,p_open_bidding_mode,p_starting_price,p_starting_price,p_bid_increment,p_value_assignment) returning * into item_row;
  insert into public.auction_item_values(item_id,participant_id,private_value)
  select item_row.id,p.id,case when mode_value = 'same' then (p_value_assignment ->> 'value')::numeric when mode_value = 'random' then floor(random()*((p_value_assignment ->> 'max')::numeric-(p_value_assignment ->> 'min')::numeric+1))+(p_value_assignment ->> 'min')::numeric else (p_value_assignment -> 'values' ->> p.id::text)::numeric end from public.live_auction_participants p where p.room_id=p_room_id and p.access_type='player' and p.removed_at is null;
  insert into public.auction_price_history(item_id,price) values(item_row.id,p_starting_price); perform public.live_auction_emit(p_room_id,'item_created'); return item_row.id;
end $$;

create or replace function public.start_live_auction_item(p_item_id uuid) returns void language plpgsql security definer set search_path = public as $$ declare item_row public.auction_items%rowtype; room_row public.live_auction_rooms%rowtype; begin select * into item_row from public.auction_items where id=p_item_id for update; if not found or not public.can_administer_live_auction_room(item_row.room_id) then raise exception 'Live Auction administrator access is required'; end if; select * into room_row from public.live_auction_rooms where id=item_row.room_id for update; if item_row.status <> 'DRAFT' then raise exception 'Only a draft item can be started'; end if; if exists(select 1 from public.auction_items where room_id=item_row.room_id and status='LIVE') then raise exception 'Close the current auction before starting another item'; end if; update public.auction_items set status='LIVE' where id=p_item_id; perform public.live_auction_emit(item_row.room_id,'auction_started'); end $$;
create or replace function public.update_live_auction_offline_price(p_item_id uuid, p_price numeric, p_leader_id uuid) returns void language plpgsql security definer set search_path = public as $$ declare item_row public.auction_items%rowtype; leader_row public.live_auction_participants%rowtype; begin select * into item_row from public.auction_items where id=p_item_id for update; if not found or not public.can_administer_live_auction_room(item_row.room_id) then raise exception 'Live Auction administrator access is required'; end if; if item_row.status <> 'LIVE' or item_row.auction_type <> 'OPEN' or item_row.open_bidding_mode <> 'OFFLINE' then raise exception 'Offline price updates are only available for a live offline open auction'; end if; if p_price < 0 then raise exception 'Price cannot be negative'; end if; if p_leader_id is not null then select * into leader_row from public.live_auction_participants where id=p_leader_id and room_id=item_row.room_id and access_type='player' and removed_at is null; if not found or leader_row.current_balance < p_price then raise exception 'The selected leader cannot afford this price'; end if; end if; update public.auction_items set current_price=p_price,current_leader_id=p_leader_id where id=p_item_id; insert into public.auction_price_history(item_id,price,leader_id) values(p_item_id,p_price,p_leader_id); perform public.live_auction_emit(item_row.room_id,'offline_price_updated'); end $$;
create or replace function public.submit_live_auction_bid(p_item_id uuid, p_amount numeric) returns void language plpgsql security definer set search_path = public as $$ declare item_row public.auction_items%rowtype; participant_row public.live_auction_participants%rowtype; begin select * into item_row from public.auction_items where id=p_item_id for update; if not found then raise exception 'Auction item not found'; end if; select * into participant_row from public.live_auction_participants where room_id=item_row.room_id and auth_user_id=auth.uid() and access_type='player' and removed_at is null for update; if not found then raise exception 'Only a buyer may bid'; end if; if item_row.status <> 'LIVE' or item_row.auction_type <> 'OPEN' or item_row.open_bidding_mode <> 'ONLINE' then raise exception 'Online bids are not open for this item'; end if; if p_amount < item_row.current_price + item_row.bid_increment then raise exception 'Your bid must be at least the next legal bid'; end if; if participant_row.current_balance < p_amount then raise exception 'Your bid cannot exceed your current balance'; end if; insert into public.auction_bids(item_id,participant_id,amount,bid_type) values(p_item_id,participant_row.id,p_amount,'ONLINE'); update public.auction_items set current_price=p_amount,current_leader_id=participant_row.id where id=p_item_id; insert into public.auction_price_history(item_id,price,leader_id) values(p_item_id,p_amount,participant_row.id); perform public.live_auction_emit(item_row.room_id,'online_bid_accepted'); end $$;
create or replace function public.submit_live_auction_sealed_bid(p_item_id uuid, p_amount numeric) returns void language plpgsql security definer set search_path = public as $$ declare item_row public.auction_items%rowtype; participant_row public.live_auction_participants%rowtype; begin select * into item_row from public.auction_items where id=p_item_id for update; if not found then raise exception 'Auction item not found'; end if; select * into participant_row from public.live_auction_participants where room_id=item_row.room_id and auth_user_id=auth.uid() and access_type='player' and removed_at is null for update; if not found then raise exception 'Only a buyer may submit a sealed bid'; end if; if item_row.status <> 'LIVE' or item_row.auction_type <> 'SEALED' then raise exception 'Sealed bids are not open for this item'; end if; if p_amount < 0 or participant_row.current_balance < p_amount then raise exception 'Your sealed bid cannot exceed your current balance'; end if; insert into public.auction_bids(item_id,participant_id,amount,bid_type) values(p_item_id,participant_row.id,p_amount,'SEALED') on conflict (item_id,participant_id) where bid_type='SEALED' do update set amount=excluded.amount,created_at=timezone('utc',now()); perform public.live_auction_emit(item_row.room_id,'sealed_bid_submitted'); end $$;
create or replace function public.close_live_auction_item(p_item_id uuid, p_winner_id uuid default null) returns void language plpgsql security definer set search_path = public as $$ declare item_row public.auction_items%rowtype; winner_row public.live_auction_participants%rowtype; winning_bid public.auction_bids%rowtype; winning_value numeric; final_price numeric; begin select * into item_row from public.auction_items where id=p_item_id for update; if not found or not public.can_administer_live_auction_room(item_row.room_id) then raise exception 'Live Auction administrator access is required'; end if; if item_row.status <> 'LIVE' then raise exception 'Only a live item can be closed'; end if;
  if item_row.auction_type='SEALED' then select b.* into winning_bid from public.auction_bids b join public.live_auction_participants p on p.id=b.participant_id where b.item_id=p_item_id and b.bid_type='SEALED' and p.current_balance>=b.amount order by b.amount desc,b.created_at asc limit 1; if winning_bid.id is not null then select * into winner_row from public.live_auction_participants where id=winning_bid.participant_id for update; final_price:=winning_bid.amount; end if;
  elsif item_row.open_bidding_mode='ONLINE' then select * into winner_row from public.live_auction_participants where id=item_row.current_leader_id for update; final_price:=item_row.current_price;
  else select * into winner_row from public.live_auction_participants where id=coalesce(p_winner_id,item_row.current_leader_id) and room_id=item_row.room_id for update; final_price:=item_row.current_price; end if;
  if winner_row.id is null then update public.auction_items set status='CLOSED' where id=p_item_id; perform public.live_auction_emit(item_row.room_id,'auction_closed_without_sale'); return; end if;
  if winner_row.access_type <> 'player' or winner_row.removed_at is not null or winner_row.current_balance < final_price then raise exception 'The selected winner cannot settle this auction'; end if;
  select private_value into winning_value from public.auction_item_values where item_id=p_item_id and participant_id=winner_row.id; update public.live_auction_participants set current_balance=current_balance-final_price where id=winner_row.id and current_balance>=final_price; if not found then raise exception 'The selected winner cannot settle this auction'; end if;
  update public.auction_items set status='CLOSED',current_leader_id=winner_row.id,winner_id=winner_row.id,winning_price=final_price where id=p_item_id;
  insert into public.auction_results(item_id,winner_id,winning_price,private_value,consumer_surplus) values(p_item_id,winner_row.id,final_price,winning_value,winning_value-final_price);
  perform public.live_auction_emit(item_row.room_id,'auction_closed'); end $$;
create or replace function public.preview_live_auction_settlement(p_item_id uuid, p_winner_id uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare item_row public.auction_items%rowtype; winner_row public.live_auction_participants%rowtype; winning_bid public.auction_bids%rowtype; private_value numeric; final_price numeric;
begin
  select * into item_row from public.auction_items where id=p_item_id; if not found or not public.can_administer_live_auction_room(item_row.room_id) then raise exception 'Live Auction administrator access is required'; end if;
  if item_row.status <> 'LIVE' then raise exception 'Only a live item can be settled'; end if;
  if item_row.auction_type='SEALED' then select b.* into winning_bid from public.auction_bids b join public.live_auction_participants p on p.id=b.participant_id where b.item_id=p_item_id and b.bid_type='SEALED' and p.current_balance>=b.amount order by b.amount desc,b.created_at asc limit 1; if winning_bid.id is not null then select * into winner_row from public.live_auction_participants where id=winning_bid.participant_id; final_price:=winning_bid.amount; end if;
  elsif item_row.open_bidding_mode='ONLINE' then select * into winner_row from public.live_auction_participants where id=item_row.current_leader_id; final_price:=item_row.current_price;
  else select * into winner_row from public.live_auction_participants where id=coalesce(p_winner_id,item_row.current_leader_id) and room_id=item_row.room_id; final_price:=item_row.current_price; end if;
  if winner_row.id is null then return jsonb_build_object('winnerId',null,'winnerName',null,'winningPrice',null,'currentBalance',null,'privateValue',null); end if;
  select v.private_value into private_value from public.auction_item_values v where v.item_id=p_item_id and v.participant_id=winner_row.id;
  return jsonb_build_object('winnerId',winner_row.id,'winnerName',winner_row.display_name,'winningPrice',final_price,'currentBalance',winner_row.current_balance,'privateValue',private_value);
end $$;
create or replace function public.enter_live_auction_debrief(p_item_id uuid) returns void language plpgsql security definer set search_path = public as $$ declare item_row public.auction_items%rowtype; begin select * into item_row from public.auction_items where id=p_item_id for update; if not found or not public.can_administer_live_auction_room(item_row.room_id) then raise exception 'Live Auction administrator access is required'; end if; if item_row.status <> 'CLOSED' then raise exception 'Only a closed auction can enter debrief'; end if; update public.auction_items set status='DEBRIEF' where id=p_item_id; perform public.live_auction_emit(item_row.room_id,'debrief_opened'); end $$;

create or replace function public.get_live_auction_view(p_room_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare room_row public.live_auction_rooms%rowtype; mine public.live_auction_participants%rowtype; is_admin boolean; begin
  select * into mine from public.live_auction_participants where room_id=p_room_id and auth_user_id=auth.uid() and removed_at is null; if not found then raise exception 'Enter this Live Auction room with an invitation code first'; end if;
  select * into room_row from public.live_auction_rooms where id=p_room_id; if not found then raise exception 'Live Auction room not found'; end if; is_admin := mine.access_type='admin'; update public.live_auction_participants set last_seen_at=timezone('utc',now()) where id=mine.id;
  return jsonb_build_object('room',jsonb_build_object('id',room_row.id,'name',room_row.name,'participantCapacity',room_row.participant_capacity,'startingBalance',room_row.starting_balance,'createdAt',room_row.created_at),'access',jsonb_build_object('type',mine.access_type,'displayName',mine.display_name,'participantId',mine.id),'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'displayName',p.display_name,'currentBalance',p.current_balance,'mine',p.id=mine.id) order by p.joined_at) from public.live_auction_participants p where p.room_id=p_room_id and p.removed_at is null and p.access_type='player' and (is_admin or p.id=mine.id)),'[]'::jsonb),'items',coalesce((select jsonb_agg(item_value order by created_at desc) from (select jsonb_build_object(
    'id',i.id,'name',i.name,'description',i.description,'startingPrice',i.starting_price,'currentPrice',i.current_price,'bidIncrement',i.bid_increment,'auctionType',i.auction_type,'openBiddingMode',i.open_bidding_mode,'status',i.status,'currentLeaderId',i.current_leader_id,'currentLeaderName',leader.display_name,'winnerId',i.winner_id,'winnerName',winner.display_name,'winningPrice',i.winning_price,
    'myPrivateValue',(select v.private_value from public.auction_item_values v where v.item_id=i.id and v.participant_id=mine.id),'mySealedBid',(select b.amount from public.auction_bids b where b.item_id=i.id and b.participant_id=mine.id and b.bid_type='SEALED'),'submittedCount',(select count(*) from public.auction_bids b where b.item_id=i.id and b.bid_type='SEALED'),
    'bidHistory',case when is_admin and (i.auction_type='OPEN' or i.status='DEBRIEF') then coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'participantId',b.participant_id,'participantName',bp.display_name,'amount',b.amount,'createdAt',b.created_at) order by b.created_at desc) from public.auction_bids b join public.live_auction_participants bp on bp.id=b.participant_id where b.item_id=i.id and (i.auction_type='OPEN' or i.status='DEBRIEF')),'[]'::jsonb) else '[]'::jsonb end,
    'priceHistory',case when is_admin then coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'price',h.price,'leaderId',h.leader_id,'leaderName',hp.display_name,'createdAt',h.created_at) order by h.created_at) from public.auction_price_history h left join public.live_auction_participants hp on hp.id=h.leader_id where h.item_id=i.id),'[]'::jsonb) else '[]'::jsonb end,
    'debriefRows',case when is_admin and i.status='DEBRIEF' then coalesce((select jsonb_agg(jsonb_build_object('participantId',p.id,'displayName',p.display_name,'privateValue',v.private_value,'bid',(select max(b.amount) from public.auction_bids b where b.item_id=i.id and b.participant_id=p.id),'difference',case when (select max(b.amount) from public.auction_bids b where b.item_id=i.id and b.participant_id=p.id) is null then null else (select max(b.amount) from public.auction_bids b where b.item_id=i.id and b.participant_id=p.id)-v.private_value end) order by p.display_name) from public.live_auction_participants p join public.auction_item_values v on v.participant_id=p.id and v.item_id=i.id where p.room_id=p_room_id),'[]'::jsonb) else '[]'::jsonb end,
    'hostValues',case when is_admin then coalesce((select jsonb_agg(jsonb_build_object('participantId',p.id,'displayName',p.display_name,'privateValue',v.private_value) order by p.display_name) from public.live_auction_participants p join public.auction_item_values v on v.participant_id=p.id and v.item_id=i.id where p.room_id=p_room_id),'[]'::jsonb) else '[]'::jsonb end
  ) item_value,i.created_at from public.auction_items i left join public.live_auction_participants leader on leader.id=i.current_leader_id left join public.live_auction_participants winner on winner.id=i.winner_id where i.room_id=p_room_id) items),'[]'::jsonb));
end $$;

alter table public.live_auction_rooms enable row level security;
alter table public.live_auction_participants enable row level security;
alter table public.auction_items enable row level security;
alter table public.auction_item_values enable row level security;
alter table public.auction_bids enable row level security;
alter table public.auction_price_history enable row level security;
alter table public.auction_results enable row level security;
alter table public.live_auction_events enable row level security;
create policy live_auction_events_read_room_members on public.live_auction_events for select to authenticated using (public.can_view_live_auction_room(room_id));
alter publication supabase_realtime add table public.live_auction_events;
grant execute on function public.create_live_auction_room(text,integer,numeric), public.list_live_auction_rooms_for_admin(), public.join_live_auction_room(uuid,text,text), public.get_live_auction_view(uuid), public.set_live_auction_balance(uuid,numeric), public.remove_live_auction_participant(uuid), public.create_live_auction_item(uuid,text,text,numeric,numeric,text,text,jsonb), public.start_live_auction_item(uuid), public.update_live_auction_offline_price(uuid,numeric,uuid), public.submit_live_auction_bid(uuid,numeric), public.submit_live_auction_sealed_bid(uuid,numeric), public.close_live_auction_item(uuid,uuid), public.preview_live_auction_settlement(uuid,uuid), public.enter_live_auction_debrief(uuid) to authenticated;

create or replace function private.cleanup_expired_live_auction_anonymous_users() returns integer language plpgsql security definer set search_path = '' as $$ declare deleted_count integer; begin delete from auth.users u where u.is_anonymous is true and u.created_at < timezone('utc',now()) - interval '7 days' and u.raw_user_meta_data->>'econmind_session_scope'='live_auction'; get diagnostics deleted_count = row_count; return deleted_count; end $$;
revoke all on function private.cleanup_expired_live_auction_anonymous_users() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname='econmind-live-auction-anonymous-cleanup';
select cron.schedule('econmind-live-auction-anonymous-cleanup','23 3 * * *',$$select private.cleanup_expired_live_auction_anonymous_users()$$);
