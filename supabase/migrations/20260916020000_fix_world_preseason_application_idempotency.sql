-- Make the join action safe to retry. A double-click, a stale browser tab, or
-- a transient network retry should return the existing pending application
-- instead of surfacing the partial unique-index error to the participant.

create or replace function public.world_preseason_apply_to_team(p_team_id uuid, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_team public.world_preseason_teams%rowtype;
  v_id uuid;
begin
  perform public.world_preseason_require_participant();
  select * into v_team
  from public.world_preseason_teams
  where id = p_team_id
  for update;

  if not found or not v_team.recruiting or v_team.status = 'frozen' then
    raise exception 'This team is not recruiting';
  end if;
  if v_team.recruitment_mode = 'invite_only' then
    raise exception 'This team accepts invitations only';
  end if;
  if exists (
    select 1
    from public.world_preseason_team_members
    where season_id = v_team.season_id and user_id = auth.uid()
  ) then
    raise exception 'You already have an active team for this season';
  end if;

  insert into public.world_preseason_team_applications(
    season_id,
    team_id,
    applicant_user_id,
    note
  )
  values (
    v_team.season_id,
    v_team.id,
    auth.uid(),
    trim(coalesce(p_note, ''))
  )
  on conflict (season_id, team_id, applicant_user_id) where status = 'pending'
  do update set
    note = excluded.note,
    updated_at = timezone('utc', now())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.world_preseason_apply_to_team(uuid, text) to authenticated;
