-- Durable per-certificate PDF jobs; the private bucket is never client-readable.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('credential-pdfs', 'credential-pdfs', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id='credential-pdfs' and
    (public is distinct from false or file_size_limit is null or file_size_limit > 26214400
      or allowed_mime_types is distinct from array['application/pdf'])) then
    raise exception 'The credential PDF bucket must be private, PDF-only, and limited to 25 MiB';
  end if;
end $$;

create table private.credential_export_jobs (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  batch_id uuid not null references private.credential_batches(id),
  actor uuid not null,
  state text not null default 'queued' check (state in ('queued','running','complete','partial','cancelled')),
  total integer not null check (total > 0),
  claim_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table private.credential_export_items (
  job_id uuid not null references private.credential_export_jobs(id),
  credential_id uuid not null references private.credentials(id),
  state text not null default 'pending' check (state in ('pending','complete','failed')),
  storage_path text,
  failure text,
  primary key (job_id, credential_id)
);
create index credential_export_jobs_claim_idx on private.credential_export_jobs(state,lease_until,created_at);
create trigger credential_export_jobs_changed after insert or update or delete on private.credential_export_jobs
  for each statement execute function private.bump_credential_jobs_revision();
create trigger credential_export_items_changed after insert or update or delete on private.credential_export_items
  for each statement execute function private.bump_credential_jobs_revision();
revoke all on private.credential_export_jobs, private.credential_export_items from public, anon, authenticated;

create function public.enqueue_credential_export(p_batch_id uuid, p_request_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin(); existing private.credential_export_jobs%rowtype; new_id uuid; total_count integer;
begin
  if p_batch_id is null or p_request_key is null then raise exception 'Batch and request key required' using errcode = '22023'; end if;
  if not exists(select 1 from private.credential_batches b where b.id = p_batch_id and b.status = 'issued') then
    raise exception 'Issued batch required' using errcode = '22023';
  end if;
  select * into existing from private.credential_export_jobs where request_key = p_request_key;
  if found then
    if existing.batch_id <> p_batch_id or existing.actor <> actor_id then raise exception 'Request key already used' using errcode = '23505'; end if;
    return existing.id;
  end if;
  -- Serialize with revocation so the job's total and item set are identical.
  perform c.id from private.credentials c where c.batch_id=p_batch_id order by c.id for update;
  select count(*) into total_count from private.credentials c where c.batch_id = p_batch_id and c.status = 'issued';
  if total_count = 0 then raise exception 'No active credentials to export' using errcode = '22023'; end if;
  insert into private.credential_export_jobs(batch_id,request_key,actor,total) values (p_batch_id,p_request_key,actor_id,total_count)
    on conflict(request_key) do nothing returning id into new_id;
  if new_id is null then
    select * into existing from private.credential_export_jobs where request_key = p_request_key;
    if existing.batch_id <> p_batch_id or existing.actor <> actor_id then raise exception 'Request key already used' using errcode = '23505'; end if;
    return existing.id;
  end if;
  insert into private.credential_export_items(job_id,credential_id)
    select new_id,c.id from private.credentials c where c.batch_id = p_batch_id and c.status = 'issued';
  insert into private.credential_audit_logs(actor,action,batch_id,details)
    values(actor_id,'export_queued',p_batch_id,jsonb_build_object('job_id',new_id,'count',total_count));
  return new_id;
end;
$$;

create function public.get_credential_export_downloads(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin(); result jsonb;
begin
  select jsonb_build_object('id',j.id,'batch_id',j.batch_id,'state',j.state,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('credential_id',c.id,'number',c.certificate_number,'storage_path',i.storage_path) order by c.batch_entry),'[]'::jsonb)
      from private.credential_export_items i join private.credentials c on c.id=i.credential_id
      where i.job_id=j.id and i.state='complete' and c.status='issued'))
    into result from private.credential_export_jobs j where j.id=p_job_id and j.state in ('complete','partial');
  if result is null then raise exception 'Completed export not found' using errcode='22023'; end if;
  return result;
end;
$$;

create function public.get_credential_export(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin(); result jsonb;
begin
  select jsonb_build_object('id',j.id,'batch_id',j.batch_id,'state',j.state,'total',j.total,'created_at',j.created_at,'updated_at',j.updated_at,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('credential_id',i.credential_id,'state',i.state,'failure',i.failure,'number',c.certificate_number) order by c.batch_entry),'[]'::jsonb)
      from private.credential_export_items i join private.credentials c on c.id = i.credential_id where i.job_id=j.id))
    into result from private.credential_export_jobs j where j.id=p_job_id;
  if result is null then raise exception 'Export job not found' using errcode = '22023'; end if;
  return result;
end;
$$;

create function public.list_credential_exports(p_limit integer default 100) returns table (
  id uuid,batch_id uuid,state text,total integer,completed bigint,failed bigint,created_at timestamptz,updated_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin();
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size' using errcode='22023'; end if;
  return query select j.id,j.batch_id,j.state,j.total,
    (select count(*) from private.credential_export_items i where i.job_id=j.id and i.state='complete'),
    (select count(*) from private.credential_export_items i where i.job_id=j.id and i.state='failed'),j.created_at,j.updated_at
    from private.credential_export_jobs j order by j.created_at desc,j.id desc limit p_limit;
end;
$$;

create function public.heartbeat_credential_export(p_job_id uuid,p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.credential_export_jobs j set lease_until=now()+interval '2 minutes',updated_at=now()
    where j.id=p_job_id and j.state='running' and j.claim_token=p_token and j.lease_until>now()
      and coalesce(public.is_superme_platform_admin(j.actor),false)
      and exists(select 1 from public.profiles p where p.user_id=j.actor and p.account_status='active');
  if not found then raise exception 'Export claim expired or access revoked' using errcode='42501'; end if;
end;
$$;

create function public.retry_credential_export(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_credential_admin(); job private.credential_export_jobs%rowtype;
begin
  select * into job from private.credential_export_jobs where id=p_job_id for update;
  if not found or job.state <> 'partial' then raise exception 'Only a partial job can be retried' using errcode='22023'; end if;
  update private.credential_export_items set state='pending',failure=null where job_id=p_job_id and state='failed';
  update private.credential_export_jobs set state='queued',actor=actor_id,claim_token=null,lease_until=null,updated_at=now() where id=p_job_id;
  insert into private.credential_audit_logs(actor,action,batch_id,details) values(actor_id,'export_retry',job.batch_id,jsonb_build_object('job_id',job.id));
end;
$$;

-- Worker endpoints are callable only with the server-side service role.
create function public.claim_credential_export() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job private.credential_export_jobs%rowtype; claim_id uuid := gen_random_uuid();
begin
  select * into job from private.credential_export_jobs j
    where j.state='queued' or (j.state='running' and j.lease_until < now())
    order by j.created_at,j.id for update skip locked limit 1;
  if not found then return null; end if;
  if not coalesce(public.is_superme_platform_admin(job.actor),false)
    or not exists(select 1 from public.profiles p where p.user_id=job.actor and p.account_status='active') then
    update private.credential_export_jobs set state='cancelled',updated_at=now() where id=job.id;
    insert into private.credential_audit_logs(actor,action,batch_id,details) values(job.actor,'export_cancelled_access',job.batch_id,jsonb_build_object('job_id',job.id));
    return null;
  end if;
  update private.credential_export_jobs set state='running',claim_token=claim_id,lease_until=now()+interval '2 minutes',updated_at=now() where id=job.id;
  return jsonb_build_object('id',job.id,'batch_id',job.batch_id,'claim_token',claim_id,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'number',c.certificate_number,'status',c.status,
      'category',c.category,'subtype',c.subtype,'issue_date',c.issue_date,'signature_key',c.signature_key,
      'issuing_authority',c.issuing_authority,'recipient',c.recipient_snapshot,'template',c.template_snapshot->'text_content') order by c.batch_entry),'[]'::jsonb)
      from private.credential_export_items i join private.credentials c on c.id=i.credential_id where i.job_id=job.id and i.state='pending'));
end;
$$;

create function public.record_credential_export_item(p_job_id uuid,p_token uuid,p_credential_id uuid,p_path text,p_failure text) returns void
language plpgsql security definer set search_path = '' as $$
declare job private.credential_export_jobs%rowtype; expected_path text;
begin
  select * into job from private.credential_export_jobs where id=p_job_id for update;
  if not found or job.state<>'running' or job.claim_token is distinct from p_token or job.lease_until <= now()
    or not coalesce(public.is_superme_platform_admin(job.actor),false)
    or not exists(select 1 from public.profiles p where p.user_id=job.actor and p.account_status='active') then
    raise exception 'Export claim expired or access revoked' using errcode='42501';
  end if;
  expected_path := job.batch_id::text || '/' || p_credential_id::text || '.pdf';
  if (p_path is null) = (p_failure is null) or (p_path is not null and p_path<>expected_path)
    or (p_failure is not null and length(p_failure)>500) then raise exception 'Invalid export result' using errcode='22023'; end if;
  if p_path is not null and not exists(select 1 from private.credentials c where c.id=p_credential_id and c.batch_id=job.batch_id and c.status='issued') then
    raise exception 'Credential is no longer active' using errcode='22023';
  end if;
  update private.credential_export_items set state=case when p_path is null then 'failed' else 'complete' end,storage_path=p_path,failure=p_failure
    where job_id=p_job_id and credential_id=p_credential_id and state='pending';
  if not found then raise exception 'Pending export item not found' using errcode='22023'; end if;
  update private.credential_export_jobs set lease_until=now()+interval '2 minutes',updated_at=now() where id=p_job_id;
end;
$$;

create function public.finish_credential_export(p_job_id uuid,p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare job private.credential_export_jobs%rowtype; failed integer;
begin
  select * into job from private.credential_export_jobs where id=p_job_id for update;
  if not found or job.state<>'running' or job.claim_token is distinct from p_token or job.lease_until<=now()
    or not coalesce(public.is_superme_platform_admin(job.actor),false)
    or not exists(select 1 from public.profiles p where p.user_id=job.actor and p.account_status='active') then
    raise exception 'Export claim expired' using errcode='42501';
  end if;
  if exists(select 1 from private.credential_export_items where job_id=p_job_id and state='pending') then
    raise exception 'Export has pending items' using errcode='22023';
  end if;
  select count(*) into failed from private.credential_export_items where job_id=p_job_id and state='failed';
  update private.credential_export_jobs set state=case when failed=0 then 'complete' else 'partial' end,claim_token=null,lease_until=null,updated_at=now() where id=p_job_id;
  insert into private.credential_audit_logs(actor,action,batch_id,details) values(job.actor,'export_finished',job.batch_id,jsonb_build_object('job_id',job.id,'failed',failed));
end;
$$;

revoke all on function public.enqueue_credential_export(uuid,uuid),public.get_credential_export(uuid),public.get_credential_export_downloads(uuid),public.list_credential_exports(integer),public.retry_credential_export(uuid)
  from public,anon,authenticated;
grant execute on function public.enqueue_credential_export(uuid,uuid),public.get_credential_export(uuid),public.get_credential_export_downloads(uuid),public.list_credential_exports(integer),public.retry_credential_export(uuid) to authenticated;
revoke all on function public.claim_credential_export(),public.heartbeat_credential_export(uuid,uuid),public.record_credential_export_item(uuid,uuid,uuid,text,text),public.finish_credential_export(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.claim_credential_export(),public.heartbeat_credential_export(uuid,uuid),public.record_credential_export_item(uuid,uuid,uuid,text,text),public.finish_credential_export(uuid,uuid) to service_role;

commit;
