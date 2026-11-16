\set ON_ERROR_STOP on
-- Run only against a new disposable database, never against production.
\ir test-credential-research-sources.sql
reset role;
create role service_role;
\ir ../supabase/migrations/20261116010000_credential_issuance_core.sql
-- Test harness only: a trusted worker would perform real rendering first.
create function public.test_attest_credential_preview(p_id uuid) returns void
language sql security definer as $$ select public.attest_credential_preview(p_id) $$;
grant execute on function public.test_attest_credential_preview(uuid) to authenticated;
do $$ begin
  if has_function_privilege('anon', 'public.issue_credential_batch(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.attest_credential_preview(uuid)', 'execute')
    or has_table_privilege('authenticated', 'private.credentials', 'select')
    or has_table_privilege('authenticated', 'private.credentials', 'update') then
    raise exception 'Direct access or anonymous issuance is possible';
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform public.create_credential_template('CON','Technology','{}'); raise exception 'ordinary user admitted';
  exception when insufficient_privilege then null; end;
  begin perform public.list_credential_admin_data(); raise exception 'ordinary user can read private records';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform public.create_credential_template('CON','Technology','{}'); raise exception 'suspended admin admitted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare t1 uuid; t2 uuid; t3 uuid; b1 uuid; b2 uuid; b3 uuid; result jsonb; repeated jsonb; issued_id uuid; begin
  begin perform public.create_credential_template('CON','Bad','{"css":"body{display:none}"}'); raise exception 'template accepted visual edits';
  exception when invalid_parameter_value then null; end;
  t1 := public.create_credential_template('CON','Technology','{"title":"Contribution"}');
  t2 := public.create_credential_template('CON','Communications','{"title":"Contribution"}');
  t3 := public.create_credential_template('LEA','Leadership','{"title":"Leadership"}');
  b1 := public.create_credential_draft('10000000-0000-0000-0000-000000000001', t1, '2026-01-01','EconMind Founder Team','[{"name":"A"},{"name":"B"}]');
  if public.create_credential_draft('10000000-0000-0000-0000-000000000001', t1, '2026-01-01','EconMind Founder Team','[{"name":"A"},{"name":"B"}]') <> b1 then
    raise exception 'same request did not return original draft';
  end if;
  begin
    perform public.create_credential_draft('10000000-0000-0000-0000-000000000001',t1,'2026-01-01','EconMind Founder Team','[{"name":"Changed"}]');
    raise exception 'idempotency key accepted different payload';
  exception when unique_violation then null; end;
  begin perform public.issue_credential_batch(b1); raise exception 'unreviewed batch issued';
  exception when invalid_parameter_value then null; end;
  perform public.review_credential_draft(b1);
  begin perform public.issue_credential_batch(b1); raise exception 'unverified preview accepted';
  exception when invalid_parameter_value then null; end;
  perform public.test_attest_credential_preview(b1);
  result := public.issue_credential_batch(b1);
  repeated := public.issue_credential_batch(b1);
  if result <> repeated or result->0->>'number' <> 'EML-CON-2026-000001' or result->1->>'number' <> 'EML-CON-2026-000002' then
    raise exception 'issuance or idempotency error: %',result;
  end if;
  issued_id := (result->0->>'id')::uuid;
  perform public.revoke_credential(issued_id,'Incorrect name');
  b2 := public.create_credential_draft('10000000-0000-0000-0000-000000000002',t2,'2026-01-01','EconMind Leadership Group','[{"name":"C"}]');
  perform public.review_credential_draft(b2); perform public.test_attest_credential_preview(b2); result := public.issue_credential_batch(b2);
  if result->0->>'number' <> 'EML-CON-2026-000003' then raise exception 'category counter reused or split by department'; end if;
  b3 := public.create_credential_draft('10000000-0000-0000-0000-000000000003',t3,'2026-01-01','EconMind Founder Team','[{"name":"D"}]');
  perform public.review_credential_draft(b3); perform public.test_attest_credential_preview(b3); result := public.issue_credential_batch(b3);
  if result->0->>'number' <> 'EML-LEA-2026-000001' then raise exception 'category counter was not independent'; end if;
  b3 := public.create_credential_draft('10000000-0000-0000-0000-000000000004',t1,'2027-01-01','EconMind Founder Team','[{"name":"E"}]');
  perform public.review_credential_draft(b3); perform public.test_attest_credential_preview(b3); result := public.issue_credential_batch(b3);
  if result->0->>'number' <> 'EML-CON-2027-000001' then raise exception 'year counter was not independent'; end if;
  result := public.list_credential_admin_data();
  if (result->'counts'->>'revoked')::integer <> 1 or jsonb_array_length(result->'credentials') <> 5 then
    raise exception 'dashboard records or totals are incorrect';
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from private.credentials) <> 5
    or (select count(*) from private.credentials where status = 'revoked') <> 1
    or (select count(*) from private.credential_audit_logs where action = 'credential_revoked') <> 1 then
    raise exception 'history or audit record lost';
  end if;
end $$;
