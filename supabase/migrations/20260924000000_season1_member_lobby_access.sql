-- Keep the Season 1 direct link available to active registered members without
-- exposing another member's pending application through the browser.
create or replace function public.get_world_preseason_my_pending_team_ids()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_ids text[];
begin
  perform public.world_preseason_require_participant();

  select coalesce(array_agg(application.team_id::text order by application.created_at), '{}'::text[])
    into v_team_ids
  from public.world_preseason_team_applications application
  join public.world_preseason_seasons season on season.id = application.season_id
  where season.code = 'season-1'
    and application.applicant_user_id = auth.uid()
    and application.status = 'pending';

  return v_team_ids;
end;
$$;

revoke all on function public.get_world_preseason_my_pending_team_ids() from public, anon, authenticated;
grant execute on function public.get_world_preseason_my_pending_team_ids() to authenticated;
