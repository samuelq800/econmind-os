-- World Economy uses team-owned authority. Teachers may continue to perform
-- their non-World teaching duties, but they no longer have cross-country
-- administration or manual shock-injection authority in this simulation.

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
      and profile.platform_role = 'platform_admin'
  )
$$;
