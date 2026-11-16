\set ON_ERROR_STOP on
\ir test-credential-issuance-core.sql
reset role;
\ir ../supabase/migrations/20261116030000_credential_research_realtime.sql
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null, file_size_limit bigint, allowed_mime_types text[]);
\ir ../supabase/migrations/20261116040000_credential_export_jobs.sql
do $$ begin
  if has_function_privilege('authenticated','public.claim_credential_export()','EXECUTE')
    or has_function_privilege('anon','public.enqueue_credential_export(uuid,uuid)','EXECUTE')
    or has_table_privilege('authenticated','private.credential_export_items','UPDATE') then
    raise exception 'export permissions are too broad';
  end if;
  if (select public from storage.buckets where id='credential-pdfs') is distinct from false then raise exception 'PDF bucket is public'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare t uuid; b uuid; j uuid; begin
  t := public.create_credential_template('DIS','Export test','{"title":"Distinction"}');
  b := public.create_credential_draft('40000000-0000-4000-8000-000000000001',t,'2026-01-01','EconMind Founder Team','[{"name":"Export One"},{"name":"Export Two"}]');
  perform public.review_credential_draft(b); perform public.test_attest_credential_preview(b); perform public.issue_credential_batch(b);
  j := public.enqueue_credential_export(b,'40000000-0000-4000-8000-000000000002');
  if public.enqueue_credential_export(b,'40000000-0000-4000-8000-000000000002') <> j then raise exception 'export request is not idempotent'; end if;
  perform set_config('test.job',j::text,false); perform set_config('test.batch',b::text,false);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform public.get_credential_export(current_setting('test.job')::uuid); raise exception 'ordinary user can view export';
  exception when insufficient_privilege then null; end;
  begin perform public.claim_credential_export(); raise exception 'ordinary user can claim export';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ declare data jsonb; job uuid; token uuid; one_id uuid; two_id uuid; batch uuid; begin
  data := public.claim_credential_export(); job := (data->>'id')::uuid; token := (data->>'claim_token')::uuid;
  batch := (data->>'batch_id')::uuid; one_id := (data->'items'->0->>'id')::uuid; two_id := (data->'items'->1->>'id')::uuid;
  if job <> current_setting('test.job')::uuid or jsonb_array_length(data->'items') <> 2 then raise exception 'incorrect worker claim'; end if;
  perform public.heartbeat_credential_export(job,token);
  begin perform public.record_credential_export_item(job,gen_random_uuid(),one_id,null,'invalid token'); raise exception 'wrong token accepted';
  exception when insufficient_privilege then null; end;
  perform public.record_credential_export_item(job,token,one_id,batch::text||'/'||one_id::text||'.pdf',null);
  perform public.record_credential_export_item(job,token,two_id,null,'temporary render error');
  perform public.finish_credential_export(job,token);
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
  if public.get_credential_export(current_setting('test.job')::uuid)->>'state' <> 'partial' then raise exception 'partial failure lost'; end if;
  perform public.retry_credential_export(current_setting('test.job')::uuid);
end $$;
reset role;
set role service_role;
do $$ declare data jsonb; job uuid; token uuid; cid uuid; batch uuid; begin
  data := public.claim_credential_export(); job := (data->>'id')::uuid; token := (data->>'claim_token')::uuid; batch := (data->>'batch_id')::uuid;
  if jsonb_array_length(data->'items') <> 1 then raise exception 'retry repeated successful items'; end if;
  cid := (data->'items'->0->>'id')::uuid;
  perform public.record_credential_export_item(job,token,cid,batch::text||'/'||cid::text||'.pdf',null);
  perform public.finish_credential_export(job,token);
end $$;
reset role;
set role authenticated;
do $$ begin
  if public.get_credential_export(current_setting('test.job')::uuid)->>'state' <> 'complete'
    or jsonb_array_length(public.get_credential_export_downloads(current_setting('test.job')::uuid)->'items') <> 2 then
    raise exception 'successful export is incomplete';
  end if;
end $$;
