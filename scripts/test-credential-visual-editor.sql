\set ON_ERROR_STOP on
-- Run only in a disposable test cluster.
\ir test-credential-browser-print.sql
create temp table v2_before as select
 (select jsonb_agg(to_jsonb(c) order by c.id) from private.credentials c) credentials,
 (select jsonb_agg(to_jsonb(t) order by t.id) from private.credential_templates t) templates,
 (select jsonb_agg(to_jsonb(n) order by n.category,n.issue_year) from private.credential_counters n) counters,
 pg_get_functiondef('public.issue_credential_batch(uuid)'::regprocedure) issuance;
\ir verify-credential-editor-v2-ready.sql
select to_regprocedure('public.get_credential_editor_render_data(uuid,uuid)') is not null as verified
\gset
\if :verified
  do $$ begin raise exception 'Release gate incorrectly allowed V1-only database'; end $$;
\endif
\ir ../supabase/migrations/20261117000000_credential_visual_editor.sql
\ir verify-credential-editor-v2-ready.sql
select to_regprocedure('public.get_credential_editor_render_data(uuid,uuid)') is not null as verified
\gset
\if :verified
\else
  do $$ begin raise exception 'Release gate did not recognize V2 database'; end $$;
\endif

do $$ begin
 if exists(select 1 from v2_before where credentials is distinct from (select jsonb_agg(to_jsonb(c) order by c.id) from private.credentials c)
   or templates is distinct from (select jsonb_agg(to_jsonb(t) order by t.id) from private.credential_templates t)
   or counters is distinct from (select jsonb_agg(to_jsonb(n) order by n.category,n.issue_year) from private.credential_counters n)
   or issuance is distinct from pg_get_functiondef('public.issue_credential_batch(uuid)'::regprocedure)) then
   raise exception 'Migration changed existing records, templates, counters or issuance function'; end if;
 if has_function_privilege('anon','public.save_credential_editor_draft(uuid,integer,uuid,text,text,date,text,text,jsonb,jsonb,jsonb,jsonb)','execute')
   or has_table_privilege('authenticated','private.credential_wording_versions','select') then raise exception 'V2 data exposed'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
 begin perform public.list_credential_wording_versions(); raise exception 'signed-out user admitted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 begin perform public.list_credential_wording_versions(); raise exception 'ordinary user admitted'; exception when insufficient_privilege then null; end;
 begin perform public.create_credential_wording_version('LEA','Initial Founder','Bad','{}'); raise exception 'ordinary user wrote wording'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
 begin perform public.list_credential_wording_versions(); raise exception 'suspended administrator admitted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare w uuid; w2 uuid; placeholder uuid; b uuid; bad uuid; legacy_t uuid; legacy_b uuid; r jsonb; c jsonb; begin
 placeholder:=public.create_credential_wording_version('LEA','Initial Founder','Not Ready','{"title":"Example","certification_statement":"[Certification Statement]"}');
 begin perform public.set_credential_wording_status(placeholder,'approved'); raise exception 'placeholder wording approved'; exception when invalid_parameter_value then null; end;
 w:=public.create_credential_wording_version('LEA','Initial Founder','Official','{"title":"Founder","certification_statement":"Text one"}');
 if (select status from public.list_credential_wording_versions() where id=w)<>'draft' then raise exception 'new wording was not draft'; end if;
 perform public.set_credential_wording_status(w,'approved');
 w2:=public.create_credential_wording_version('LEA','Initial Founder','Official','{"title":"Founder","certification_statement":"Text two"}');
 perform public.set_credential_wording_status(w2,'approved');
 if (select status from public.list_credential_wording_versions() where id=w)<>'archived' then raise exception 'previous version not archived'; end if;
 if not exists(select 1 from public.list_credential_audit_logs() where action='wording_status_changed' and details->>'wording_id'=w::text and details->>'status'='archived') then raise exception 'wording archive missing from audit'; end if;
 begin
   perform public.save_credential_editor_draft(null,0,'30000000-0000-0000-0000-000000000005','LEA','Initial Founder','2027-01-01','EconMind Founder Team','samuel_qian_v1',
     '[{"name":"Forged"}]','[{"title":"Different","certification_statement":"Text two"}]','[{}]',jsonb_build_array(jsonb_build_object('type','library','id',w2::text,'modified',false)));
   raise exception 'modified wording falsely recorded as unchanged';
 exception when invalid_parameter_value then null; end;
 r:=public.save_credential_editor_draft(null,0,'30000000-0000-0000-0000-000000000001','LEA','Initial Founder','2027-01-01','EconMind Founder Team','samuel_qian_v1',
   '[{"name":"Synthetic One"},{"name":"Synthetic Two"}]',
   '[{"title":"First","certification_statement":"First text"},{"title":"Second","certification_statement":"Second text"}]',
   '[{"kind":"research","id":"article-one","label":"Research"},{}]',jsonb_build_array(jsonb_build_object('type','library','id',w2::text,'modified',true),'{}'::jsonb));
 b:=(r->>'id')::uuid;
 if r->>'revision'<>'1' or public.get_credential_editor_render_data(b)->'editor'->'wordings'->1->>'title'<>'Second' then raise exception 'editor draft not stored'; end if;
 r:=public.save_credential_editor_draft(b,1,null,'LEA','Initial Founder','2027-01-01','EconMind Leadership Group','yale_chen_v1',
   '[{"name":"Synthetic One"},{"name":"Synthetic Two"}]',
   '[{"title":"Edited","certification_statement":"Edited text"},{"title":"Second","certification_statement":"Second text"}]',
   '[{"kind":"research","id":"article-one","label":"Research"},{}]',jsonb_build_array(jsonb_build_object('type','library','id',w2::text,'modified',true),'{}'::jsonb));
 if r->>'revision'<>'2' then raise exception 'draft update failed'; end if;
 begin
   perform public.save_credential_editor_draft(b,1,null,'LEA','Initial Founder','2027-01-01','EconMind Founder Team','samuel_qian_v1',
    '[{"name":"Synthetic One"}]','[{"title":"Stale"}]','[{}]','[{}]');
   raise exception 'stale editor save succeeded';
 exception when serialization_failure then null; end;
 begin perform public.review_credential_draft(b); raise exception 'V2 review bypassed revision guard'; exception when serialization_failure then null; end;
 begin perform public.review_credential_editor_draft(b,1); raise exception 'stale preview reviewed'; exception when serialization_failure then null; end;
 perform public.review_credential_editor_draft(b,2);
 begin
   perform public.save_credential_editor_draft(b,2,null,'LEA','Initial Founder','2027-01-01','EconMind Founder Team','samuel_qian_v1',
    '[{"name":"Synthetic One"}]','[{"title":"Changed"}]','[{}]','[{}]');
   raise exception 'reviewed draft changed';
 exception when invalid_parameter_value then null; end;
 perform public.confirm_credential_print_review(b,true);
 c:=public.issue_credential_batch(b);
 if c->0->>'number'<>'EML-LEA-2027-000001' or c->1->>'number'<>'EML-LEA-2027-000002' then raise exception 'V1 numbering changed: %',c; end if;
 if public.issue_credential_batch(b)<>c then raise exception 'issuance retry changed'; end if;
 begin
   perform public.save_credential_editor_draft(b,2,null,'LEA','Initial Founder','2027-01-01','EconMind Founder Team','samuel_qian_v1',
    '[{"name":"Altered"}]','[{"title":"Changed"}]','[{}]','[{}]');
   raise exception 'issued certificate was editable';
 exception when invalid_parameter_value then null; end;
 r:=public.get_credential_editor_render_data(b);
 if r->'credentials'->0->'template_snapshot'->'text_content'->>'title'<>'Edited'
   or r->'credentials'->1->'template_snapshot'->'text_content'->>'title'<>'Second'
   or r->'credentials'->0->'recipient_snapshot'->'source_ref'->>'id'<>'article-one'
   or r->'credentials'->0->'template_snapshot'->'wording_reference'->>'version'<>'2'
   or r->'credentials'->0->'template_snapshot'->'wording_reference'->>'modified'<>'true' then
   raise exception 'issued snapshot or research source missing'; end if;
 r:=public.save_credential_editor_draft(null,0,'30000000-0000-0000-0000-000000000002','DIS','Project Excellence','2028-01-01','EconMind Founder Team','samuel_qian_v1',
   '[{"name":"Unconfigured"}]','[{"title":"","certification_statement":""}]','[{}]','[{}]');
 bad:=(r->>'id')::uuid; perform public.review_credential_editor_draft(bad,1); perform public.confirm_credential_print_review(bad,true);
 begin perform public.issue_credential_batch(bad); raise exception 'incomplete wording issued'; exception when invalid_parameter_value then null; end;
 r:=public.save_credential_editor_draft(null,0,'30000000-0000-0000-0000-000000000003','PAR','Preview Only','2029-01-01','EconMind Founder Team','samuel_qian_v1',
   '[{"name":"Preview Only"}]','[{"title":"Participant","certification_statement":"Verified text"}]','[{}]','[{}]');
 perform public.get_credential_editor_render_data((r->>'id')::uuid);
 legacy_t:=public.create_credential_template('MEM','Legacy after V2','{"title":"Membership"}');
 legacy_b:=public.create_credential_draft('30000000-0000-0000-0000-000000000004',legacy_t,'2034-01-01','EconMind Founder Team','[{"name":"Legacy User"}]');
 perform public.review_credential_draft(legacy_b); perform public.confirm_credential_print_review(legacy_b,true);
 c:=public.issue_credential_batch(legacy_b);
 if c->0->>'number'<>'EML-MEM-2034-000001' then raise exception 'V1 workflow changed after V2 migration'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from v2_before where credentials is distinct from (select jsonb_agg(to_jsonb(c) order by c.id) from private.credentials c where c.recipient_name='Test')) then
   raise exception 'old issued credential changed'; end if;
 if (select last_sequence from private.credential_counters where category='CON' and issue_year=2026)<>1 then raise exception 'existing counter changed'; end if;
 if exists(select 1 from private.credential_counters where category='DIS' and issue_year=2028) then raise exception 'failed issuance allocated a number'; end if;
 if exists(select 1 from private.credential_counters where category='PAR' and issue_year=2029) then raise exception 'draft or preview allocated a number'; end if;
end $$;
