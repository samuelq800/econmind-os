-- Register the requested university partners in the public League directory.
-- Map points are reviewed city centroids, never campus addresses.  The profile
-- links below deliberately preserve the users' existing platform roles.

insert into public.school_location_catalog (
  location_key,
  geoname_id,
  city,
  area_key,
  area_label,
  administrative_area,
  latitude,
  longitude,
  source_name,
  source_snapshot_date,
  source_url
)
values
  ('geonames:2653941', 2653941, 'Cambridge', 'geoarea:GB', 'United Kingdom', 'England', 52.2, 0.1166667, 'GeoNames', date '2026-09-10', 'https://www.geonames.org/2653941/'),
  ('geonames:4464368', 4464368, 'Durham', 'geoarea:US', 'United States', 'North Carolina', 35.9940329, -78.898619, 'GeoNames', date '2026-09-10', 'https://www.geonames.org/4464368/'),
  ('geonames:5368361', 5368361, 'Los Angeles', 'geoarea:US', 'United States', 'California', 34.0522342, -118.2436849, 'GeoNames', date '2026-09-10', 'https://www.geonames.org/5368361/')
on conflict (location_key) do update
set geoname_id = excluded.geoname_id,
    city = excluded.city,
    area_key = excluded.area_key,
    area_label = excluded.area_label,
    administrative_area = excluded.administrative_area,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    source_name = excluded.source_name,
    source_snapshot_date = excluded.source_snapshot_date,
    source_url = excluded.source_url;

do $$
declare
  university record;
  resolved_school public.schools%rowtype;
  resolved_user_id uuid;
  matching_profile_count integer;
begin
  for university in
    select *
    from (
      values
        ('Shanghai International Studies University', 'Shanghai', 'geonames:1796236'),
        ('The University of Melbourne', 'Melbourne', 'geonames:2158177'),
        ('Duke University', 'Durham', 'geonames:4464368'),
        ('University of Cambridge', 'Cambridge', 'geonames:2653941'),
        ('UCLA', 'Los Angeles', 'geonames:5368361')
    ) as university(name, city, location_key)
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('league-school:' || public.econmind_school_identity_key(university.name), 0)
    );

    select * into resolved_school
    from public.schools
    where public.econmind_school_identity_key(name) = public.econmind_school_identity_key(university.name)
    order by (status = 'approved') desc, created_at, id
    limit 1
    for update;

    if not found then
      insert into public.schools (
        name,
        city,
        curriculum_system,
        status,
        location_status,
        location_key,
        location_source,
        location_verified_at
      ) values (
        university.name,
        university.city,
        'other',
        'approved',
        'verified',
        university.location_key,
        'verified_roster_backfill',
        timezone('utc', now())
      )
      returning * into resolved_school;
    else
      update public.schools
      set name = university.name,
          city = university.city,
          curriculum_system = coalesce(curriculum_system, 'other'),
          status = 'approved',
          location_status = 'verified',
          location_key = university.location_key,
          location_source = 'verified_roster_backfill',
          location_public_note = null,
          location_verified_at = timezone('utc', now())
      where id = resolved_school.id
      returning * into resolved_school;
    end if;

    insert into public.school_location_review_events (
      school_id,
      event_type,
      from_status,
      to_status,
      location_key,
      note,
      payload
    ) values (
      resolved_school.id,
      'verified',
      null,
      'verified',
      university.location_key,
      'University partner added to the reviewed public city register.',
      jsonb_build_object('source', 'university_partner_registration')
    );
  end loop;

  for university in
    select *
    from (
      values
        ('Leo', 'University of Cambridge'),
        ('Joanna Zou', 'UCLA')
    ) as university(display_name, school_name)
  loop
    select count(*), (array_agg(user_id order by user_id))[1]
    into matching_profile_count, resolved_user_id
    from public.profiles
    where lower(trim(display_name)) = lower(university.display_name);

    if matching_profile_count <> 1 then
      raise exception 'Expected exactly one profile named %, found %', university.display_name, matching_profile_count;
    end if;

    select id into resolved_school.id
    from public.schools
    where status = 'approved'
      and public.econmind_school_identity_key(name) = public.econmind_school_identity_key(university.school_name)
    order by created_at, id
    limit 1;

    if resolved_school.id is null then
      raise exception 'Approved university school % is unavailable', university.school_name;
    end if;

    update public.profiles
    set school_id = resolved_school.id
    where user_id = resolved_user_id;
  end loop;
end;
$$;
