-- Read-only invitation access for visitors who should be able to explore every
-- page without receiving an account, school, team, or database write rights.

create table if not exists public.viewer_invitation_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  label text check (label is null or char_length(trim(label)) between 1 and 120),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expires_at is null or expires_at > created_at)
);

create index if not exists viewer_invitation_codes_active_idx
  on public.viewer_invitation_codes (is_active, expires_at);

drop trigger if exists viewer_invitation_codes_set_updated_at on public.viewer_invitation_codes;
create trigger viewer_invitation_codes_set_updated_at
before update on public.viewer_invitation_codes
for each row execute function public.set_league_updated_at();

alter table public.viewer_invitation_codes enable row level security;

create or replace function public.normalise_viewer_invitation_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.validate_viewer_invitation_code(p_code text)
returns table(label text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select invitation.label, invitation.expires_at
  from public.viewer_invitation_codes invitation
  where invitation.is_active
    and (invitation.expires_at is null or invitation.expires_at > timezone('utc', now()))
    and invitation.code_hash = encode(
      extensions.digest(public.normalise_viewer_invitation_code(p_code), 'sha256'),
      'hex'
    )
  limit 1
$$;

create or replace function public.create_viewer_invitation_code(
  p_label text default null,
  p_expires_at timestamptz default null
)
returns table(id uuid, invitation_code text, label text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
  generated_hash text;
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  if p_expires_at is not null and p_expires_at <= timezone('utc', now()) then
    raise exception 'Invitation expiry must be in the future';
  end if;
  if p_label is not null and char_length(trim(p_label)) > 120 then
    raise exception 'Invitation labels must be 120 characters or fewer';
  end if;

  loop
    generated_code := 'VIEW-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 20));
    generated_hash := encode(
      extensions.digest(public.normalise_viewer_invitation_code(generated_code), 'sha256'),
      'hex'
    );
    insert into public.viewer_invitation_codes(code_hash, label, expires_at, created_by)
    values (generated_hash, nullif(trim(p_label), ''), p_expires_at, auth.uid())
    on conflict (code_hash) do nothing
    returning viewer_invitation_codes.id, generated_code, viewer_invitation_codes.label, viewer_invitation_codes.expires_at
    into id, invitation_code, label, expires_at;
    exit when found;
  end loop;

  return next;
end;
$$;

create or replace function public.list_viewer_invitation_codes()
returns table(id uuid, label text, is_active boolean, expires_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select invitation.id, invitation.label, invitation.is_active, invitation.expires_at, invitation.created_at
  from public.viewer_invitation_codes invitation
  where public.is_platform_admin(auth.uid())
  order by invitation.created_at desc
$$;

create or replace function public.set_viewer_invitation_active(
  p_invitation_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  update public.viewer_invitation_codes
  set is_active = p_active
  where id = p_invitation_id;
  if not found then raise exception 'Viewer invitation not found'; end if;
end;
$$;

revoke all on table public.viewer_invitation_codes from anon, authenticated;
revoke all on function public.normalise_viewer_invitation_code(text) from public, anon, authenticated;
revoke all on function public.validate_viewer_invitation_code(text) from public;
revoke all on function public.create_viewer_invitation_code(text, timestamptz) from public;
revoke all on function public.list_viewer_invitation_codes() from public;
revoke all on function public.set_viewer_invitation_active(uuid, boolean) from public;
grant execute on function public.validate_viewer_invitation_code(text) to anon, authenticated;
grant execute on function public.create_viewer_invitation_code(text, timestamptz), public.list_viewer_invitation_codes(), public.set_viewer_invitation_active(uuid, boolean) to authenticated;
