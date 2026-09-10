create table world_v2.world_head (
  world_id text primary key,
  world_version bigint not null default 0 check (world_version >= 0),
  event_sequence bigint not null default 0 check (event_sequence >= 0)
);

comment on table world_v2.world_head is
  'Transaction-bound World head foundation; V09 owns writer lease, fencing and atomic transition runtime';

create table world_v2.command_submission (
  world_id text not null references world_v2.world_head (world_id),
  command_id text not null,
  idempotency_key text,
  command_type text not null,
  schema_version text not null,
  canonical_payload text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  command_fingerprint text not null check (command_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  auth_subject uuid not null,
  actor_id text not null,
  country_id text not null,
  office_id text,
  expected_world_version bigint check (expected_world_version >= 0),
  sim_time bigint not null check (sim_time >= 0),
  correlation_id text not null,
  submitted_at_real timestamptz not null,
  primary key (world_id, command_id),
  unique (world_id, idempotency_key)
);

comment on table world_v2.command_submission is
  'Immutable canonical Command intent; receipt and queue lifecycle are owned by V07.2';

create table world_v2.authoritative_event (
  world_id text not null references world_v2.world_head (world_id),
  event_id text not null,
  event_sequence bigint not null check (event_sequence > 0),
  world_version bigint not null check (world_version > 0),
  causation_command_id text not null,
  correlation_id text not null,
  event_type text not null,
  schema_version text not null,
  canonical_payload text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  event_fingerprint text not null check (event_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  sim_time bigint not null check (sim_time >= 0),
  recorded_at_real timestamptz not null,
  corrects_event_id text,
  primary key (world_id, event_id),
  unique (world_id, event_sequence),
  foreign key (world_id, causation_command_id)
    references world_v2.command_submission (world_id, command_id),
  foreign key (world_id, corrects_event_id)
    references world_v2.authoritative_event (world_id, event_id),
  check (corrects_event_id is null or corrects_event_id <> event_id)
);

comment on table world_v2.authoritative_event is
  'Append-only authoritative Event history; correction is a new causally linked Event';

create function world_v2.reject_authoritative_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'authoritative World history is append-only'
    using errcode = '55000';
end;
$$;

create trigger command_submission_is_immutable
before update or delete on world_v2.command_submission
for each row execute function world_v2.reject_authoritative_history_mutation();

create trigger authoritative_event_is_immutable
before update or delete on world_v2.authoritative_event
for each row execute function world_v2.reject_authoritative_history_mutation();
