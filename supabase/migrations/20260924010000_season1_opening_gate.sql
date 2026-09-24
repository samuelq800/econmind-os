-- Season 1 entrance clock. This is a pre-season access gate only; it does not
-- unlock registration or the simulation event ledger.
alter table public.world_preseason_seasons
  add column if not exists lobby_opens_at timestamptz;

update public.world_preseason_seasons
set lobby_opens_at = '2026-09-25 13:00:00+00'::timestamptz
where code = 'season-1' and lobby_opens_at is null;

create or replace function public.world_preseason_gate_open()
returns boolean language sql volatile security definer set search_path = public as $$
  select coalesce((
    select clock_timestamp() >= season.lobby_opens_at
    from public.world_preseason_seasons season
    where season.code = 'season-1'
  ), false);
$$;

create or replace function public.get_world_preseason_opening()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_opening timestamptz; v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where user_id = auth.uid() and account_status = 'active'
  ) then
    raise exception 'An active authenticated account is required';
  end if;
  select lobby_opens_at into v_opening
  from public.world_preseason_seasons where code = 'season-1';
  if v_opening is null then raise exception 'Season 1 opening time is unavailable'; end if;
  return jsonb_build_object(
    'opensAt', v_opening,
    'serverNow', v_now,
    'isOpen', v_now >= v_opening
  );
end;
$$;

create or replace function public.set_world_preseason_opening(p_opens_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator access required';
  end if;
  if p_opens_at is null
    or p_opens_at < '2026-01-01 00:00:00+00'::timestamptz
    or p_opens_at > v_now + interval '5 years' then
    raise exception 'Invalid Season 1 opening time';
  end if;
  update public.world_preseason_seasons
  set lobby_opens_at = p_opens_at
  where code = 'season-1';
  if not found then raise exception 'Season 1 configuration is unavailable'; end if;
  return jsonb_build_object(
    'opensAt', p_opens_at,
    'serverNow', v_now,
    'isOpen', v_now >= p_opens_at
  );
end;
$$;

-- Every existing participant RPC already calls this helper. Replacing the
-- helper also blocks direct RPC calls before the entrance opens.
create or replace function public.world_preseason_require_participant()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where user_id = auth.uid() and account_status = 'active'
  ) then
    raise exception 'An active authenticated account is required';
  end if;
  if not public.world_preseason_gate_open() then
    raise exception 'Season 1 Team Lobby has not opened yet';
  end if;
end;
$$;

-- The earlier member release granted direct SELECT on discovery tables for
-- Realtime. Keep those privileges but close their member RLS policies too.
alter policy world_preseason_public_team_discovery on public.world_preseason_teams
  using (public.world_preseason_gate_open() and exists (
    select 1 from public.world_preseason_seasons s where s.id = season_id
  ));
alter policy world_preseason_member_roster_read on public.world_preseason_team_members
  using (public.world_preseason_gate_open() and (
    user_id = auth.uid() or exists (
      select 1 from public.world_preseason_team_members mine
      where mine.team_id = world_preseason_team_members.team_id and mine.user_id = auth.uid()
    ) or public.is_platform_admin(auth.uid())
  ));
alter policy world_preseason_channel_read on public.world_preseason_chat_channels
  using (public.world_preseason_gate_open() and (
    channel_type = 'LOBBY' or exists (
      select 1 from public.world_preseason_team_members mine
      where mine.team_id = world_preseason_chat_channels.team_id and mine.user_id = auth.uid()
    ) or public.is_platform_admin(auth.uid())
  ));
alter policy world_preseason_message_read on public.world_preseason_chat_messages
  using (public.world_preseason_gate_open() and exists (
    select 1 from public.world_preseason_chat_channels c
    where c.id = channel_id and (
      c.channel_type = 'LOBBY' or public.is_platform_admin(auth.uid()) or exists (
        select 1 from public.world_preseason_team_members mine
        where mine.team_id = c.team_id and mine.user_id = auth.uid()
      )
    )
  ));
alter policy world_preseason_free_agent_read on public.world_preseason_free_agents
  using (public.world_preseason_gate_open() and (
    availability_status = 'available' or user_id = auth.uid()
      or public.is_platform_admin(auth.uid())
  ));

revoke all on function public.world_preseason_gate_open() from public, anon, authenticated;
revoke all on function public.get_world_preseason_opening() from public, anon, authenticated;
revoke all on function public.set_world_preseason_opening(timestamptz) from public, anon, authenticated;
grant execute on function public.world_preseason_gate_open() to authenticated;
grant execute on function public.get_world_preseason_opening() to authenticated;
grant execute on function public.set_world_preseason_opening(timestamptz) to authenticated;
