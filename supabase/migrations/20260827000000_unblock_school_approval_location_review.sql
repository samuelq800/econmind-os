-- School membership approval and map verification answer different questions.
-- A platform administrator may approve an otherwise valid school application
-- without completing the optional city-level map review. Unverified schools
-- remain out of the public map until a later, independently evidenced review.

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
  selected_location public.school_location_catalog%rowtype;
  application_identity_key text;
  application_location_verified boolean := false;
  previous_school_location_status text := null;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  if p_status not in ('approved', 'rejected', 'under_review') then
    raise exception 'Invalid application status';
  end if;

  select * into application
  from public.league_applications
  where id = p_application_id
  for update;
  if not found then raise exception 'Application not found'; end if;
  if application.status in ('approved', 'rejected') then
    raise exception 'This application has already been decided';
  end if;

  if p_status = 'approved' then
    application_location_verified := application.location_status = 'verified'
      and application.location_key is not null;

    if application_location_verified then
      select * into selected_location
      from public.school_location_catalog
      where location_key = application.location_key;
      if not found then
        raise exception 'Verified location is not available in the canonical catalog';
      end if;
    end if;

    application_identity_key := public.econmind_school_identity_key(application.school_name);
    perform pg_advisory_xact_lock(hashtextextended('league-school:' || application_identity_key, 0));

    select * into existing_school
    from public.schools
    where status = 'approved'
      and public.econmind_school_identity_key(name) = application_identity_key
    order by created_at, id
    limit 1
    for update;

    if found then
      new_school_id := existing_school.id;
      previous_school_location_status := existing_school.location_status;

      if application_location_verified then
        if existing_school.location_status = 'verified'
          and existing_school.location_key is distinct from application.location_key then
          raise exception 'The approved school already has a different verified location';
        end if;

        if existing_school.location_status <> 'verified' then
          update public.schools
          set city = selected_location.city,
              location_status = 'verified',
              location_key = selected_location.location_key,
              location_source = 'application_review',
              location_public_note = null,
              location_verified_by = application.location_reviewed_by,
              location_verified_at = application.location_reviewed_at
          where id = existing_school.id;
        end if;
      end if;
    else
      insert into public.schools(
        name, club_name, city, curriculum_system, status, created_by,
        liaison_user_id, location_status, location_key, location_source,
        location_verified_by, location_verified_at
      ) values (
        coalesce(public.econmind_canonical_school_name(application_identity_key), application.school_name),
        application.club_name,
        case when application_location_verified then selected_location.city else nullif(trim(application.submitted_city), '') end,
        application.curriculum_system,
        'approved',
        application.applicant_user_id,
        application.applicant_user_id,
        case when application_location_verified then 'verified' else 'missing' end,
        case when application_location_verified then selected_location.location_key else null end,
        case when application_location_verified then 'application_review' else null end,
        case when application_location_verified then application.location_reviewed_by else null end,
        case when application_location_verified then application.location_reviewed_at else null end
      ) returning id into new_school_id;
    end if;

    insert into public.school_location_review_events(
      application_id, school_id, event_type, from_status, to_status,
      location_key, actor_user_id, payload
    ) values (
      application.id,
      new_school_id,
      'application_applied',
      previous_school_location_status,
      case when application_location_verified then 'verified' else 'missing' end,
      case when application_location_verified then selected_location.location_key else null end,
      auth.uid(),
      jsonb_build_object(
        'application_status', 'approved',
        'location_review_required', not application_location_verified
      )
    );

    update public.profiles
    set school_id = new_school_id,
        platform_role = 'school_leader'
    where user_id = application.applicant_user_id;
  end if;

  update public.league_applications
  set status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = timezone('utc', now())
  where id = application.id;

  return jsonb_build_object(
    'application_id', application.id,
    'status', p_status,
    'school_id', new_school_id
  );
end;
$$;
