-- Give every client the same absolute timer boundary. A rounded remaining
-- second is still returned for compatibility, but must not drive the clock.
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
    'room', jsonb_build_object(
      'id', room_row.id,
      'name', room_row.name,
      'status', effective_status,
      'durationSeconds', room_row.duration_seconds,
      'remainingSeconds', case when room_row.status = 'live' and room_row.started_at is not null then greatest(0, ceil(extract(epoch from (room_row.started_at + make_interval(secs => room_row.remaining_seconds) - timezone('utc', now()))))::integer) else room_row.remaining_seconds end,
      'timerEndsAt', case when room_row.status = 'live' and room_row.started_at is not null then room_row.started_at + make_interval(secs => room_row.remaining_seconds) else null end,
      'startedAt', room_row.started_at,
      'endedAt', room_row.ended_at,
      'createdAt', room_row.created_at
    ),
    'access', jsonb_build_object('type', case when public.is_platform_admin(auth.uid()) then 'admin' else participant_row.access_type end, 'displayName', coalesce(participant_row.display_name, 'Platform Admin'), 'countryId', participant_row.country_key, 'role', participant_row.role_key),
    'seats', coalesce((select jsonb_agg(jsonb_build_object('countryId', s.country_key, 'role', s.role_key, 'displayName', s.display_name, 'mine', s.auth_user_id = auth.uid()) order by s.country_key, s.role_key) from public.live_world_participants s where s.room_id = p_room_id and s.country_key is not null and s.role_key is not null), '[]'::jsonb),
    'state', jsonb_build_object('publishedPolicies', coalesce(room_row.state -> 'publishedPolicies', '{}'::jsonb), 'agreements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'proposerCountry', a.proposer_country_key, 'receiverCountry', a.receiver_country_key, 'depth', a.depth, 'status', a.status, 'createdAt', a.created_at, 'decidedAt', a.decided_at) order by a.created_at desc) from public.live_world_agreements a where a.room_id = p_room_id), '[]'::jsonb), 'crises', coalesce((select jsonb_agg(jsonb_build_object('id', c.crisis_key, 'active', c.active) order by c.activated_at desc) from public.live_world_crises c where c.room_id = p_room_id), '[]'::jsonb)),
    'drafts', case when public.is_platform_admin(auth.uid()) then coalesce((select jsonb_object_agg(country_key, role_drafts) from (select country_key, jsonb_object_agg(role_key, draft_policy) role_drafts from public.live_world_participants where room_id = p_room_id and country_key is not null and role_key is not null group by country_key) grouped), '{}'::jsonb) when participant_row.country_key is not null then coalesce((select jsonb_object_agg(country_key, role_drafts) from (select country_key, jsonb_object_agg(role_key, draft_policy) role_drafts from public.live_world_participants where room_id = p_room_id and country_key = participant_row.country_key and role_key is not null group by country_key) grouped), '{}'::jsonb) else '{}'::jsonb end,
    'events', coalesce((select jsonb_agg(event_value order by created_at desc) from (select jsonb_build_object('id', e.id, 'type', e.event_type, 'message', e.message, 'countryId', e.country_key, 'createdAt', e.created_at) event_value, e.created_at from public.live_world_events e where e.room_id = p_room_id order by e.created_at desc limit 40) feed), '[]'::jsonb)
  );
end;
$$;
