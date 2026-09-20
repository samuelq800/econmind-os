-- Additive Mail Terminal V1. Source only: apply separately after review.
-- Shared history is readable by canonical platform admins and writable only by
-- the service-role Edge Functions. No existing roles, rows or policies change.
begin;

create table public.mail_threads (
  id uuid primary key default extensions.gen_random_uuid(),
  subject text not null check (char_length(subject) between 1 and 998),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  message_count integer not null default 0 check (message_count >= 0),
  last_message_preview text not null default '',
  last_sender_email text,
  last_sender_name text,
  has_attachments boolean not null default false
);

create table public.mail_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  thread_id uuid not null references public.mail_threads(id) on delete restrict,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_email text not null check (char_length(sender_email) between 3 and 254),
  sender_name text check (char_length(sender_name) <= 200),
  recipient_email text not null check (char_length(recipient_email) between 3 and 254),
  recipient_name text check (char_length(recipient_name) <= 200),
  subject text not null check (char_length(subject) between 1 and 998),
  body_text text not null check (char_length(body_text) <= 100000),
  body_html text check (char_length(body_html) <= 100000),
  internet_message_id text check (char_length(internet_message_id) <= 998),
  in_reply_to text check (char_length(in_reply_to) <= 998),
  references_ids text[] not null default '{}' check (cardinality(references_ids) <= 100),
  provider text not null check (provider in ('brevo', 'cloudflare')),
  provider_message_id text check (char_length(provider_message_id) <= 998),
  delivery_status text not null check (delivery_status in (
    'received', 'pending', 'accepted', 'delivered', 'deferred', 'soft_bounced',
    'hard_bounced', 'blocked', 'invalid', 'failed', 'spam'
  )),
  -- Deliberately no cascading profile/auth FK: preserve sending-time audit
  -- identity even if an account is later removed through another workflow.
  actor_user_id uuid,
  actor_display_name text check (char_length(actor_display_name) <= 80),
  has_attachments boolean not null default false,
  attachments jsonb not null default '[]' check (
    jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 100
  ),
  request_id uuid unique,
  request_fingerprint text,
  inbound_dedupe_key text unique,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  delivery_event_at timestamptz,
  failure_code text check (char_length(failure_code) <= 80),
  check (has_attachments = (jsonb_array_length(attachments) > 0)),
  check (
    (direction = 'outbound' and actor_user_id is not null and actor_display_name is not null
      and sender_email = 'admin@econmind.group' and provider = 'brevo'
      and request_id is not null and request_fingerprint is not null
      and inbound_dedupe_key is null and delivery_status <> 'received'
      and char_length(btrim(subject)) between 1 and 200
      and char_length(btrim(body_text)) between 1 and 20000)
    or
    (direction = 'inbound' and actor_user_id is null and actor_display_name is null
      and recipient_email = 'admin@econmind.group' and provider = 'cloudflare'
      and request_id is null and request_fingerprint is null
      and inbound_dedupe_key is not null and delivery_status = 'received')
  )
);

-- Minimal provider ledger also holds events arriving before the send response
-- is saved. It contains no body, recipient, token, or full webhook payload.
create table public.mail_delivery_events (
  event_key text primary key check (char_length(event_key) between 1 and 200),
  provider_message_id text not null check (char_length(provider_message_id) between 1 and 998),
  status text not null check (status in (
    'accepted', 'delivered', 'deferred', 'soft_bounced', 'hard_bounced',
    'blocked', 'invalid', 'failed', 'spam'
  )),
  event_at timestamptz not null,
  failure_code text check (char_length(failure_code) <= 80),
  created_at timestamptz not null default now()
);

create index mail_threads_inbox_idx on public.mail_threads(last_message_at desc, id) where last_inbound_at is not null;
create index mail_messages_thread_idx on public.mail_messages(thread_id, created_at, id);
create index mail_messages_sent_idx on public.mail_messages(created_at desc, id) where direction = 'outbound';
create index mail_messages_internet_id_idx on public.mail_messages(internet_message_id) where internet_message_id is not null;
create unique index mail_messages_inbound_id_idx on public.mail_messages(internet_message_id) where direction = 'inbound' and internet_message_id is not null;
create unique index mail_messages_provider_id_idx on public.mail_messages(provider_message_id) where direction = 'outbound' and provider_message_id is not null;
create index mail_delivery_events_provider_idx on public.mail_delivery_events(provider_message_id, event_at);

alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;
alter table public.mail_delivery_events enable row level security;
revoke all on public.mail_threads, public.mail_messages, public.mail_delivery_events from public, anon, authenticated;
grant select on public.mail_threads, public.mail_messages to authenticated;
grant all on public.mail_threads, public.mail_messages, public.mail_delivery_events to service_role;
create policy mail_threads_admin_read on public.mail_threads for select to authenticated
  using (public.is_platform_admin((select auth.uid())));
create policy mail_messages_admin_read on public.mail_messages for select to authenticated
  using (public.is_platform_admin((select auth.uid())));
-- No browser write policies; no browser access at all to the delivery ledger.

create function public.mail_preserve_message_history()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Mail history cannot be deleted' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['provider_message_id', 'internet_message_id', 'delivery_status',
      'sent_at', 'delivered_at', 'failed_at', 'delivery_event_at', 'failure_code'])
     is distinct from
     (to_jsonb(old) - array['provider_message_id', 'internet_message_id', 'delivery_status',
      'sent_at', 'delivered_at', 'failed_at', 'delivery_event_at', 'failure_code'])
    or old.direction = 'inbound'
    or (old.provider_message_id is not null and new.provider_message_id is distinct from old.provider_message_id)
    or (old.internet_message_id is not null and new.internet_message_id is distinct from old.internet_message_id) then
    raise exception 'Mail snapshots are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger mail_messages_preserve_history before update or delete on public.mail_messages
  for each row execute function public.mail_preserve_message_history();

create function public.mail_update_thread_summary()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  update public.mail_threads set
    updated_at = now(),
    last_message_at = greatest(last_message_at, new.created_at),
    last_inbound_at = case when new.direction = 'inbound' then greatest(last_inbound_at, new.created_at) else last_inbound_at end,
    last_outbound_at = case when new.direction = 'outbound' then greatest(last_outbound_at, new.created_at) else last_outbound_at end,
    message_count = message_count + 1,
    last_message_preview = case when new.created_at >= last_message_at then left(new.body_text, 180) else last_message_preview end,
    last_sender_email = case when new.created_at >= last_message_at then new.sender_email else last_sender_email end,
    last_sender_name = case when new.created_at >= last_message_at then new.sender_name else last_sender_name end,
    has_attachments = has_attachments or new.has_attachments
  where id = new.thread_id;
  return new;
end;
$$;
create trigger mail_messages_thread_summary after insert on public.mail_messages
  for each row execute function public.mail_update_thread_summary();

create function public.mail_begin_send(
  p_request_id uuid, p_actor_user_id uuid, p_actor_display_name text,
  p_to text, p_subject text, p_body_text text, p_thread_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare
  v_message public.mail_messages%rowtype;
  v_thread_id uuid := p_thread_id;
  v_fingerprint text;
  v_parent_id text;
begin
  if not public.is_platform_admin(p_actor_user_id) then
    raise exception 'Platform administrator permission required' using errcode = '42501';
  end if;
  if p_request_id is null or p_actor_display_name is null
    or char_length(btrim(p_actor_display_name)) not between 1 and 80
    or p_actor_display_name ~ '[[:cntrl:]]'
    or p_to is null or p_to !~ '^[^[:space:]<>;,]+@[^[:space:]<>;,]+\.[^[:space:]<>;,]+$'
    or p_subject is null or char_length(btrim(p_subject)) not between 1 and 200
    or p_subject ~ '[[:cntrl:]]'
    or p_body_text is null or char_length(btrim(p_body_text)) not between 1 and 20000 then
    raise exception 'Invalid send input' using errcode = '22023';
  end if;
  v_fingerprint := encode(extensions.digest(jsonb_build_object(
    'actor', p_actor_user_id, 'to', p_to, 'subject', p_subject,
    'message', p_body_text, 'threadId', p_thread_id
  )::text, 'sha256'), 'hex');
  -- Serialize concurrent invocations for a logical request, before creating
  -- either row. A completed or pending request is never sent a second time.
  perform pg_advisory_xact_lock(hashtextextended('mail-send:' || p_request_id::text, 0));
  select * into v_message from public.mail_messages where request_id = p_request_id;
  if found then
    if v_message.request_fingerprint <> v_fingerprint then
      raise exception 'Request ID payload mismatch' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_message.id, 'thread_id', v_message.thread_id,
      'delivery_status', v_message.delivery_status, 'provider_message_id', v_message.provider_message_id, 'created', false);
  end if;
  if v_thread_id is null then
    insert into public.mail_threads(subject) values (p_subject) returning id into v_thread_id;
  else
    perform 1 from public.mail_threads where id = v_thread_id for update;
    if not found then raise exception 'Mail thread not found' using errcode = 'P0002'; end if;
    select internet_message_id into v_parent_id from public.mail_messages
      where thread_id = v_thread_id and direction = 'inbound'
      order by created_at desc, id desc limit 1;
  end if;
  insert into public.mail_messages(thread_id, direction, sender_email, sender_name,
    recipient_email, subject, body_text, provider, delivery_status,
    actor_user_id, actor_display_name, request_id, request_fingerprint, in_reply_to)
  values (v_thread_id, 'outbound', 'admin@econmind.group', p_actor_display_name || ' · EconMind',
    p_to, p_subject, p_body_text, 'brevo', 'pending', p_actor_user_id,
    p_actor_display_name, p_request_id, v_fingerprint, v_parent_id)
  returning * into v_message;
  return jsonb_build_object('id', v_message.id, 'thread_id', v_message.thread_id,
    'delivery_status', v_message.delivery_status, 'provider_message_id', null, 'created', true);
end;
$$;

-- Monotone precedence, with timestamps breaking equal-precedence ties. Soft
-- failures can recover to delivered; delivery cannot regress to request/deferred.
-- A permanent failure or complaint remains visible for manual investigation.
create function public.mail_delivery_rank(p_status text)
returns integer language sql immutable security invoker set search_path = public as $$
  select case p_status when 'pending' then 0 when 'accepted' then 10
    when 'deferred' then 20 when 'soft_bounced' then 30 when 'failed' then 40
    when 'delivered' then 50 when 'hard_bounced' then 60 when 'blocked' then 60
    when 'invalid' then 60 when 'spam' then 70 else -1 end
$$;

create function public.mail_reconcile_delivery(p_message_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_message public.mail_messages%rowtype;
  v_event public.mail_delivery_events%rowtype;
begin
  select * into v_message from public.mail_messages where id = p_message_id and direction = 'outbound' for update;
  if not found or v_message.provider_message_id is null then return; end if;
  select * into v_event from public.mail_delivery_events
    where provider_message_id = v_message.provider_message_id
    order by public.mail_delivery_rank(status) desc, event_at desc, event_key desc limit 1;
  if not found then return; end if;
  if public.mail_delivery_rank(v_event.status) > public.mail_delivery_rank(v_message.delivery_status)
    or (public.mail_delivery_rank(v_event.status) = public.mail_delivery_rank(v_message.delivery_status)
      and (v_message.delivery_event_at is null or v_event.event_at > v_message.delivery_event_at)) then
    update public.mail_messages set
      delivery_status = v_event.status,
      delivery_event_at = v_event.event_at,
      delivered_at = case when v_event.status = 'delivered' then coalesce(delivered_at, v_event.event_at) else delivered_at end,
      failed_at = case when v_event.status in ('soft_bounced', 'hard_bounced', 'blocked', 'invalid', 'failed', 'spam') then v_event.event_at
        when v_event.status = 'delivered' then null else failed_at end,
      failure_code = case when v_event.status in ('soft_bounced', 'hard_bounced', 'blocked', 'invalid', 'failed', 'spam')
        then v_event.failure_code else null end
    where id = p_message_id;
  end if;
end;
$$;

create function public.mail_complete_send(
  p_message_id uuid, p_provider_message_id text default null, p_failure_code text default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_message public.mail_messages%rowtype;
begin
  if p_provider_message_id is null and p_failure_code is null then
    raise exception 'A confirmed provider outcome is required' using errcode = '22023';
  end if;
  -- Same provider lock in the event endpoint prevents an event arriving between
  -- binding the provider ID and reconciliation from being stranded unmatched.
  if p_provider_message_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('mail-provider:' || p_provider_message_id, 0));
  end if;
  select * into v_message from public.mail_messages where id = p_message_id and direction = 'outbound' for update;
  if not found then raise exception 'Mail message not found' using errcode = 'P0002'; end if;
  if v_message.provider_message_id is not null and v_message.provider_message_id is distinct from p_provider_message_id then
    raise exception 'Provider identity mismatch' using errcode = '22023';
  end if;
  if v_message.delivery_status = 'pending' then
    update public.mail_messages set
      provider_message_id = p_provider_message_id,
      internet_message_id = p_provider_message_id,
      delivery_status = case when p_provider_message_id is not null then 'accepted' else 'failed' end,
      sent_at = case when p_provider_message_id is not null then now() else null end,
      failed_at = case when p_provider_message_id is null then now() else null end,
      failure_code = case when p_provider_message_id is null then p_failure_code else null end
    where id = p_message_id;
  end if;
  perform public.mail_reconcile_delivery(p_message_id);
  select * into v_message from public.mail_messages where id = p_message_id;
  return jsonb_build_object('id', v_message.id, 'thread_id', v_message.thread_id,
    'delivery_status', v_message.delivery_status, 'provider_message_id', v_message.provider_message_id);
end;
$$;

create function public.mail_ingest_inbound(p_message jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_message public.mail_messages%rowtype;
  v_thread_id uuid;
  v_identity text := nullif(btrim(p_message->>'internet_message_id', '<> '), '');
  v_parent text := nullif(btrim(p_message->>'in_reply_to', '<> '), '');
  v_refs text[];
  v_dedupe text;
  v_subject text := coalesce(nullif(btrim(p_message->>'subject'), ''), '(No subject)');
begin
  if p_message->>'recipient_email' is distinct from 'admin@econmind.group'
    or coalesce(p_message->>'raw_sha256', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid inbound envelope' using errcode = '22023';
  end if;
  select coalesce(array_agg(btrim(value, '<> ') order by ord), '{}'::text[]) into v_refs
    from jsonb_array_elements_text(coalesce(p_message->'references_ids', '[]'::jsonb)) with ordinality as refs(value, ord);
  v_dedupe := case when v_identity is not null then 'mid:' || v_identity else 'raw:' || (p_message->>'raw_sha256') end;
  perform pg_advisory_xact_lock(hashtextextended('mail-inbound:' || v_dedupe, 0));
  select * into v_message from public.mail_messages where inbound_dedupe_key = v_dedupe;
  if found then return jsonb_build_object('id', v_message.id, 'thread_id', v_message.thread_id, 'duplicate', true); end if;

  -- Match header identity only. Subject text is never a lookup key.
  if v_parent is not null then
    select thread_id into v_thread_id from public.mail_messages where internet_message_id = v_parent
      order by (direction = 'outbound') desc, created_at desc, id desc limit 1;
  end if;
  if v_thread_id is null then
    select message.thread_id into v_thread_id
      from unnest(v_refs) with ordinality as ref(value, ord)
      join public.mail_messages message on message.internet_message_id = ref.value
      order by ref.ord desc, (message.direction = 'outbound') desc, message.created_at desc, message.id desc limit 1;
  end if;
  if v_thread_id is null then
    insert into public.mail_threads(subject) values (v_subject) returning id into v_thread_id;
  end if;
  insert into public.mail_messages(thread_id, direction, sender_email, sender_name,
    recipient_email, recipient_name, subject, body_text, body_html, internet_message_id,
    in_reply_to, references_ids, provider, delivery_status, inbound_dedupe_key,
    has_attachments, attachments, received_at, sent_at)
  values (v_thread_id, 'inbound', p_message->>'sender_email', p_message->>'sender_name',
    'admin@econmind.group', p_message->>'recipient_name', v_subject, p_message->>'body_text',
    p_message->>'body_html', v_identity, v_parent, v_refs, 'cloudflare', 'received', v_dedupe,
    jsonb_array_length(p_message->'attachments') > 0, p_message->'attachments',
    (p_message->>'received_at')::timestamptz, (p_message->>'sent_at')::timestamptz)
  returning * into v_message;
  return jsonb_build_object('id', v_message.id, 'thread_id', v_message.thread_id, 'duplicate', false);
end;
$$;

create function public.mail_apply_delivery_event(
  p_provider_message_id text, p_status text, p_event_at timestamptz,
  p_event_key text, p_failure_code text default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_inserted integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('mail-provider:' || p_provider_message_id, 0));
  insert into public.mail_delivery_events(event_key, provider_message_id, status, event_at, failure_code)
    values (p_event_key, p_provider_message_id, p_status, p_event_at, p_failure_code)
    on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  select id into v_id from public.mail_messages where provider = 'brevo' and provider_message_id = p_provider_message_id;
  if v_id is not null then perform public.mail_reconcile_delivery(v_id); end if;
  return jsonb_build_object('matched', v_id is not null, 'duplicate', v_inserted = 0);
end;
$$;

-- Functions use invoker rights and have no PUBLIC/anon/authenticated EXECUTE.
-- The service key stays only inside Supabase Edge Functions.
revoke all on function public.mail_preserve_message_history(), public.mail_update_thread_summary(),
  public.mail_begin_send(uuid, uuid, text, text, text, text, uuid), public.mail_delivery_rank(text),
  public.mail_reconcile_delivery(uuid), public.mail_complete_send(uuid, text, text),
  public.mail_ingest_inbound(jsonb), public.mail_apply_delivery_event(text, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.mail_preserve_message_history(), public.mail_update_thread_summary(),
  public.mail_begin_send(uuid, uuid, text, text, text, text, uuid), public.mail_delivery_rank(text),
  public.mail_reconcile_delivery(uuid), public.mail_complete_send(uuid, text, text),
  public.mail_ingest_inbound(jsonb), public.mail_apply_delivery_event(text, text, timestamptz, text, text)
  to service_role;

commit;
