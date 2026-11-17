-- Browser print mode: the approved visual assets are stored privately and are
-- returned only to active superme administrators. No service key is exposed.
begin;
create table private.credential_visual_assets (
  id boolean primary key default true check (id),
  template_html bytea not null,
  yale_signature bytea not null,
  updated_at timestamptz not null default now()
);
revoke all on private.credential_visual_assets from public, anon, authenticated;

create function public.get_credential_visual_assets() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); result jsonb;
begin
  select jsonb_build_object('template_html', convert_from(a.template_html, 'UTF8'),
    'yale_signature', encode(a.yale_signature, 'base64')) into result
    from private.credential_visual_assets a where a.id;
  if result is null then raise exception 'Private certificate assets are not configured' using errcode = '55000'; end if;
  return result;
end;
$$;
revoke all on function public.get_credential_visual_assets() from public, anon, authenticated;
grant execute on function public.get_credential_visual_assets() to authenticated;

create function public.list_credential_organization_page(p_after_id uuid default null, p_limit integer default 100)
returns setof public.organization_directory language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin();
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size' using errcode='22023'; end if;
  return query select d.* from public.organization_directory d
    where p_after_id is null or d.id > p_after_id order by d.id limit p_limit;
end;
$$;
revoke all on function public.list_credential_organization_page(uuid,integer) from public, anon, authenticated;
grant execute on function public.list_credential_organization_page(uuid,integer) to authenticated;

-- This records an administrator's manual review, not a server-rendered or
-- pixel-perfect automated verification. Issuance still requires this step.
create function public.confirm_credential_print_review(p_batch_id uuid, p_confirm boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin();
begin
  if p_confirm is distinct from true then raise exception 'Explicit review required' using errcode = '22023'; end if;
  if not exists (select 1 from private.credential_visual_assets where id) then
    raise exception 'Private certificate assets are not configured' using errcode = '55000';
  end if;
  update private.credential_batches set preview_verified_at = now()
    where id = p_batch_id and status = 'reviewed';
  if not found then raise exception 'Reviewed batch not found' using errcode = '22023'; end if;
  insert into private.credential_audit_logs(actor, action, batch_id, details)
    values (actor, 'manual_print_review_confirmed', p_batch_id, jsonb_build_object('verification', 'administrator_manual_review'));
end;
$$;
revoke all on function public.confirm_credential_print_review(uuid,boolean) from public, anon, authenticated;
grant execute on function public.confirm_credential_print_review(uuid,boolean) to authenticated;

create function public.ensure_credential_starter_templates() returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); item record;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('credential-starter-templates', 0));
  for item in select * from (values
    ('MEM','Membership','MEMBERSHIP'), ('PAR','Participation','PARTICIPATION'),
    ('CON','Technical Contribution','CONTRIBUTION'), ('CON','Communications Contribution','CONTRIBUTION'),
    ('LEA','Leadership','LEADERSHIP'), ('DIS','Distinction','DISTINCTION')
  ) as starters(category,subtype,title) loop
    if not exists (select 1 from private.credential_templates t where t.category=item.category and t.subtype=item.subtype) then
      perform public.create_credential_template(item.category,item.subtype,jsonb_build_object('title',item.title));
    end if;
  end loop;
end;
$$;
revoke all on function public.ensure_credential_starter_templates() from public, anon, authenticated;
grant execute on function public.ensure_credential_starter_templates() to authenticated;

create or replace function public.cancel_credential_draft(p_batch_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin();
begin
  update private.credential_batches set status='cancelled' where id=p_batch_id and status in ('draft','reviewed');
  if not found then raise exception 'Only an unissued draft can be cancelled' using errcode='22023'; end if;
  insert into private.credential_audit_logs(actor,action,batch_id) values(actor,'draft_cancelled',p_batch_id);
end;
$$;
revoke all on function public.cancel_credential_draft(uuid) from public, anon, authenticated;
grant execute on function public.cancel_credential_draft(uuid) to authenticated;
commit;
