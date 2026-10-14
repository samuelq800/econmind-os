-- Explicitly authorized withdrawal of inspected stale applications only.
-- No team/member/profile/free-agent writes and no persistent schema changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.world_preseason_teams, public.world_preseason_team_members,
  public.world_preseason_team_applications in share row exclusive mode;
do $withdraw$
declare
  v_ids jsonb := '__APPLICATION_IDS_JSON__'::jsonb;
  v_season uuid;
  v_changed integer;
begin
  select id into strict v_season from public.world_preseason_seasons where code='season-1';
  if (select count(*) from public.world_preseason_team_applications a
    where a.season_id=v_season and a.status='pending'
      and a.id in (select value::uuid from jsonb_array_elements_text(v_ids))
      and exists(select 1 from public.world_preseason_team_members m
        where m.season_id=v_season and m.user_id=a.applicant_user_id and m.team_id<>a.team_id)) <> jsonb_array_length(v_ids)
  then raise exception 'Inspected stale batch changed or includes a non-conflicting applicant'; end if;
  update public.world_preseason_team_applications a
    set status='withdrawn',reviewed_by=null,reviewed_at=now()
    where a.season_id=v_season and a.status='pending'
      and a.id in (select value::uuid from jsonb_array_elements_text(v_ids));
  get diagnostics v_changed = row_count;
  if v_changed <> jsonb_array_length(v_ids) then raise exception 'Withdrawal count mismatch'; end if;
end $withdraw$;
commit;
