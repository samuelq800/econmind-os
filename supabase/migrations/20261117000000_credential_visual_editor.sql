-- Additive V2 editor storage. Existing counters, issuance functions and records
-- are untouched. Only new editor batches opt in to a per-recipient snapshot.
begin;

create table private.credential_wording_versions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('MEM','PAR','CON','LEA','DIS')),
  subtype text not null check (length(trim(subtype)) between 1 and 120),
  template_name text not null check (length(trim(template_name)) between 1 and 120),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  text_content jsonb not null check (jsonb_typeof(text_content) = 'object'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  unique(category,subtype,template_name,version)
);
create unique index credential_wording_one_approved on private.credential_wording_versions(category,subtype,template_name) where status='approved';
revoke all on private.credential_wording_versions from public,anon,authenticated;

create table private.credential_editor_drafts (
  batch_id uuid primary key references private.credential_batches(id),
  wordings jsonb not null check (jsonb_typeof(wordings)='array'),
  source_refs jsonb not null check (jsonb_typeof(source_refs)='array'),
  wording_refs jsonb not null check (jsonb_typeof(wording_refs)='array'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
revoke all on private.credential_editor_drafts from public,anon,authenticated;

create function private.validate_credential_wording(p_wording jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
  if p_wording is null or jsonb_typeof(p_wording)<>'object' or octet_length(p_wording::text)>20000
    or exists (select 1 from jsonb_each(p_wording) f where f.key not in
      ('title','certification_statement','role_description','contribution_paragraph','service_period_text')
      or jsonb_typeof(f.value)<>'string' or length(f.value #>> '{}')>4000) then
    raise exception 'Invalid plain-text wording' using errcode='22023';
  end if;
end $$;
revoke all on function private.validate_credential_wording(jsonb) from public,anon,authenticated;

create function public.list_credential_wording_versions() returns table(
  id uuid, category text, subtype text, template_name text, version integer, status text,
  text_content jsonb, created_by uuid, created_at timestamptz, approved_by uuid, approved_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin();
begin
  return query select w.id,w.category,w.subtype,w.template_name,w.version,w.status,w.text_content,w.created_by,w.created_at,w.approved_by,w.approved_at
    from private.credential_wording_versions w order by w.category,w.subtype,w.template_name,w.version desc;
end $$;

create function public.create_credential_wording_version(p_category text,p_subtype text,p_template_name text,p_text_content jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); result uuid; next_version integer;
begin
  if p_category is null or p_category not in ('MEM','PAR','CON','LEA','DIS') or p_subtype is null
    or length(trim(p_subtype)) not between 1 and 120 or p_template_name is null or length(trim(p_template_name)) not between 1 and 120 then
    raise exception 'Invalid wording identity' using errcode='22023';
  end if;
  perform private.validate_credential_wording(p_text_content);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wording:'||p_category||':'||trim(p_subtype)||':'||trim(p_template_name),0));
  select coalesce(max(version),0)+1 into next_version from private.credential_wording_versions
    where category=p_category and subtype=trim(p_subtype) and template_name=trim(p_template_name);
  insert into private.credential_wording_versions(category,subtype,template_name,version,text_content,created_by)
    values(p_category,trim(p_subtype),trim(p_template_name),next_version,p_text_content,actor) returning id into result;
  insert into private.credential_audit_logs(actor,action,details) values(actor,'wording_version_created',jsonb_build_object('wording_id',result,'version',next_version));
  return result;
end $$;

create function public.set_credential_wording_status(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); item private.credential_wording_versions%rowtype; prior record;
begin
  if p_status is null or p_status not in ('approved','archived') then raise exception 'Invalid status' using errcode='22023'; end if;
  select * into item from private.credential_wording_versions where id=p_id;
  if not found then raise exception 'Wording version not found' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wording:'||item.category||':'||item.subtype||':'||item.template_name,0));
  select * into strict item from private.credential_wording_versions where id=p_id for update;
  if p_status='approved' then
    if item.status <> 'draft' or nullif(trim(item.text_content->>'title'),'') is null
      or nullif(trim(item.text_content->>'certification_statement'),'') is null
      or exists(select 1 from unnest(array['[Certificate Title]','[Certification Statement]','[Verified Responsibilities]','[Contribution Description]','[Service Period]']) placeholder
        where position(placeholder in item.text_content::text)>0) then
      raise exception 'Only complete draft wording can be approved' using errcode='22023';
    end if;
    for prior in update private.credential_wording_versions set status='archived' where category=item.category and subtype=item.subtype
      and template_name=item.template_name and status='approved' and id<>item.id returning id loop
      insert into private.credential_audit_logs(actor,action,details) values(actor,'wording_status_changed',jsonb_build_object('wording_id',prior.id,'status','archived','superseded_by',item.id));
    end loop;
    update private.credential_wording_versions set status='approved',approved_by=actor,approved_at=now() where id=item.id;
  else
    if item.status='archived' then raise exception 'Wording is already archived' using errcode='22023'; end if;
    update private.credential_wording_versions set status='archived' where id=item.id;
  end if;
  insert into private.credential_audit_logs(actor,action,details) values(actor,'wording_status_changed',jsonb_build_object('wording_id',item.id,'status',p_status));
end $$;

-- Validate exactly the accepted V1 recipient shape, without creating extra drafts.
create function private.validate_credential_editor_entries(p_entries jsonb,p_category text) returns void
language plpgsql stable security definer set search_path='' as $$
declare e jsonb;
begin
  if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 500
    or octet_length(p_entries::text)>1000000 then raise exception 'Invalid recipients' using errcode='22023'; end if;
  for e in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(e)<>'object' or jsonb_typeof(e->'name') is distinct from 'string'
      or length(trim(e->>'name')) not between 1 and 200 or octet_length(e::text)>10000
      or exists(select 1 from jsonb_each(e) f where f.key not in ('name','role','department','project','contribution','service_period','user_id','replaces_id')
        or jsonb_typeof(f.value)<>'string' or length(f.value #>> '{}')>4000) then
      raise exception 'Invalid recipient' using errcode='22023';
    end if;
    if e ? 'user_id' and ((e->>'user_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists(select 1 from public.profiles where user_id=(e->>'user_id')::uuid)) then
      raise exception 'Linked recipient account does not exist' using errcode='22023';
    end if;
    if e ? 'replaces_id' and ((e->>'replaces_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists(select 1 from private.credentials where id=(e->>'replaces_id')::uuid and status='revoked' and category=p_category)) then
      raise exception 'Invalid replacement' using errcode='22023';
    end if;
  end loop;
end $$;
revoke all on function private.validate_credential_editor_entries(jsonb,text) from public,anon,authenticated;

create function public.save_credential_editor_draft(p_batch_id uuid,p_expected_revision integer,p_request_key uuid,
  p_category text,p_subtype text,p_issue_date date,p_issuing_authority text,p_signature_key text,
  p_entries jsonb,p_wordings jsonb,p_source_refs jsonb,p_wording_refs jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); t_id uuid; v_batch_id uuid; current_batch private.credential_batches%rowtype;
  current_editor private.credential_editor_drafts%rowtype; item jsonb; indexed record; baseline jsonb; next_rev integer; next_version integer;
begin
  if p_category is null or p_category not in ('MEM','PAR','CON','LEA','DIS') or p_subtype is null or length(trim(p_subtype)) not between 1 and 120
    or p_issue_date is null or extract(year from p_issue_date) not between 2000 and 9999
    or p_issuing_authority is null or p_issuing_authority not in ('EconMind Founder Team','EconMind Leadership Group')
    or p_signature_key is null or p_signature_key not in ('samuel_qian_v1','yale_chen_v1') then
    raise exception 'Invalid editor draft' using errcode='22023';
  end if;
  perform private.validate_credential_editor_entries(p_entries,p_category);
  if p_wordings is null or p_source_refs is null or p_wording_refs is null or jsonb_typeof(p_wordings)<>'array' or jsonb_typeof(p_source_refs)<>'array' or jsonb_typeof(p_wording_refs)<>'array'
    or jsonb_array_length(p_wordings)<>jsonb_array_length(p_entries) or jsonb_array_length(p_source_refs)<>jsonb_array_length(p_entries)
    or jsonb_array_length(p_wording_refs)<>jsonb_array_length(p_entries)
    or octet_length(p_wordings::text)>1000000 or octet_length(p_source_refs::text)>200000 or octet_length(p_wording_refs::text)>100000 then
    raise exception 'Editor data must match recipients' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_wordings) loop perform private.validate_credential_wording(item); end loop;
  for item in select value from jsonb_array_elements(p_source_refs) loop
    if jsonb_typeof(item)<>'object' or octet_length(item::text)>5000 or exists(select 1 from jsonb_each(item) f
      where f.key not in ('kind','id','label','linked_name') or jsonb_typeof(f.value)<>'string' or length(f.value #>> '{}')>1000) then
      raise exception 'Invalid source reference' using errcode='22023';
    end if;
  end loop;
  for indexed in select value,ordinality from jsonb_array_elements(p_wording_refs) with ordinality loop
    item:=indexed.value;
    if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('type','id','modified'))
      or (item<>'{}'::jsonb and (item->>'type' is null or item->>'type' not in ('library','legacy') or item->>'id' is null
        or item->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(item->'modified') is distinct from 'boolean')) then
      raise exception 'Invalid wording version reference' using errcode='22023';
    end if;
    if item<>'{}'::jsonb and not (
      (item->>'type'='library' and exists(select 1 from private.credential_wording_versions w where w.id=(item->>'id')::uuid and w.category=p_category and w.subtype=trim(p_subtype)))
      or (item->>'type'='legacy' and exists(select 1 from private.credential_templates t where t.id=(item->>'id')::uuid and t.category=p_category and t.subtype=trim(p_subtype)))
    ) then raise exception 'Wording version does not match the selected category' using errcode='22023'; end if;
    if item<>'{}'::jsonb and not (item->>'modified')::boolean then
      if item->>'type'='library' then select w.text_content into baseline from private.credential_wording_versions w where w.id=(item->>'id')::uuid;
      else select t.text_content into baseline from private.credential_templates t where t.id=(item->>'id')::uuid; end if;
      if exists(select 1 from unnest(array['title','certification_statement','role_description','contribution_paragraph','service_period_text']) k
        where coalesce(p_wordings->(indexed.ordinality::integer-1)->>k,'') <> coalesce(baseline->>k,'')) then
        raise exception 'Modified wording cannot be recorded as unchanged' using errcode='22023';
      end if;
    end if;
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_category||':'||trim(p_subtype),0));
  select id into t_id from private.credential_templates where category=p_category and subtype=trim(p_subtype) and active order by version desc limit 1;
  if t_id is null then
    -- An empty technical base is not an approved wording version.
    select coalesce(max(version),0)+1 into next_version from private.credential_templates where category=p_category and subtype=trim(p_subtype);
    insert into private.credential_templates(category,subtype,version,text_content,created_by)
      values(p_category,trim(p_subtype),next_version,'{}'::jsonb,actor) returning id into t_id;
    insert into private.credential_audit_logs(actor,action,details) values(actor,'editor_technical_base_created',jsonb_build_object('template_id',t_id));
  end if;
  if p_batch_id is null then
    if p_request_key is null then raise exception 'Request key required' using errcode='22023'; end if;
    v_batch_id:=public.create_credential_draft(p_request_key,t_id,p_issue_date,p_issuing_authority,p_entries,p_signature_key);
    select * into current_editor from private.credential_editor_drafts where credential_editor_drafts.batch_id=v_batch_id for update;
    if found then
      if current_editor.wordings<>p_wordings or current_editor.source_refs<>p_source_refs or current_editor.wording_refs<>p_wording_refs then raise exception 'Request key already used for different editor data' using errcode='23505'; end if;
      return jsonb_build_object('id',v_batch_id,'revision',current_editor.revision);
    end if;
    insert into private.credential_editor_drafts(batch_id,wordings,source_refs,wording_refs) values(v_batch_id,p_wordings,p_source_refs,p_wording_refs);
    return jsonb_build_object('id',v_batch_id,'revision',1);
  end if;
  select * into current_batch from private.credential_batches where id=p_batch_id for update;
  if not found or current_batch.status<>'draft' then raise exception 'Only an unreviewed draft can be edited' using errcode='22023'; end if;
  select * into current_editor from private.credential_editor_drafts where credential_editor_drafts.batch_id=p_batch_id for update;
  if coalesce(current_editor.revision,0) is distinct from p_expected_revision then raise exception 'Draft changed in another session; reload before saving' using errcode='40001'; end if;
  update private.credential_batches set template_id=t_id,entries=p_entries,issue_date=p_issue_date,issuing_authority=p_issuing_authority,
    signature_key=p_signature_key,preview_verified_at=null,reviewed_at=null,reviewed_by=null,duplicates_acknowledged=false where id=p_batch_id;
  next_rev:=coalesce(current_editor.revision,0)+1;
  insert into private.credential_editor_drafts(batch_id,wordings,source_refs,wording_refs,revision) values(p_batch_id,p_wordings,p_source_refs,p_wording_refs,next_rev)
    on conflict(batch_id) do update set wordings=excluded.wordings,source_refs=excluded.source_refs,wording_refs=excluded.wording_refs,revision=excluded.revision,updated_at=now();
  insert into private.credential_audit_logs(actor,action,batch_id,details) values(actor,'editor_draft_updated',p_batch_id,jsonb_build_object('revision',next_rev));
  return jsonb_build_object('id',p_batch_id,'revision',next_rev);
end $$;

create function public.get_credential_editor_render_data(p_batch_id uuid,p_credential_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); result jsonb; edit jsonb;
begin
  result:=public.get_credential_render_data(p_batch_id,p_credential_id);
  select jsonb_build_object('wordings',wordings,'source_refs',source_refs,'wording_refs',wording_refs,'revision',revision) into edit
    from private.credential_editor_drafts where batch_id=p_batch_id;
  return result || jsonb_build_object('editor',edit);
end $$;

-- V1 drafts cannot be edited after creation. V2 drafts can, so bind the
-- existing review operation to the revision actually previewed by the admin.
create function public.review_credential_editor_draft(p_batch_id uuid,p_expected_revision integer,p_acknowledge_duplicates boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); actual_revision integer;
begin
  perform 1 from private.credential_batches where id=p_batch_id for update;
  if not found then raise exception 'Draft not found' using errcode='22023'; end if;
  select revision into actual_revision from private.credential_editor_drafts where batch_id=p_batch_id;
  if p_expected_revision is null or p_expected_revision<>coalesce(actual_revision,0) then
    raise exception 'Draft changed after preview; preview every recipient again' using errcode='40001';
  end if;
  perform set_config('econmind.credential_review_revision',coalesce(actual_revision,0)::text,true);
  perform public.review_credential_draft(p_batch_id,p_acknowledge_duplicates);
  perform set_config('econmind.credential_review_revision','',true);
end $$;

create function private.guard_credential_editor_review() returns trigger
language plpgsql security definer set search_path='' as $$
declare actual_revision integer;
begin
  if old.status='draft' and new.status='reviewed' then
    select revision into actual_revision from private.credential_editor_drafts where batch_id=old.id;
    if actual_revision is not null and current_setting('econmind.credential_review_revision',true) is distinct from actual_revision::text then
      raise exception 'Preview the current editor revision before review' using errcode='40001';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_credential_editor_review() from public,anon,authenticated;
create trigger credential_editor_review_guard before update of status on private.credential_batches for each row execute function private.guard_credential_editor_review();

-- Existing issue_credential_batch assigns all IDs and counters. At the insert
-- boundary only V2 batches get the exact reviewed text and source snapshot.
create function private.snapshot_credential_editor_data() returns trigger
language plpgsql security definer set search_path='' as $$
declare item private.credential_editor_drafts%rowtype; idx integer:=new.batch_entry-1; src jsonb; wording_ref jsonb; wording_meta jsonb;
begin
  select * into item from private.credential_editor_drafts where batch_id=new.batch_id;
  if found then
    if item.wordings->idx is null or item.source_refs->idx is null or item.wording_refs->idx is null then raise exception 'Editor snapshot is incomplete' using errcode='22023'; end if;
    if nullif(trim(item.wordings->idx->>'title'),'') is null or nullif(trim(item.wordings->idx->>'certification_statement'),'') is null
      or exists(select 1 from unnest(array['[Certificate Title]','[Certification Statement]','[Verified Responsibilities]','[Contribution Description]','[Service Period]']) placeholder
        where position(placeholder in (item.wordings->idx)::text)>0) then
      raise exception 'Complete each certificate wording before issuance' using errcode='22023';
    end if;
    new.template_snapshot:=jsonb_set(new.template_snapshot,'{text_content}',item.wordings->idx,true);
    wording_ref:=item.wording_refs->idx;
    if wording_ref<>'{}'::jsonb then
      if wording_ref->>'type'='library' then
        select jsonb_build_object('name',w.template_name,'version',w.version,'status_at_issue',w.status) into wording_meta
          from private.credential_wording_versions w where w.id=(wording_ref->>'id')::uuid;
      else
        select jsonb_build_object('name','Existing template','version',t.version,'status_at_issue',case when t.active then 'active' else 'inactive' end) into wording_meta
          from private.credential_templates t where t.id=(wording_ref->>'id')::uuid;
      end if;
      if wording_meta is null then raise exception 'Wording version is unavailable' using errcode='22023'; end if;
      new.template_snapshot:=jsonb_set(new.template_snapshot,'{wording_reference}',wording_ref||wording_meta,true);
    end if;
    src:=item.source_refs->idx;
    if src<>'{}'::jsonb then new.recipient_snapshot:=jsonb_set(new.recipient_snapshot,'{source_ref}',src,true); end if;
  end if;
  return new;
end $$;
revoke all on function private.snapshot_credential_editor_data() from public,anon,authenticated;
create trigger credential_editor_snapshot before insert on private.credentials for each row execute function private.snapshot_credential_editor_data();

revoke all on function public.list_credential_wording_versions(),public.create_credential_wording_version(text,text,text,jsonb),
 public.set_credential_wording_status(uuid,text),public.save_credential_editor_draft(uuid,integer,uuid,text,text,date,text,text,jsonb,jsonb,jsonb,jsonb),
 public.get_credential_editor_render_data(uuid,uuid),public.review_credential_editor_draft(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.list_credential_wording_versions(),public.create_credential_wording_version(text,text,text,jsonb),
 public.set_credential_wording_status(uuid,text),public.save_credential_editor_draft(uuid,integer,uuid,text,text,date,text,text,jsonb,jsonb,jsonb,jsonb),
 public.get_credential_editor_render_data(uuid,uuid),public.review_credential_editor_draft(uuid,integer,boolean) to authenticated;
commit;
