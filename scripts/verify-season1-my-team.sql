-- Read-only production release preflight. Never prints member information.
do $verify$
declare signature text;
begin
  foreach signature in array array[
    'public.get_world_preseason_my_team()',
    'public.world_preseason_apply_by_team_code(text)',
    'public.world_preseason_remove_member(uuid,uuid)',
    'public.world_preseason_leave_team(uuid)'
  ] loop
    if to_regprocedure(signature) is null then raise exception 'Season 1 My Team migration required: %',signature; end if;
    if not has_function_privilege('authenticated',signature,'EXECUTE')
      or has_function_privilege('anon',signature,'EXECUTE')
    then raise exception 'Season 1 My Team RPC permissions invalid: %',signature; end if;
  end loop;
  if not exists (select 1 from public.world_preseason_seasons where code='season-1' and config->>'maximumTeamSize'='6')
    or exists (select 1 from public.world_preseason_teams t join public.world_preseason_seasons s on s.id=t.season_id where s.code='season-1' and (t.capacity<>6 or t.team_code is null))
  then raise exception 'Season 1 six-member capacity or team codes are unavailable'; end if;
end
$verify$;
