-- One-time operator maintenance, not a migration or a client-accessible RPC.
-- The protected runner substitutes a validated, previously inspected UUID list.
-- reviewed_by remains NULL: this is an operator action, not an impersonated user.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '45s';
lock table public.world_preseason_teams, public.world_preseason_team_members,
  public.world_preseason_team_applications, public.world_preseason_free_agents
  in share row exclusive mode;
create temporary table season1_approval_results(application_id uuid, outcome text) on commit drop;
do $batch$
declare
  v_ids jsonb := '__APPLICATION_IDS_JSON__'::jsonb;
  v_season uuid;
  v_application public.world_preseason_team_applications%rowtype;
  v_team public.world_preseason_teams%rowtype;
  v_existing_team uuid;
  v_outcome text;
begin
  select id into strict v_season from public.world_preseason_seasons where code='season-1';
  if (select count(*) from public.world_preseason_team_applications
      where season_id=v_season and status='pending'
        and id in (select value::uuid from jsonb_array_elements_text(v_ids))) <> jsonb_array_length(v_ids)
  then raise exception 'Inspected application batch changed; preview again before any write'; end if;

  for v_application in select * from public.world_preseason_team_applications
    where season_id=v_season and status='pending'
      and id in (select value::uuid from jsonb_array_elements_text(v_ids))
    order by created_at, id
  loop
    v_outcome := null;
    v_existing_team := null;
    select * into v_team from public.world_preseason_teams
      where id=v_application.team_id and season_id=v_season;
    if not found then
      v_outcome := 'invalid_team';
    else
      select team_id into v_existing_team from public.world_preseason_team_members
        where season_id=v_season and user_id=v_application.applicant_user_id;
      if v_existing_team=v_team.id then
        v_outcome := 'confirmed_existing_member';
      elsif v_existing_team is not null then
        v_outcome := 'already_in_other_team';
      elsif not exists (select 1 from public.profiles
        where user_id=v_application.applicant_user_id and account_status='active') then
        v_outcome := 'inactive_account';
      elsif v_team.recruitment_locked or v_team.status in ('frozen','dissolved','registered','active') then
        v_outcome := 'locked_team';
      elsif (select count(*) from public.world_preseason_team_members where team_id=v_team.id) >= v_team.capacity then
        v_outcome := 'full_team';
      else
        -- Existing join guard and one-team-per-season constraints stay enabled.
        insert into public.world_preseason_team_members(season_id,team_id,user_id)
          values(v_season,v_team.id,v_application.applicant_user_id);
        v_outcome := 'joined';
      end if;
    end if;
    if v_outcome in ('joined','confirmed_existing_member') then
      update public.world_preseason_team_applications
        set status='accepted', reviewed_by=null, reviewed_at=now()
        where id=v_application.id and season_id=v_season and status='pending';
      delete from public.world_preseason_free_agents
        where season_id=v_season and user_id=v_application.applicant_user_id;
      if v_outcome='joined' then perform public.world_preseason_refresh_team(v_team.id); end if;
    end if;
    insert into season1_approval_results values(v_application.id,v_outcome);
  end loop;

  if exists (select 1 from season1_approval_results r
    join public.world_preseason_team_applications a on a.id=r.application_id
    where r.outcome in ('joined','confirmed_existing_member') and (a.status<>'accepted'
      or not exists (select 1 from public.world_preseason_team_members m
        where m.season_id=v_season and m.team_id=a.team_id and m.user_id=a.applicant_user_id)))
  then raise exception 'Approval verification failed'; end if;
end $batch$;
-- Counts only: never publish applicants, IDs, names, notes or contact details.
select jsonb_build_object(
  'inspected', count(*),
  'accepted', count(*) filter(where outcome in ('joined','confirmed_existing_member')),
  'joined', count(*) filter(where outcome='joined'),
  'confirmedExistingMember', count(*) filter(where outcome='confirmed_existing_member'),
  'blocked', coalesce((select jsonb_object_agg(outcome,n) from (
    select outcome,count(*) n from season1_approval_results
    where outcome not in ('joined','confirmed_existing_member') group by outcome
  ) reasons),'{}'::jsonb),
  'remainingPending', (select count(*) from public.world_preseason_team_applications a
    join public.world_preseason_seasons s on s.id=a.season_id
    where s.code='season-1' and a.status='pending')
) as result from season1_approval_results;
commit;
