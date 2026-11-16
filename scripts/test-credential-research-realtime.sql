\set ON_ERROR_STOP on
\ir test-credential-research-sources.sql
reset role;
create schema private;
\ir ../supabase/migrations/20261116030000_credential_research_realtime.sql
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  if (select count(*) from public.credential_source_revisions) <> 0 then raise exception 'non-superme can see research events'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  if (select count(*) from public.credential_source_revisions) <> 0 then raise exception 'suspended superme can see research events'; end if;
end $$;
reset role;
update public.research_papers set title = 'Changed' where id = '10000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
  if (select revision from public.credential_source_revisions where source='research') <> 1 then
    raise exception 'research changes did not update the revision';
  end if;
end $$;
