\set ON_ERROR_STOP on
-- Run only against a new disposable database, never against production.
\ir test-credential-issuance-core.sql
\ir ../supabase/migrations/20261116020000_shared_team_directory.sql
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform public.list_credential_organization_sources(); raise exception 'ordinary user admitted';
  exception when insufficient_privilege then null; end;
  begin perform public.save_organization_appointment(null,'{"name":"A","title":"T","organizational_group":"technology-team"}'); raise exception 'ordinary user can change directory';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare id uuid; data jsonb; begin
  begin perform public.set_organization_directory_active(true); raise exception 'empty directory activated';
  exception when invalid_parameter_value then null; end;
  id := public.save_organization_appointment(null,'{"name":"Public member","title":"Technology","organizational_group":"technology-team","public_visible":true}');
  perform public.save_organization_appointment(null,'{"name":"Private member","title":"Member","organizational_group":"leadership-group","public_visible":false}');
  if (select count(*) from public.list_credential_organization_sources()) <> 2 then raise exception 'admin roster incomplete'; end if;
  data := public.read_organization_directory();
  if (data->>'activated')::boolean or jsonb_array_length(data->'appointments') <> 1 then raise exception 'public roster leaked or activated'; end if;
  perform public.set_organization_directory_active(true);
  perform public.save_organization_appointment(id,'{"name":"Updated member","title":"Developer","organizational_group":"technology-team","public_visible":true}');
  data := public.read_organization_directory();
  if not (data->>'activated')::boolean or data->'appointments'->0->>'name' <> 'Updated member' then raise exception 'roster update not reflected'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  if (select count(*) from public.organization_directory) <> 1 then raise exception 'row security exposed a private member'; end if;
end $$;
