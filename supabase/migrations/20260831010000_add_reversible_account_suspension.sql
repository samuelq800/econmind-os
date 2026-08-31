-- Reversible account-access state for administrator moderation. The actual
-- Supabase Auth ban is performed only by the protected Edge Function.
alter table public.profiles
  add column if not exists account_status text not null default 'active'
  check (account_status in ('active', 'suspended')),
  add column if not exists account_status_changed_at timestamptz,
  add column if not exists account_status_changed_by uuid references public.profiles(user_id) on delete set null;

create index if not exists profiles_account_status_idx
  on public.profiles(account_status)
  where account_status = 'suspended';

-- Account-access fields are maintained only by the service-role Edge Function.
-- Preserve existing administrator role management while preventing any browser
-- client, including the affected account, from restoring its own access.
create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.uid() = new.user_id and not public.is_platform_admin(auth.uid()) then
    new.role := 'student';
    new.platform_role := 'user';
  elsif tg_op = 'UPDATE' and not public.is_platform_admin(auth.uid()) then
    new.role := old.role;
    new.platform_role := old.platform_role;
  end if;

  if tg_op = 'INSERT' and coalesce(auth.role(), '') <> 'service_role' then
    new.account_status := 'active';
    new.account_status_changed_at := null;
    new.account_status_changed_by := null;
  elsif tg_op = 'UPDATE' and coalesce(auth.role(), '') <> 'service_role' then
    new.account_status := old.account_status;
    new.account_status_changed_at := old.account_status_changed_at;
    new.account_status_changed_by := old.account_status_changed_by;
  end if;

  return new;
end;
$$;
