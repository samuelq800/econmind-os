-- A single explicit superme approval is sufficient for a complete wording.
-- Certificate review, eligibility, issuance and existing snapshots are unchanged.
begin;

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
    if item.status='approved' then return; end if;
    if item.status not in ('draft','reviewed') then
      raise exception 'Archived wording cannot be approved as a new template version' using errcode='22023';
    end if;
    if nullif(trim(item.text_content->>'title'),'') is null
      or nullif(trim(item.text_content->>'certification_statement'),'') is null
      or exists(select 1 from unnest(array['[Certificate Title]','[Certification Statement]','[Verified Responsibilities]','[Contribution Description]','[Service Period]']) placeholder
        where position(placeholder in item.text_content::text)>0) then
      raise exception 'Add a title and complete the wording before approving this version' using errcode='22023';
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

create or replace function private.credential_direct_wording_approval_ready() returns boolean
language sql immutable set search_path='' as $$ select true $$;
revoke all on function private.credential_direct_wording_approval_ready() from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
