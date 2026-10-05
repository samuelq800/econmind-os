-- Read-only release verification. Does not mutate or expose participant data.
do $verify$
declare signature text; definition text;
begin
  foreach signature in array array[
    'public.world_preseason_dissolve_team(uuid)',
    'public.world_preseason_leave_team(uuid)',
    'public.world_preseason_create_team(text,text,text,text,text,text[])',
    'public.world_preseason_create_invite(uuid,uuid,timestamp with time zone)',
    'public.get_world_preseason_lobby(integer)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'Season 1 team lifecycle migration required: %', signature;
    end if;
    if not has_function_privilege('authenticated', signature, 'EXECUTE')
      or has_function_privilege('anon', signature, 'EXECUTE')
      or exists (
        select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = to_regprocedure(signature) and a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
    then raise exception 'Season 1 team lifecycle RPC permissions invalid: %', signature; end if;
    select pg_get_functiondef(p.oid) into definition from pg_proc p where p.oid = to_regprocedure(signature);
    if definition not like '%world_preseason_require_participant()%'
      or not exists (select 1 from pg_proc p where p.oid = to_regprocedure(signature) and p.prosecdef and 'search_path=public' = any(p.proconfig))
    then raise exception 'Season 1 team lifecycle RPC authorization invalid: %', signature; end if;
  end loop;
  signature := 'public.world_preseason_is_current_team_member(uuid)';
  if to_regprocedure(signature) is null then raise exception 'Season 1 roster membership predicate unavailable'; end if;
  if not has_function_privilege('authenticated', signature, 'EXECUTE')
    or has_function_privilege('anon', signature, 'EXECUTE')
    or not exists (select 1 from pg_proc p where p.oid=to_regprocedure(signature) and p.prosecdef and p.provolatile='s' and p.prorettype='boolean'::regtype and 'search_path=public'=any(p.proconfig))
    or exists (
      select 1 from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid=to_regprocedure(signature) and a.grantee=0 and a.privilege_type='EXECUTE'
    )
  then raise exception 'Season 1 roster membership predicate permissions invalid'; end if;
  if not exists (
    select 1 from pg_policy where polrelid='public.world_preseason_team_members'::regclass
      and polname='world_preseason_member_roster_read'
      and pg_get_expr(polqual,polrelid) like '%world_preseason_is_current_team_member%'
      and pg_get_expr(polqual,polrelid) like '%world_preseason_gate_open%'
  ) then raise exception 'Season 1 non-recursive roster read policy unavailable'; end if;
  foreach signature in array array[
    'public.world_preseason_dissolve_team()',
    'public.world_preseason_leave_team()',
    'public.world_preseason_remove_member(uuid)'
  ] loop
    if to_regprocedure(signature) is not null and (
      has_function_privilege('authenticated', signature, 'EXECUTE')
      or has_function_privilege('anon', signature, 'EXECUTE')
      or exists (
        select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = to_regprocedure(signature) and a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
    ) then raise exception 'Obsolete Season 1 lifecycle RPC remains callable: %', signature; end if;
  end loop;
  select pg_get_functiondef(to_regprocedure('public.world_preseason_leave_team(uuid)')) into definition;
  if definition not like '%captain_user_id%' or definition not like '%joined_at%' or definition not like '%world_preseason_dissolve_team%'
  then raise exception 'Season 1 captain handover or last-member dissolution unavailable'; end if;
  select pg_get_functiondef(to_regprocedure('public.get_world_preseason_lobby(integer)')) into definition;
  if definition not like '%sameSchool%' or definition not like '%schoolName%' or definition not like '%viewer%'
  then raise exception 'Season 1 school discovery unavailable'; end if;
  if not exists (select 1 from pg_attribute where attrelid='public.world_preseason_teams'::regclass and attname='school_id' and not attisdropped)
    or not exists (select 1 from pg_attribute where attrelid='public.world_preseason_teams'::regclass and attname='home_school_bound_at' and not attisdropped)
  then raise exception 'Season 1 durable home school columns unavailable'; end if;
  if exists (select 1 from public.world_preseason_teams t join public.world_preseason_seasons s on s.id=t.season_id where s.code='season-1' and t.home_school_bound_at is null)
  then raise exception 'Season 1 home school initialization incomplete'; end if;
  if to_regprocedure('public.world_preseason_set_team_lock(uuid,boolean)') is null
    or not exists (select 1 from pg_trigger where tgrelid = 'public.world_preseason_team_members'::regclass and tgname = 'world_preseason_guard_member_join' and tgenabled = 'O')
    or not exists (select 1 from public.world_preseason_seasons where code='season-1' and config->>'maximumTeamSize'='6')
    or exists (select 1 from public.world_preseason_teams t join public.world_preseason_seasons s on s.id=t.season_id where s.code='season-1' and (t.capacity<>6 or t.team_code is null))
  then raise exception 'Season 1 team capacity, codes or recruitment lock prerequisite unavailable'; end if;
end
$verify$;
