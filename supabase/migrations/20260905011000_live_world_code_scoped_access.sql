-- Invitation codes select the Live World persona for this browser. In
-- particular, a player code must not restore a previous administrator view.
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
declare requested_access text;
declare player_count integer;
declare has_existing_participant boolean := false;
begin
  if auth.uid() is null then raise exception 'A temporary room session is required'; end if;
  if char_length(name_value) not between 1 and 48 then raise exception 'Enter a display name between 1 and 48 characters'; end if;
  select * into room_row from public.live_world_rooms where id = p_room_id for update;
  if not found then raise exception 'Live World room not found'; end if;
  is_admin_code := code_hash = room_row.admin_code_hash;
  if not is_admin_code and code_hash <> room_row.player_code_hash then raise exception 'This room code is invalid'; end if;

  select * into participant_row from public.live_world_participants where room_id = p_room_id and auth_user_id = auth.uid() for update;
  has_existing_participant := found;
  select count(*) into player_count from public.live_world_participants where room_id = p_room_id and access_type = 'player' and (not has_existing_participant or id <> participant_row.id);
  requested_access := case when is_admin_code then 'admin' when player_count >= room_row.participant_capacity then 'observer' else 'player' end;

  if has_existing_participant then
    update public.live_world_participants set access_type = requested_access, last_seen_at = timezone('utc', now()) where id = participant_row.id returning * into participant_row;
    return jsonb_build_object('accessType', participant_row.access_type, 'countryId', null, 'role', null);
  end if;

  select * into same_name_row from public.live_world_participants where room_id = p_room_id and display_name_key = name_key for update;
  if found then
    if same_name_row.access_type = 'admin' and not is_admin_code then raise exception 'That display name is reserved for an administrator. Choose another display name.'; end if;
    update public.live_world_participants set auth_user_id = auth.uid(), access_type = requested_access, last_seen_at = timezone('utc', now()) where id = same_name_row.id returning * into participant_row;
    return jsonb_build_object('accessType', participant_row.access_type, 'countryId', null, 'role', null);
  end if;

  insert into public.live_world_participants(room_id, auth_user_id, display_name, display_name_key, access_type)
  values(p_room_id, auth.uid(), name_value, name_key, requested_access)
  returning * into participant_row;
  insert into public.live_world_events(room_id, event_type, message)
  values(p_room_id, case when participant_row.access_type = 'observer' then 'observer_joined' else 'participant_joined' end, participant_row.display_name || case when participant_row.access_type = 'observer' then ' is observing the shared screen.' else ' joined the room.' end);
  return jsonb_build_object('accessType', participant_row.access_type, 'countryId', null, 'role', null);
exception when unique_violation then raise exception 'That display name is already in use for this room';
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
    'access', jsonb_build_object('type', coalesce(participant_row.access_type, case when public.is_platform_admin(auth.uid()) then 'admin' else 'observer' end), 'displayName', coalesce(participant_row.display_name, 'Platform Admin'), 'countryId', null, 'role', null),
    'seats', coalesce((select jsonb_agg(jsonb_build_object('countryId', a.country_key, 'role', a.role_key, 'displayName', p.display_name, 'mine', p.auth_user_id = auth.uid()) order by a.country_key, a.role_key) from public.live_world_seat_assignments a join public.live_world_participants p on p.id = a.participant_id where a.room_id = p_room_id), '[]'::jsonb),
    'state', jsonb_build_object('publishedPolicies', coalesce(room_row.state -> 'publishedPolicies', '{}'::jsonb), 'agreements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'proposerCountry', a.proposer_country_key, 'receiverCountry', a.receiver_country_key, 'depth', a.depth, 'status', a.status, 'createdAt', a.created_at, 'decidedAt', a.decided_at) order by a.created_at desc) from public.live_world_agreements a where a.room_id = p_room_id), '[]'::jsonb), 'crises', coalesce((select jsonb_agg(jsonb_build_object('id', c.crisis_key, 'active', c.active) order by c.activated_at desc) from public.live_world_crises c where c.room_id = p_room_id), '[]'::jsonb), 'sanctions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'initiatorCountry', s.initiator_country_key, 'targetCountry', s.target_country_key, 'tariffRate', s.tariff_rate, 'status', s.status, 'createdAt', s.created_at) order by s.updated_at desc) from public.live_world_sanctions s where s.room_id = p_room_id), '[]'::jsonb)),
    'messages', coalesce((select jsonb_agg(message_value order by created_at asc) from (select jsonb_build_object('id', m.id, 'countryId', m.country_key, 'displayName', p.display_name, 'body', m.body, 'createdAt', m.created_at) message_value, m.created_at from public.live_world_messages m join public.live_world_participants p on p.id = m.participant_id where m.room_id = p_room_id order by m.created_at desc limit 80) recent_messages), '[]'::jsonb),
    'drafts', case when public.is_platform_admin(auth.uid()) and participant_row.id is null then coalesce((select jsonb_object_agg(country_key, role_drafts) from (select country_key, jsonb_object_agg(role_key, draft_policy) role_drafts from public.live_world_seat_assignments where room_id = p_room_id group by country_key) grouped), '{}'::jsonb) else coalesce((select jsonb_object_agg(country_key, role_drafts) from (select a.country_key, jsonb_object_agg(a.role_key, a.draft_policy) role_drafts from public.live_world_seat_assignments a where a.room_id = p_room_id and a.participant_id = participant_row.id group by a.country_key) grouped), '{}'::jsonb) end,
    'events', coalesce((select jsonb_agg(event_value order by created_at desc) from (select jsonb_build_object('id', e.id, 'type', e.event_type, 'message', e.message, 'countryId', e.country_key, 'createdAt', e.created_at, 'details', e.details) event_value, e.created_at from public.live_world_events e where e.room_id = p_room_id order by e.created_at desc limit 40) feed), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.join_live_world_room(uuid, text, text), public.get_live_world_view(uuid) to authenticated;
