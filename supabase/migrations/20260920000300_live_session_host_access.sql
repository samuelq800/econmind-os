-- Teachers and School Leaders may host their own short Live World and Live Auction sessions.
-- Platform Admins retain cross-platform visibility; other hosts only see rooms they created.

create or replace function public.is_live_session_host(p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin(p_user_id) or exists(
    select 1 from public.profiles p
    where p.user_id = p_user_id
      and (p.role = 'teacher' or p.platform_role = 'school_leader')
  )
$$;
revoke all on function public.is_live_session_host(uuid) from public, anon, authenticated;

create or replace function public.create_live_world_room(p_name text, p_duration_seconds integer, p_participant_capacity integer)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare created public.live_world_rooms%rowtype;
declare player_code text := public.live_world_code('PLAY');
declare admin_code text := public.live_world_code('ADMIN');
begin
  if auth.uid() is null or not public.is_live_session_host(auth.uid()) then raise exception 'Teacher, School Leader, or Platform Admin access is required to create a Live World room'; end if;
  if p_duration_seconds < 300 or p_duration_seconds > 3600 then raise exception 'Duration must be between 5 and 60 minutes'; end if;
  if p_participant_capacity < 1 or p_participant_capacity > 20 then raise exception 'Player capacity must be between 1 and 20'; end if;
  insert into public.live_world_rooms(name, duration_seconds, remaining_seconds, participant_capacity, player_code_hash, admin_code_hash, created_by)
  values(trim(p_name), p_duration_seconds, p_duration_seconds, p_participant_capacity, encode(extensions.digest(player_code, 'sha256'), 'hex'), encode(extensions.digest(admin_code, 'sha256'), 'hex'), auth.uid())
  returning * into created;
  insert into public.live_world_events(room_id, event_type, message) values(created.id, 'room_created', 'Room created and waiting for participants.');
  return jsonb_build_object('room', jsonb_build_object('id', created.id, 'name', created.name, 'status', created.status, 'durationSeconds', created.duration_seconds, 'participantCapacity', created.participant_capacity, 'createdAt', created.created_at), 'playerCode', player_code, 'adminCode', admin_code);
end;
$$;

create or replace function public.list_live_world_rooms_for_admin()
returns table(id uuid, name text, status text, duration_seconds integer, started_at timestamptz, ended_at timestamptz, created_at timestamptz, participant_count bigint, participant_capacity integer)
language sql stable security definer set search_path = public
as $$
  select r.id, r.name, r.status, r.duration_seconds, r.started_at, r.ended_at, r.created_at, count(p.id), r.participant_capacity
  from public.live_world_rooms r left join public.live_world_participants p on p.room_id = r.id
  where public.is_live_session_host(auth.uid()) and (public.is_platform_admin(auth.uid()) or r.created_by = auth.uid())
  group by r.id order by r.created_at desc
$$;

create or replace function public.create_live_auction_room(p_name text, p_participant_capacity integer default 30, p_starting_balance numeric default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare player_code text := public.live_auction_code('PLAY'); admin_code text := public.live_auction_code('ADMIN'); created public.live_auction_rooms%rowtype;
begin
  if auth.uid() is null or not public.is_live_session_host(auth.uid()) then raise exception 'Teacher, School Leader, or Platform Admin access is required to create a Live Auction room'; end if;
  if p_participant_capacity not between 1 and 100 or p_starting_balance not between 0 and 1000000 then raise exception 'Invalid Live Auction room settings'; end if;
  insert into public.live_auction_rooms(name, participant_capacity, starting_balance, player_code_hash, admin_code_hash, created_by)
  values(trim(p_name), p_participant_capacity, p_starting_balance, encode(extensions.digest(player_code, 'sha256'), 'hex'), encode(extensions.digest(admin_code, 'sha256'), 'hex'), auth.uid()) returning * into created;
  perform public.live_auction_emit(created.id, 'room_created');
  return jsonb_build_object('room', jsonb_build_object('id', created.id, 'name', created.name, 'participantCapacity', created.participant_capacity, 'startingBalance', created.starting_balance, 'createdAt', created.created_at), 'playerCode', player_code, 'adminCode', admin_code);
end $$;

create or replace function public.list_live_auction_rooms_for_admin() returns table(id uuid, name text, participant_count bigint, participant_capacity integer, item_count bigint, created_at timestamptz)
language sql security definer set search_path = public
as $$
  select r.id, r.name, count(distinct p.id) filter (where p.access_type = 'player' and p.removed_at is null), r.participant_capacity, count(distinct i.id), r.created_at
  from public.live_auction_rooms r left join public.live_auction_participants p on p.room_id = r.id left join public.auction_items i on i.room_id = r.id
  where public.is_live_session_host(auth.uid()) and (public.is_platform_admin(auth.uid()) or r.created_by = auth.uid())
  group by r.id order by r.created_at desc
$$;

grant execute on function public.create_live_world_room(text, integer, integer), public.list_live_world_rooms_for_admin(), public.create_live_auction_room(text, integer, numeric), public.list_live_auction_rooms_for_admin() to authenticated;
