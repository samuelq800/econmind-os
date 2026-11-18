-- V0.3 incremental catalog, approval and current-research integration. No existing record or counter is reset.
begin;
alter table private.credential_templates drop constraint credential_templates_category_check;
alter table private.credential_templates add constraint credential_templates_category_check check (category in ('MEM','PAR','CON','LEA','DIS','SUP','CLB','PRT','GSP'));
alter table private.credential_wording_versions drop constraint credential_wording_versions_category_check;
alter table private.credential_wording_versions add constraint credential_wording_versions_category_check check (category in ('MEM','PAR','CON','LEA','DIS','SUP','CLB','PRT','GSP'));
alter table private.credential_wording_versions drop constraint credential_wording_versions_status_check;
alter table private.credential_wording_versions add constraint credential_wording_versions_status_check check (status in ('draft','reviewed','approved','archived'));
create or replace function public.create_credential_wording_version(p_category text,p_subtype text,p_template_name text,p_text_content jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); result uuid; next_version integer;
begin
  if p_category is null or p_category not in ('MEM','PAR','CON','LEA','DIS','SUP','CLB','PRT','GSP') or p_subtype is null
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

create or replace function public.set_credential_wording_status(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); item private.credential_wording_versions%rowtype; prior record;
begin
  if p_status is null or p_status not in ('reviewed','approved','archived') then raise exception 'Invalid status' using errcode='22023'; end if;
  select * into item from private.credential_wording_versions where id=p_id;
  if not found then raise exception 'Wording version not found' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wording:'||item.category||':'||item.subtype||':'||item.template_name,0));
  select * into strict item from private.credential_wording_versions where id=p_id for update;
  if p_status='reviewed' then
    if item.status <> 'draft' then raise exception 'Only a draft can be reviewed' using errcode='22023'; end if;
    update private.credential_wording_versions set status='reviewed' where id=item.id;
  elsif p_status='approved' then
    if item.status <> 'reviewed' or nullif(trim(item.text_content->>'title'),'') is null
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

create or replace function public.save_credential_editor_draft(p_batch_id uuid,p_expected_revision integer,p_request_key uuid,
  p_category text,p_subtype text,p_issue_date date,p_issuing_authority text,p_signature_key text,
  p_entries jsonb,p_wordings jsonb,p_source_refs jsonb,p_wording_refs jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); t_id uuid; v_batch_id uuid; current_batch private.credential_batches%rowtype;
  current_editor private.credential_editor_drafts%rowtype; item jsonb; indexed record; baseline jsonb; next_rev integer; next_version integer;
begin
  if p_category is null or p_category not in ('MEM','PAR','CON','LEA','DIS','SUP','CLB','PRT','GSP') or p_subtype is null or length(trim(p_subtype)) not between 1 and 120
    or p_issue_date is null or extract(year from p_issue_date) not between 2000 and 9999
    or p_issuing_authority is null or p_issuing_authority not in ('EconMind Founder Team','EconMind Leadership Group')
    or p_signature_key is null or p_signature_key not in ('samuel_qian_v1','yale_chen_v1') then
    raise exception 'Invalid editor draft' using errcode='22023';
  end if;
  perform private.validate_credential_editor_entries(p_entries,p_category);
  if p_wordings is null or p_source_refs is null or p_wording_refs is null or jsonb_typeof(p_wordings)<>'array' or jsonb_typeof(p_source_refs)<>'array' or jsonb_typeof(p_wording_refs)<>'array'
    or jsonb_array_length(p_wordings)<>jsonb_array_length(p_entries) or jsonb_array_length(p_source_refs)<>jsonb_array_length(p_entries)
    or jsonb_array_length(p_wording_refs)<>jsonb_array_length(p_entries)
    or octet_length(p_wordings::text)>1000000 or octet_length(p_source_refs::text)>1000000 or octet_length(p_wording_refs::text)>100000 then
    raise exception 'Editor data must match recipients' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_wordings) loop perform private.validate_credential_wording(item); end loop;
  for item in select value from jsonb_array_elements(p_source_refs) loop
    if jsonb_typeof(item)<>'object' or octet_length(item::text)>12000 or exists(select 1 from jsonb_each(item) f
      where f.key not in ('kind','id','label','linked_name','paper_title','author_display_name','coauthors_text','paper_status','paper_updated_at','paper_published_at','verified_author','status_reviewed','distinction_evidence') or jsonb_typeof(f.value)<>'string' or length(f.value #>> '{}')>4000) then
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

create or replace function public.create_credential_template(p_category text, p_subtype text, p_text_content jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_credential_admin(); new_id uuid; next_version integer;
begin
  if p_category is null or p_category not in ('MEM','PAR','CON','LEA','DIS','SUP','CLB','PRT','GSP') or p_subtype is null
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

create or replace function public.search_credential_records(p_query text default '', p_category text default null,
  p_department text default '', p_from date default null, p_to date default null,
  p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 50)
returns table (id uuid, batch_id uuid, template_id uuid, replaces_id uuid, certificate_number text, recipient_name text, category text, subtype text,
  issue_date date, signature_key text, status text, created_at timestamptz, recipient_snapshot jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := private.require_credential_admin();
begin
  if p_limit is null or p_limit not between 1 and 100 or (p_before is null) <> (p_before_id is null)
    or length(coalesce(p_query,'')) > 200 or length(coalesce(p_department,'')) > 200
    or (p_category is not null and p_category not in ('MEM','PAR','CON','LEA','DIS','SUP','CLB','PRT','GSP'))
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

create or replace function public.list_credential_research_sources(
  p_after_id uuid default null,
  p_limit integer default 100
)
returns table (
  paper_id uuid,
  uploader_user_id uuid,
  author_display_name text,
  owner_name_matches boolean,
  coauthors_text text,
  title text,
  subject text,
  institution text,
  status text,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null
    or not coalesce(public.is_superme_platform_admin(auth.uid()), false)
    or not exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.account_status = 'active'
    ) then
    raise exception 'Superme platform administrator required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Page size must be between 1 and 100' using errcode = '22023';
  end if;
  return query
    select p.id, p.owner_user_id, p.author_display_name,
      case when nullif(trim(pr.display_name),'') is null then null
        else lower(trim(pr.display_name))=lower(trim(p.author_display_name)) end, p.coauthors_text,
      p.title, p.subject, p.school_display_name, p.status, p.published_at, p.updated_at
    from public.research_papers p left join public.profiles pr on pr.user_id=p.owner_user_id
    where (p_after_id is null or p.id > p_after_id)
    order by p.id
    limit p_limit;
end;
$$;

create or replace function public.get_credential_research_source(p_paper_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin();
begin
  return (select jsonb_build_object(
    'paper_id',p.id,'uploader_user_id',p.owner_user_id,'author_display_name',p.author_display_name,
    'owner_name_matches',case when nullif(btrim(pr.display_name),'') is null then null
      else lower(btrim(pr.display_name))=lower(btrim(p.author_display_name)) end,
    'coauthors_text',p.coauthors_text,'title',p.title,'subject',p.subject,'institution',p.school_display_name,
    'status',p.status,'published_at',p.published_at,'updated_at',p.updated_at)
    from public.research_papers p left join public.profiles pr on pr.user_id=p.owner_user_id where p.id=p_paper_id);
end $$;
revoke all on function public.get_credential_research_source(uuid) from public,anon,authenticated;
grant execute on function public.get_credential_research_source(uuid) to authenticated;

create or replace function public.list_credential_organization_identities(p_after_id uuid default null,p_limit integer default 100)
returns table(id uuid,name text,title text,organizational_group text)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin();
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size' using errcode='22023'; end if;
  return query select d.id,d.name,d.title,d.organizational_group from public.organization_directory d
    where d.public_visible and (p_after_id is null or d.id>p_after_id) order by d.id limit p_limit;
end $$;
revoke all on function public.list_credential_organization_identities(uuid,integer) from public,anon,authenticated;
grant execute on function public.list_credential_organization_identities(uuid,integer) to authenticated;

create or replace function private.snapshot_credential_editor_data() returns trigger
language plpgsql security definer set search_path='' as $$
declare item private.credential_editor_drafts%rowtype; idx integer:=new.batch_entry-1; src jsonb; wording_ref jsonb; wording_meta jsonb; approved_wording jsonb; paper public.research_papers%rowtype; source_author text;
begin
  select * into item from private.credential_editor_drafts where batch_id=new.batch_id;
  if found then
    if item.wordings->idx is null or item.source_refs->idx is null or item.wording_refs->idx is null then raise exception 'Editor snapshot is incomplete' using errcode='22023'; end if;
    if nullif(trim(item.wordings->idx->>'title'),'') is null or nullif(trim(item.wordings->idx->>'certification_statement'),'') is null
      or exists(select 1 from unnest(array['[Certificate Title]','[Certification Statement]','[Verified Responsibilities]','[Contribution Description]','[Service Period]']) placeholder
        where position(placeholder in (item.wordings->idx)::text)>0) then
      raise exception 'Complete each certificate wording before issuance' using errcode='22023';
    end if;
    wording_ref:=item.wording_refs->idx;
    if wording_ref->>'type' is distinct from 'library' then raise exception 'An approved wording version is required for issuance' using errcode='22023'; end if;
    select w.text_content into approved_wording from private.credential_wording_versions w where w.id=(wording_ref->>'id')::uuid and w.status='approved' for share;
    if approved_wording is null then raise exception 'Draft or unapproved wording cannot be issued' using errcode='22023'; end if;
    src:=item.source_refs->idx;
    if new.category='DIS' and nullif(btrim(src->>'distinction_evidence'),'') is null then
      raise exception 'Distinction requires the verified achievement and approval record' using errcode='22023';
    end if;
    if approved_wording->>'certification_statement' like '%{paper_title}%' and src->>'kind' is distinct from 'research' then
      raise exception 'Select and verify a current Research Library paper' using errcode='22023';
    end if;
    if src->>'kind'='research' then
      if coalesce(src->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Research source ID is invalid' using errcode='22023'; end if;
      select * into paper from public.research_papers where id=(src->>'id')::uuid for share;
      if not found or src->>'paper_title' is distinct from paper.title or src->>'author_display_name' is distinct from coalesce(paper.author_display_name,'')
        or src->>'coauthors_text' is distinct from coalesce(paper.coauthors_text,'') or src->>'paper_status' is distinct from paper.status
        or (src->>'paper_updated_at')::timestamptz is distinct from paper.updated_at then raise exception 'Research source changed; refresh and review the draft' using errcode='40001'; end if;
      source_author:=trim(new.recipient_name);
      if src->>'verified_author' is distinct from source_author or not (source_author=coalesce(btrim(paper.author_display_name),'') or exists (
          select 1 from regexp_split_to_table(coalesce(paper.coauthors_text,''), E'[,;，；\\n]') as part where btrim(part)=source_author))
        or (paper.status<>'published' and src->>'status_reviewed' is distinct from 'true')
        or (new.user_id is not null and (new.user_id is distinct from paper.owner_user_id or source_author is distinct from btrim(paper.author_display_name) or not exists (
          select 1 from public.profiles pr where pr.user_id=new.user_id and lower(btrim(pr.display_name))=lower(source_author)))) then raise exception 'Research author or publication status requires verification' using errcode='22023'; end if;
      src:=src || jsonb_build_object('paper_title',paper.title,'author_display_name',paper.author_display_name,
        'coauthors_text',coalesce(paper.coauthors_text,''),'paper_status',paper.status,'paper_updated_at',paper.updated_at,
        'paper_published_at',paper.published_at);
      approved_wording:=jsonb_set(approved_wording,'{certification_statement}',to_jsonb(replace(approved_wording->>'certification_statement','{paper_title}',paper.title)));
    end if;
    if (new.category='DIS' or src->>'kind'='research') and
      (exists(select 1 from unnest(array['title','certification_statement','role_description','contribution_paragraph','service_period_text']) k
        where coalesce(item.wordings->idx->>k,'')<>coalesce(approved_wording->>k,''))
        or (new.category='DIS' and (nullif(btrim(new.recipient_snapshot->>'role'),'') is not null
          or nullif(btrim(new.recipient_snapshot->>'contribution'),'') is not null
          or nullif(btrim(new.recipient_snapshot->>'service_period'),'') is not null))) then
      raise exception 'Changed wording must be saved and approved as a new version' using errcode='22023';
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
    if src<>'{}'::jsonb then new.recipient_snapshot:=jsonb_set(new.recipient_snapshot,'{source_ref}',src,true); end if;
  elsif new.category='DIS' then
    raise exception 'Distinction must use approved wording and verified evidence in the editor' using errcode='22023';
  end if;
  return new;
end $$;
-- The user-supplied text is imported by superme and stored only in private schema.
create table if not exists private.credential_handoff_catalog (
  version text primary key check (version='0.3.0-draft'),
  presets jsonb not null,
  archive jsonb not null,
  imported_by uuid not null,
  imported_at timestamptz not null default now()
);
revoke all on private.credential_handoff_catalog from public,anon,authenticated;

create or replace function public.get_credential_handoff_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin();
begin
  return coalesce((select jsonb_build_object('imported',true,'presets',presets,'archive',archive)
    from private.credential_handoff_catalog where version='0.3.0-draft'), '{"imported":false,"presets":[],"archive":[]}'::jsonb);
end $$;

create or replace function public.import_credential_handoff_catalog(p_catalog jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_credential_admin(); item jsonb; body jsonb; version_number integer; presets jsonb:='[]'; archive jsonb:='[]';
begin
  if p_catalog is null or p_catalog->>'version' is distinct from '0.3.0-draft'
    or octet_length(p_catalog::text)>120000
    or jsonb_typeof(p_catalog->'templates') is distinct from 'array'
    or jsonb_typeof(p_catalog->'legacy_archive') is distinct from 'array'
    or jsonb_array_length(p_catalog->'templates')<>46 or jsonb_array_length(p_catalog->'legacy_archive')<>25
    or (select count(distinct x->>'template_id') from jsonb_array_elements(p_catalog->'templates') x)<>46
    or (select count(distinct x->>'legacy_id') from jsonb_array_elements(p_catalog->'legacy_archive') x)<>25 then
    raise exception 'Select the original v0.3 wording library JSON' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('credential-handoff-v03',0));
  if exists(select 1 from private.credential_handoff_catalog where version='0.3.0-draft') then return false; end if;
  for item in select value from jsonb_array_elements(p_catalog->'templates') loop
    if item->>'template_id' not in ('D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'PERS-SAM-LEA', 'PERS-SAM-CON', 'PERS-YAL-LEA', 'PERS-YAL-CON', 'PERS-ARIA-CON', 'PERS-IRE-CON', 'PERS-JES-CON', 'PERS-OLI-CON', 'PERS-PHI-CON', 'PERS-REG-CON', 'M01', 'M02', 'P01', 'P02', 'C01', 'C02', 'C03', 'C04', 'L01', 'L02', 'L03', 'L04', 'S01', 'SC01', 'SC02', 'SC03', 'PT01', 'GS01', 'CON-R-LIVE')
      or item->>'status' is distinct from 'draft'
      or jsonb_typeof(item->'certificate_title') is distinct from 'string'
      or jsonb_typeof(item->'identity_line') is distinct from 'string'
      or jsonb_typeof(item->'statement') is distinct from 'string' then
      raise exception 'Invalid handoff wording record' using errcode='22023';
    end if;
    body:=jsonb_build_object('title',item->'certificate_title','certification_statement',item->'statement',
      'role_description',item->'identity_line','contribution_paragraph','','service_period_text','');
    perform private.validate_credential_wording(body);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wording:'||(item->>'category')||':'||(item->>'subtype')||':'||(item->>'template_id'),0));
    select coalesce(max(w.version),0)+1 into version_number from private.credential_wording_versions w
      where w.category=item->>'category' and w.subtype=item->>'subtype' and w.template_name=item->>'template_id';
    insert into private.credential_wording_versions(category,subtype,template_name,version,text_content,status,created_by)
      values(item->>'category',item->>'subtype',item->>'template_id',version_number,body,'draft',actor);
    if item->>'data_mode'='personal_preset' then
      if jsonb_typeof(item->'recipient_name') is distinct from 'string' or length(btrim(item->>'recipient_name')) not between 1 and 200 then
        raise exception 'Invalid handoff preset name' using errcode='22023';
      end if;
      presets:=presets || jsonb_build_array(jsonb_build_object('template_id',item->>'template_id','recipient_name',item->>'recipient_name','data_mode','personal_preset'));
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_catalog->'legacy_archive') loop
    if item->>'legacy_id' not in ('CON-T01', 'CON-C01', 'CON-C02', 'CON-C03', 'CON-C04', 'CON-C05', 'LEA-01', 'LEA-02', 'LEA-03', 'LEA-04', 'CON-R01', 'CON-R02', 'CLB-01', 'CLB-02', 'CLB-03', 'SUP-01', 'DIS-01', 'DIS-02', 'DIS-03', 'PAR-01', 'PAR-02', 'MEM-01', 'MEM-02', 'PRT-01', 'GSP-01') or item->>'status' is distinct from 'superseded_reference_do_not_auto_activate'
      or jsonb_typeof(item->'subtype') is distinct from 'string' or jsonb_typeof(item->'statement') is distinct from 'string' then
      raise exception 'Invalid handoff archive record' using errcode='22023';
    end if;
    archive:=archive || jsonb_build_array(jsonb_build_object('legacy_id',item->>'legacy_id','subtype',item->>'subtype','statement',item->>'statement'));
  end loop;
  insert into private.credential_handoff_catalog(version,presets,archive,imported_by)
    values('0.3.0-draft',presets,archive,actor);
  insert into private.credential_audit_logs(actor,action,details)
    values(actor,'wording_catalog_imported',jsonb_build_object('version','0.3.0-draft','draft_count',46,'archive_count',25));
  return true;
end $$;
revoke all on function public.get_credential_handoff_catalog(),public.import_credential_handoff_catalog(jsonb) from public,anon,authenticated;
grant execute on function public.get_credential_handoff_catalog(),public.import_credential_handoff_catalog(jsonb) to authenticated;

create or replace function private.credential_handoff_v03_version() returns text language sql immutable set search_path='' as $$ select '0.3.0-draft'::text $$;
revoke all on function private.credential_handoff_v03_version() from public, anon, authenticated;
commit;
