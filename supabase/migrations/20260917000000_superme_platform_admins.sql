-- Superme Platform Admin is a narrow hierarchy above the existing
-- platform_admin role. It is deliberately separate from profiles.platform_role:
-- regular platform admins retain operational League access, while only the two
-- designated Superme accounts can inspect or change another administrator.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.superme_platform_admins (
  user_id uuid primary key references public.profiles(user_id) on delete restrict,
  designated_at timestamptz not null default timezone('utc', now())
);

revoke all on table private.superme_platform_admins from public, anon, authenticated;

do $bootstrap$
begin
  if (
    select count(*)
    from public.profiles
    where user_id in (
      'ffc87a95-f535-4781-9c2d-c2fac962ea9e'::uuid,
      '1396ed21-aef3-4827-a2b9-dd25d4be21a7'::uuid
    )
  ) <> 2 then
    raise exception 'Both designated Superme Platform Admin profiles must exist before this migration can run';
  end if;
end;
$bootstrap$;

insert into private.superme_platform_admins (user_id)
values
  ('ffc87a95-f535-4781-9c2d-c2fac962ea9e'::uuid),
  ('1396ed21-aef3-4827-a2b9-dd25d4be21a7'::uuid)
on conflict (user_id) do nothing;

update public.profiles
set platform_role = 'platform_admin'
where user_id in (
  'ffc87a95-f535-4781-9c2d-c2fac962ea9e'::uuid,
  '1396ed21-aef3-4827-a2b9-dd25d4be21a7'::uuid
);

-- profiles.platform_role is the canonical operational authority. The helper
-- table mirrors other roles for World features but must not preserve a stale
-- platform_admin grant after a demotion.
create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles profile
    where profile.user_id = p_user_id
      and profile.platform_role = 'platform_admin'
  )
$$;

create or replace function public.is_superme_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists(
    select 1
    from private.superme_platform_admins designation
    join public.profiles profile on profile.user_id = designation.user_id
    where designation.user_id = p_user_id
      and profile.platform_role = 'platform_admin'
  )
$$;

create or replace function public.has_platform_role(p_role text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_role = 'platform_admin' then public.is_platform_admin(p_user_id)
    else exists(
      select 1
      from public.profile_platform_roles role_assignment
      where role_assignment.user_id = p_user_id
        and role_assignment.role = p_role
    )
    or (p_role = 'teacher' and exists(select 1 from public.profiles profile where profile.user_id = p_user_id and profile.role = 'teacher'))
    or (p_role = 'league_participant' and exists(select 1 from public.profiles profile where profile.user_id = p_user_id and profile.platform_role = 'team_member'))
    or (p_role = 'league_admin' and exists(select 1 from public.profiles profile where profile.user_id = p_user_id and profile.platform_role = 'school_leader'))
  end
$$;

create or replace function public.sync_profile_platform_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profile_platform_roles
  where user_id = new.user_id
    and role in ('student', 'teacher', 'league_participant', 'league_admin', 'platform_admin');

  if new.role in ('student', 'teacher') then
    insert into public.profile_platform_roles(user_id, role)
    values (new.user_id, new.role)
    on conflict do nothing;
  end if;

  if new.platform_role = 'team_member' then
    insert into public.profile_platform_roles(user_id, role)
    values (new.user_id, 'league_participant')
    on conflict do nothing;
  elsif new.platform_role = 'school_leader' then
    insert into public.profile_platform_roles(user_id, role)
    values (new.user_id, 'league_admin')
    on conflict do nothing;
  elsif new.platform_role = 'platform_admin' then
    insert into public.profile_platform_roles(user_id, role)
    values (new.user_id, 'platform_admin')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

delete from public.profile_platform_roles role_assignment
where role_assignment.role = 'platform_admin'
  and not exists(
    select 1 from public.profiles profile
    where profile.user_id = role_assignment.user_id
      and profile.platform_role = 'platform_admin'
  );

create or replace function public.can_view_admin_dashboard_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id = auth.uid()
    or public.is_superme_platform_admin(auth.uid())
    or exists(
      select 1 from public.profiles profile
      where profile.user_id = p_user_id
        and profile.platform_role <> 'platform_admin'
    )
$$;

drop policy if exists profiles_league_admin_select on public.profiles;
create policy profiles_league_admin_select on public.profiles
for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  and public.can_view_admin_dashboard_profile(user_id)
);

drop policy if exists profile_platform_roles_read_own_or_admin on public.profile_platform_roles;
create policy profile_platform_roles_read_own_or_admin on public.profile_platform_roles
for select to authenticated
using (
  user_id = auth.uid()
  or (
    public.is_platform_admin(auth.uid())
    and public.can_view_admin_dashboard_profile(user_id)
  )
);

create or replace function public.set_league_platform_role(p_user_id uuid, p_platform_role text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_platform_role text;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  if p_platform_role not in ('user', 'team_member', 'school_leader', 'platform_admin') then
    raise exception 'Invalid platform role';
  end if;

  select platform_role
  into current_platform_role
  from public.profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if current_platform_role = 'platform_admin' or p_platform_role = 'platform_admin' then
    if not public.is_superme_platform_admin(auth.uid()) then
      raise exception 'Only a Superme Platform Admin can view or change administrator roles';
    end if;
    if exists(select 1 from private.superme_platform_admins where user_id = p_user_id) then
      raise exception 'The Superme Platform Admin designation is protected';
    end if;
  end if;

  if current_platform_role = p_platform_role then
    return;
  end if;

  update public.profiles
  set platform_role = p_platform_role
  where user_id = p_user_id;

  insert into public.moderation_actions(
    actor_user_id,
    target_type,
    target_reference,
    action,
    outcome
  ) values (
    auth.uid(),
    'profile',
    p_user_id::text,
    'platform_role_changed',
    format('Platform role changed from %s to %s.', current_platform_role, p_platform_role)
  );
end;
$$;

create or replace function public.set_econmind_academic_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_platform_role text;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  if p_role not in ('student', 'teacher', 'professor') then
    raise exception 'Invalid academic role';
  end if;

  select platform_role into target_platform_role
  from public.profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;
  if target_platform_role = 'platform_admin'
    and not public.is_superme_platform_admin(auth.uid()) then
    raise exception 'Only a Superme Platform Admin can view or change administrator roles';
  end if;

  update public.profiles
  set role = p_role
  where user_id = p_user_id;
end;
$$;

-- This previously granted a second route to platform_admin through the
-- multi-role helper table. Keep its existing non-admin behavior, but route
-- administrator changes through the hierarchy-aware function above.
create or replace function public.set_platform_role_assignment(
  p_user_id uuid,
  p_role text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  if p_role not in ('student', 'teacher', 'league_participant', 'league_admin', 'platform_admin') then
    raise exception 'Invalid platform role';
  end if;

  if p_role = 'platform_admin' then
    perform public.set_league_platform_role(
      p_user_id,
      case when p_enabled then 'platform_admin' else 'user' end
    );
    return;
  end if;

  if p_enabled then
    insert into public.profile_platform_roles(user_id, role, assigned_by)
    values (p_user_id, p_role, auth.uid())
    on conflict do nothing;
  else
    delete from public.profile_platform_roles
    where user_id = p_user_id and role = p_role;
  end if;
end;
$$;

drop policy if exists moderation_actions_admin_select on public.moderation_actions;
create policy moderation_actions_admin_select on public.moderation_actions
for select to authenticated
using (
  public.is_superme_platform_admin(auth.uid())
  or (
    public.is_platform_admin(auth.uid())
    and action <> 'platform_role_changed'
  )
);

revoke all on function public.is_superme_platform_admin(uuid), public.can_view_admin_dashboard_profile(uuid) from public, anon;
grant execute on function public.is_superme_platform_admin(uuid), public.can_view_admin_dashboard_profile(uuid) to authenticated;

