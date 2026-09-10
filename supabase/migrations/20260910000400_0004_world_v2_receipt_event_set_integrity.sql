create or replace function world_v2.validate_command_receipt_evidence()
returns trigger
language plpgsql
as $$
declare
  submitted_idempotency_key text;
  expected_event_ids jsonb;
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
    select coalesce(
      jsonb_agg(event.event_id order by event.event_sequence),
      '[]'::jsonb
    )
      into expected_event_ids
      from world_v2.authoritative_event event
      where event.world_id = new.world_id
        and event.causation_command_id = new.transition_id
        and event.world_version = new.world_version_after;

    if new.event_ids <> expected_event_ids then
      raise exception 'receipt Event IDs must equal the complete ordered authoritative transition Event set'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

comment on function world_v2.validate_command_receipt_evidence() is
  'Validates immutable receipt identity and exact equality with every transition Event ordered by authoritative event_sequence';

create function world_v2.reject_event_after_final_receipt()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
      from world_v2.command_receipt receipt
      where receipt.world_id = new.world_id
        and receipt.outcome = 'COMMITTED'
        and receipt.transition_id = new.causation_command_id
        and receipt.world_version_after = new.world_version
  ) then
    raise exception 'cannot append an Event after its authoritative transition receipt is final'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger authoritative_event_cannot_extend_final_transition
before insert on world_v2.authoritative_event
for each row execute function world_v2.reject_event_after_final_receipt();

comment on trigger authoritative_event_cannot_extend_final_transition on world_v2.authoritative_event is
  'Preserves exact receipt Event-set completeness after immutable finalization; V09 inserts all Events before the receipt in one transaction';
