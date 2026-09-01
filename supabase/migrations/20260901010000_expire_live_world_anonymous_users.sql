-- Live World visitors use isolated, temporary Supabase Auth identities. They
-- are not EconMind accounts and must never appear in the main profiles table.
-- Keep room history after an identity expires, then remove the Auth identity
-- after seven days with a daily database job.

-- Existing anonymous identities predate the client-side scope marker. Live
-- World is the only anonymous-auth feature in this application, so mark them
-- before removing their automatically-created profiles.
update auth.users
set raw_user_meta_data = jsonb_set(
  coalesce(raw_user_meta_data, '{}'::jsonb),
  '{econmind_session_scope}',
  to_jsonb('live_world'::text),
  true
)
where is_anonymous is true;

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
  if new.is_anonymous is true then
    return new;
  end if;

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

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Auth identity expiry must not erase the participant or crisis history that
-- explains a completed room's results.
alter table public.live_world_participants
  alter column auth_user_id drop not null;
alter table public.live_world_participants
  drop constraint if exists live_world_participants_auth_user_id_fkey;
alter table public.live_world_participants
  add constraint live_world_participants_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

alter table public.live_world_crises
  alter column activated_by drop not null;
alter table public.live_world_crises
  drop constraint if exists live_world_crises_activated_by_fkey;
alter table public.live_world_crises
  add constraint live_world_crises_activated_by_fkey
  foreign key (activated_by) references auth.users(id) on delete set null;

delete from public.profiles profile
using auth.users auth_user
where profile.user_id = auth_user.id
  and auth_user.is_anonymous is true
  and auth_user.raw_user_meta_data->>'econmind_session_scope' = 'live_world';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.cleanup_expired_live_world_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from auth.users auth_user
  where auth_user.is_anonymous is true
    and auth_user.created_at < timezone('utc', now()) - interval '7 days'
    and auth_user.raw_user_meta_data->>'econmind_session_scope' = 'live_world';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.cleanup_expired_live_world_anonymous_users()
from public, anon, authenticated;

-- Remove identities already older than the retention window, then run once a
-- day. The unusual minute avoids competing with jobs scheduled on the hour.
select private.cleanup_expired_live_world_anonymous_users();

create extension if not exists pg_cron;
select cron.unschedule(jobid)
from cron.job
where jobname = 'econmind-live-world-anonymous-cleanup';

select cron.schedule(
  'econmind-live-world-anonymous-cleanup',
  '17 3 * * *',
  $$select private.cleanup_expired_live_world_anonymous_users()$$
);
