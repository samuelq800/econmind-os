do $verify$
declare v_oid oid := to_regprocedure('public.get_world_preseason_admin_overview()');
begin
  if v_oid is null then raise exception 'Season 1 admin overview is missing'; end if;
  if not has_function_privilege('authenticated', v_oid, 'execute')
    or has_function_privilege('anon', v_oid, 'execute')
    or exists (select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = v_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE')
  then raise exception 'Admin overview grants are invalid'; end if;
  if not exists (select 1 from pg_proc p where p.oid = v_oid and p.prosecdef and p.provolatile = 's'
    and array_to_string(p.proconfig, ',') like '%search_path=""%'
    and pg_get_functiondef(p.oid) like '%world_preseason_require_admin()%'
    and pg_get_functiondef(p.oid) like '%registeredPlayers%'
    and pg_get_functiondef(p.oid) like '%snapshotAt%')
  then raise exception 'Admin overview authorization or projection is invalid'; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'world_preseason_teams')
  then raise exception 'Team change publication is missing'; end if;
end $verify$;
