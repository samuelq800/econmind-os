-- Owner-approved, city-level location review for the six approved schools that
-- remained unplotted on 2026-09-30. This is deliberately scoped by school ID.
-- The matching 22 already-approved applications are reconciled to their
-- school's verified catalog key; submitted free-text locations are not trusted.
-- A database patch has no end-user JWT, so reviewer UUIDs remain NULL rather
-- than impersonating an administrator. Evidence and provenance are recorded in
-- school_location_review_events. Re-running is a no-op for matching approvals.

begin;

create temporary table econmind_location_approval_targets on commit drop as
select * from (values
  (
    '0d07493a-7636-4875-9bb5-d61bae409bfc'::uuid, '上海宏文学校',
    'Shanghai', 'geonames:1796236', 1796236::bigint,
    'geoarea:CN', 'China — mainland areas', 'Shanghai',
    31.22222::double precision, 121.45806::double precision,
    'https://www.geonames.org/1796236/',
    'https://sh.hongwenfeh.com/lianxi-list.html',
    'The school identifies its Shanghai campus in Pudong. The public marker is the existing Shanghai city centroid, not its campus address.'
  ),
  (
    '24166a1f-b4ff-4ccf-b0a7-c136518a0c0a'::uuid, '哈尔滨市第三中学校',
    'Harbin', 'geonames:2037013', 2037013::bigint,
    'geoarea:CN', 'China — mainland areas', 'Heilongjiang',
    45.75000::double precision, 126.65000::double precision,
    'https://www.geonames.org/2037013/harbin.html',
    'https://www.hlj.gov.cn/hlj/c107858/202605/c00_31943619.shtml',
    'The Heilongjiang government lists the school''s Harbin campuses. The public marker is the Harbin city centroid.'
  ),
  (
    'c3707f49-7d0f-44dd-a070-d51b487049a3'::uuid, '安徽省广德中学',
    'Guangde', 'geonames:1793092', 1793092::bigint,
    'geoarea:CN', 'China — mainland areas', 'Anhui',
    30.90641::double precision, 119.40865::double precision,
    'https://www.geonames.org/1793092/taozhou.html',
    'https://www.guangde.gov.cn/OpennessContent/show/3033664.html',
    'The Guangde education authority identifies the school in Guangde. GeoNames names the populated-place centre Taozhou and lists Guangde as an alternate name; Xuancheng city centre is not used.'
  ),
  (
    '147a60fe-37d6-4130-acfb-5ac9bce09100'::uuid, '南京市金陵中学',
    'Nanjing', 'geonames:1799962', 1799962::bigint,
    'geoarea:CN', 'China — mainland areas', 'Jiangsu',
    32.06167::double precision, 118.77778::double precision,
    'https://www.geonames.org/1799962/',
    'https://www.jlhs.net/',
    'The official school site identifies Jinling High School in Nanjing. The public marker is the existing Nanjing city centroid.'
  ),
  (
    '61a2ddd6-843a-4dd2-921f-5cc09d12538e'::uuid, '天津传媒学院',
    'Tianjin', 'geonames:1792947', 1792947::bigint,
    'geoarea:CN', 'China — mainland areas', 'Tianjin',
    39.14222::double precision, 117.17667::double precision,
    'https://www.geonames.org/1792947/',
    'https://www.tjcma.edu.cn/web/',
    'The official college site places its campus in Tianjin''s Jizhou District. The public marker follows the existing municipality-level Tianjin city-centroid policy.'
  ),
  (
    'c69699a4-a7f3-4842-8f6a-f6bae8c28286'::uuid, 'Stanford Online High School',
    'Redwood City', 'geonames:5386834', 5386834::bigint,
    'geoarea:US', 'United States', 'California',
    37.48522::double precision, (-122.23635)::double precision,
    'https://www.geonames.org/5386834/redwood-city.html',
    'https://onlinehighschool.stanford.edu/contact-us',
    'The online school lists Redwood City as its administrative contact location. This city-centre marker does not imply a physical teaching campus.'
  )
) as reviewed(
  school_id, school_name, city, location_key, geoname_id, area_key,
  area_label, administrative_area, latitude, longitude, geonames_url,
  evidence_url, review_note
);

create temporary table econmind_application_approval_targets on commit drop as
select unnest(array[
  '30e609a8-dbf2-4787-9e3a-81414d980be1'::uuid,
  '9c8414bd-ba56-4265-9d53-8345a56548d9'::uuid,
  '28ce05b5-4ac7-426e-b9d7-6c12ca3897bf'::uuid,
  'c029967b-a6c8-42ce-96c4-a608f70af535'::uuid,
  '8f817283-1346-466a-a93f-52103afe299c'::uuid,
  '9bce6a87-dcef-4edf-bca0-584564aebaa9'::uuid,
  '34bdf080-c376-419e-a17e-ddaa381b5d15'::uuid,
  '7a658719-3853-4257-b6dd-b8c513cf8bc4'::uuid,
  'f7217a1f-82bb-42e2-a0e0-9fe1c1540e58'::uuid,
  '9a1e9d1a-2c10-4a36-81df-d3a3f8d53f18'::uuid,
  'fac2d4c8-95cb-4e9c-b3db-f19eb5462465'::uuid,
  'dfa703e7-9505-4f10-9ac9-22dfdacd7ac5'::uuid,
  '507944fb-3012-4ec7-8bd8-fff3fd5cf103'::uuid,
  '82f65ed6-9012-4d3d-9dc0-be4e54b014dc'::uuid,
  '24d18822-fc4d-439a-9eae-688ba145f1f1'::uuid,
  'c06c2b24-8ac1-4b07-ac58-a1ae965a1c51'::uuid,
  '2a04bdfd-2bbe-46c7-9616-7dc245ca8df6'::uuid,
  'aa723046-7845-4548-9cba-ada74031e05d'::uuid,
  '8e8fcdc6-33d1-4b2b-a258-76b8d0050ad9'::uuid,
  '51a37bba-c016-49fb-8300-c06f03a55f5e'::uuid,
  'f8c6502c-1d88-48f7-a9d9-7cdcf67715a3'::uuid,
  '8f1fae66-9639-4bd0-b780-46085a4bb3b0'::uuid
]) as application_id;

do $review$
declare
  target record;
  selected_school public.schools%rowtype;
  selected_application public.league_applications%rowtype;
  matching_school public.schools%rowtype;
  school_count integer;
  prior_evidence_url text;
begin
  if (select count(*) from econmind_location_approval_targets) <> 6
    or (select count(distinct school_id) from econmind_location_approval_targets) <> 6
    or (select count(*) from econmind_application_approval_targets) <> 22
    or (select count(distinct application_id) from econmind_application_approval_targets) <> 22 then
    raise exception 'School or application approval target count is not as expected';
  end if;

  -- Fail closed on an unexpected school identity or a conflicting live review.
  for target in select * from econmind_location_approval_targets order by school_id loop
    select * into selected_school from public.schools
    where id = target.school_id for update;
    if not found or selected_school.name is distinct from target.school_name
      or selected_school.status <> 'approved' then
      raise exception 'Unexpected school identity or approval state: %', target.school_id;
    end if;
    if selected_school.location_status = 'verified'
      and selected_school.location_key = target.location_key then
      continue;
    end if;
    if selected_school.location_status <> 'missing'
      or selected_school.location_key is not null then
      raise exception 'School location changed since review: %', target.school_id;
    end if;

    insert into public.school_location_catalog (
      location_key, geoname_id, city, area_key, area_label,
      administrative_area, latitude, longitude, source_name,
      source_snapshot_date, source_url
    ) values (
      target.location_key, target.geoname_id, target.city, target.area_key,
      target.area_label, target.administrative_area, target.latitude,
      target.longitude, 'GeoNames', date '2026-09-30', target.geonames_url
    ) on conflict (location_key) do nothing;

    if not exists (
      select 1 from public.school_location_catalog catalog
      where catalog.location_key = target.location_key
        and catalog.geoname_id = target.geoname_id
        and catalog.city = target.city
        and catalog.area_key = target.area_key
        and catalog.area_label = target.area_label
        and catalog.administrative_area = target.administrative_area
        and abs(catalog.latitude - target.latitude) < 0.000001
        and abs(catalog.longitude - target.longitude) < 0.000001
    ) then
      raise exception 'GeoNames catalog key conflicts with reviewed location: %', target.location_key;
    end if;

    update public.schools
    set city = target.city,
        location_status = 'verified',
        location_key = target.location_key,
        location_source = 'admin_review',
        location_public_note = null,
        location_verified_by = null,
        location_verified_at = timezone('utc', now())
    where id = target.school_id;

    insert into public.school_location_review_events (
      school_id, event_type, from_status, to_status, location_key,
      evidence_url, note, payload
    ) values (
      target.school_id, 'verified', 'missing', 'verified', target.location_key,
      target.evidence_url, target.review_note,
      jsonb_build_object(
        'approval_batch', '2026-09-30-school-location',
        'authorization', 'owner-approved code-level review',
        'execution', 'scoped database migration',
        'reviewer_uuid', 'not impersonated',
        'catalog_source', 'GeoNames'
      )
    );
  end loop;

  -- These applications were already approved as applications; only their
  -- location-review status is reconciled to the matched school's vetted key.
  for target in select * from econmind_application_approval_targets order by application_id loop
    select * into selected_application from public.league_applications
    where id = target.application_id for update;
    if not found or selected_application.status <> 'approved' then
      raise exception 'Application missing or not approved: %', target.application_id;
    end if;

    select count(*) into school_count
    from public.schools school
    where school.status = 'approved'
      and public.econmind_school_identity_key(school.name) =
          public.econmind_school_identity_key(selected_application.school_name);
    if school_count <> 1 then
      raise exception 'Application does not match exactly one approved school: %', target.application_id;
    end if;

    select * into matching_school from public.schools school
    where school.status = 'approved'
      and public.econmind_school_identity_key(school.name) =
          public.econmind_school_identity_key(selected_application.school_name);
    if matching_school.location_status <> 'verified'
      or matching_school.location_key is null then
      raise exception 'Matched school has no verified location: %', matching_school.id;
    end if;

    if selected_application.location_status = 'verified'
      and selected_application.location_key = matching_school.location_key then
      continue;
    end if;
    if selected_application.location_status <> 'pending_review'
      or selected_application.location_key is not null then
      raise exception 'Application location changed since review: %', target.application_id;
    end if;

    select event.evidence_url into prior_evidence_url
    from public.school_location_review_events event
    where event.school_id = matching_school.id
      and event.location_key = matching_school.location_key
      and event.evidence_url is not null
    order by event.created_at desc
    limit 1;

    update public.league_applications
    set location_status = 'verified',
        location_key = matching_school.location_key,
        location_source = 'catalog_match',
        location_public_note = null,
        location_reviewed_by = null,
        location_reviewed_at = timezone('utc', now())
    where id = target.application_id;

    insert into public.school_location_review_events (
      application_id, school_id, event_type, from_status, to_status,
      location_key, evidence_url, note, payload
    ) values (
      target.application_id, matching_school.id, 'catalog_matched',
      'pending_review', 'verified', matching_school.location_key,
      prior_evidence_url,
      'Approved application reconciled to the uniquely matching approved school and its previously verified city key; submitted free-text city was not used.',
      jsonb_build_object(
        'approval_batch', '2026-09-30-school-location',
        'authorization', 'owner-approved code-level review',
        'execution', 'scoped database migration',
        'reviewer_uuid', 'not impersonated',
        'school_id', matching_school.id
      )
    );
  end loop;

  if (
    select count(*) from econmind_location_approval_targets reviewed
    join public.schools school on school.id = reviewed.school_id
    where school.location_status = 'verified'
      and school.location_key = reviewed.location_key
      and school.city = reviewed.city
  ) <> 6 then
    raise exception 'Not all six school locations were verified';
  end if;

  if (
    select count(*) from econmind_application_approval_targets candidate
    join public.league_applications application on application.id = candidate.application_id
    join public.schools school
      on public.econmind_school_identity_key(school.name) =
         public.econmind_school_identity_key(application.school_name)
    where application.status = 'approved'
      and application.location_status = 'verified'
      and application.location_key = school.location_key
  ) <> 22 then
    raise exception 'Not all 22 approved applications were reconciled';
  end if;
end
$review$;

commit;
