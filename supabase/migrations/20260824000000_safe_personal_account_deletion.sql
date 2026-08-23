-- Safe, atomic self-service account deletion.
--
-- A browser must never delete public.profiles directly: doing so removes app
-- data while leaving auth.users able to sign in. All deletion now goes through
-- one SECURITY DEFINER transaction that derives the target from auth.uid(),
-- locks both identity rows, re-checks every blocker, removes private support
-- correspondence, and finally hard-deletes the Auth user.

drop policy if exists "profiles_delete_own" on public.profiles;
revoke delete on public.profiles from authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.account_deletion_blockers(p_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  blockers text[] := array[]::text[];
  account_profile public.profiles%rowtype;
begin
  select * into account_profile
  from public.profiles
  where user_id = p_user_id;

  if not found then
    return array['profile_missing'];
  end if;

  -- Self-service deletion is deliberately limited to ordinary personal
  -- accounts. Teacher, Professor and administrative ownership can include
  -- other people's work, so those accounts continue through support review.
  if account_profile.role <> 'student'
    or account_profile.platform_role <> 'user'
    or exists (
      select 1 from public.profile_platform_roles helper
      where helper.user_id = p_user_id and helper.role <> 'student'
    )
  then
    blockers := array_append(blockers, 'privileged_role');
  end if;

  if account_profile.school_id is not null
    or exists (select 1 from public.schools school where school.liaison_user_id = p_user_id)
    or exists (
      select 1 from public.league_applications application
      where application.applicant_user_id = p_user_id and application.status = 'approved'
    )
  then
    blockers := array_append(blockers, 'school_affiliation');
  end if;

  if exists (select 1 from public.team_members member where member.user_id = p_user_id)
    or exists (select 1 from public.teams team where team.captain_user_id = p_user_id)
  then
    blockers := array_append(blockers, 'team_membership');
  end if;

  if exists (select 1 from public.competition_roles role_assignment where role_assignment.user_id = p_user_id)
    or exists (select 1 from public.scenario_editor_access editor_access where editor_access.user_id = p_user_id)
    or exists (select 1 from public.league_challenge_role_assignments role_assignment where role_assignment.user_id = p_user_id)
  then
    blockers := array_append(blockers, 'league_assignment');
  end if;

  if exists (
      select 1 from public.continuous_world_memberships membership
      where membership.user_id = p_user_id and membership.membership_status <> 'left'
    )
    or exists (select 1 from public.continuous_world_role_assignments role_assignment where role_assignment.user_id = p_user_id)
  then
    blockers := array_append(blockers, 'world_membership');
  end if;

  -- These references use ON DELETE RESTRICT because they preserve shared
  -- simulations. Treat them as an organisational responsibility instead of
  -- altering or deleting shared records during self-service deletion.
  if exists (select 1 from public.institution_drafts draft where draft.created_by = p_user_id)
    or exists (select 1 from public.continuous_world_actions action where action.submitted_by = p_user_id)
    or exists (select 1 from public.continuous_world_country_teams country_team where country_team.claimed_by = p_user_id)
    or exists (select 1 from public.continuous_world_contracts contract where contract.submitted_by = p_user_id)
    or exists (select 1 from public.continuous_world_cabinet_proposals proposal where proposal.created_by = p_user_id)
    or exists (select 1 from public.continuous_world_budget_requests request where request.created_by = p_user_id)
    or exists (select 1 from public.league_challenge_attempts attempt where attempt.started_by = p_user_id)
    or exists (select 1 from public.league_challenge_stage_decisions decision where decision.locked_by = p_user_id)
  then
    blockers := array_append(blockers, 'shared_league_history');
  end if;

  if exists (select 1 from public.experiments experiment where experiment.teacher_id = p_user_id)
    or exists (select 1 from public.professor_projects project where project.professor_id = p_user_id)
    or exists (
      select 1 from public.model_compositions composition
      where composition.user_id = p_user_id and composition.status = 'published'
    )
  then
    blockers := array_append(blockers, 'shared_authored_content');
  end if;

  return blockers;
end;
$$;

create or replace function public.get_self_account_deletion_eligibility()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  blockers text[];
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;

  blockers := private.account_deletion_blockers(account_id);
  return jsonb_build_object(
    'eligible', cardinality(blockers) = 0,
    'blockers', to_jsonb(blockers)
  );
end;
$$;

create or replace function public.delete_self_personal_account(p_confirmation text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  account_email text;
  blockers text[];
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;

  -- The locks also serialize concurrent school/team joins that reference
  -- either row, closing the gap between eligibility checking and deletion.
  select email into account_email
  from auth.users
  where id = account_id
  for update;
  if not found then
    raise exception 'Authenticated account no longer exists';
  end if;

  perform 1
  from public.profiles
  where user_id = account_id
  for update;
  if not found then
    raise exception 'Account profile is unavailable';
  end if;

  if account_email is null
    or lower(btrim(coalesce(p_confirmation, ''))) <> lower('DELETE ' || account_email)
  then
    raise exception 'Confirmation text does not match this account';
  end if;

  blockers := private.account_deletion_blockers(account_id);
  if cardinality(blockers) > 0 then
    raise exception 'This account is not eligible for self-service deletion'
      using detail = array_to_string(blockers, ',');
  end if;

  -- Support messages and administrator notes can contain personal details.
  -- Remove both sides of that correspondence before the profile cascade. All
  -- statements remain in this transaction and roll back if Auth deletion or
  -- any unknown foreign-key constraint fails.
  delete from public.moderation_actions action
  where action.support_request_id in (
    select request.id from public.support_requests request where request.user_id = account_id
  );
  delete from public.support_requests request where request.user_id = account_id;

  delete from auth.users where id = account_id;
  if not found then
    raise exception 'Account deletion did not complete';
  end if;

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function private.account_deletion_blockers(uuid) from public, anon, authenticated;
revoke all on function public.get_self_account_deletion_eligibility() from public, anon, authenticated;
revoke all on function public.delete_self_personal_account(text) from public, anon, authenticated;
grant execute on function public.get_self_account_deletion_eligibility() to authenticated;
grant execute on function public.delete_self_personal_account(text) to authenticated;

comment on function public.get_self_account_deletion_eligibility() is
  'Returns blocker codes for the signed-in account without exposing organisation identifiers.';
comment on function public.delete_self_personal_account(text) is
  'Atomically hard-deletes only the signed-in standard personal account after server-side eligibility and confirmation checks.';
