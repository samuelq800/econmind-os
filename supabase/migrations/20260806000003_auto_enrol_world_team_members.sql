-- A Team owns one World country. Claiming it enrols every existing Team member
-- immediately; members added later are enrolled by the complementary trigger.
-- Enrolment grants visibility and the ability to claim a vacant office only.
-- It never grants policy authority without a role assignment.

create or replace function public.enrol_claimed_team_in_continuous_world()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.continuous_world_memberships(
    world_id,
    user_id,
    membership_status
  )
  select new.world_id, team_member.user_id, 'active'
  from public.team_members team_member
  where team_member.team_id = new.team_id
  on conflict (world_id, user_id) do update
    set membership_status = 'active';
  return new;
end;
$$;

drop trigger if exists continuous_world_country_teams_enrol_members
  on public.continuous_world_country_teams;
create trigger continuous_world_country_teams_enrol_members
after insert on public.continuous_world_country_teams
for each row execute function public.enrol_claimed_team_in_continuous_world();

-- Backfill existing Team-controlled countries so the rule also applies to
-- countries claimed before this migration was installed.
insert into public.continuous_world_memberships(
  world_id,
  user_id,
  membership_status
)
select country_team.world_id, team_member.user_id, 'active'
from public.continuous_world_country_teams country_team
join public.team_members team_member
  on team_member.team_id = country_team.team_id
on conflict (world_id, user_id) do update
  set membership_status = 'active';

create or replace function public.enrol_new_team_member_in_claimed_worlds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.continuous_world_memberships(
    world_id,
    user_id,
    membership_status
  )
  select country_team.world_id, new.user_id, 'active'
  from public.continuous_world_country_teams country_team
  join public.continuous_worlds world_row
    on world_row.id = country_team.world_id
  where country_team.team_id = new.team_id
    and world_row.status in ('running', 'paused')
  on conflict (world_id, user_id) do update
    set membership_status = 'active';
  return new;
end;
$$;

drop trigger if exists team_members_enrol_claimed_worlds on public.team_members;
create trigger team_members_enrol_claimed_worlds
after insert on public.team_members
for each row execute function public.enrol_new_team_member_in_claimed_worlds();

-- The live World interface has seven published portfolios. Restore the seventh
-- one here because the earlier permission-repair migration intentionally
-- narrowed the list while fixing supervisor authority.
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
declare
  role_assignment public.continuous_world_role_assignments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_type not in (
    'country_captain', 'central_bank_governor', 'economic_policy_minister',
    'trade_minister', 'infrastructure_investment_minister',
    'social_labour_minister', 'research_innovation_minister'
  ) then raise exception 'Invalid world role'; end if;
  perform public.join_continuous_world(p_world_id);
  if not public.is_continuous_world_team_member(
    p_world_id, p_country_key, auth.uid()
  ) and not public.can_manage_continuous_world_country(
    p_world_id, p_country_key, auth.uid()
  ) then raise exception 'Your League team does not control this country'; end if;
  insert into public.continuous_world_role_assignments(
    world_id, country_key, user_id, role_type, assigned_by
  ) values(p_world_id, p_country_key, auth.uid(), p_role_type, auth.uid())
  returning * into role_assignment;
  return role_assignment;
end;
$$;
