create table world_v2.command_queue (
  world_id text not null,
  command_id text not null,
  authority_kind text not null
    check (authority_kind in ('DISCRETIONARY_USER', 'VERSIONED_AUTOMATIC')),
  queue_state text not null default 'PENDING'
    check (queue_state in ('PENDING', 'CLAIMED', 'FINALIZED')),
  priority_rank integer not null default 0 check (priority_rank >= 0),
  available_at_sim_time bigint not null check (available_at_sim_time >= 0),
  attempt_count bigint not null default 0 check (attempt_count >= 0),
  claimed_by text,
  claimed_at_real timestamptz,
  finalized_at_real timestamptz,
  primary key (world_id, command_id),
  foreign key (world_id, command_id)
    references world_v2.command_submission (world_id, command_id),
  check (
    (queue_state = 'PENDING' and claimed_by is null and claimed_at_real is null and finalized_at_real is null)
    or (queue_state = 'CLAIMED' and claimed_by is not null and claimed_at_real is not null and finalized_at_real is null)
    or (queue_state = 'FINALIZED' and finalized_at_real is not null)
  )
);

comment on table world_v2.command_queue is
  'Operational V07.2 queue state; a claim is not commit authority or a V09 fencing token';

alter table world_v2.command_submission
  add constraint command_submission_receipt_evidence_key
  unique (world_id, command_id, command_fingerprint);

alter table world_v2.authoritative_event
  add constraint authoritative_event_transition_evidence_key
  unique (world_id, event_id, causation_command_id, world_version);

comment on column world_v2.authoritative_event.world_version is
  'WorldVersion after the logical transition; event_sequence independently orders one or more Events within that transition';

create table world_v2.command_receipt (
  world_id text not null,
  command_id text not null,
  idempotency_key text,
  schema_version text not null check (schema_version = 'command-receipt-v2'),
  command_fingerprint text not null check (command_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  outcome text not null
    check (outcome in ('COMMITTED', 'REJECTED', 'AUTHORIZATION_REVOKED')),
  reason_code text,
  transition_id text,
  world_version_before bigint check (world_version_before >= 0),
  world_version_after bigint check (world_version_after > 0),
  sim_time bigint not null check (sim_time >= 0),
  event_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(event_ids) = 'array'),
  recorded_at_real timestamptz not null,
  primary key (world_id, command_id),
  foreign key (world_id, command_id, command_fingerprint)
    references world_v2.command_submission (world_id, command_id, command_fingerprint),
  check (
    (
      outcome = 'COMMITTED'
      and reason_code is null
      and transition_id = command_id
      and world_version_before is not null
      and world_version_after = world_version_before + 1
      and jsonb_array_length(event_ids) > 0
    )
    or (
      outcome in ('REJECTED', 'AUTHORIZATION_REVOKED')
      and reason_code ~ '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$'
      and transition_id is null
      and world_version_before is null
      and world_version_after is null
      and jsonb_array_length(event_ids) = 0
    )
  )
);

comment on table world_v2.command_receipt is
  'Immutable final Command outcome bound to canonical intent and one complete authoritative transition';

create function world_v2.validate_command_receipt_evidence()
returns trigger
language plpgsql
as $$
declare
  submitted_idempotency_key text;
  matching_event_count bigint;
  distinct_event_count bigint;
  non_string_event_count bigint;
begin
  select idempotency_key
    into submitted_idempotency_key
    from world_v2.command_submission
    where world_id = new.world_id
      and command_id = new.command_id
      and command_fingerprint = new.command_fingerprint;

  if not found or new.idempotency_key is distinct from submitted_idempotency_key then
    raise exception 'receipt Command identity or fingerprint does not match submission'
      using errcode = '23503';
  end if;

  if new.outcome = 'COMMITTED' then
    select count(*)
      into non_string_event_count
      from jsonb_array_elements(new.event_ids) as items(item)
      where jsonb_typeof(items.item) <> 'string';
    if non_string_event_count <> 0 then
      raise exception 'receipt Event IDs must be canonical strings'
        using errcode = '23514';
    end if;

    select count(distinct ids.event_id)
      into distinct_event_count
      from jsonb_array_elements_text(new.event_ids) as ids(event_id);
    if distinct_event_count <> jsonb_array_length(new.event_ids) then
      raise exception 'receipt Event IDs must be unique'
        using errcode = '23514';
    end if;

    select count(*)
      into matching_event_count
      from world_v2.authoritative_event event
      where event.world_id = new.world_id
        and event.causation_command_id = new.transition_id
        and event.world_version = new.world_version_after
        and event.event_id in (
          select ids.event_id
          from jsonb_array_elements_text(new.event_ids) as ids(event_id)
        );
    if matching_event_count <> jsonb_array_length(new.event_ids) then
      raise exception 'receipt Events do not exist in the authoritative transition'
        using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger command_receipt_evidence_is_bound
before insert on world_v2.command_receipt
for each row execute function world_v2.validate_command_receipt_evidence();

create table world_v2.event_consumer_receipt (
  world_id text not null,
  event_id text not null,
  consumer_id text not null,
  schema_version text not null check (schema_version = 'consumer-receipt-v1'),
  delivery_state text not null
    check (delivery_state in ('PROCESSING', 'DELIVERED', 'FAILED')),
  attempt_count bigint not null default 1 check (attempt_count > 0),
  last_attempt_at_real timestamptz not null,
  primary key (world_id, event_id, consumer_id),
  foreign key (world_id, event_id)
    references world_v2.authoritative_event (world_id, event_id)
);

comment on table world_v2.event_consumer_receipt is
  'Consumer-owned operational delivery state; never authoritative Event history';

create table world_v2.notification_outbox (
  world_id text not null,
  outbox_message_id text not null,
  command_id text not null,
  event_id text,
  schema_version text not null check (schema_version = 'outbox-v1'),
  canonical_payload text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  available_at_sim_time bigint not null check (available_at_sim_time >= 0),
  delivery_state text not null default 'PENDING'
    check (delivery_state in ('PENDING', 'DELIVERED')),
  attempt_count bigint not null default 0 check (attempt_count >= 0),
  last_attempt_at_real timestamptz,
  delivered_at_real timestamptz,
  primary key (world_id, outbox_message_id),
  foreign key (world_id, command_id)
    references world_v2.command_receipt (world_id, command_id),
  foreign key (world_id, event_id)
    references world_v2.authoritative_event (world_id, event_id),
  check (
    (delivery_state = 'PENDING' and delivered_at_real is null)
    or (delivery_state = 'DELIVERED' and delivered_at_real is not null)
  )
);

comment on table world_v2.notification_outbox is
  'At-least-once notification delivery state; retries cannot execute economic work';

create trigger command_receipt_is_immutable
before update or delete on world_v2.command_receipt
for each row execute function world_v2.reject_authoritative_history_mutation();

create function world_v2.validate_command_queue_transition()
returns trigger
language plpgsql
as $$
begin
  if new.world_id is distinct from old.world_id
     or new.command_id is distinct from old.command_id
     or new.authority_kind is distinct from old.authority_kind
     or new.priority_rank is distinct from old.priority_rank
     or new.available_at_sim_time is distinct from old.available_at_sim_time then
    raise exception 'command queue identity and authority are immutable'
      using errcode = '55000';
  end if;
  if not (
    (old.queue_state = 'PENDING' and new.queue_state = 'CLAIMED')
    or (old.queue_state = 'CLAIMED' and new.queue_state in ('PENDING', 'FINALIZED'))
    or (old.queue_state = 'FINALIZED' and new.queue_state = 'FINALIZED')
  ) then
    raise exception 'invalid command queue transition'
      using errcode = '55000';
  end if;
  if new.attempt_count < old.attempt_count then
    raise exception 'command queue attempt count cannot decrease'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger command_queue_transition_is_guarded
before update on world_v2.command_queue
for each row execute function world_v2.validate_command_queue_transition();

create function world_v2.validate_consumer_receipt_update()
returns trigger
language plpgsql
as $$
begin
  if new.world_id is distinct from old.world_id
     or new.event_id is distinct from old.event_id
     or new.consumer_id is distinct from old.consumer_id
     or new.schema_version is distinct from old.schema_version then
    raise exception 'consumer receipt identity is immutable'
      using errcode = '55000';
  end if;
  if old.delivery_state = 'DELIVERED' and new.delivery_state <> 'DELIVERED' then
    raise exception 'delivered consumer receipt cannot be reopened'
      using errcode = '55000';
  end if;
  if new.attempt_count < old.attempt_count then
    raise exception 'consumer receipt attempt count cannot decrease'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger consumer_receipt_update_is_guarded
before update on world_v2.event_consumer_receipt
for each row execute function world_v2.validate_consumer_receipt_update();

create function world_v2.validate_outbox_update()
returns trigger
language plpgsql
as $$
begin
  if new.world_id is distinct from old.world_id
     or new.outbox_message_id is distinct from old.outbox_message_id
     or new.command_id is distinct from old.command_id
     or new.event_id is distinct from old.event_id
     or new.schema_version is distinct from old.schema_version
     or new.canonical_payload is distinct from old.canonical_payload
     or new.payload_sha256 is distinct from old.payload_sha256
     or new.available_at_sim_time is distinct from old.available_at_sim_time then
    raise exception 'outbox authoritative references and payload are immutable'
      using errcode = '55000';
  end if;
  if old.delivery_state = 'DELIVERED' and new.delivery_state <> 'DELIVERED' then
    raise exception 'delivered outbox item cannot be reopened'
      using errcode = '55000';
  end if;
  if new.attempt_count < old.attempt_count then
    raise exception 'outbox attempt count cannot decrease'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger outbox_update_is_guarded
before update on world_v2.notification_outbox
for each row execute function world_v2.validate_outbox_update();
