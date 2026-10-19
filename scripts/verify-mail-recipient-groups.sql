select coalesce((
  select p.prosecdef and p.provolatile = 's'
    and p.proconfig @> array['search_path=""']
    and pg_get_function_result(p.oid) = 'TABLE(user_id uuid, display_name text, email text, school_id uuid, school_name text, groups text[])'
    and p.prosrc like '%public.is_platform_admin(auth.uid())%'
    and p.prosrc like '%t.created_by = p.user_id%'
    and p.prosrc like '%season1_team_founders%'
    and p.prosrc like '%individual_participants%'
    and p.prosrc like '%season.code = ''season-1''%'
    and not has_function_privilege('anon', p.oid, 'execute')
    and has_function_privilege('authenticated', p.oid, 'execute')
    and not exists(select 1 from aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.oid=to_regprocedure('public.admin_mail_recipient_directory(uuid)')
),false) as verified;
