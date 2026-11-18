-- Distinction evidence is optional. Keep any supplied evidence and the existing issuance checks.
begin;

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
    raise exception 'Distinction must use approved wording in the editor' using errcode='22023';
  end if;
  return new;
end $$;

commit;
