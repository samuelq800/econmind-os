-- Dedicated, owner-approved registration exception. No existing account changes.
begin;
create schema if not exists private;
create table if not exists private.direct_registration_policy (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default true
);
insert into private.direct_registration_policy(singleton) values(true) on conflict do nothing;
create table if not exists private.direct_registration_limits (
  bucket text primary key,
  opened_at timestamptz not null,
  attempts integer not null check(attempts>0)
);
alter table private.direct_registration_policy enable row level security;
alter table private.direct_registration_limits enable row level security;
revoke all on private.direct_registration_policy, private.direct_registration_limits from public, anon, authenticated;

-- Atomic global + per-account limits; no reliance on spoofable forwarding headers.
create or replace function public.authorize_direct_registration(p_address text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); bucket_id text; n integer;
begin
  if p_address is null or char_length(p_address)>254 or p_address<>lower(btrim(p_address)) or position('@' in p_address)=0 then raise exception 'Invalid address'; end if;
  foreach bucket_id in array array['direct-global', 'direct-account:'||encode(extensions.digest(p_address,'sha256'),'hex')] loop
    insert into private.direct_registration_limits(bucket,opened_at,attempts) values(bucket_id,t,1)
    on conflict(bucket) do update set
      attempts=case when direct_registration_limits.opened_at<=t-interval '10 minutes' then 1 else direct_registration_limits.attempts+1 end,
      opened_at=case when direct_registration_limits.opened_at<=t-interval '10 minutes' then t else direct_registration_limits.opened_at end
    returning attempts into n;
    if n>(case when bucket_id='direct-global' then 100 else 6 end) then return jsonb_build_object('status','limited'); end if;
  end loop;
  if not coalesce((select enabled from private.direct_registration_policy where singleton),false) then return jsonb_build_object('status','unavailable'); end if;
  -- Confirmed, pending, banned and OAuth accounts are all rejected identically.
  if exists(select 1 from auth.users where lower(email)=p_address) then return jsonb_build_object('status','invalid'); end if;
  return jsonb_build_object('status','new');
end $$;
revoke all on function public.authorize_direct_registration(text) from public,anon,authenticated;
grant execute on function public.authorize_direct_registration(text) to service_role;

-- Receipts arise only from a NEW profile whose registration explicitly supplied
-- every current checkbox. Do not backfill older accounts or infer acceptance.
create or replace function private.record_new_registration_policies()
returns trigger language plpgsql security definer set search_path='' as $$
declare receipt jsonb; checks jsonb;
begin
  select raw_user_meta_data->'policy_acknowledgement' into receipt from auth.users
    where id=new.user_id and not coalesce(is_anonymous,false);
  if receipt->>'release_id' is distinct from '2026-10-21-v2' then return new; end if;
  checks:=receipt->'checks';
  if jsonb_typeof(checks) is distinct from 'object' then return new; end if;
  if (select count(*) from jsonb_object_keys(checks))<>8 or exists(
    select 1 from private.current_policy_release_documents() d where checks->d.document_key is distinct from 'true'::jsonb
  ) then return new; end if;
  insert into public.policy_acknowledgement_records(user_id,release_id,document_key,document_version,document_path,source_sha256,acknowledgement_action)
    select new.user_id,'2026-10-21-v2',document_key,document_version,document_path,source_sha256,acknowledgement_action from private.current_policy_release_documents()
    on conflict(user_id,release_id,document_key) do nothing;
  insert into public.user_consents(user_id,document_type,document_version) values(new.user_id,'terms','2.0'),(new.user_id,'privacy','2.0')
    on conflict(user_id,document_type,document_version) do nothing;
  return new;
end $$;
revoke all on function private.record_new_registration_policies() from public,anon,authenticated;
drop trigger if exists profiles_record_registration_policies on public.profiles;
create trigger profiles_record_registration_policies after insert on public.profiles for each row execute function private.record_new_registration_policies();
notify pgrst,'reload schema';
commit;
