\set ON_ERROR_STOP on
-- Disposable test database only; the assets here are synthetic.
\ir test-credential-research-sources.sql
reset role;
create role service_role;
\ir ../supabase/migrations/20261116010000_credential_issuance_core.sql
\ir ../supabase/migrations/20261116020000_shared_team_directory.sql
\ir ../supabase/migrations/20261116060000_credential_browser_print.sql
insert into private.credential_visual_assets(id,template_html,yale_signature)
values (true,convert_to('synthetic template','UTF8'),convert_to('synthetic signature','UTF8'));
insert into public.organization_directory(id,name,title,organizational_group)
values ('20000000-0000-0000-0000-000000000001','Synthetic A','Lead','technology-team'),
       ('20000000-0000-0000-0000-000000000002','Synthetic B','Lead','technology-team');
do $$ begin
  if has_function_privilege('anon','public.get_credential_visual_assets()','execute')
    or has_table_privilege('authenticated','private.credential_visual_assets','select') then
    raise exception 'Private print assets exposed';
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform public.get_credential_visual_assets(); raise exception 'ordinary user read private assets';
  exception when insufficient_privilege then null; end;
  begin perform public.confirm_credential_print_review(gen_random_uuid(),true); raise exception 'ordinary user confirmed review';
  exception when insufficient_privilege then null; end;
  begin perform public.ensure_credential_starter_templates(); raise exception 'ordinary user created templates';
  exception when insufficient_privilege then null; end;
  begin perform public.list_credential_organization_page(); raise exception 'ordinary user accessed organization source';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform public.get_credential_visual_assets(); raise exception 'suspended administrator read private assets';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare t uuid; b uuid; result jsonb; begin
  if public.get_credential_visual_assets()->>'template_html' <> 'synthetic template' then raise exception 'assets missing'; end if;
  if (select count(*) from public.list_credential_organization_page(null,1)) <> 1
     or (select name from public.list_credential_organization_page('20000000-0000-0000-0000-000000000001',1)) <> 'Synthetic B'
    then raise exception 'organization pagination failed'; end if;
  perform public.ensure_credential_starter_templates();
  perform public.ensure_credential_starter_templates();
  if jsonb_array_length(public.list_credential_admin_data()->'templates') <> 6 then raise exception 'starter templates not idempotent'; end if;
  t := public.create_credential_template('CON','Test','{"title":"Contribution"}');
  b := public.create_credential_draft('10000000-0000-0000-0000-000000000001',t,'2026-01-01','EconMind Founder Team','[{"name":"Test","user_id":"00000000-0000-0000-0000-000000000002"}]');
  begin perform public.confirm_credential_print_review(b,true); raise exception 'unreviewed draft accepted';
  exception when invalid_parameter_value then null; end;
  perform public.review_credential_draft(b);
  begin perform public.confirm_credential_print_review(b,false); raise exception 'missing confirmation accepted';
  exception when invalid_parameter_value then null; end;
  perform public.confirm_credential_print_review(b,true);
  result := public.issue_credential_batch(b);
  if result->0->>'number' <> 'EML-CON-2026-000001' then raise exception 'numbering failed'; end if;
  if public.get_credential_render_data(b)->'credentials'->0->'recipient_snapshot'->>'user_id' <> '00000000-0000-0000-0000-000000000002' then raise exception 'linked account snapshot missing'; end if;
  if not exists (select 1 from public.list_credential_audit_logs() where action='manual_print_review_confirmed') then raise exception 'manual review not audited'; end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from private.credentials where recipient_name='Test' and user_id='00000000-0000-0000-0000-000000000002') then
    raise exception 'linked account missing from issued credential';
  end if;
end $$;
