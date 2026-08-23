-- Governance, privacy, legal acknowledgement, and in-site support foundation.
-- This migration is additive. It does not force existing accounts to accept a
-- new document, and it does not widen any public profile fields.

create table if not exists public.legal_document_versions (
  document_type text not null check (document_type in ('terms', 'privacy')),
  version text not null check (version ~ '^[0-9]+\.[0-9]+$'),
  effective_date date not null,
  require_reacceptance boolean not null default false,
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  change_summary text check (change_summary is null or char_length(change_summary) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (document_type, version)
);

insert into public.legal_document_versions(document_type, version, effective_date, require_reacceptance, status, change_summary)
values
  ('terms', '1.0', date '2026-08-23', false, 'active', 'Initial public Terms of Use.'),
  ('privacy', '1.0', date '2026-08-23', false, 'active', 'Initial public Privacy Notice.')
on conflict (document_type, version) do nothing;

create table if not exists public.user_consents (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  document_type text not null check (document_type in ('terms', 'privacy')),
  document_version text not null check (document_version ~ '^[0-9]+\.[0-9]+$'),
  accepted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, document_type, document_version)
);

create index if not exists user_consents_user_document_idx
  on public.user_consents(user_id, document_type, accepted_at desc);

create table if not exists public.support_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete set null,
  category text not null check (category in ('general', 'privacy', 'account_deletion', 'report', 'league_appeal', 'security')),
  subject text not null check (char_length(btrim(subject)) between 4 and 180),
  message text not null check (char_length(btrim(message)) between 10 and 6000),
  target_type text check (target_type is null or char_length(btrim(target_type)) between 2 and 80),
  target_reference text check (target_reference is null or char_length(btrim(target_reference)) <= 300),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'closed')),
  public_response text check (public_response is null or char_length(public_response) <= 6000),
  internal_note text check (internal_note is null or char_length(internal_note) <= 10000),
  assigned_admin_user_id uuid references public.profiles(user_id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists support_requests_user_created_idx
  on public.support_requests(user_id, created_at desc);
create index if not exists support_requests_status_created_idx
  on public.support_requests(status, created_at asc);

create table if not exists public.moderation_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  support_request_id uuid references public.support_requests(id) on delete set null,
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  target_type text not null check (char_length(btrim(target_type)) between 2 and 80),
  target_reference text check (target_reference is null or char_length(target_reference) <= 300),
  action text not null check (action in ('reviewed', 'responded', 'resolved', 'closed', 'content_hidden', 'content_removed', 'attempt_invalidated', 'access_restricted', 'access_restored')),
  outcome text check (outcome is null or char_length(outcome) <= 4000),
  internal_note text check (internal_note is null or char_length(internal_note) <= 10000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists moderation_actions_request_created_idx
  on public.moderation_actions(support_request_id, created_at desc);
create index if not exists moderation_actions_actor_created_idx
  on public.moderation_actions(actor_user_id, created_at desc);

drop trigger if exists support_requests_set_updated_at on public.support_requests;
create trigger support_requests_set_updated_at
before update on public.support_requests
for each row execute function public.set_updated_at();

-- Supabase's auth trigger runs with database privileges. When sign-up metadata
-- contains the checkbox acknowledgements, it stores only the document version
-- and timestamp; it intentionally stores no IP or device fingerprint.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  terms_version text := nullif(new.raw_user_meta_data #>> '{legal_acceptance,terms_version}', '');
  privacy_version text := nullif(new.raw_user_meta_data #>> '{legal_acceptance,privacy_version}', '');
begin
  insert into public.profiles(user_id, display_name, avatar_url)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data->>'display_name', ''), 80), ''),
    nullif(left(coalesce(new.raw_user_meta_data->>'avatar_url', ''), 2048), '')
  )
  on conflict (user_id) do nothing;

  if terms_version is not null and privacy_version is not null then
    insert into public.user_consents(user_id, document_type, document_version)
    select new.id, document.document_type, document.version
    from public.legal_document_versions document
    where document.status = 'active'
      and (
        (document.document_type = 'terms' and document.version = terms_version)
        or (document.document_type = 'privacy' and document.version = privacy_version)
      )
    on conflict (user_id, document_type, document_version) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.accept_current_legal_documents(
  p_terms_version text,
  p_privacy_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acceptance_user_id uuid := auth.uid();
  accepted_documents integer;
begin
  if acceptance_user_id is null then
    raise exception 'Signed-in account required';
  end if;

  select count(*) into accepted_documents
  from public.legal_document_versions document
  where document.status = 'active'
    and (
      (document.document_type = 'terms' and document.version = p_terms_version)
      or (document.document_type = 'privacy' and document.version = p_privacy_version)
    );

  if accepted_documents <> 2 then
    raise exception 'The requested legal document version is not active';
  end if;

  insert into public.user_consents(user_id, document_type, document_version)
  values
    (acceptance_user_id, 'terms', p_terms_version),
    (acceptance_user_id, 'privacy', p_privacy_version)
  on conflict (user_id, document_type, document_version) do nothing;
end;
$$;

create or replace function public.review_support_request(
  p_request_id uuid,
  p_status text,
  p_public_response text default null,
  p_internal_note text default null,
  p_action text default null,
  p_outcome text default null
)
returns public.support_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.support_requests;
  updated_row public.support_requests;
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  if p_status not in ('open', 'reviewing', 'resolved', 'closed') then
    raise exception 'Invalid support request status';
  end if;
  if p_public_response is not null and char_length(p_public_response) > 6000 then
    raise exception 'Public response is too long';
  end if;
  if p_internal_note is not null and char_length(p_internal_note) > 10000 then
    raise exception 'Internal note is too long';
  end if;
  if p_action is not null and p_action not in ('reviewed', 'responded', 'resolved', 'closed', 'content_hidden', 'content_removed', 'attempt_invalidated', 'access_restricted', 'access_restored') then
    raise exception 'Invalid moderation action';
  end if;

  select * into request_row
  from public.support_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'Support request not found';
  end if;

  update public.support_requests
  set
    status = p_status,
    public_response = case when p_public_response is null then request_row.public_response else nullif(btrim(p_public_response), '') end,
    internal_note = case when p_internal_note is null then request_row.internal_note else nullif(btrim(p_internal_note), '') end,
    assigned_admin_user_id = auth.uid(),
    resolved_at = case when p_status in ('resolved', 'closed') then timezone('utc', now()) else null end
  where id = p_request_id
  returning * into updated_row;

  if p_action is not null then
    insert into public.moderation_actions(
      support_request_id, actor_user_id, target_type, target_reference, action, outcome, internal_note
    ) values (
      request_row.id,
      auth.uid(),
      coalesce(request_row.target_type, 'support_request'),
      request_row.target_reference,
      p_action,
      nullif(btrim(coalesce(p_outcome, '')), ''),
      nullif(btrim(coalesce(p_internal_note, '')), '')
    );
  end if;

  return updated_row;
end;
$$;

alter table public.legal_document_versions enable row level security;
alter table public.user_consents enable row level security;
alter table public.support_requests enable row level security;
alter table public.moderation_actions enable row level security;

create policy legal_document_versions_read_authenticated
on public.legal_document_versions
for select to authenticated
using (status in ('active', 'retired') or public.is_platform_admin(auth.uid()));

create policy legal_document_versions_admin_manage
on public.legal_document_versions
for all to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

create policy user_consents_select_own
on public.user_consents
for select to authenticated
using (user_id = auth.uid());

create policy user_consents_admin_select
on public.user_consents
for select to authenticated
using (public.is_platform_admin(auth.uid()));

create policy support_requests_select_own
on public.support_requests
for select to authenticated
using (user_id = auth.uid());

create policy support_requests_insert_own
on public.support_requests
for insert to authenticated
with check (user_id = auth.uid());

create policy support_requests_admin_select
on public.support_requests
for select to authenticated
using (public.is_platform_admin(auth.uid()));

create policy moderation_actions_admin_select
on public.moderation_actions
for select to authenticated
using (public.is_platform_admin(auth.uid()));

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.accept_current_legal_documents(text, text) from public, anon;
revoke all on function public.review_support_request(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.accept_current_legal_documents(text, text) to authenticated;
grant execute on function public.review_support_request(uuid, text, text, text, text, text) to authenticated;
grant select on public.legal_document_versions, public.user_consents, public.support_requests, public.moderation_actions to authenticated;
grant insert on public.support_requests to authenticated;
