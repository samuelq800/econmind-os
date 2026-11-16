-- Credential issuance core. Apply only after reviewing the separate deployment plan.
-- Private tables are never writable through the client; all entry points authorize
-- the current user independently and execute within a single transaction.
begin;

create schema if not exists private;

create table private.credential_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('MEM', 'PAR', 'CON', 'LEA', 'DIS')),
  subtype text not null check (length(trim(subtype)) between 1 and 120),
  version integer not null check (version > 0),
  text_content jsonb not null check (jsonb_typeof(text_content) = 'object'),
  active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, subtype, version)
);

create table private.credential_batches (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  template_id uuid not null references private.credential_templates(id),
  entries jsonb not null check (jsonb_typeof(entries) = 'array'),
  issue_date date not null,
  issuing_authority text not null check (issuing_authority in ('EconMind Founder Team', 'EconMind Leadership Group')),
  signature_key text not null check (signature_key in ('samuel_qian_v1', 'yale_chen_v1')),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'issued', 'cancelled')),
  created_by uuid not null,
  reviewed_by uuid,
  duplicates_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  preview_verified_at timestamptz,
  issued_at timestamptz
);

create table private.credential_counters (
  category text not null,
  issue_year integer not null,
  last_sequence integer not null check (last_sequence between 1 and 999999),
  primary key (category, issue_year)
);

create table private.credentials (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references private.credential_batches(id),
  batch_entry integer not null,
  certificate_number text not null unique,
  replaces_id uuid references private.credentials(id),
  recipient_name text not null,
  category text not null,
  subtype text not null,
  issue_date date not null,
  issuing_authority text not null,
  signature_key text not null check (signature_key in ('samuel_qian_v1', 'yale_chen_v1')),
  signatory_title text not null default 'EconMind Initial Founder',
  template_id uuid not null references private.credential_templates(id),
  template_snapshot jsonb not null,
  recipient_snapshot jsonb not null,
  status text not null default 'issued' check (status in ('issued', 'revoked', 'replaced')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  revocation_reason text,
  unique (batch_id, batch_entry),
  unique (replaces_id),
  check (replaces_id is null or replaces_id <> id)
);

create table private.credential_audit_logs (
  id bigint generated always as identity primary key,
  actor uuid not null,
  action text not null,
  batch_id uuid references private.credential_batches(id),
  credential_id uuid references private.credentials(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

revoke all on private.credential_templates, private.credential_batches, private.credential_counters,
  private.credentials, private.credential_audit_logs from public, anon, authenticated;
revoke all on sequence private.credential_audit_logs_id_seq from public, anon, authenticated;

create function private.require_credential_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null
    or not coalesce(public.is_superme_platform_admin(actor), false)
    or not exists (select 1 from public.profiles p where p.user_id = actor and p.account_status = 'active') then
    raise exception 'Superme platform administrator required' using errcode = '42501';
  end if;
  return actor;
end;
$$;
revoke all on function private.require_credential_admin() from public, anon, authenticated;

create function public.create_credential_template(p_category text, p_subtype text, p_text_content jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); new_id uuid; next_version integer;
begin
  if p_category is null or p_category not in ('MEM', 'PAR', 'CON', 'LEA', 'DIS') or p_subtype is null
    or length(trim(p_subtype)) not between 1 and 120 or p_text_content is null
    or jsonb_typeof(p_text_content) <> 'object' or octet_length(p_text_content::text) > 20000 then
    raise exception 'Invalid template' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_text_content) f
    where f.key not in ('title', 'certification_statement', 'role_description', 'contribution_paragraph', 'service_period_text')
       or jsonb_typeof(f.value) <> 'string' or length(f.value #>> '{}') > 4000) then
    raise exception 'Template may contain only supported plain-text fields' using errcode = '22023';
  end if;
  -- Serialize version allocation per category/subtype, including the first version.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_category || ':' || trim(p_subtype), 0));
  select coalesce(max(t.version), 0) + 1 into next_version from private.credential_templates t
    where t.category = p_category and t.subtype = trim(p_subtype);
  update private.credential_templates set active=false,updated_at=now()
    where category=p_category and subtype=trim(p_subtype) and active;
  insert into private.credential_templates(category, subtype, version, text_content, created_by)
    values (p_category, trim(p_subtype), next_version, p_text_content, actor) returning id into new_id;
  insert into private.credential_audit_logs(actor, action, details)
    values (actor, 'template_created', jsonb_build_object('template_id', new_id, 'version', next_version));
  return new_id;
end;
$$;

create function public.create_credential_draft(p_request_key uuid, p_template_id uuid, p_issue_date date,
  p_issuing_authority text, p_entries jsonb, p_signature_key text default 'samuel_qian_v1')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); new_id uuid; existing private.credential_batches%rowtype; entry jsonb;
begin
  if p_request_key is null or p_issue_date is null or extract(year from p_issue_date) not between 2000 and 9999
    or p_issuing_authority is null or p_issuing_authority not in ('EconMind Founder Team', 'EconMind Leadership Group')
    or p_signature_key is null or p_signature_key not in ('samuel_qian_v1', 'yale_chen_v1')
    or p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Invalid draft' using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) not between 1 and 500 or octet_length(p_entries::text) > 1000000 then
    raise exception 'Invalid number or size of entries' using errcode = '22023';
  end if;
  select * into existing from private.credential_batches where request_key = p_request_key;
  if found then
    if existing.created_by <> actor or existing.template_id <> p_template_id or existing.entries <> p_entries
      or existing.issue_date <> p_issue_date or existing.issuing_authority <> p_issuing_authority or existing.signature_key <> p_signature_key then
      raise exception 'Idempotency key already used for different draft' using errcode = '23505';
    end if;
    return existing.id;
  end if;
  perform 1 from private.credential_templates where id = p_template_id and active for share;
  if not found then raise exception 'Active template not found' using errcode = '22023'; end if;
  for entry in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(entry) <> 'object' or jsonb_typeof(entry->'name') is distinct from 'string'
      or length(trim(entry->>'name')) not between 1 and 200 or octet_length(entry::text) > 10000 then
      raise exception 'Invalid recipient' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_each(entry) f
      where f.key not in ('name','role','department','project','contribution','service_period','user_id','replaces_id')
        or jsonb_typeof(f.value) <> 'string' or length(f.value #>> '{}') > 4000) then
      raise exception 'Invalid recipient field' using errcode = '22023';
    end if;
    if entry ? 'replaces_id' and (entry->>'replaces_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists (select 1 from private.credentials c join private.credential_templates t on t.id=p_template_id
        where c.id=(entry->>'replaces_id')::uuid and c.status='revoked' and c.category=t.category)) then
      raise exception 'Replacement must reference a revoked credential in the same category' using errcode='22023';
    end if;
  end loop;
  insert into private.credential_batches(request_key, template_id, entries, issue_date, issuing_authority, signature_key, created_by)
    values (p_request_key, p_template_id, p_entries, p_issue_date, p_issuing_authority, p_signature_key, actor)
    on conflict (request_key) do nothing returning id into new_id;
  if new_id is null then
    select * into existing from private.credential_batches where request_key = p_request_key;
    if existing.created_by <> actor or existing.template_id <> p_template_id or existing.entries <> p_entries
      or existing.issue_date <> p_issue_date or existing.issuing_authority <> p_issuing_authority or existing.signature_key <> p_signature_key then
      raise exception 'Idempotency key already used for different draft' using errcode = '23505';
    end if;
    return existing.id;
  end if;
  insert into private.credential_audit_logs(actor, action, batch_id) values (actor, 'draft_created', new_id);
  return new_id;
end;
$$;

create function public.set_credential_template_active(p_template_id uuid,p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); template private.credential_templates%rowtype;
begin
  if p_active is null then raise exception 'Active status required' using errcode='22023'; end if;
  select * into template from private.credential_templates where id=p_template_id;
  if not found then raise exception 'Template not found' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(template.category || ':' || template.subtype, 0));
  if p_active then
    update private.credential_templates set active=false,updated_at=now()
      where category=template.category and subtype=template.subtype and active and id<>p_template_id;
  end if;
  update private.credential_templates set active=p_active,updated_at=now() where id=p_template_id;
  insert into private.credential_audit_logs(actor,action,details)
    values(actor,'template_activation_changed',jsonb_build_object('template_id',p_template_id,'active',p_active));
end;
$$;

create function public.review_credential_draft(p_batch_id uuid, p_acknowledge_duplicates boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); batch private.credential_batches%rowtype; duplicate_count integer;
begin
  select * into batch from private.credential_batches where id = p_batch_id for update;
  if not found or batch.status <> 'draft' then raise exception 'Draft not found or not reviewable' using errcode = '22023'; end if;
  select count(*) into duplicate_count from (
    select lower(trim(e.value->>'name')) as name from jsonb_array_elements(batch.entries) e
    group by lower(trim(e.value->>'name')) having count(*) > 1
    union
    select distinct lower(trim(e.value->>'name')) from jsonb_array_elements(batch.entries) e
      join private.credentials c on lower(c.recipient_name) = lower(trim(e.value->>'name'))
      join private.credential_templates t on t.id = batch.template_id and t.category = c.category
  ) duplicates;
  if duplicate_count > 0 and not coalesce(p_acknowledge_duplicates,false) then
    raise exception 'Potential duplicate recipient names require review' using errcode = '23505', detail = duplicate_count::text;
  end if;
  update private.credential_batches set status = 'reviewed', reviewed_by = actor, reviewed_at = now(),
    duplicates_acknowledged = coalesce(p_acknowledge_duplicates,false)
    where id = p_batch_id and status = 'draft';
  insert into private.credential_audit_logs(actor, action, batch_id, details)
    values (actor, 'batch_reviewed', p_batch_id, jsonb_build_object('potential_duplicate_names', duplicate_count, 'acknowledged', coalesce(p_acknowledge_duplicates,false)));
end;
$$;

create function public.issue_credential_batch(p_batch_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); b private.credential_batches%rowtype;
  t private.credential_templates%rowtype; yr integer; first_seq integer; total integer; item record; seq integer;
begin
  select * into b from private.credential_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found' using errcode = '22023'; end if;
  if b.status = 'issued' then
    return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'number', c.certificate_number) order by c.batch_entry), '[]'::jsonb)
      from private.credentials c where c.batch_id = p_batch_id);
  end if;
  if b.status <> 'reviewed' or b.preview_verified_at is null then
    raise exception 'Batch requires a reviewed, verified preview before issuance' using errcode = '22023';
  end if;
  select * into strict t from private.credential_templates where id = b.template_id;
  -- Recheck under a category-level lock so two concurrent batches cannot both
  -- pass review and silently issue the same name without acknowledgement.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('credential-duplicates:' || t.category, 0));
  perform c.id from private.credentials c where c.id in (
    select (e.value->>'replaces_id')::uuid from jsonb_array_elements(b.entries) e where e.value ? 'replaces_id'
  ) order by c.id for update;
  if exists (select 1 from jsonb_array_elements(b.entries) e left join private.credentials c on c.id=(e.value->>'replaces_id')::uuid
    where e.value ? 'replaces_id' and (c.id is null or c.status <> 'revoked' or c.category <> t.category)) then
    raise exception 'The original credential is no longer available for replacement' using errcode='22023';
  end if;
  if not b.duplicates_acknowledged and exists (
    select 1 from jsonb_array_elements(b.entries) e join private.credentials c
      on lower(c.recipient_name) = lower(trim(e.value->>'name')) and c.category = t.category
  ) then raise exception 'Potential duplicate appeared after review; create a new reviewed draft' using errcode = '23505'; end if;
  total := jsonb_array_length(b.entries); yr := extract(year from b.issue_date)::integer;
  insert into private.credential_counters(category, issue_year, last_sequence) values (t.category, yr, total)
    on conflict (category, issue_year) do update set last_sequence = private.credential_counters.last_sequence + excluded.last_sequence
    returning last_sequence - total + 1 into first_seq;
  for item in select value, ordinality from jsonb_array_elements(b.entries) with ordinality loop
    seq := first_seq + item.ordinality::integer - 1;
    insert into private.credentials(batch_id, batch_entry, certificate_number, replaces_id, recipient_name, category, subtype,
      issue_date, issuing_authority, signature_key, template_id, template_snapshot, recipient_snapshot, created_by)
    values (b.id, item.ordinality, 'EML-' || t.category || '-' || yr || '-' || lpad(seq::text, 6, '0'), (item.value->>'replaces_id')::uuid,
      trim(item.value->>'name'), t.category, t.subtype, b.issue_date, b.issuing_authority, b.signature_key, t.id,
      jsonb_build_object('version', t.version, 'text_content', t.text_content), item.value, actor);
    if item.value ? 'replaces_id' then
      update private.credentials set status='replaced' where id=(item.value->>'replaces_id')::uuid and status='revoked';
      insert into private.credential_audit_logs(actor,action,batch_id,credential_id,details)
        values(actor,'credential_replaced',b.id,(item.value->>'replaces_id')::uuid,jsonb_build_object('replacement_number','EML-' || t.category || '-' || yr || '-' || lpad(seq::text,6,'0')));
    end if;
  end loop;
  update private.credential_batches set status = 'issued', issued_at = now() where id = b.id;
  insert into private.credential_audit_logs(actor, action, batch_id, details)
    values (actor, 'batch_issued', b.id, jsonb_build_object('count', total));
  return (select jsonb_agg(jsonb_build_object('id', c.id, 'number', c.certificate_number) order by c.batch_entry)
    from private.credentials c where c.batch_id = b.id);
end;
$$;

-- Only the trusted rendering worker may attest successful preview and layout
-- checks. No public/client RPC grants this privilege. The worker implementation
-- and its visual checks are not yet built, so issuance remains fail-closed.
create function public.attest_credential_preview(p_batch_id uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_actor is null or not coalesce(public.is_superme_platform_admin(p_actor), false)
    or not exists (select 1 from public.profiles where user_id = p_actor and account_status = 'active') then
    raise exception 'Superme platform administrator required' using errcode = '42501';
  end if;
  update private.credential_batches set preview_verified_at = now()
    where id = p_batch_id and status = 'reviewed';
  if not found then raise exception 'Reviewed batch not found' using errcode = '22023'; end if;
  insert into private.credential_audit_logs(actor, action, batch_id) values (p_actor, 'preview_verified', p_batch_id);
end;
$$;
revoke all on function public.attest_credential_preview(uuid,uuid) from public, anon, authenticated;
grant execute on function public.attest_credential_preview(uuid,uuid) to service_role;

create function public.get_credential_render_data(p_batch_id uuid, p_credential_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); result jsonb;
begin
  if p_batch_id is null then raise exception 'Batch required' using errcode = '22023'; end if;
  select jsonb_build_object('id', b.id, 'status', b.status, 'entries', b.entries, 'issue_date', b.issue_date,
    'issuing_authority', b.issuing_authority, 'signature_key', b.signature_key, 'category', t.category, 'subtype', t.subtype,
    'template', t.text_content, 'template_version', t.version,
    'credentials', (select coalesce(jsonb_agg(to_jsonb(c) order by c.batch_entry), '[]'::jsonb)
      from (select id, batch_entry, certificate_number, status, recipient_snapshot, template_snapshot
        from private.credentials where batch_id = b.id and (p_credential_id is null or id = p_credential_id)) c))
    into result from private.credential_batches b join private.credential_templates t on t.id = b.template_id where b.id = p_batch_id;
  if result is null then raise exception 'Batch not found' using errcode = '22023'; end if;
  return result;
end;
$$;
revoke all on function public.get_credential_render_data(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_credential_render_data(uuid,uuid) to authenticated;

create function public.revoke_credential(p_credential_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); batch uuid;
begin
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then
    raise exception 'A revocation reason is required' using errcode = '22023';
  end if;
  update private.credentials set status = 'revoked', revoked_by = actor, revoked_at = now(), revocation_reason = trim(p_reason)
    where id = p_credential_id and status = 'issued' returning batch_id into batch;
  if not found then raise exception 'Credential not found or already revoked' using errcode = '22023'; end if;
  insert into private.credential_audit_logs(actor, action, batch_id, credential_id, details)
    values (actor, 'credential_revoked', batch, p_credential_id, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

create function public.list_credential_admin_data(p_limit integer default 100, p_before timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin();
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before is null) <> (p_before_id is null) then
    raise exception 'Invalid pagination cursor or page size' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'counts', (select jsonb_build_object(
      'issued', count(*),
      'issued_this_month', count(*) filter (where created_at >= date_trunc('month', now())),
      'revoked', count(*) filter (where status in ('revoked','replaced'))) from private.credentials),
    'pending', (select count(*) from private.credential_batches where status in ('draft', 'reviewed')),
    'templates', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
      from (select id, category, subtype, version, active, text_content, created_at, updated_at from private.credential_templates order by created_at desc, id desc) t),
    'credentials', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc, c.id desc), '[]'::jsonb)
      from (select id, batch_id, template_id, replaces_id, certificate_number, recipient_name, category, subtype, issue_date, issuing_authority,
        signatory_title, signature_key, template_snapshot, recipient_snapshot, status, created_at, revoked_at, revocation_reason
        from private.credentials where p_before is null or (created_at, id) < (p_before, p_before_id)
        order by created_at desc, id desc limit p_limit) c),
    'batches', (select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc), '[]'::jsonb)
      from (select id, template_id, entries, issue_date, issuing_authority, signature_key, status, created_at, reviewed_at, preview_verified_at, issued_at
        from private.credential_batches order by created_at desc limit p_limit) b)
  );
end;
$$;

create function public.list_credential_audit_logs(p_limit integer default 100, p_before_id bigint default null)
returns table (id bigint, actor uuid, action text, batch_id uuid, credential_id uuid, details jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := private.require_credential_admin();
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size' using errcode = '22023'; end if;
  return query select l.id, l.actor, l.action, l.batch_id, l.credential_id, l.details, l.created_at from private.credential_audit_logs l
    where p_before_id is null or l.id < p_before_id order by l.id desc limit p_limit;
end;
$$;

create function public.search_credential_records(p_query text default '', p_category text default null,
  p_department text default '', p_from date default null, p_to date default null,
  p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 50)
returns table (id uuid, batch_id uuid, template_id uuid, replaces_id uuid, certificate_number text, recipient_name text, category text, subtype text,
  issue_date date, signature_key text, status text, created_at timestamptz, recipient_snapshot jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := private.require_credential_admin();
begin
  if p_limit is null or p_limit not between 1 and 100 or (p_before is null) <> (p_before_id is null)
    or length(coalesce(p_query,'')) > 200 or length(coalesce(p_department,'')) > 200
    or (p_category is not null and p_category not in ('MEM','PAR','CON','LEA','DIS'))
    or (p_from is not null and p_to is not null and p_from > p_to) then
    raise exception 'Invalid search filter' using errcode = '22023';
  end if;
  return query select c.id,c.batch_id,c.template_id,c.replaces_id,c.certificate_number,c.recipient_name,c.category,c.subtype,c.issue_date,
    c.signature_key,c.status,c.created_at,c.recipient_snapshot from private.credentials c
    where (coalesce(trim(p_query),'') = '' or position(lower(trim(p_query)) in lower(c.recipient_name)) > 0
      or position(lower(trim(p_query)) in lower(c.certificate_number)) > 0)
      and (p_category is null or c.category = p_category)
      and (coalesce(trim(p_department),'') = '' or position(lower(trim(p_department)) in lower(coalesce(c.recipient_snapshot->>'department',''))) > 0)
      and (p_from is null or c.issue_date >= p_from) and (p_to is null or c.issue_date <= p_to)
      and (p_before is null or (c.created_at,c.id) < (p_before,p_before_id))
    order by c.created_at desc,c.id desc limit p_limit;
end;
$$;

revoke all on function public.create_credential_template(text,text,jsonb), public.create_credential_draft(uuid,uuid,date,text,jsonb,text),
  public.set_credential_template_active(uuid,boolean),
  public.review_credential_draft(uuid,boolean), public.issue_credential_batch(uuid), public.revoke_credential(uuid,text),
  public.list_credential_admin_data(integer,timestamptz,uuid), public.list_credential_audit_logs(integer,bigint),
  public.search_credential_records(text,text,text,date,date,timestamptz,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.create_credential_template(text,text,jsonb), public.create_credential_draft(uuid,uuid,date,text,jsonb,text),
  public.set_credential_template_active(uuid,boolean),
  public.review_credential_draft(uuid,boolean), public.issue_credential_batch(uuid), public.revoke_credential(uuid,text),
  public.list_credential_admin_data(integer,timestamptz,uuid), public.list_credential_audit_logs(integer,bigint),
  public.search_credential_records(text,text,text,date,date,timestamptz,uuid,integer) to authenticated;

commit;
