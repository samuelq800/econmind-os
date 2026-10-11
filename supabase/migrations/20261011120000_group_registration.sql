-- One reusable group code, separate from view-only invitations and email OTPs.
-- Starts disabled. Only a platform administrator can configure or stop it.
create schema if not exists private;
create table if not exists private.group_registration_policy (
  singleton boolean primary key default true check (singleton),
  code_hash text check (code_hash ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default false,
  expires_at timestamptz,
  changed_by uuid references public.profiles(user_id) on delete set null,
  changed_at timestamptz not null default clock_timestamp(),
  check (not enabled or code_hash is not null)
);
insert into private.group_registration_policy(singleton) values (true) on conflict do nothing;
create table if not exists private.group_registration_limits (
  bucket text primary key check (bucket ~ '^[a-f0-9]{64}$'),
  opened_at timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table private.group_registration_policy enable row level security;
alter table private.group_registration_limits enable row level security;
revoke all on private.group_registration_policy, private.group_registration_limits from public, anon, authenticated;

create or replace function public.get_group_registration_policy()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator required';
  end if;
  return (select jsonb_build_object('enabled', enabled, 'has_code', code_hash is not null,
    'is_open', enabled and (expires_at is null or expires_at > clock_timestamp()),
    'expires_at', expires_at, 'changed_at', changed_at) from private.group_registration_policy);
end;
$$;

create or replace function public.set_group_registration_policy(p_code text, p_enabled boolean, p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator required';
  end if;
  if p_enabled is null or (p_code is not null and char_length(btrim(p_code)) not between 12 and 128) then
    raise exception 'Invalid group registration policy';
  end if;
  if p_enabled and p_expires_at is not null and p_expires_at <= clock_timestamp() then
    raise exception 'Expiry must be in the future';
  end if;
  update private.group_registration_policy set
    code_hash = case when p_code is null then code_hash else encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex') end,
    enabled = p_enabled, expires_at = p_expires_at,
    changed_by = auth.uid(), changed_at = clock_timestamp();
end;
$$;

-- Called only by the protected Edge Function. Rate checks precede code/account
-- checks, so wrong codes and existing accounts also consume attempts.
create or replace function public.authorize_group_registration(p_code text, p_email text, p_peer text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t timestamptz := clock_timestamp();
  email_bucket text;
  bucket_id text;
  n integer;
  policy private.group_registration_policy%rowtype;
  target auth.users%rowtype;
begin
  if p_peer is null or p_peer !~ '^[a-f0-9]{64}$' or p_email is null or char_length(p_email) > 254
    or p_email <> lower(btrim(p_email)) then raise exception 'Invalid registration request'; end if;
  email_bucket := encode(extensions.digest('group-email:' || p_email, 'sha256'), 'hex');
  -- All callers take peer then email locks through atomic upserts.
  foreach bucket_id in array array[p_peer, email_bucket] loop
    insert into private.group_registration_limits(bucket, opened_at, attempts) values (bucket_id, t, 1)
    on conflict (bucket) do update set
      attempts = case when group_registration_limits.opened_at <= t - interval '10 minutes' then 1 else group_registration_limits.attempts + 1 end,
      opened_at = case when group_registration_limits.opened_at <= t - interval '10 minutes' then t else group_registration_limits.opened_at end
    returning attempts into n;
    if n > (case when bucket_id = p_peer then 30 else 6 end) then
      return jsonb_build_object('status', 'limited');
    end if;
  end loop;
  select * into policy from private.group_registration_policy where singleton;
  if not policy.enabled or (policy.expires_at is not null and policy.expires_at <= t) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  if p_code is null or char_length(btrim(p_code)) not between 12 and 128
    or policy.code_hash <> encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex') then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into target from auth.users where lower(email) = p_email and aud = 'authenticated';
  if not found then return jsonb_build_object('status', 'new'); end if;
  if target.email_confirmed_at is not null or target.is_anonymous is true
    or target.deleted_at is not null or target.banned_until > t or coalesce(target.encrypted_password, '') = ''
    or exists (select 1 from auth.identities where user_id = target.id and provider <> 'email')
    or exists (select 1 from public.profiles where user_id = target.id and account_status = 'suspended') then
    return jsonb_build_object('status', 'invalid');
  end if;
  return jsonb_build_object('status', 'pending', 'user_id', target.id);
end;
$$;

revoke all on function public.get_group_registration_policy(), public.set_group_registration_policy(text, boolean, timestamptz) from public, anon;
grant execute on function public.get_group_registration_policy(), public.set_group_registration_policy(text, boolean, timestamptz) to authenticated;
revoke all on function public.authorize_group_registration(text, text, text) from public, anon, authenticated;
grant execute on function public.authorize_group_registration(text, text, text) to service_role;
