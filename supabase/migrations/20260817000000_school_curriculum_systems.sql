-- Curriculum systems are a required part of every new school request. Existing
-- schools remain untouched until their School Leader updates the value through
-- the scoped RPC below.

alter table public.schools
  add column if not exists curriculum_system text;

alter table public.schools
  drop constraint if exists schools_curriculum_system_check;

alter table public.schools
  add constraint schools_curriculum_system_check
  check (curriculum_system is null or curriculum_system in ('ap', 'ib', 'alevel', 'other'));

alter table public.league_applications
  add column if not exists curriculum_system text;

-- Historic applications predate the field. Mark them as Other rather than
-- guessing a programme for a school that has not yet confirmed its details.
update public.league_applications
set curriculum_system = 'other'
where curriculum_system is null;

alter table public.league_applications
  alter column curriculum_system set not null;

alter table public.league_applications
  drop constraint if exists league_applications_curriculum_system_check;

alter table public.league_applications
  add constraint league_applications_curriculum_system_check
  check (curriculum_system in ('ap', 'ib', 'alevel', 'other'));

create index if not exists schools_curriculum_system_idx
  on public.schools(curriculum_system)
  where curriculum_system is not null;

-- The link is safe to share: it derives the target school from the signed-in
-- user and this function repeats the School Leader permission check in SQL.
create or replace function public.update_league_school_curriculum(
  p_school_id uuid,
  p_curriculum_system text
)
returns public.schools
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_school public.schools%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_curriculum_system not in ('ap', 'ib', 'alevel', 'other') then
    raise exception 'Curriculum system must be AP, IB, A-Level or Other';
  end if;
  if not public.is_school_leader_for(p_school_id, auth.uid()) then
    raise exception 'Only this school''s School Leader can update its curriculum system';
  end if;

  update public.schools
  set curriculum_system = p_curriculum_system
  where id = p_school_id
  returning * into updated_school;

  if not found then raise exception 'School not found'; end if;
  return updated_school;
end;
$$;

revoke all on function public.update_league_school_curriculum(uuid, text) from public, anon;
grant execute on function public.update_league_school_curriculum(uuid, text) to authenticated;

-- Replace the original four-parameter onboarding RPC. The fifth argument is
-- intentionally required by the create-school branch, while school selection
-- and visitor onboarding remain unchanged.
drop function if exists public.complete_econmind_onboarding(text, uuid, text, text);
drop function if exists public.complete_econmind_onboarding(text, uuid, text, text, text);

create function public.complete_econmind_onboarding(
  p_path text,
  p_school_id uuid default null,
  p_school_name text default null,
  p_club_name text default null,
  p_curriculum_system text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_school public.schools%rowtype;
  display_name_value text;
  created_application_id uuid;
  clean_curriculum_system text := lower(trim(coalesce(p_curriculum_system, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_path not in ('school', 'create_school', 'visitor') then
    raise exception 'Choose an approved school, create a school application, or continue as a visitor';
  end if;

  if p_path = 'school' then
    if p_school_id is null then raise exception 'Choose an approved school'; end if;
    select * into selected_school from public.schools where id = p_school_id and status = 'approved';
    if not found then raise exception 'That school is not available for selection'; end if;
    update public.profiles
    set school_id = selected_school.id,
        onboarding_path = 'school',
        onboarding_completed_at = timezone('utc', now())
    where user_id = auth.uid();
    return jsonb_build_object('path', 'school', 'school_id', selected_school.id, 'school_name', selected_school.name);
  end if;

  if p_path = 'visitor' then
    update public.profiles
    set onboarding_path = 'visitor', onboarding_completed_at = timezone('utc', now())
    where user_id = auth.uid();
    return jsonb_build_object('path', 'visitor');
  end if;

  if p_school_name is null or char_length(trim(p_school_name)) not between 2 and 160 then
    raise exception 'Enter a school name between 2 and 160 characters';
  end if;
  if clean_curriculum_system not in ('ap', 'ib', 'alevel', 'other') then
    raise exception 'Choose AP, IB, A-Level or Other as the school curriculum system';
  end if;
  if exists (select 1 from public.schools where lower(name) = lower(trim(p_school_name)) and status = 'approved') then
    raise exception 'This school is already available. Choose it from the approved-school list.';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'EconMind member')
  into display_name_value
  from public.profiles
  where user_id = auth.uid();

  insert into public.league_applications (
    applicant_user_id, school_name, club_name, contact_person, curriculum_system,
    expected_teams, expected_members, preferred_language, preferred_format,
    organising_committee_interest, notes
  ) values (
    auth.uid(), trim(p_school_name), nullif(trim(coalesce(p_club_name, '')), ''), display_name_value, clean_curriculum_system,
    1, 7, 'English', 'either', false,
    'Created from the first-session account chooser.'
  ) returning id into created_application_id;

  update public.profiles
  set onboarding_path = 'create_school', onboarding_completed_at = timezone('utc', now())
  where user_id = auth.uid();

  return jsonb_build_object('path', 'create_school', 'application_id', created_application_id, 'status', 'submitted');
end;
$$;

revoke all on function public.complete_econmind_onboarding(text, uuid, text, text, text) from public, anon;
grant execute on function public.complete_econmind_onboarding(text, uuid, text, text, text) to authenticated;

-- When a new application is approved, its stated curriculum is copied to the
-- new school. If a pre-existing school identity is found, its confirmed value
-- remains authoritative.
create or replace function public.review_league_application(p_application_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.league_applications%rowtype;
  new_school_id uuid;
  existing_school public.schools%rowtype;
  application_identity_key text;
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_status not in ('approved', 'rejected', 'under_review') then raise exception 'Invalid application status'; end if;
  select * into application from public.league_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if application.status in ('approved', 'rejected') then raise exception 'This application has already been decided'; end if;

  if p_status = 'approved' then
    application_identity_key := public.econmind_school_identity_key(application.school_name);
    select * into existing_school
    from public.schools
    where status = 'approved'
      and public.econmind_school_identity_key(name) = application_identity_key
    order by created_at, id
    limit 1
    for update;

    if found then
      new_school_id := existing_school.id;
    else
      insert into public.schools(name, club_name, curriculum_system, status, created_by, liaison_user_id)
      values(
        coalesce(public.econmind_canonical_school_name(application_identity_key), application.school_name),
        application.club_name,
        application.curriculum_system,
        'approved',
        application.applicant_user_id,
        application.applicant_user_id
      )
      returning id into new_school_id;
    end if;

    update public.profiles
    set school_id = new_school_id, platform_role = 'school_leader'
    where user_id = application.applicant_user_id;
  end if;

  update public.league_applications
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = timezone('utc', now())
  where id = application.id;

  return jsonb_build_object('application_id', application.id, 'status', p_status, 'school_id', new_school_id);
end;
$$;

revoke all on function public.review_league_application(uuid, text) from public, anon;
grant execute on function public.review_league_application(uuid, text) to authenticated;
