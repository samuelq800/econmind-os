-- Season 1: automatic application acceptance and captain recruitment lock.
begin;
alter table public.world_preseason_teams add column if not exists recruitment_locked boolean not null default false;

create or replace function public.get_world_preseason_my_team()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype; v_membership public.world_preseason_team_members%rowtype;
begin
  perform public.world_preseason_require_participant();
  select m.* into v_membership from public.world_preseason_team_members m
  join public.world_preseason_seasons s on s.id = m.season_id
  where s.code = 'season-1' and m.user_id = auth.uid();
  if not found then return jsonb_build_object('team',null,'membership',null,'members','[]'::jsonb); end if;
  select * into v_team from public.world_preseason_teams where id = v_membership.team_id;
  return jsonb_build_object(
    'team', jsonb_build_object('id',v_team.id,'name',v_team.name,'code',v_team.team_code,'description',v_team.description,'capacity',v_team.capacity,'status',v_team.status,'recruitmentLocked',v_team.recruitment_locked,'recruitmentMode',v_team.recruitment_mode,'preferredLanguage',v_team.preferred_language,'teamStyle',v_team.team_style,'captainUserId',v_team.captain_user_id),
    'membership', jsonb_build_object('memberRole',v_membership.member_role,'isReady',v_membership.is_ready),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
      'userId',m.user_id,'displayName',coalesce(p.display_name,'Participant'),'schoolName',s.name,
      'memberRole',m.member_role,'rolePreferences',m.role_preferences,'isReady',m.is_ready,'joinedAt',m.joined_at
    ) order by (m.member_role = 'captain') desc,m.joined_at,m.user_id)
    from public.world_preseason_team_members m join public.profiles p on p.user_id = m.user_id
    left join public.schools s on s.id = p.school_id where m.team_id = v_team.id),'[]'::jsonb)
  );
end;
$$;
create or replace function public.world_preseason_refresh_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype; v_count integer; v_ready integer; v_minimum integer;
begin
  select * into v_team from public.world_preseason_teams where id = p_team_id for update;
  if not found or v_team.status in ('frozen','dissolved','registered','active') then return; end if;
  select count(*), count(*) filter (where is_ready) into v_count, v_ready from public.world_preseason_team_members where team_id = p_team_id;
  v_minimum := coalesce((select (config->>'minimumTeamSize')::integer from public.world_preseason_seasons where id = v_team.season_id), 2);
  update public.world_preseason_teams set recruiting = not v_team.recruitment_locked and v_count < v_team.capacity and v_team.recruitment_mode <> 'invite_only', status = case when v_count >= v_minimum and v_ready = v_count then 'ready' when v_count >= v_team.capacity then 'full' when v_count > 0 then 'recruiting' else 'forming' end where id = p_team_id;
end;
$$;


create or replace function public.world_preseason_set_team_lock(p_team_id uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype;
begin
  perform public.world_preseason_require_participant();
  select t.* into v_team from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id=t.season_id
  where t.id=p_team_id and s.code='season-1' for update of t;
  if not found or v_team.captain_user_id<>auth.uid() or not exists (
    select 1 from public.world_preseason_team_members where team_id=p_team_id and user_id=auth.uid() and member_role='captain'
  ) then raise exception 'Only the current team captain can lock or unlock the team'; end if;
  if v_team.status in ('frozen','dissolved','registered','active') then raise exception 'This team roster is locked for the season'; end if;
  if p_locked is null then raise exception 'Choose a lock state'; end if;
  update public.world_preseason_teams set recruitment_locked=p_locked,
    recruitment_mode=case when p_locked then recruitment_mode else 'open' end where id=p_team_id;
  perform public.world_preseason_refresh_team(p_team_id);
end;
$$;

-- Guard every membership entry path, including outstanding invitations and legacy approvals.
create or replace function public.world_preseason_guard_member_join()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype;
begin
  select * into v_team from public.world_preseason_teams where id=new.team_id for update;
  if not found or new.season_id<>v_team.season_id then raise exception 'Invalid team'; end if;
  if v_team.recruitment_locked or v_team.status in ('frozen','dissolved','registered','active') then
    raise exception 'This team is locked and is not accepting new members';
  end if;
  if (select count(*) from public.world_preseason_team_members where team_id=new.team_id) >= v_team.capacity then
    raise exception 'This team is full';
  end if;
  return new;
end;
$$;
drop trigger if exists world_preseason_guard_member_join on public.world_preseason_team_members;
create trigger world_preseason_guard_member_join before insert on public.world_preseason_team_members
for each row execute function public.world_preseason_guard_member_join();

create or replace function public.world_preseason_apply_to_team(p_team_id uuid, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype; v_id uuid; v_existing_team uuid;
begin
  perform public.world_preseason_require_participant();
  select t.* into v_team from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id=t.season_id
  where t.id=p_team_id and s.code='season-1' for update of t;
  if not found then raise exception 'Team not found'; end if;
  select team_id into v_existing_team from public.world_preseason_team_members
  where season_id=v_team.season_id and user_id=auth.uid();
  if v_existing_team=v_team.id then
    select id into v_id from public.world_preseason_team_applications
    where team_id=v_team.id and applicant_user_id=auth.uid() and status='accepted' order by created_at desc limit 1;
    return coalesce(v_id,v_team.id);
  end if;
  if v_existing_team is not null then raise exception 'You already have an active team for this season'; end if;
  if v_team.recruitment_locked or not v_team.recruiting or v_team.status in ('frozen','dissolved','registered','active')
    or v_team.recruitment_mode='invite_only' then raise exception 'This team is not recruiting'; end if;
  if (select count(*) from public.world_preseason_team_members where team_id=v_team.id) >= v_team.capacity then raise exception 'This team is full'; end if;
  insert into public.world_preseason_team_members(season_id,team_id,user_id)
  values(v_team.season_id,v_team.id,auth.uid());
  insert into public.world_preseason_team_applications(season_id,team_id,applicant_user_id,note)
  values(v_team.season_id,v_team.id,auth.uid(),trim(coalesce(p_note,'')))
  on conflict (season_id,team_id,applicant_user_id) where status='pending'
  do update set note=excluded.note,updated_at=timezone('utc',now()) returning id into v_id;
  update public.world_preseason_team_applications set status='accepted',reviewed_by=auth.uid(),reviewed_at=timezone('utc',now()) where id=v_id;
  update public.world_preseason_team_applications set status='rejected',reviewed_by=auth.uid(),reviewed_at=timezone('utc',now())
  where season_id=v_team.season_id and applicant_user_id=auth.uid() and status='pending';
  delete from public.world_preseason_free_agents where season_id=v_team.season_id and user_id=auth.uid();
  perform public.world_preseason_refresh_team(v_team.id);
  return v_id;
end;
$$;
create or replace function public.world_preseason_apply_by_team_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team_id uuid;
begin
  perform public.world_preseason_require_participant();
  select t.id into v_team_id from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id=t.season_id
  where s.code='season-1' and t.team_code=upper(trim(p_code));
  if not found then raise exception 'Team code not found'; end if;
  return public.world_preseason_apply_to_team(v_team_id,'Applied with team code');
end;
$$;
revoke all on function public.world_preseason_set_team_lock(uuid,boolean), public.world_preseason_guard_member_join(), public.world_preseason_apply_to_team(uuid,text) from public,anon,authenticated;
grant execute on function public.world_preseason_set_team_lock(uuid,boolean), public.world_preseason_apply_to_team(uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
