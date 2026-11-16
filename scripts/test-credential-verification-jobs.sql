\set ON_ERROR_STOP on
\ir test-credential-issuance-core.sql
reset role;
\ir ../supabase/migrations/20261116030000_credential_research_realtime.sql
\ir ../supabase/migrations/20261116050000_credential_verification_jobs.sql
do $$ begin
  if has_function_privilege('authenticated','public.claim_credential_verification()','EXECUTE')
    or has_function_privilege('anon','public.enqueue_credential_verification(uuid,uuid)','EXECUTE')
    or has_table_privilege('authenticated','private.credential_verification_items','UPDATE') then
    raise exception 'verification permissions are too broad';
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare t uuid; b uuid; j uuid; begin
  t := public.create_credential_template('PAR','Verification test','{"title":"Participation"}');
  b := public.create_credential_draft('50000000-0000-4000-8000-000000000001',t,'2026-01-01','EconMind Founder Team','[{"name":"Verify One"},{"name":"Verify Two"}]');
  perform public.review_credential_draft(b);
  j := public.enqueue_credential_verification(b,'50000000-0000-4000-8000-000000000002');
  if public.enqueue_credential_verification(b,'50000000-0000-4000-8000-000000000002') <> j then raise exception 'verification request is not idempotent'; end if;
  perform set_config('test.verification_job',j::text,false); perform set_config('test.verification_batch',b::text,false); perform set_config('test.verification_template',t::text,false);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform public.get_credential_verification(current_setting('test.verification_job')::uuid); raise exception 'ordinary user can view verification';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ declare data jsonb; job uuid; token uuid; begin
  data := public.claim_credential_verification(); job := (data->>'id')::uuid; token := (data->>'claim_token')::uuid;
  if job <> current_setting('test.verification_job')::uuid or jsonb_array_length(data->'items') <> 2 then raise exception 'incorrect verification claim'; end if;
  perform public.heartbeat_credential_verification(job,token);
  perform public.record_credential_verification_item(job,token,0,null);
  perform public.record_credential_verification_item(job,token,1,'Text exceeds the approved certificate layout.');
  perform public.finish_credential_verification(job,token);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare b uuid := current_setting('test.verification_batch')::uuid; j uuid; begin
  if public.get_credential_verification(current_setting('test.verification_job')::uuid)->>'state' <> 'failed' then raise exception 'failed verification lost'; end if;
  begin perform public.issue_credential_batch(b); raise exception 'failed verification allowed issuance'; exception when invalid_parameter_value then null; end;
  j := public.enqueue_credential_verification(b,'50000000-0000-4000-8000-000000000003');
  perform set_config('test.verification_job',j::text,false);
end $$;
reset role;
set role service_role;
do $$ declare data jsonb; job uuid; token uuid; begin
  data := public.claim_credential_verification(); job := (data->>'id')::uuid; token := (data->>'claim_token')::uuid;
  perform public.record_credential_verification_item(job,token,0,null);
  perform public.record_credential_verification_item(job,token,1,null);
  perform public.finish_credential_verification(job,token);
end $$;
reset role;
set role authenticated;
do $$ begin
  if jsonb_array_length(public.issue_credential_batch(current_setting('test.verification_batch')::uuid)) <> 2 then raise exception 'verified batch failed to issue'; end if;
  begin perform public.cancel_credential_draft(current_setting('test.verification_batch')::uuid); raise exception 'issued batch could be cancelled';
  exception when invalid_parameter_value then null; end;
end $$;
do $$ declare b uuid; j uuid; begin
  b := public.create_credential_draft('50000000-0000-4000-8000-000000000004',current_setting('test.verification_template')::uuid,'2026-01-01','EconMind Founder Team','[{"name":"Cancelled"}]');
  perform public.review_credential_draft(b);
  j := public.enqueue_credential_verification(b,'50000000-0000-4000-8000-000000000005');
  perform public.cancel_credential_draft(b);
  if public.get_credential_verification(j)->>'state' <> 'cancelled' then raise exception 'draft cancellation did not cancel verification'; end if;
end $$;
