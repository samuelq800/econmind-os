-- Season 1 only: six-member teams, stable discovery codes and self-service
-- membership management. Codes request captain approval; they do not bypass it.
begin;

do $$
begin
  if exists (
    select 1 from public.world_preseason_team_members m
    join public.world_preseason_seasons s on s.id = m.season_id
    where s.code = 'season-1' group by m.team_id having count(*) > 6
  ) then
    raise exception 'A Season 1 team already exceeds six members; resolve it without deleting members automatically';
  end if;
end;
$$;

alter table public.world_preseason_seasons alter column config set default
  '{"minimumTeamSize":2,"maximumTeamSize":6,"roles":["Finance & Economy","Trade & Foreign Affairs","Industry & Technology","Labour & Social Development","Central Bank"],"languages":["English","Chinese","Bilingual"]}'::jsonb;
update public.world_preseason_seasons
set config = jsonb_set(config, '{maximumTeamSize}', '6'::jsonb)
where code = 'season-1';
alter table public.world_preseason_teams alter column capacity set default 6;
update public.world_preseason_teams t set capacity = 6
from public.world_preseason_seasons s where s.id = t.season_id and s.code = 'season-1';

alter table public.world_preseason_teams add column if not exists team_code text
  not null default ('EM-T1-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10)));
create unique index if not exists world_preseason_team_code_idx on public.world_preseason_teams(team_code);

create or replace function public.world_preseason_create_team(p_name text, p_description text default '', p_recruitment_mode text default 'open', p_team_style text default 'balanced', p_preferred_language text default 'English', p_role_preferences text[] default '{}'::text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_season public.world_preseason_seasons%rowtype; v_team_id uuid;
begin
  perform public.world_preseason_require_participant();
  select * into v_season from public.world_preseason_seasons where code = 'season-1' and status in ('pre_season','registration_open');
  if not found then raise exception 'Season 1 is not available'; end if;
  if exists (select 1 from public.world_preseason_team_members where season_id = v_season.id and user_id = auth.uid()) then raise exception 'You already have an active team for this season'; end if;
  insert into public.world_preseason_teams(season_id,name,description,recruitment_focus,recruitment_mode,team_style,preferred_language,capacity,captain_user_id,created_by)
  values(v_season.id,trim(p_name),trim(coalesce(p_description,'')),trim(coalesce(p_description,'')),p_recruitment_mode,p_team_style,trim(p_preferred_language),6,auth.uid(),auth.uid()) returning id into v_team_id;
  insert into public.world_preseason_team_members(season_id,team_id,user_id,member_role,role_preferences) values(v_season.id,v_team_id,auth.uid(),'captain',coalesce(p_role_preferences,'{}'));
  insert into public.world_preseason_chat_channels(season_id,channel_type,team_id) values(v_season.id,'TEAM',v_team_id);
  perform public.world_preseason_refresh_team(v_team_id);
  return v_team_id;
end;
$$;

-- Refresh formerly full four-member teams so they can recruit again.
select public.world_preseason_refresh_team(t.id)
from public.world_preseason_teams t join public.world_preseason_seasons s on s.id = t.season_id
where s.code = 'season-1';

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
    'team', jsonb_build_object('id',v_team.id,'name',v_team.name,'code',v_team.team_code,'description',v_team.description,'capacity',v_team.capacity,'status',v_team.status,'recruitmentMode',v_team.recruitment_mode,'preferredLanguage',v_team.preferred_language,'teamStyle',v_team.team_style,'captainUserId',v_team.captain_user_id),
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

create or replace function public.world_preseason_apply_by_team_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype;
begin
  perform public.world_preseason_require_participant();
  select t.* into v_team from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id = t.season_id
  where s.code = 'season-1' and t.team_code = upper(trim(p_code)) for update of t;
  if not found then raise exception 'Team code not found'; end if;
  if v_team.status in ('frozen','dissolved','registered','active') or not v_team.recruiting
    or (select count(*) from public.world_preseason_team_members where team_id = v_team.id) >= v_team.capacity
  then raise exception 'This team is not accepting applications'; end if;
  return public.world_preseason_apply_to_team(v_team.id, 'Applied with team code');
end;
$$;

create or replace function public.world_preseason_remove_member(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype;
begin
  perform public.world_preseason_require_participant();
  select t.* into v_team from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id = t.season_id
  where t.id = p_team_id and s.code = 'season-1' for update of t;
  if not found or v_team.captain_user_id <> auth.uid() or not exists (
    select 1 from public.world_preseason_team_members
    where team_id = p_team_id and user_id = auth.uid() and member_role = 'captain'
  ) then raise exception 'Only the current team captain can remove members'; end if;
  if v_team.status in ('frozen','dissolved','registered','active') then raise exception 'This team roster is locked'; end if;
  if p_user_id = auth.uid() or p_user_id = v_team.captain_user_id then raise exception 'The captain cannot be removed'; end if;
  delete from public.world_preseason_team_members where team_id = p_team_id and user_id = p_user_id and member_role = 'member';
  if not found then raise exception 'This player is no longer a member of your team'; end if;
  perform public.world_preseason_refresh_team(p_team_id);
end;
$$;

create or replace function public.world_preseason_leave_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team public.world_preseason_teams%rowtype; v_role text;
begin
  perform public.world_preseason_require_participant();
  select t.* into v_team from public.world_preseason_teams t
  join public.world_preseason_seasons s on s.id = t.season_id
  where t.id = p_team_id and s.code = 'season-1' for update of t;
  if not found then raise exception 'Team not found'; end if;
  select member_role into v_role from public.world_preseason_team_members where team_id = p_team_id and user_id = auth.uid();
  if not found then raise exception 'You are no longer a member of this team'; end if;
  if v_role = 'captain' or v_team.captain_user_id = auth.uid() then raise exception 'The captain cannot leave the team without a leadership handover'; end if;
  if v_team.status in ('frozen','dissolved','registered','active') then raise exception 'This team roster is locked'; end if;
  delete from public.world_preseason_team_members where team_id = p_team_id and user_id = auth.uid() and member_role = 'member';
  perform public.world_preseason_refresh_team(p_team_id);
end;
$$;

revoke all on function public.get_world_preseason_my_team(), public.world_preseason_apply_by_team_code(text), public.world_preseason_remove_member(uuid,uuid), public.world_preseason_leave_team(uuid), public.world_preseason_create_team(text,text,text,text,text,text[]) from public, anon, authenticated;
grant execute on function public.get_world_preseason_my_team(), public.world_preseason_apply_by_team_code(text), public.world_preseason_remove_member(uuid,uuid), public.world_preseason_leave_team(uuid), public.world_preseason_create_team(text,text,text,text,text,text[]) to authenticated;

notify pgrst, 'reload schema';
commit;
