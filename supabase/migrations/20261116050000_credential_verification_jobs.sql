-- Durable verification avoids a long browser request for large batches.
begin;
create table private.credential_verification_jobs (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  batch_id uuid not null references private.credential_batches(id),
  actor uuid not null,
  state text not null default 'queued' check (state in ('queued','running','complete','failed','cancelled')),
  total integer not null check (total > 0),
  claim_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table private.credential_verification_items (
  job_id uuid not null references private.credential_verification_jobs(id),
  entry_index integer not null,
  state text not null default 'pending' check (state in ('pending','complete','failed')),
  failure text,
  primary key(job_id,entry_index)
);
create index credential_verification_jobs_claim_idx on private.credential_verification_jobs(state,lease_until,created_at);
create trigger credential_verification_jobs_changed after insert or update or delete on private.credential_verification_jobs
  for each statement execute function private.bump_credential_jobs_revision();
create trigger credential_verification_items_changed after insert or update or delete on private.credential_verification_items
  for each statement execute function private.bump_credential_jobs_revision();
revoke all on private.credential_verification_jobs,private.credential_verification_items from public,anon,authenticated;

create function public.enqueue_credential_verification(p_batch_id uuid,p_request_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin(); b private.credential_batches%rowtype; existing private.credential_verification_jobs%rowtype; new_id uuid;
begin
  if p_batch_id is null or p_request_key is null then raise exception 'Batch and request key required' using errcode='22023'; end if;
  select * into b from private.credential_batches where id=p_batch_id for update;
  if not found or b.status<>'reviewed' then raise exception 'Reviewed batch required' using errcode='22023'; end if;
  insert into private.credential_verification_jobs(request_key,batch_id,actor,total)
    values(p_request_key,p_batch_id,actor_id,jsonb_array_length(b.entries)) on conflict(request_key) do nothing returning id into new_id;
  if new_id is null then
    select * into existing from private.credential_verification_jobs where request_key=p_request_key;
    if existing.batch_id<>p_batch_id or existing.actor<>actor_id then raise exception 'Request key already used' using errcode='23505'; end if;
    return existing.id;
  end if;
  insert into private.credential_verification_items(job_id,entry_index)
    select new_id, n from generate_series(0,jsonb_array_length(b.entries)-1) n;
  insert into private.credential_audit_logs(actor,action,batch_id,details)
    values(actor_id,'verification_queued',b.id,jsonb_build_object('job_id',new_id));
  return new_id;
end;
$$;

create function public.list_credential_verifications(p_limit integer default 100) returns table (
  id uuid,batch_id uuid,state text,total integer,completed bigint,failed bigint,created_at timestamptz,updated_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin();
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size' using errcode='22023'; end if;
  return query select j.id,j.batch_id,j.state,j.total,
    (select count(*) from private.credential_verification_items i where i.job_id=j.id and i.state='complete'),
    (select count(*) from private.credential_verification_items i where i.job_id=j.id and i.state='failed'),j.created_at,j.updated_at
    from private.credential_verification_jobs j order by j.created_at desc,j.id desc limit p_limit;
end;
$$;

create function public.get_credential_verification(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin(); result jsonb;
begin
  select jsonb_build_object('id',j.id,'batch_id',j.batch_id,'state',j.state,'total',j.total,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('index',i.entry_index,'state',i.state,'failure',i.failure) order by i.entry_index),'[]'::jsonb)
      from private.credential_verification_items i where i.job_id=j.id))
    into result from private.credential_verification_jobs j where j.id=p_job_id;
  if result is null then raise exception 'Verification job not found' using errcode='22023'; end if;
  return result;
end;
$$;

create function public.cancel_credential_draft(p_batch_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin();
begin
  update private.credential_batches set status='cancelled' where id=p_batch_id and status in ('draft','reviewed');
  if not found then raise exception 'Only an unissued draft can be cancelled' using errcode='22023'; end if;
  update private.credential_verification_jobs set state='cancelled',claim_token=null,lease_until=null,updated_at=now()
    where batch_id=p_batch_id and state in ('queued','running');
  insert into private.credential_audit_logs(actor,action,batch_id) values(actor_id,'draft_cancelled',p_batch_id);
end;
$$;

create function public.claim_credential_verification() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job private.credential_verification_jobs%rowtype; claim_id uuid := gen_random_uuid(); b private.credential_batches%rowtype; t private.credential_templates%rowtype;
begin
  select * into job from private.credential_verification_jobs j where j.state='queued' or (j.state='running' and j.lease_until < now())
    order by j.created_at,j.id for update skip locked limit 1;
  if not found then return null; end if;
  select * into b from private.credential_batches where id=job.batch_id;
  if b.status<>'reviewed' or not coalesce(public.is_superme_platform_admin(job.actor),false)
    or not exists(select 1 from public.profiles p where p.user_id=job.actor and p.account_status='active') then
    update private.credential_verification_jobs set state='cancelled',updated_at=now() where id=job.id;
    return null;
  end if;
  select * into strict t from private.credential_templates where id=b.template_id;
  update private.credential_verification_jobs set state='running',claim_token=claim_id,lease_until=now()+interval '2 minutes',updated_at=now() where id=job.id;
  return jsonb_build_object('id',job.id,'batch_id',b.id,'claim_token',claim_id,'category',t.category,'subtype',t.subtype,
    'issue_date',b.issue_date,'signature_key',b.signature_key,'issuing_authority',b.issuing_authority,'template',t.text_content,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('index',i.entry_index,'recipient',b.entries->i.entry_index) order by i.entry_index),'[]'::jsonb)
      from private.credential_verification_items i where i.job_id=job.id and i.state='pending'));
end;
$$;

create function public.heartbeat_credential_verification(p_job_id uuid,p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.credential_verification_jobs j set lease_until=now()+interval '2 minutes',updated_at=now()
    where j.id=p_job_id and j.state='running' and j.claim_token=p_token and j.lease_until>now()
      and coalesce(public.is_superme_platform_admin(j.actor),false)
      and exists(select 1 from public.profiles p where p.user_id=j.actor and p.account_status='active');
  if not found then raise exception 'Verification claim expired or access revoked' using errcode='42501'; end if;
end;
$$;

create function public.record_credential_verification_item(p_job_id uuid,p_token uuid,p_index integer,p_failure text) returns void
language plpgsql security definer set search_path = '' as $$
declare job private.credential_verification_jobs%rowtype;
begin
  select * into job from private.credential_verification_jobs where id=p_job_id;
  if not found then raise exception 'Verification claim expired or access revoked' using errcode='42501'; end if;
  perform 1 from private.credential_batches where id=job.batch_id for update;
  select * into job from private.credential_verification_jobs where id=p_job_id for update;
  if not found or job.state<>'running' or job.claim_token is distinct from p_token or job.lease_until<=now()
    or not coalesce(public.is_superme_platform_admin(job.actor),false)
    or not exists(select 1 from public.profiles p where p.user_id=job.actor and p.account_status='active') then
    raise exception 'Verification claim expired or access revoked' using errcode='42501';
  end if;
  if p_failure is not null and length(p_failure)>500 then raise exception 'Invalid failure detail' using errcode='22023'; end if;
  update private.credential_verification_items set state=case when p_failure is null then 'complete' else 'failed' end,failure=p_failure
    where job_id=p_job_id and entry_index=p_index and state='pending';
  if not found then raise exception 'Pending verification item not found' using errcode='22023'; end if;
  update private.credential_verification_jobs set lease_until=now()+interval '2 minutes',updated_at=now() where id=p_job_id;
end;
$$;

create function public.finish_credential_verification(p_job_id uuid,p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare job private.credential_verification_jobs%rowtype; failed integer;
begin
  select * into job from private.credential_verification_jobs where id=p_job_id;
  if not found then raise exception 'Verification claim expired or access revoked' using errcode='42501'; end if;
  perform 1 from private.credential_batches where id=job.batch_id for update;
  select * into job from private.credential_verification_jobs where id=p_job_id for update;
  if not found or job.state<>'running' or job.claim_token is distinct from p_token or job.lease_until<=now()
    or not coalesce(public.is_superme_platform_admin(job.actor),false)
    or not exists(select 1 from public.profiles p where p.user_id=job.actor and p.account_status='active') then
    raise exception 'Verification claim expired or access revoked' using errcode='42501';
  end if;
  if exists(select 1 from private.credential_verification_items where job_id=p_job_id and state='pending') then raise exception 'Verification has pending items' using errcode='22023'; end if;
  select count(*) into failed from private.credential_verification_items where job_id=p_job_id and state='failed';
  if failed=0 then
    update private.credential_batches set preview_verified_at=now() where id=job.batch_id and status='reviewed';
    if not found then raise exception 'Batch is no longer reviewable' using errcode='22023'; end if;
  end if;
  update private.credential_verification_jobs set state=case when failed=0 then 'complete' else 'failed' end,claim_token=null,lease_until=null,updated_at=now() where id=p_job_id;
  insert into private.credential_audit_logs(actor,action,batch_id,details) values(job.actor,'verification_finished',job.batch_id,jsonb_build_object('job_id',job.id,'failed',failed));
end;
$$;

revoke all on function public.enqueue_credential_verification(uuid,uuid),public.list_credential_verifications(integer),public.get_credential_verification(uuid),public.cancel_credential_draft(uuid)
  from public,anon,authenticated;
grant execute on function public.enqueue_credential_verification(uuid,uuid),public.list_credential_verifications(integer),public.get_credential_verification(uuid),public.cancel_credential_draft(uuid) to authenticated;
revoke all on function public.claim_credential_verification(),public.heartbeat_credential_verification(uuid,uuid),public.record_credential_verification_item(uuid,uuid,integer,text),public.finish_credential_verification(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.claim_credential_verification(),public.heartbeat_credential_verification(uuid,uuid),public.record_credential_verification_item(uuid,uuid,integer,text),public.finish_credential_verification(uuid,uuid) to service_role;
commit;
