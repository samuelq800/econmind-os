-- First-session account orientation. A person chooses how they want to enter
-- the platform without receiving a League role or a team assignment by default.

alter table public.profiles
  add column if not exists onboarding_path text check (onboarding_path in ('school', 'create_school', 'visitor')),
  add column if not exists onboarding_completed_at timestamptz;

create index if not exists profiles_onboarding_path_idx
  on public.profiles(onboarding_path)
  where onboarding_path is null;

-- Existing school members do not need to repeat the choice. Existing accounts
-- without a school will see the one-time chooser at their next sign-in.
update public.profiles
set onboarding_path = 'school',
    onboarding_completed_at = coalesce(onboarding_completed_at, timezone('utc', now()))
where school_id is not null
  and onboarding_path is null;

create or replace function public.list_approved_econmind_schools()
returns table (id uuid, name text, club_name text, city text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.club_name, s.city
  from public.schools s
  where s.status = 'approved'
  order by lower(s.name), s.created_at;
$$;

create or replace function public.complete_econmind_onboarding(
  p_path text,
  p_school_id uuid default null,
  p_school_name text default null,
  p_club_name text default null
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_path not in ('school', 'create_school', 'visitor') then
    raise exception 'Choose an approved school, create a school application, or continue as a visitor';
  end if;

  if p_path = 'school' then
    if p_school_id is null then
      raise exception 'Choose an approved school';
    end if;
    select * into selected_school
    from public.schools
    where id = p_school_id and status = 'approved';
    if not found then
      raise exception 'That school is not available for selection';
    end if;
    update public.profiles
    set school_id = selected_school.id,
        onboarding_path = 'school',
        onboarding_completed_at = timezone('utc', now())
    where user_id = auth.uid();
    return jsonb_build_object('path', 'school', 'school_id', selected_school.id, 'school_name', selected_school.name);
  end if;

  if p_path = 'visitor' then
    update public.profiles
    set onboarding_path = 'visitor',
        onboarding_completed_at = timezone('utc', now())
    where user_id = auth.uid();
    return jsonb_build_object('path', 'visitor');
  end if;

  if p_school_name is null or char_length(trim(p_school_name)) not between 2 and 160 then
    raise exception 'Enter a school name between 2 and 160 characters';
  end if;
  if exists (select 1 from public.schools where lower(name) = lower(trim(p_school_name)) and status = 'approved') then
    raise exception 'This school is already available. Choose it from the approved-school list.';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'EconMind member')
  into display_name_value
  from public.profiles
  where user_id = auth.uid();

  insert into public.league_applications (
    applicant_user_id, school_name, club_name, contact_person,
    expected_teams, expected_members, preferred_language, preferred_format,
    organising_committee_interest, notes
  ) values (
    auth.uid(), trim(p_school_name), nullif(trim(coalesce(p_club_name, '')), ''), display_name_value,
    1, 7, 'English', 'either', false,
    'Created from the first-session account chooser.'
  ) returning id into created_application_id;

  update public.profiles
  set onboarding_path = 'create_school',
      onboarding_completed_at = timezone('utc', now())
  where user_id = auth.uid();

  return jsonb_build_object('path', 'create_school', 'application_id', created_application_id, 'status', 'submitted');
end;
$$;

revoke all on function public.list_approved_econmind_schools() from public;
revoke all on function public.complete_econmind_onboarding(text, uuid, text, text) from public;
grant execute on function public.list_approved_econmind_schools() to authenticated;
grant execute on function public.complete_econmind_onboarding(text, uuid, text, text) to authenticated;
