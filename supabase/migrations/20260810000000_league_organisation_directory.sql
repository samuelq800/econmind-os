-- League organisation layer: public school/team identity cards plus a small
-- School Leader profile editor. This does not alter simulations, attempts,
-- scoring, World Economy, or their existing RLS policies.

alter table public.schools
  add column if not exists description text
    check (description is null or char_length(trim(description)) <= 1200),
  add column if not exists logo_url text
    check (logo_url is null or char_length(trim(logo_url)) <= 1000);

create or replace function public.update_league_school_profile(
  p_school_id uuid,
  p_description text,
  p_logo_url text default null
)
returns public.schools
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_school public.schools%rowtype;
  clean_description text := nullif(trim(coalesce(p_description, '')), '');
  clean_logo_url text := nullif(trim(coalesce(p_logo_url, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.is_platform_admin(auth.uid()) or public.is_school_leader_for(p_school_id, auth.uid())) then
    raise exception 'Only this school''s School Leader or a platform administrator can update its profile';
  end if;
  if clean_description is not null and char_length(clean_description) > 1200 then
    raise exception 'School descriptions must be 1200 characters or fewer';
  end if;
  if clean_logo_url is not null and clean_logo_url !~* '^https?://' then
    raise exception 'School logo URLs must use https:// or http://';
  end if;
  update public.schools
  set description = clean_description,
      logo_url = clean_logo_url
  where id = p_school_id
  returning * into updated_school;
  if not found then raise exception 'School not found'; end if;
  return updated_school;
end;
$$;

-- The public directory deliberately returns aggregates and the elected Team
-- captain display name only. It does not make profiles, emails, invite codes,
-- role assignments, or in-progress decisions publicly readable.
create or replace function public.get_public_league_directory()
returns table(
  school_id uuid,
  school_name text,
  club_name text,
  city text,
  description text,
  logo_url text,
  member_count bigint,
  team_count bigint,
  current_season_points numeric,
  official_challenge_count bigint,
  official_wins bigint,
  achievements jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with active_season as (
    select id
    from public.league_seasons
    where status = 'active'
    order by starts_at nulls last, created_at desc
    limit 1
  ), member_totals as (
    select team.school_id, count(member.id)::bigint as member_count
    from public.teams team
    left join public.team_members member on member.team_id = team.id
    where team.status = 'active'
    group by team.school_id
  ), team_totals as (
    select school_id, count(*)::bigint as team_count
    from public.teams
    where status = 'active'
    group by school_id
  ), team_challenge_best as (
    select distinct on (attempt.team_id, attempt.challenge_id)
      attempt.school_id,
      attempt.team_id,
      attempt.challenge_id,
      attempt.final_score
    from public.league_challenge_attempts attempt
    join public.league_challenges challenge on challenge.id = attempt.challenge_id
    join active_season season on season.id = challenge.season_id
    where attempt.mode = 'official'
      and attempt.status = 'submitted'
    order by attempt.team_id, attempt.challenge_id, attempt.final_score desc, attempt.submitted_at asc
  ), ranked_challenges as (
    select team_challenge_best.*,
      rank() over(partition by challenge_id order by final_score desc) as challenge_rank
    from team_challenge_best
  ), season_totals as (
    select school_id,
      coalesce(sum(final_score), 0)::numeric as season_points,
      count(*)::bigint as official_challenge_count,
      count(*) filter (where challenge_rank = 1)::bigint as official_wins
    from ranked_challenges
    group by school_id
  )
  select school.id,
    school.name,
    school.club_name,
    school.city,
    school.description,
    school.logo_url,
    coalesce(member_totals.member_count, 0),
    coalesce(team_totals.team_count, 0),
    coalesce(season_totals.season_points, 0),
    coalesce(season_totals.official_challenge_count, 0),
    coalesce(season_totals.official_wins, 0),
    case when coalesce(season_totals.official_wins, 0) > 0
      then jsonb_build_array('Official Win', 'Official Participation')
      when coalesce(season_totals.official_challenge_count, 0) > 0
        then jsonb_build_array('Official Participation')
      else '[]'::jsonb
    end
  from public.schools school
  left join member_totals on member_totals.school_id = school.id
  left join team_totals on team_totals.school_id = school.id
  left join season_totals on season_totals.school_id = school.id
  where school.status = 'approved'
  order by school.name;
$$;

create or replace function public.get_public_league_teams()
returns table(
  team_id uuid,
  team_name text,
  team_slug text,
  school_id uuid,
  school_name text,
  captain_name text,
  member_count bigint,
  current_season_points numeric,
  official_challenge_count bigint,
  official_wins bigint,
  continuous_world_country text
)
language sql
stable
security definer
set search_path = public
as $$
  with active_season as (
    select id
    from public.league_seasons
    where status = 'active'
    order by starts_at nulls last, created_at desc
    limit 1
  ), member_totals as (
    select team_id, count(*)::bigint as member_count
    from public.team_members
    group by team_id
  ), team_challenge_best as (
    select distinct on (attempt.team_id, attempt.challenge_id)
      attempt.team_id,
      attempt.challenge_id,
      attempt.final_score
    from public.league_challenge_attempts attempt
    join public.league_challenges challenge on challenge.id = attempt.challenge_id
    join active_season season on season.id = challenge.season_id
    where attempt.mode = 'official'
      and attempt.status = 'submitted'
    order by attempt.team_id, attempt.challenge_id, attempt.final_score desc, attempt.submitted_at asc
  ), ranked_challenges as (
    select team_challenge_best.*,
      rank() over(partition by challenge_id order by final_score desc) as challenge_rank
    from team_challenge_best
  ), season_totals as (
    select team_id,
      coalesce(sum(final_score), 0)::numeric as season_points,
      count(*)::bigint as official_challenge_count,
      count(*) filter (where challenge_rank = 1)::bigint as official_wins
    from ranked_challenges
    group by team_id
  ), current_country as (
    select distinct on (country_team.team_id)
      country_team.team_id,
      country_team.country_key
    from public.continuous_world_country_teams country_team
    join public.continuous_worlds world on world.id = country_team.world_id
    where country_team.released_at is null and world.status in ('running', 'paused')
    order by country_team.team_id, country_team.claimed_at desc
  )
  select team.id,
    team.name,
    team.slug,
    school.id,
    school.name,
    captain.display_name,
    coalesce(member_totals.member_count, 0),
    coalesce(season_totals.season_points, 0),
    coalesce(season_totals.official_challenge_count, 0),
    coalesce(season_totals.official_wins, 0),
    current_country.country_key
  from public.teams team
  join public.schools school on school.id = team.school_id and school.status = 'approved'
  left join public.profiles captain on captain.user_id = team.captain_user_id
  left join member_totals on member_totals.team_id = team.id
  left join season_totals on season_totals.team_id = team.id
  left join current_country on current_country.team_id = team.id
  where team.status = 'active'
  order by school.name, team.name;
$$;

revoke all on function public.update_league_school_profile(uuid, text, text) from public, anon;
grant execute on function public.update_league_school_profile(uuid, text, text) to authenticated;
revoke all on function public.get_public_league_directory() from public;
revoke all on function public.get_public_league_teams() from public;
grant execute on function public.get_public_league_directory(), public.get_public_league_teams() to anon, authenticated;
