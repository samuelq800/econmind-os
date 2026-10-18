select
  coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.world_preseason_country_preferences')),false)
  and not has_table_privilege('anon','public.world_preseason_country_preferences','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.world_preseason_country_preferences','SELECT,INSERT,UPDATE,DELETE')
  and (select count(*)=2 from pg_proc p where p.oid in (
    to_regprocedure('public.get_world_preseason_country_preferences()'),
    to_regprocedure('public.set_world_preseason_country_preference(uuid,text,text)'))
    and p.prosecdef and array_to_string(p.proconfig,',') like '%search_path=""%'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
    and pg_get_functiondef(p.oid) like '%world_preseason_require_participant()%')
  and not has_function_privilege('authenticated','public.world_preseason_release_ineligible_country(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.world_preseason_release_ineligible_country(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.world_preseason_country_eligibility_trigger()','EXECUTE')
  and exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.world_preseason_country_one_team_idx')
    and i.indisunique and i.indisvalid and i.indrelid='public.world_preseason_country_preferences'::regclass
    and pg_get_indexdef(i.indexrelid) like '%(season_id, country_code)%'
    and pg_get_expr(i.indpred,i.indrelid)='(released_at IS NULL)')
  and exists(select 1 from pg_constraint where conrelid='public.world_preseason_country_preferences'::regclass
    and contype='p' and convalidated and pg_get_constraintdef(oid)='PRIMARY KEY (team_id)')
  and (select count(*)=2 from pg_trigger where not tgisinternal and tgenabled='O'
    and tgfoid='public.world_preseason_country_eligibility_trigger()'::regprocedure
    and ((tgrelid='public.world_preseason_teams'::regclass and tgname='world_preseason_country_team_eligibility')
      or (tgrelid='public.world_preseason_team_members'::regclass and tgname='world_preseason_country_member_eligibility')))
  and not exists(select 1 from pg_publication_tables where schemaname='public' and tablename='world_preseason_country_preferences')
  and pg_get_functiondef('public.set_world_preseason_country_preference(uuid,text,text)'::regprocedure) like '%for update of t%'
  and pg_get_functiondef('public.set_world_preseason_country_preference(uuid,text,text)'::regprocedure) like '%v_count<3%'
  and pg_get_functiondef('public.set_world_preseason_country_preference(uuid,text,text)'::regprocedure) like '%member_role=''captain''%'
  and pg_get_functiondef('public.world_preseason_release_ineligible_country(uuid)'::regprocedure) like '%not v_team.recruitment_locked or v_count<3%'
  as verified;
