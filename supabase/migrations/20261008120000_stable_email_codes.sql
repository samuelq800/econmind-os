-- Additive, isolated authentication-mail cache. Never alter auth.users tokens.
begin;
create schema if not exists private;
create table if not exists private.stable_email_codes (
  subject text primary key check (subject ~ '^[a-f0-9]{64}$'),
  purpose text not null check (purpose in ('signup', 'recovery')),
  code_cipher text not null,
  hash_ciphers text[] not null,
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  last_sent_at timestamptz not null,
  attempts integer not null default 0,
  consumed boolean not null default false,
  lease uuid,
  lease_until timestamptz
);
create table if not exists private.stable_email_code_limits (
  bucket text primary key,
  opened_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0
);
alter table private.stable_email_codes enable row level security;
alter table private.stable_email_code_limits enable row level security;
revoke all on private.stable_email_codes, private.stable_email_code_limits from public, anon, authenticated;

-- This function is service-only. SQL locks establish one fixed window across
-- separate Edge instances and simultaneous resend/verify requests.
create or replace function public.stable_email_code_send(
  p_subject text, p_purpose text, p_code_cipher text, p_hash_cipher text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.stable_email_codes%rowtype; t timestamptz := clock_timestamp();
begin
  if p_subject !~ '^[a-f0-9]{64}$' or p_purpose not in ('signup','recovery')
     or length(p_code_cipher) not between 30 and 1000 or length(p_hash_cipher) not between 30 and 2000 then
    raise exception 'Invalid challenge';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stable-email:' || p_subject, 0));
  select * into r from private.stable_email_codes where subject = p_subject for update;
  if found and r.lease_until > t then return jsonb_build_object('status','busy'); end if;
  if found and r.expires_at > t and not r.consumed then
    if r.last_sent_at > t - interval '60 seconds' then return jsonb_build_object('status','limited'); end if;
    update private.stable_email_codes set
      hash_ciphers = (array_prepend(p_hash_cipher, r.hash_ciphers))[1:8], last_sent_at = t
      where subject = p_subject returning * into r;
    -- Do not reset issued_at, expiry or failed verification attempts on resend.
  else
    insert into private.stable_email_codes(subject,purpose,code_cipher,hash_ciphers,issued_at,expires_at,last_sent_at)
      values(p_subject,p_purpose,p_code_cipher,array[p_hash_cipher],t,t+interval '60 minutes',t)
      on conflict(subject) do update set purpose=excluded.purpose,code_cipher=excluded.code_cipher,
        hash_ciphers=excluded.hash_ciphers,issued_at=excluded.issued_at,expires_at=excluded.expires_at,
        last_sent_at=t,attempts=0,consumed=false,lease=null,lease_until=null
      returning * into r;
  end if;
  return jsonb_build_object('status','ready','code_cipher',r.code_cipher,'expires_at',r.expires_at);
end $$;

create or replace function public.stable_email_code_claim(p_subject text, p_peer text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.stable_email_codes%rowtype; t timestamptz := clock_timestamp(); n integer; l uuid := gen_random_uuid();
begin
  if p_subject !~ '^[a-f0-9]{64}$' or p_peer !~ '^[a-f0-9]{64}$' then raise exception 'Invalid challenge'; end if;
  insert into private.stable_email_code_limits(bucket,opened_at,attempts) values(p_peer,t,1)
    on conflict(bucket) do update set
      attempts=case when stable_email_code_limits.opened_at <= t-interval '10 minutes' then 1 else stable_email_code_limits.attempts+1 end,
      opened_at=case when stable_email_code_limits.opened_at <= t-interval '10 minutes' then t else stable_email_code_limits.opened_at end
    returning attempts into n;
  if n > 30 then return jsonb_build_object('status','limited'); end if;
  select * into r from private.stable_email_codes where subject=p_subject for update;
  if not found then return jsonb_build_object('status','legacy'); end if;
  if r.consumed or r.expires_at <= t then return jsonb_build_object('status','invalid'); end if;
  if r.lease_until > t then return jsonb_build_object('status','busy'); end if;
  if r.attempts >= 10 then return jsonb_build_object('status','limited'); end if;
  update private.stable_email_codes set attempts=attempts+1,lease=l,lease_until=t+interval '90 seconds' where subject=p_subject;
  return jsonb_build_object('status','ready','lease',l,'code_cipher',r.code_cipher,'hash_ciphers',r.hash_ciphers,'expires_at',r.expires_at);
end $$;

create or replace function public.stable_email_code_finish(p_subject text,p_lease uuid,p_consumed boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update private.stable_email_codes set lease=null,lease_until=null,
    consumed=consumed or p_consumed,
    code_cipher=case when p_consumed then '' else code_cipher end,
    hash_ciphers=case when p_consumed then array[]::text[] else hash_ciphers end
    where subject=p_subject and lease=p_lease;
  return found;
end $$;

revoke all on function public.stable_email_code_send(text,text,text,text),
  public.stable_email_code_claim(text,text), public.stable_email_code_finish(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.stable_email_code_send(text,text,text,text),
  public.stable_email_code_claim(text,text), public.stable_email_code_finish(text,uuid,boolean) to service_role;
commit;
