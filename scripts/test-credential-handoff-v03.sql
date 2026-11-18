\set ON_ERROR_STOP on
\ir test-credential-visual-editor.sql
reset role;
create temp table v03_before as select
 (select jsonb_agg(to_jsonb(c) order by c.id) from private.credentials c) credentials,
 (select jsonb_agg(to_jsonb(n) order by n.category,n.issue_year) from private.credential_counters n) counters,
 pg_get_functiondef('public.issue_credential_batch(uuid)'::regprocedure) issuance;
\ir ../supabase/migrations/20261118000000_credential_handoff_v03.sql
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.import_credential_handoff_catalog(:'handoff_catalog'::jsonb);
do $$ begin
 if (select count(*) from private.credential_wording_versions where template_name in ('D01','D17','CON-R-LIVE'))<>3
    or (select count(*) from private.credential_wording_versions where status='draft' and template_name not in ('Official','Not Ready'))<>46 then
   raise exception '46 seeded wordings are not drafts'; end if;
 if exists(select 1 from v03_before where credentials is distinct from (select jsonb_agg(to_jsonb(c) order by c.id) from private.credentials c)
   or counters is distinct from (select jsonb_agg(to_jsonb(n) order by n.category,n.issue_year) from private.credential_counters n)
   or issuance is distinct from pg_get_functiondef('public.issue_credential_batch(uuid)'::regprocedure)) then raise exception 'v0.3 changed history or counters'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 begin perform public.list_credential_wording_versions(); raise exception 'ordinary user admitted'; exception when insufficient_privilege then null; end;
 begin perform public.list_credential_research_sources(); raise exception 'ordinary user can read research sources'; exception when insufficient_privilege then null; end;
 begin perform public.get_credential_research_source('10000000-0000-0000-0000-000000000002'); raise exception 'ordinary user can read paper by ID'; exception when insufficient_privilege then null; end;
 begin perform public.get_credential_handoff_catalog(); raise exception 'ordinary user can read private catalog'; exception when insufficient_privilege then null; end;
 begin perform public.import_credential_handoff_catalog('{}'); raise exception 'ordinary user can import'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare w uuid; b uuid; r jsonb; begin
 if not exists(select 1 from public.list_credential_research_sources('10000000-0000-0000-0000-000000000102',100) where paper_id='10000000-0000-0000-0000-000000000103') then raise exception 'record without a file omitted'; end if;
 select id into w from public.list_credential_wording_versions() where template_name='S01';
 begin perform public.set_credential_wording_status(w,'approved'); raise exception 'unreviewed template approved'; exception when invalid_parameter_value then null; end;
 r:=public.save_credential_editor_draft(null,0,'88888888-0000-0000-0000-000000000001','SUP','Supervisor','2027-01-01','EconMind Founder Team','samuel_qian_v1',
   '[{"name":"Synthetic Supervisor"}]',jsonb_build_array((select text_content from public.list_credential_wording_versions() where id=w)), '[{}]',jsonb_build_array(jsonb_build_object('type','library','id',w,'modified',false)));
 b:=(r->>'id')::uuid;
 perform public.review_credential_editor_draft(b,1); perform public.confirm_credential_print_review(b,true);
 begin perform public.issue_credential_batch(b); raise exception 'draft issued'; exception when invalid_parameter_value then null; end;
 perform public.set_credential_wording_status(w,'reviewed'); perform public.set_credential_wording_status(w,'approved');
 r:=public.issue_credential_batch(b);
 if r<>public.issue_credential_batch(b) then raise exception 'issue retry was not idempotent'; end if;
 if not exists(select 1 from public.search_credential_records('', 'SUP') where certificate_number = 'EML-SUP-2027-000001') then raise exception 'new category numbering broken'; end if;
end $$;
reset role;
-- Test-only source edit; the application never receives this helper.
create function public.test_rename_research(p_title text, p_status text default 'published') returns void language sql security definer set search_path='' as $$
 update public.research_papers set title=p_title,status=p_status,updated_at=clock_timestamp() where id='10000000-0000-0000-0000-000000000002'
$$;
grant execute on function public.test_rename_research(text,text) to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare w uuid; b uuid; result jsonb; src jsonb; wording jsonb; p record; begin
 select * into p from public.list_credential_research_sources() where paper_id='10000000-0000-0000-0000-000000000002';
 select id,text_content into w,wording from public.list_credential_wording_versions() where template_name='CON-R-LIVE';
 perform public.set_credential_wording_status(w,'reviewed'); perform public.set_credential_wording_status(w,'approved');
 src:=jsonb_build_object('kind','research','id',p.paper_id,'label',p.title,'paper_title',p.title,'author_display_name',p.author_display_name,
   'coauthors_text',coalesce(p.coauthors_text,''),'paper_status',p.status,'paper_updated_at',p.updated_at,'verified_author',p.author_display_name,'status_reviewed','false');
 wording:=jsonb_set(wording,'{certification_statement}',to_jsonb(replace(wording->>'certification_statement','{paper_title}',p.title)));
 result:=public.save_credential_editor_draft(null,0,'88888888-0000-0000-0000-000000000002','CON','Research Authorship · Live Library','2027-01-01','EconMind Founder Team','samuel_qian_v1',
   jsonb_build_array(jsonb_build_object('name',p.author_display_name,'project',p.title)),jsonb_build_array(wording),jsonb_build_array(src),jsonb_build_array(jsonb_build_object('type','library','id',w,'modified',true)));
 b:=(result->>'id')::uuid; perform public.review_credential_editor_draft(b,1); perform public.confirm_credential_print_review(b,true);
 perform public.test_rename_research('Renamed during review');
 begin perform public.issue_credential_batch(b); raise exception 'changed research source issued'; exception when serialization_failure then null; end;
 select * into p from public.list_credential_research_sources() where paper_id='10000000-0000-0000-0000-000000000002';
 if p.title<>'Renamed during review' then raise exception 'research change not visible'; end if;
 src:=jsonb_build_object('kind','research','id',p.paper_id,'label',p.title,'paper_title',p.title,'author_display_name',p.author_display_name,
   'coauthors_text',coalesce(p.coauthors_text,''),'paper_status',p.status,'paper_updated_at',p.updated_at,'verified_author',p.author_display_name,'status_reviewed','false');
 select text_content into wording from public.list_credential_wording_versions() where id=w;
 wording:=jsonb_set(wording,'{certification_statement}',to_jsonb(replace(wording->>'certification_statement','{paper_title}',p.title)));
 result:=public.save_credential_editor_draft(null,0,'88888888-0000-0000-0000-000000000003','CON','Research Authorship · Live Library','2027-01-01','EconMind Founder Team','samuel_qian_v1',
   jsonb_build_array(jsonb_build_object('name',p.author_display_name,'project',p.title)),jsonb_build_array(wording),jsonb_build_array(src),jsonb_build_array(jsonb_build_object('type','library','id',w,'modified',true)));
 b:=(result->>'id')::uuid; perform public.review_credential_editor_draft(b,1); perform public.confirm_credential_print_review(b,true); result:=public.issue_credential_batch(b);
 perform public.test_rename_research('Changed after issue','unpublished');
 if public.get_credential_research_source(p.paper_id)->>'status' <> 'unpublished' then raise exception 'Unpublish not visible by ID'; end if;
 if (public.get_credential_editor_render_data(b,(result->0->>'id')::uuid)->'credentials'->0->'recipient_snapshot'->'source_ref'->>'paper_title') is distinct from 'Renamed during review' then
   raise exception 'issued source snapshot did not remain frozen'; end if;
end $$;
do $$ declare w uuid; b uuid; payload jsonb; begin
 select id,text_content into w,payload from public.list_credential_wording_versions() where template_name='D01';
 perform public.set_credential_wording_status(w,'reviewed'); perform public.set_credential_wording_status(w,'approved');
 b:=(public.save_credential_editor_draft(null,0,'88888888-0000-0000-0000-000000000010','DIS','Outstanding Academic Contribution','2027-01-01','EconMind Founder Team','samuel_qian_v1',
   '[{"name":"Synthetic Honoree"}]',jsonb_build_array(payload),'[{}]',jsonb_build_array(jsonb_build_object('type','library','id',w,'modified',false)))->>'id')::uuid;
 perform public.review_credential_editor_draft(b,1); perform public.confirm_credential_print_review(b,true);
 begin perform public.issue_credential_batch(b); raise exception 'unverified distinction issued'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
\ir ../supabase/migrations/20261118000000_credential_handoff_v03.sql
select public.import_credential_handoff_catalog(:'handoff_catalog'::jsonb);
 do $$ begin
 if (select count(*) from private.credential_wording_versions where template_name not in ('Official','Not Ready'))<>46 then raise exception 'seed rerun duplicated entries'; end if;
 if not exists(select 1 from private.credential_wording_versions where template_name='S01' and status='approved') then raise exception 'seed rerun reset approval'; end if;
 end $$;
