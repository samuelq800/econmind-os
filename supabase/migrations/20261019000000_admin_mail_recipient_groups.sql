-- Additive read-only directory. Existing mail RPC, sender and send limits stay intact.
begin;

create or replace function public.admin_mail_recipient_directory(p_after uuid default null)
returns table(user_id uuid, display_name text, email text, school_id uuid, school_name text, groups text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_admin(auth.uid()), false) then
    raise exception 'Platform administrator access required' using errcode = '42501';
  end if;
  return query
  with page as (
    -- Preserve the existing directory's eligibility, including accounts still completing setup.
    select p.user_id, p.display_name, u.email::text as email, p.school_id,
      s.name as school_name, p.onboarding_path, p.platform_role, p.role
    from public.profiles p join auth.users u on u.id = p.user_id
    left join public.schools s on s.id = p.school_id
    where (p_after is null or p.user_id > p_after)
      and u.email is not null and u.email <> '' and u.deleted_at is null
    order by p.user_id limit 200
  )
  select p.user_id, p.display_name, p.email, p.school_id, p.school_name,
    array_remove(array[
      case when founder.created_team then 'season1_team_founders' end,
      case when membership.member or free_agent.available then 'season1_participants' end,
      case when membership.member then 'season1_team_members' end,
      case when free_agent.available then 'season1_free_agents' end,
      case when p.school_id is not null then 'school_participants' end,
      case when p.school_id is null and p.onboarding_path = 'visitor' then 'individual_participants' end,
      case when p.platform_role = 'school_leader' then 'school_leaders' end,
      case when p.role in ('teacher','professor') then 'teachers_professors' end
    ], null)::text[]
  from page p
  cross join lateral (
    select count(*) > 0 as member
    from public.world_preseason_team_members m
    join public.world_preseason_teams t on t.id = m.team_id and t.season_id = m.season_id
    join public.world_preseason_seasons season on season.id = t.season_id
    where m.user_id = p.user_id and season.code = 'season-1' and t.status <> 'dissolved'
  ) membership
  cross join lateral (
    -- Original creator, not current captain or a self-declared role preference.
    select exists (
      select 1 from public.world_preseason_teams t
      join public.world_preseason_seasons season on season.id = t.season_id
      where t.created_by = p.user_id and season.code = 'season-1' and t.status <> 'dissolved'
    ) as created_team
  ) founder
  cross join lateral (
    select not membership.member and exists (
      select 1 from public.world_preseason_free_agents f
      join public.world_preseason_seasons season on season.id = f.season_id
      where f.user_id = p.user_id and season.code = 'season-1' and f.availability_status = 'available'
    ) as available
  ) free_agent
  order by p.user_id;
end;
$$;

revoke all on function public.admin_mail_recipient_directory(uuid) from public, anon, authenticated;
grant execute on function public.admin_mail_recipient_directory(uuid) to authenticated;
comment on function public.admin_mail_recipient_directory(uuid) is
  'Platform-admin-only email directory, paginated by user ID. Overlapping recipient groups reflect current Season 1 membership and profile school affiliation. Does not send mail.';

commit;
