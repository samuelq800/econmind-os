-- Verify the five approved school records that were still outside the public
-- city register. Coordinates are city centroids, never campus addresses.
-- The school or institutional URLs are retained in the review event as the
-- independent evidence for the city-level association.

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
  ('geonames:2038180', 2038180, 'Changchun', 'geoarea:CN', 'China — mainland areas', 'Jilin', 43.88, 125.32278, 'GeoNames', date '2026-09-16', 'https://www.geonames.org/2038180/'),
  ('geonames:1814087', 1814087, 'Dalian', 'geoarea:CN', 'China — mainland areas', 'Liaoning', 38.91222, 121.60222, 'GeoNames', date '2026-09-16', 'https://www.geonames.org/1814087/'),
  ('geonames:5408395', 5408395, 'Westlake Village', 'geoarea:US', 'United States', 'California', 34.14584, -118.80565, 'GeoNames', date '2026-09-16', 'https://www.geonames.org/5408395/'),
  ('geonames:4955635', 4955635, 'Wilbraham', 'geoarea:US', 'United States', 'Massachusetts', 42.12371, -72.43147, 'GeoNames', date '2026-09-16', 'https://www.geonames.org/4955635/')
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

with assignments (school_id, city, location_key, evidence_url, note) as (
  values
    (
      '16cd96b6-ac67-4ff0-9ec3-c7e2643aaed2'::uuid,
      'Changchun',
      'geonames:2038180',
      'https://www.msannu.cn/ms-mcms/html/1/177/230/index.html',
      'The official HSANNU page lists its campuses in Changchun; the public marker is the Changchun city centroid.'
    ),
    (
      '0d57b93d-2595-48b2-8c4c-0d7c0eacad6b'::uuid,
      'Dalian',
      'geonames:1814087',
      'https://fg.dlut.edu.cn/',
      'The official Dalian University of Technology affiliated high school site identifies the school in Dalian; the public marker is the Dalian city centroid.'
    ),
    (
      '2006ebed-8766-4ca1-ad04-e8e1b992ba09'::uuid,
      'Westlake Village',
      'geonames:5408395',
      'https://whs.conejousd.org/our-school/school-profile',
      'The official Westlake High School profile lists 100 N Lakeview Canyon Rd., Westlake Village, CA; the public marker is the Westlake Village city centroid.'
    ),
    (
      '7001828f-44cf-42e2-a15b-f146b6594bc7'::uuid,
      'Wilbraham',
      'geonames:4955635',
      'https://www.wma.us/',
      'The official Wilbraham & Monson Academy site identifies the school in Wilbraham, Massachusetts; the public marker is the Wilbraham city centroid.'
    ),
    (
      '1a1030f2-fecd-47d5-8c3d-81b504ac4047'::uuid,
      'Shanghai',
      'geonames:1796236',
      'https://www.wlsashanghaiacademy.com/',
      'The official WLSA Shanghai Academy site lists its Shanghai campuses; the street address previously stored as the city label is replaced with the Shanghai city centroid.'
    )
), updated as (
  update public.schools school
  set city = assignments.city,
      location_status = 'verified',
      location_key = assignments.location_key,
      location_source = 'admin_review',
      location_public_note = null,
      location_verified_by = null,
      location_verified_at = timezone('utc', now())
  from assignments
  where school.id = assignments.school_id
    and school.location_status = 'missing'
    and school.location_key is null
  returning school.id
)
insert into public.school_location_review_events (
  school_id,
  event_type,
  from_status,
  to_status,
  location_key,
  evidence_url,
  note,
  payload
)
select
  assignments.school_id,
  'verified',
  'missing',
  'verified',
  assignments.location_key,
  assignments.evidence_url,
  assignments.note,
  jsonb_build_object(
    'verification_method', 'admin_catalog_backfill',
    'catalog_source', 'GeoNames',
    'catalog_source_snapshot_date', '2026-09-16'
  )
from assignments
where exists (select 1 from updated where updated.id = assignments.school_id)
  and not exists (
    select 1
    from public.school_location_review_events event
    where event.school_id = assignments.school_id
      and event.event_type = 'verified'
      and event.location_key = assignments.location_key
  );

do $verify$
begin
  if (
    select count(*)
    from public.schools
    where id = any(array[
      '16cd96b6-ac67-4ff0-9ec3-c7e2643aaed2'::uuid,
      '0d57b93d-2595-48b2-8c4c-0d7c0eacad6b'::uuid,
      '2006ebed-8766-4ca1-ad04-e8e1b992ba09'::uuid,
      '7001828f-44cf-42e2-a15b-f146b6594bc7'::uuid,
      '1a1030f2-fecd-47d5-8c3d-81b504ac4047'::uuid
    ])
    and location_status = 'verified'
    and location_key is not null
  ) <> 5 then
    raise exception 'The five remaining school locations were not verified';
  end if;

  if not exists (
    select 1 from public.schools
    where id = '1a1030f2-fecd-47d5-8c3d-81b504ac4047'::uuid
      and city = 'Shanghai'
      and location_key = 'geonames:1796236'
  ) then
    raise exception 'WLSA Shanghai Academy was not normalised to the Shanghai city marker';
  end if;
end
$verify$;
