-- Follow-up for 20260920000000_live_auction.sql.
-- The original migration has already been applied to production; keep these changes additive.

create or replace function public.start_live_auction_item(p_item_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare item_row public.auction_items%rowtype; room_row public.live_auction_rooms%rowtype;
begin
  select * into item_row from public.auction_items where id=p_item_id for update;
  if not found or not public.can_administer_live_auction_room(item_row.room_id) then raise exception 'Live Auction administrator access is required'; end if;
  -- Serialise starts for a room, rather than only locking the selected draft item.
  select * into room_row from public.live_auction_rooms where id=item_row.room_id for update;
  if item_row.status <> 'DRAFT' then raise exception 'Only a draft item can be started'; end if;
  if exists(select 1 from public.auction_items where room_id=item_row.room_id and status='LIVE') then raise exception 'Close the current auction before starting another item'; end if;
  update public.auction_items set status='LIVE' where id=p_item_id;
  perform public.live_auction_emit(item_row.room_id,'auction_started');
end $$;

create or replace function public.preview_live_auction_settlement(p_item_id uuid, p_winner_id uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare item_row public.auction_items%rowtype; winner_row public.live_auction_participants%rowtype; winning_bid public.auction_bids%rowtype; private_value numeric; final_price numeric;
begin
  select * into item_row from public.auction_items where id=p_item_id;
  if not found or not public.can_administer_live_auction_room(item_row.room_id) then raise exception 'Live Auction administrator access is required'; end if;
  if item_row.status <> 'LIVE' then raise exception 'Only a live item can be settled'; end if;
  if item_row.auction_type='SEALED' then
    select b.* into winning_bid from public.auction_bids b join public.live_auction_participants p on p.id=b.participant_id where b.item_id=p_item_id and b.bid_type='SEALED' and p.current_balance>=b.amount order by b.amount desc,b.created_at asc limit 1;
    if winning_bid.id is not null then select * into winner_row from public.live_auction_participants where id=winning_bid.participant_id; final_price:=winning_bid.amount; end if;
  elsif item_row.open_bidding_mode='ONLINE' then
    select * into winner_row from public.live_auction_participants where id=item_row.current_leader_id; final_price:=item_row.current_price;
  else
    select * into winner_row from public.live_auction_participants where id=coalesce(p_winner_id,item_row.current_leader_id) and room_id=item_row.room_id; final_price:=item_row.current_price;
  end if;
  if winner_row.id is null then return jsonb_build_object('winnerId',null,'winnerName',null,'winningPrice',null,'currentBalance',null,'privateValue',null); end if;
  select v.private_value into private_value from public.auction_item_values v where v.item_id=p_item_id and v.participant_id=winner_row.id;
  return jsonb_build_object('winnerId',winner_row.id,'winnerName',winner_row.display_name,'winningPrice',final_price,'currentBalance',winner_row.current_balance,'privateValue',private_value);
end $$;

-- Preserve the previously deployed function under an internal name, then correct its
-- host payload without exposing administrators in the buyer list.
alter function public.get_live_auction_view(uuid) rename to get_live_auction_view_legacy;
create or replace function public.get_live_auction_view(p_room_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare view_value jsonb; player_values jsonb; item_values jsonb; is_admin boolean;
begin
  view_value := public.get_live_auction_view_legacy(p_room_id);
  is_admin := view_value -> 'access' ->> 'type' = 'admin';
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'displayName',p.display_name,'currentBalance',p.current_balance,'mine',p.id=(view_value -> 'access' ->> 'participantId')::uuid) order by p.joined_at),'[]'::jsonb)
    into player_values from public.live_auction_participants p where p.room_id=p_room_id and p.access_type='player' and p.removed_at is null;
  select coalesce(jsonb_agg(entry || jsonb_build_object('bidHistory', case when is_admin and ((entry ->> 'auctionType')='OPEN' or (entry ->> 'status')='DEBRIEF') then coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'participantId',b.participant_id,'participantName',bp.display_name,'amount',b.amount,'createdAt',b.created_at) order by b.created_at desc) from public.auction_bids b join public.live_auction_participants bp on bp.id=b.participant_id where b.item_id=(entry ->> 'id')::uuid and ((entry ->> 'auctionType')='OPEN' or (entry ->> 'status')='DEBRIEF')),'[]'::jsonb) else '[]'::jsonb end) order by position),'[]'::jsonb)
    into item_values from jsonb_array_elements(view_value -> 'items') with ordinality as item(entry, position);
  return jsonb_set(jsonb_set(view_value,'{participants}',player_values),'{items}',item_values);
end $$;

revoke all on function public.live_auction_code(text), public.live_auction_participant(uuid,uuid), public.can_administer_live_auction_room(uuid,uuid), public.live_auction_emit(uuid,text), public.get_live_auction_view_legacy(uuid) from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_auction_events') then
    alter publication supabase_realtime add table public.live_auction_events;
  end if;
end $$;

grant execute on function public.get_live_auction_view(uuid), public.preview_live_auction_settlement(uuid,uuid), public.start_live_auction_item(uuid) to authenticated;
