-- Preset item metadata and asset references. Additive for existing Live Auction rooms.
alter table public.auction_items add column if not exists image_url text check (image_url is null or char_length(image_url) <= 500);
alter table public.auction_items add column if not exists preset_id text check (preset_id is null or char_length(preset_id) <= 120);

create or replace function public.create_live_auction_item(p_room_id uuid, p_name text, p_description text, p_starting_price numeric, p_bid_increment numeric, p_auction_type text, p_open_bidding_mode text, p_value_assignment jsonb, p_image_url text default null, p_preset_id text default null) returns uuid language plpgsql security definer set search_path = public as $$
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
  if mode_value = 'manual' then select count(*) into supplied_count from jsonb_object_keys(p_value_assignment -> 'values'); if supplied_count <> participant_count or exists(select 1 from jsonb_each_text(p_value_assignment -> 'values') e where e.value !~ '^[0-9]+(\\.[0-9]+)?$' or e.value::numeric > 1000000) then raise exception 'Enter one non-negative private value for every buyer'; end if; end if;
  insert into public.auction_items(room_id,name,description,image_url,preset_id,auction_type,open_bidding_mode,starting_price,current_price,bid_increment,value_assignment) values(p_room_id,trim(p_name),nullif(trim(p_description),''),nullif(trim(p_image_url),''),nullif(trim(p_preset_id),''),p_auction_type,p_open_bidding_mode,p_starting_price,p_starting_price,p_bid_increment,p_value_assignment) returning * into item_row;
  insert into public.auction_item_values(item_id,participant_id,private_value) select item_row.id,p.id,case when mode_value = 'same' then (p_value_assignment ->> 'value')::numeric when mode_value = 'random' then floor(random()*((p_value_assignment ->> 'max')::numeric-(p_value_assignment ->> 'min')::numeric+1))+(p_value_assignment ->> 'min')::numeric else (p_value_assignment -> 'values' ->> p.id::text)::numeric end from public.live_auction_participants p where p.room_id=p_room_id and p.access_type='player' and p.removed_at is null;
  insert into public.auction_price_history(item_id,price) values(item_row.id,p_starting_price); perform public.live_auction_emit(p_room_id,'item_created'); return item_row.id;
end $$;

create or replace function public.get_live_auction_view(p_room_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare view_value jsonb; player_values jsonb; item_values jsonb; is_admin boolean;
begin
  view_value := public.get_live_auction_view_legacy(p_room_id);
  is_admin := view_value -> 'access' ->> 'type' = 'admin';
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'displayName',p.display_name,'currentBalance',p.current_balance,'mine',p.id=(view_value -> 'access' ->> 'participantId')::uuid) order by p.joined_at),'[]'::jsonb) into player_values from public.live_auction_participants p where p.room_id=p_room_id and p.access_type='player' and p.removed_at is null;
  select coalesce(jsonb_agg(entry || jsonb_build_object('imageUrl',(select i.image_url from public.auction_items i where i.id=(entry ->> 'id')::uuid),'presetId',(select i.preset_id from public.auction_items i where i.id=(entry ->> 'id')::uuid),'bidHistory',case when is_admin and ((entry ->> 'auctionType')='OPEN' or (entry ->> 'status')='DEBRIEF') then coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'participantId',b.participant_id,'participantName',bp.display_name,'amount',b.amount,'createdAt',b.created_at) order by b.created_at desc) from public.auction_bids b join public.live_auction_participants bp on bp.id=b.participant_id where b.item_id=(entry ->> 'id')::uuid and ((entry ->> 'auctionType')='OPEN' or (entry ->> 'status')='DEBRIEF')),'[]'::jsonb) else '[]'::jsonb end) order by position),'[]'::jsonb) into item_values from jsonb_array_elements(view_value -> 'items') with ordinality as item(entry, position);
  return jsonb_set(jsonb_set(view_value,'{participants}',player_values),'{items}',item_values);
end $$;

grant execute on function public.create_live_auction_item(uuid,text,text,numeric,numeric,text,text,jsonb,text,text), public.get_live_auction_view(uuid) to authenticated;
