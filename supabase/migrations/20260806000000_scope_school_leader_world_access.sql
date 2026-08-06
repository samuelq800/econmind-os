-- School Leaders supervise only the World country controlled by a Team from
-- their own school. Teachers and platform administrators remain global World
-- supervisors. This replaces the earlier legacy mapping that treated every
-- school_leader profile as a global league administrator.

create or replace function public.can_administer_continuous_world(
  p_world_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles profile
    where profile.user_id = p_user_id
      and (
        profile.platform_role = 'platform_admin'
        or profile.role = 'teacher'
      )
  )
$$;

create or replace function public.can_manage_continuous_world_country(
  p_world_id uuid,
  p_country_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_administer_continuous_world(p_world_id, p_user_id)
    or exists(
      select 1
      from public.continuous_world_country_teams country_team
      join public.teams team on team.id = country_team.team_id
      where country_team.world_id = p_world_id
        and country_team.country_key = p_country_key
        and public.is_school_leader_for(team.school_id, p_user_id)
    )
$$;

create or replace function public.can_act_for_continuous_world_country(
  p_world_id uuid,
  p_country_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_continuous_world_country(
      p_world_id,
      p_country_key,
      p_user_id
    )
    or exists(
      select 1
      from public.continuous_world_role_assignments role_assignment
      join public.continuous_world_memberships membership
        on membership.world_id = role_assignment.world_id
       and membership.user_id = role_assignment.user_id
       and membership.membership_status = 'active'
      where role_assignment.world_id = p_world_id
        and role_assignment.country_key = p_country_key
        and role_assignment.user_id = p_user_id
        and public.is_continuous_world_team_member(
          p_world_id,
          p_country_key,
          p_user_id
        )
    )
$$;

create or replace function public.continuous_world_has_role(
  p_world_id uuid,
  p_country_key text,
  p_role text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_continuous_world_country(
      p_world_id,
      p_country_key,
      p_user_id
    )
    or exists(
      select 1
      from public.continuous_world_role_assignments role_assignment
      where role_assignment.world_id = p_world_id
        and role_assignment.country_key = p_country_key
        and role_assignment.user_id = p_user_id
        and role_assignment.role_type = p_role
        and public.is_continuous_world_team_member(
          p_world_id,
          p_country_key,
          p_user_id
        )
    )
$$;

-- A School Leader can claim an unoccupied country for a Team at their own
-- school. The check deliberately uses the candidate Team's school because no
-- country-to-Team row exists until the claim succeeds.
create or replace function public.claim_continuous_world_country(
  p_world_id uuid,
  p_country_key text
)
returns public.continuous_world_country_teams
language plpgsql
security definer
set search_path = public
as $$
declare assigned public.continuous_world_country_teams%rowtype; team uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  team := public.continuous_world_team_for_user(auth.uid());
  if team is null then raise exception 'An approved League team is required'; end if;
  if not exists(
    select 1
    from public.team_members
    where team_id = team and user_id = auth.uid() and team_role = 'captain'
  )
  and not exists(
    select 1
    from public.teams
    where id = team and public.is_school_leader_for(school_id, auth.uid())
  )
  and not public.can_administer_continuous_world(p_world_id, auth.uid()) then
    raise exception 'Only the Team captain, its School Leader, or a World supervisor may claim a country';
  end if;
  perform public.join_continuous_world(p_world_id);
  if not exists(
    select 1
    from public.continuous_worlds world_row
    cross join lateral jsonb_array_elements(
      coalesce(world_row.current_state -> 'countries', '[]'::jsonb)
    ) country
    where world_row.id = p_world_id and country ->> 'id' = p_country_key
  ) then raise exception 'Unknown fictional country'; end if;
  insert into public.continuous_world_country_teams(world_id, country_key, team_id, claimed_by)
  values(p_world_id, p_country_key, team, auth.uid())
  returning * into assigned;
  insert into public.continuous_world_role_assignments(world_id, country_key, user_id, role_type, assigned_by)
  values(p_world_id, p_country_key, auth.uid(), 'country_captain', auth.uid())
  on conflict (world_id, country_key, role_type) do nothing;
  insert into public.continuous_world_events(world_id, country_key, event_type, payload, created_by)
  values(
    p_world_id,
    p_country_key,
    'notice',
    jsonb_build_object('message', 'A League team claimed this country.', 'team_id', team),
    auth.uid()
  );
  return assigned;
end;
$$;

create or replace function public.claim_continuous_world_role(
  p_world_id uuid,
  p_country_key text,
  p_role_type text
)
returns public.continuous_world_role_assignments
language plpgsql
security definer
set search_path = public
as $$
declare role_assignment public.continuous_world_role_assignments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_type not in (
    'country_captain',
    'central_bank_governor',
    'economic_policy_minister',
    'trade_minister',
    'infrastructure_investment_minister',
    'social_labour_minister'
  ) then raise exception 'Invalid world role'; end if;
  perform public.join_continuous_world(p_world_id);
  if not public.is_continuous_world_team_member(
    p_world_id,
    p_country_key,
    auth.uid()
  )
  and not public.can_manage_continuous_world_country(
    p_world_id,
    p_country_key,
    auth.uid()
  ) then
    raise exception 'Your League team does not control this country';
  end if;
  insert into public.continuous_world_role_assignments(
    world_id,
    country_key,
    user_id,
    role_type,
    assigned_by
  )
  values(p_world_id, p_country_key, auth.uid(), p_role_type, auth.uid())
  returning * into role_assignment;
  return role_assignment;
end;
$$;

revoke all on function public.can_manage_continuous_world_country(uuid, text, uuid) from public, anon;
grant execute on function public.can_manage_continuous_world_country(uuid, text, uuid) to authenticated;
