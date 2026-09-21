-- Keep the database's active legal-document registry aligned with the public
-- versions shown by the application. The acknowledgement RPC rejects any
-- version that is not active, so this must ship before or with the web copy.

insert into public.legal_document_versions(
  document_type,
  version,
  effective_date,
  require_reacceptance,
  status,
  change_summary
)
values
  (
    'terms',
    '1.2',
    date '2026-08-27',
    false,
    'active',
    'Current public Terms of Use; clarifies the optional Google Sign-In method.'
  ),
  (
    'privacy',
    '1.1',
    date '2026-08-27',
    false,
    'active',
    'Current Privacy Notice, including the Google Sign-In data transparency clarification.'
  )
on conflict (document_type, version) do update
set
  effective_date = excluded.effective_date,
  require_reacceptance = excluded.require_reacceptance,
  status = excluded.status,
  change_summary = excluded.change_summary;

-- Older acknowledgements remain in user_consents for historical accuracy, but
-- are no longer selectable as the current document pair.
update public.legal_document_versions
set status = 'retired'
where status = 'active'
  and (
    (document_type = 'terms' and version <> '1.2')
    or (document_type = 'privacy' and version <> '1.1')
  );
