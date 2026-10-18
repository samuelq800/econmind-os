-- OS registration preferences ONLY. No World country allocation/runtime writes.
begin;
create table if not exists public.world_preseason_country_preferences (
  team_id uuid primary key references public.world_preseason_teams(id) on delete cascade,
  season_id uuid not null references public.world_preseason_seasons(id) on delete restrict,
  country_code text not null check (country_code ~ '^(0[1-9]|[1-6][0-9]|70)$'),
  submitted_by uuid references public.profiles(user_id) on delete set null,
  selected_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text
);
create unique index if not exists world_preseason_country_one_team_idx
  on public.world_preseason_country_preferences(season_id, country_code) where released_at is null;
alter table public.world_preseason_country_preferences enable row level security;
revoke all on public.world_preseason_country_preferences from public, anon, authenticated;

create or replace function public.get_world_preseason_country_preferences()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_season uuid; v_team public.world_preseason_teams%rowtype; v_count integer; v_captain boolean;
begin
  perform public.world_preseason_require_participant();
  select id into v_season from public.world_preseason_seasons where code='season-1';
  if v_season is null then raise exception 'Season 1 configuration is unavailable'; end if;
  select t.* into v_team
    from public.world_preseason_teams t join public.world_preseason_team_members m on m.team_id=t.id
    where m.user_id=auth.uid() and m.season_id=v_season and t.season_id=v_season and t.status<>'dissolved';
  -- Composite record and scalar are read separately (PL/pgSQL does not allow a
  -- row variable in a multi-item INTO list).
  if v_team.id is not null then
    select count(*) into v_count from public.world_preseason_team_members where team_id=v_team.id and season_id=v_season;
    select exists(select 1 from public.world_preseason_team_members where team_id=v_team.id and user_id=auth.uid() and member_role='captain') and v_team.captain_user_id=auth.uid() into v_captain;
  end if;
  return jsonb_build_object(
    'seasonId',v_season,'serverNow',statement_timestamp(),
    'myTeam',case when v_team.id is null then null else jsonb_build_object(
      'id',v_team.id,'name',v_team.name,'memberCount',v_count,'recruitmentLocked',v_team.recruitment_locked,
      'isCaptain',v_captain,'eligible',v_captain and v_count>=3 and v_team.recruitment_locked and v_team.status not in ('frozen','dissolved','registered','active'),
      'preference',(select jsonb_build_object('code',country_code,'selectedAt',selected_at) from public.world_preseason_country_preferences where team_id=v_team.id and released_at is null)
    ) end,
    'countries',(select jsonb_agg(jsonb_build_object('code',lpad(n::text,2,'0'),
      'reserved',exists(select 1 from public.world_preseason_country_preferences p where p.season_id=v_season and p.country_code=lpad(n::text,2,'0') and p.released_at is null),
      'selectedByMyTeam',exists(select 1 from public.world_preseason_country_preferences p where p.team_id=v_team.id and p.country_code=lpad(n::text,2,'0') and p.released_at is null)
    ) order by n) from generate_series(1,70) n)
  );
end;
$$;

create or replace function public.set_world_preseason_country_preference(p_team_id uuid,p_country_code text,p_expected_country_code text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_team public.world_preseason_teams%rowtype; v_count integer; v_previous text;
begin
  perform public.world_preseason_require_participant();
  if p_country_code is null or p_country_code !~ '^(0[1-9]|[1-6][0-9]|70)$' then raise exception 'Choose a country code from 01 to 70'; end if;
  select t.* into v_team from public.world_preseason_teams t join public.world_preseason_seasons s on s.id=t.season_id
    where t.id=p_team_id and s.code='season-1' for update of t;
  if not found then raise exception 'Team not found'; end if;
  if v_team.captain_user_id<>auth.uid() or not exists(select 1 from public.world_preseason_team_members where team_id=p_team_id and user_id=auth.uid() and member_role='captain') then raise exception 'Only the current team captain can choose a country'; end if;
  if not v_team.recruitment_locked or v_team.status in ('frozen','dissolved','registered','active') then raise exception 'Lock recruitment before choosing a country'; end if;
  select count(*) into v_count from public.world_preseason_team_members where team_id=p_team_id and season_id=v_team.season_id;
  if v_count<3 then raise exception 'At least 3 team members are required'; end if;
  select country_code into v_previous from public.world_preseason_country_preferences where team_id=p_team_id and released_at is null;
  if v_previous is not distinct from p_country_code then return public.get_world_preseason_country_preferences(); end if;
  if v_previous is distinct from p_expected_country_code then raise exception 'Your team selection changed. Refresh and try again'; end if;
  begin
    insert into public.world_preseason_country_preferences(team_id,season_id,country_code,submitted_by)
    values(p_team_id,v_team.season_id,p_country_code,auth.uid())
    on conflict(team_id) do update set country_code=excluded.country_code,season_id=excluded.season_id,submitted_by=excluded.submitted_by,selected_at=now(),released_at=null,release_reason=null;
  exception when unique_violation then raise exception 'This country has already been selected by another team. Choose another country';
  end;
  -- Invalidate through existing authorized team Realtime, without publishing
  -- private preference rows or submitter identities to other participants.
  update public.world_preseason_teams set updated_at=now() where id=p_team_id;
  return public.get_world_preseason_country_preferences();
end;
$$;

create or replace function public.world_preseason_release_ineligible_country(p_team_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_team public.world_preseason_teams%rowtype; v_count integer; v_changed integer;
begin
  select * into v_team from public.world_preseason_teams where id=p_team_id for update;
  if not found then return; end if;
  select count(*) into v_count from public.world_preseason_team_members where team_id=p_team_id and season_id=v_team.season_id;
  if not v_team.recruitment_locked or v_count<3 or v_team.status='dissolved' then
    update public.world_preseason_country_preferences set released_at=now(),release_reason=case when v_team.status='dissolved' then 'team_dissolved' when not v_team.recruitment_locked then 'recruitment_unlocked' else 'fewer_than_three_members' end
    where team_id=p_team_id and released_at is null;
    get diagnostics v_changed=row_count;
    if v_changed>0 then update public.world_preseason_teams set updated_at=now() where id=p_team_id; end if;
  end if;
end;
$$;
create or replace function public.world_preseason_country_eligibility_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='world_preseason_teams' then
    perform public.world_preseason_release_ineligible_country(new.id);
  else
    if tg_op<>'INSERT' then perform public.world_preseason_release_ineligible_country(old.team_id); end if;
    if tg_op<>'DELETE' and (tg_op='INSERT' or new.team_id is distinct from old.team_id or new.season_id is distinct from old.season_id) then perform public.world_preseason_release_ineligible_country(new.team_id); end if;
  end if;
  return null;
end;
$$;
drop trigger if exists world_preseason_country_team_eligibility on public.world_preseason_teams;
create trigger world_preseason_country_team_eligibility after update of recruitment_locked,status on public.world_preseason_teams for each row execute function public.world_preseason_country_eligibility_trigger();
drop trigger if exists world_preseason_country_member_eligibility on public.world_preseason_team_members;
create trigger world_preseason_country_member_eligibility after insert or delete or update of team_id,season_id on public.world_preseason_team_members for each row execute function public.world_preseason_country_eligibility_trigger();

revoke all on function public.get_world_preseason_country_preferences(), public.set_world_preseason_country_preference(uuid,text,text), public.world_preseason_release_ineligible_country(uuid), public.world_preseason_country_eligibility_trigger() from public,anon,authenticated;
grant execute on function public.get_world_preseason_country_preferences(),public.set_world_preseason_country_preference(uuid,text,text) to authenticated;
commit;
