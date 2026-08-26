-- Required city-level school locations with a separate, auditable review
-- workflow. Applicant text is never a map authority: only a platform admin can
-- bind an application or school to a frozen GeoNames place record.

create or replace function public.econmind_school_identity_key(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  with cleaned as (
    select regexp_replace(lower(trim(coalesce(p_name, ''))), '[^[:alnum:]一-鿿]+', '', 'g') as value
  )
  select case value
    when 'baid' then 'beijingacademyinternationaldepartment'
    when '南外仙林分校' then 'nanjingforeignlanguageschoolxianlincampus'
    when '苏州一中' then 'suzhouno1highschool'
    when 'suzhouscientificforeignlanguagehighschool' then 'suzhousciencetechnologytownforeignlanguageschool'
    else value
  end
  from cleaned;
$$;

create or replace function public.econmind_canonical_school_name(p_identity_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_identity_key
    when 'beijingacademyinternationaldepartment' then 'Beijing Academy International Department'
    when 'nanjingforeignlanguageschoolxianlincampus' then 'Nanjing Foreign Language School, Xianlin Campus'
    when 'suzhouno1highschool' then 'Suzhou No.1 High School'
    when 'suzhousciencetechnologytownforeignlanguageschool' then 'SUZHOU SCIENCE&TECHNOLOGY TOWN FOREIGN LANGUAGE SCHOOL'
    else null
  end;
$$;

create or replace function public.econmind_location_text_key(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(trim(coalesce(p_value, '')), '[[:space:]]+', ' ', 'g'));
$$;

-- Candidate keys mirror country-region-data 4.1.0 plus ZZ, which is an
-- explicit manual-review escape hatch. These keys are geographic indexes,
-- not declarations about sovereignty or territorial status.
create or replace function public.econmind_is_supported_area_key(p_area_key text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    upper(trim(p_area_key)) ~ '^GEOAREA:[A-Z]{2}$'
    and right(upper(trim(p_area_key)), 2) = any(array[
      'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
      'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
      'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
      'DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR',
      'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
      'HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP',
      'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
      'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
      'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
      'QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
      'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ',
      'VA','VC','VE','VG','VI','VN','VU','WF','WS','XK','YE','YT','ZA','ZM','ZW','ZZ'
    ]::text[]),
    false
  );
$$;

create or replace function public.econmind_neutral_area_label(
  p_area_key text,
  p_proposed_label text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(trim(coalesce(p_area_key, '')))
    when 'GEOAREA:CN' then 'China — mainland areas'
    when 'GEOAREA:EH' then 'Western Sahara'
    when 'GEOAREA:FK' then 'Falkland Islands (Islas Malvinas)'
    when 'GEOAREA:HK' then 'Hong Kong SAR'
    when 'GEOAREA:MO' then 'Macao SAR'
    when 'GEOAREA:PS' then 'Palestinian territories'
    when 'GEOAREA:TW' then 'Taiwan'
    when 'GEOAREA:XK' then 'Kosovo'
    when 'GEOAREA:ZZ' then 'Other or not listed area — manual review'
    else trim(coalesce(p_proposed_label, ''))
  end;
$$;

create or replace function public.econmind_is_https_url(p_value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    char_length(trim(p_value)) between 9 and 1000
    and trim(p_value) ~* '^https://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$',
    false
  );
$$;

create or replace function public.econmind_is_independent_location_evidence_url(p_value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select public.econmind_is_https_url(p_value)
    and trim(p_value) !~* '^https://([^/?#@]+\.)?geonames\.org([:/?#]|$)';
$$;

create table if not exists public.school_location_catalog (
  location_key text primary key check (location_key ~ '^geonames:[1-9][0-9]{0,18}$'),
  geoname_id bigint not null unique check (geoname_id > 0),
  city text not null check (char_length(trim(city)) between 2 and 100),
  area_key text not null check (area_key ~ '^geoarea:[A-Z]{2}$' and public.econmind_is_supported_area_key(area_key)),
  area_label text not null check (char_length(trim(area_label)) between 1 and 100),
  administrative_area text check (administrative_area is null or char_length(trim(administrative_area)) between 1 and 100),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  source_name text not null default 'GeoNames',
  source_snapshot_date date,
  source_url text not null check (public.econmind_is_https_url(source_url)),
  verified_by uuid references public.profiles(user_id) on delete set null,
  verified_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.school_location_catalog (
  location_key, geoname_id, city, area_key, area_label,
  administrative_area, latitude, longitude, source_snapshot_date, source_url
)
values
  ('geonames:1816670', 1816670, 'Beijing', 'geoarea:CN', 'China — mainland areas', 'Beijing', 39.9075, 116.39723, '2026-08-25', 'https://www.geonames.org/1816670/'),
  ('geonames:1815286', 1815286, 'Chengdu', 'geoarea:CN', 'China — mainland areas', 'Sichuan', 30.66667, 104.06667, '2026-08-25', 'https://www.geonames.org/1815286/'),
  ('geonames:1814906', 1814906, 'Chongqing', 'geoarea:CN', 'China — mainland areas', 'Chongqing', 29.56026, 106.55771, '2026-08-25', 'https://www.geonames.org/1814906/'),
  ('geonames:1808926', 1808926, 'Hangzhou', 'geoarea:CN', 'China — mainland areas', 'Zhejiang', 30.29365, 120.16142, '2026-08-25', 'https://www.geonames.org/1808926/'),
  ('geonames:1805753', 1805753, 'Jinan', 'geoarea:CN', 'China — mainland areas', 'Shandong', 36.66833, 116.99722, '2026-08-25', 'https://www.geonames.org/1805753/'),
  ('geonames:1800163', 1800163, 'Nanchang', 'geoarea:CN', 'China — mainland areas', 'Jiangxi', 28.68396, 115.85306, '2026-08-25', 'https://www.geonames.org/1800163/'),
  ('geonames:1799962', 1799962, 'Nanjing', 'geoarea:CN', 'China — mainland areas', 'Jiangsu', 32.06167, 118.77778, '2026-08-25', 'https://www.geonames.org/1799962/'),
  ('geonames:1799869', 1799869, 'Nanning', 'geoarea:CN', 'China — mainland areas', 'Guangxi', 22.81667, 108.31667, '2026-08-25', 'https://www.geonames.org/1799869/'),
  ('geonames:1799397', 1799397, 'Ningbo', 'geoarea:CN', 'China — mainland areas', 'Zhejiang', 29.87819, 121.54945, '2026-08-25', 'https://www.geonames.org/1799397/'),
  ('geonames:1797929', 1797929, 'Qingdao', 'geoarea:CN', 'China — mainland areas', 'Shandong', 36.06488, 120.38042, '2026-08-25', 'https://www.geonames.org/1797929/'),
  ('geonames:1796236', 1796236, 'Shanghai', 'geoarea:CN', 'China — mainland areas', 'Shanghai', 31.22222, 121.45806, '2026-08-25', 'https://www.geonames.org/1796236/'),
  ('geonames:1795565', 1795565, 'Shenzhen', 'geoarea:CN', 'China — mainland areas', 'Guangdong', 22.54554, 114.0683, '2026-08-25', 'https://www.geonames.org/1795565/'),
  ('geonames:1880252', 1880252, 'Singapore', 'geoarea:SG', 'Singapore', null, 1.28967, 103.85007, '2026-08-25', 'https://www.geonames.org/1880252/'),
  ('geonames:1886760', 1886760, 'Suzhou', 'geoarea:CN', 'China — mainland areas', 'Jiangsu', 31.30408, 120.59538, '2026-08-25', 'https://www.geonames.org/1886760/'),
  ('geonames:1790923', 1790923, 'Wuxi', 'geoarea:CN', 'China — mainland areas', 'Jiangsu', 31.56887, 120.28857, '2026-08-25', 'https://www.geonames.org/1790923/'),
  ('geonames:1790437', 1790437, 'Zhuhai', 'geoarea:CN', 'China — mainland areas', 'Guangdong', 22.27694, 113.56778, '2026-08-25', 'https://www.geonames.org/1790437/')
on conflict (location_key) do nothing;

alter table public.league_applications
  add column if not exists submitted_area_key text,
  add column if not exists submitted_area_label text,
  add column if not exists submitted_administrative_area text,
  add column if not exists submitted_city text,
  add column if not exists location_status text not null default 'missing',
  add column if not exists location_key text references public.school_location_catalog(location_key) on delete restrict,
  add column if not exists location_source text,
  add column if not exists location_public_note text,
  add column if not exists location_reviewed_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists location_reviewed_at timestamptz;

alter table public.league_applications
  drop constraint if exists league_applications_submitted_area_key_check,
  drop constraint if exists league_applications_submitted_area_label_check,
  drop constraint if exists league_applications_submitted_administrative_area_check,
  drop constraint if exists league_applications_submitted_city_check,
  drop constraint if exists league_applications_location_status_check,
  drop constraint if exists league_applications_location_source_check,
  drop constraint if exists league_applications_location_public_note_check,
  drop constraint if exists league_applications_verified_location_check;

alter table public.league_applications
  add constraint league_applications_submitted_area_key_check
    check (
      submitted_area_key is null
      or (
        submitted_area_key ~ '^geoarea:[A-Z]{2}$'
        and public.econmind_is_supported_area_key(submitted_area_key)
      )
    ),
  add constraint league_applications_submitted_area_label_check
    check (submitted_area_label is null or char_length(trim(submitted_area_label)) between 1 and 100),
  add constraint league_applications_submitted_administrative_area_check
    check (submitted_administrative_area is null or char_length(trim(submitted_administrative_area)) between 1 and 100),
  add constraint league_applications_submitted_city_check
    check (submitted_city is null or char_length(trim(submitted_city)) between 2 and 100),
  add constraint league_applications_location_status_check
    check (location_status in ('missing', 'pending_review', 'verified', 'needs_correction')),
  add constraint league_applications_location_source_check
    check (location_source is null or location_source in ('catalog_match', 'admin_review')),
  add constraint league_applications_location_public_note_check
    check (location_public_note is null or char_length(trim(location_public_note)) between 1 and 500),
  add constraint league_applications_verified_location_check
    check (
      (location_status = 'verified' and location_key is not null)
      or (location_status <> 'verified' and location_key is null)
    );

alter table public.schools
  add column if not exists location_status text not null default 'missing',
  add column if not exists location_key text references public.school_location_catalog(location_key) on delete restrict,
  add column if not exists location_source text,
  add column if not exists location_public_note text,
  add column if not exists location_verified_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists location_verified_at timestamptz;

alter table public.schools
  drop constraint if exists schools_location_status_check,
  drop constraint if exists schools_location_source_check,
  drop constraint if exists schools_location_public_note_check,
  drop constraint if exists schools_verified_location_check;

alter table public.schools
  add constraint schools_location_status_check
    check (location_status in ('missing', 'verified', 'needs_correction')),
  add constraint schools_location_source_check
    check (location_source is null or location_source in ('verified_roster_backfill', 'application_review', 'admin_review')),
  add constraint schools_location_public_note_check
    check (location_public_note is null or char_length(trim(location_public_note)) between 2 and 500),
  add constraint schools_verified_location_check
    check (
      (location_status = 'verified' and location_key is not null)
      or (location_status <> 'verified' and location_key is null)
    );

with verified_roster(school_name, location_key) as (
  values
    ('Suzhou High School-International Division', 'geonames:1886760'),
    ('BASIS Bilingual School Shenzhen', 'geonames:1795565'),
    ('Basis International School Shenzhen', 'geonames:1795565'),
    ('Beijing Academy International Department', 'geonames:1816670'),
    ('Beijing Aidi International School', 'geonames:1816670'),
    ('The High School Affiliated to Beijing Normal University', 'geonames:1816670'),
    ('Chongqing Nankai Secondary School', 'geonames:1814906'),
    ('Hangzhou Dingwen Academy', 'geonames:1808926'),
    ('Harrow Nanning', 'geonames:1799869'),
    ('HD Shanghai School', 'geonames:1796236'),
    ('HT Nanjing Impact Academy', 'geonames:1799962'),
    ('International Department of Beijing No.80 High School', 'geonames:1816670'),
    ('The Attached Middle School To Jiangxi Normal University', 'geonames:1800163'),
    ('Jiangsu Tianyi High School', 'geonames:1790923'),
    ('Nanjing Foreign Language School, Xianlin Campus', 'geonames:1799962'),
    ('Shandong Experimental High School', 'geonames:1805753'),
    ('Suzhou Industrial Park Xinghai Experimental Senior High School', 'geonames:1886760'),
    ('SUZHOU SCIENCE&TECHNOLOGY TOWN FOREIGN LANGUAGE SCHOOL', 'geonames:1886760'),
    ('Suzhou No.1 High School', 'geonames:1886760'),
    ('Chengdu Jiaxiang Foreign Language School', 'geonames:1815286'),
    ('The Experimental School Affiliated with Zhuhai No.1 High School', 'geonames:1790437'),
    ('Victoria World Academy', 'geonames:1880252'),
    ('Beijing National Day School', 'geonames:1816670'),
    ('HD Ningbo School', 'geonames:1799397'),
    ('MalvernCollegeQingdao', 'geonames:1797929'),
    ('Shenzhen College of International Education', 'geonames:1795565'),
    ('杭州西子实验学校国际部', 'geonames:1808926')
)
update public.schools school
set city = catalog.city,
    location_status = 'verified',
    location_key = catalog.location_key,
    location_source = 'verified_roster_backfill',
    location_verified_at = timezone('utc', now())
from verified_roster roster
join public.school_location_catalog catalog on catalog.location_key = roster.location_key
where school.location_key is null
  and public.econmind_school_identity_key(school.name) = public.econmind_school_identity_key(roster.school_name);

create table if not exists public.school_location_review_events (
  id uuid primary key default extensions.gen_random_uuid(),
  application_id uuid references public.league_applications(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  event_type text not null check (event_type in (
    'submitted', 'resubmitted', 'catalog_matched', 'verified',
    'needs_correction', 'legacy_backfill', 'application_applied'
  )),
  from_status text,
  to_status text not null,
  location_key text references public.school_location_catalog(location_key) on delete restrict,
  evidence_url text check (evidence_url is null or public.econmind_is_https_url(evidence_url)),
  note text check (note is null or char_length(trim(note)) between 1 and 2000),
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  check (application_id is not null or school_id is not null)
);

create index if not exists league_applications_location_status_idx
  on public.league_applications(location_status, created_at desc);
create unique index if not exists league_applications_one_active_per_applicant_idx
  on public.league_applications(applicant_user_id)
  where status in ('submitted', 'under_review');
create index if not exists schools_location_status_idx
  on public.schools(location_status, created_at desc);
create index if not exists school_location_review_events_application_idx
  on public.school_location_review_events(application_id, created_at desc)
  where application_id is not null;
create index if not exists school_location_review_events_school_idx
  on public.school_location_review_events(school_id, created_at desc)
  where school_id is not null;

insert into public.school_location_review_events (
  school_id, event_type, from_status, to_status, location_key, note, payload
)
select school.id, 'legacy_backfill', 'missing', 'verified', school.location_key,
  'Matched an approved editorial roster identity to the frozen GeoNames catalog during migration.',
  jsonb_build_object('source', 'verified_roster_backfill')
from public.schools school
where school.location_source = 'verified_roster_backfill'
  and not exists (
    select 1 from public.school_location_review_events event
    where event.school_id = school.id and event.event_type = 'legacy_backfill'
  );

create or replace function public.register_school_location_catalog_entry(
  p_geoname_id bigint,
  p_city text,
  p_area_key text,
  p_area_label text,
  p_administrative_area text,
  p_latitude double precision,
  p_longitude double precision
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_key text;
  existing_location public.school_location_catalog%rowtype;
  clean_city text := trim(coalesce(p_city, ''));
  clean_area_key text := upper(trim(coalesce(p_area_key, '')));
  clean_area_label text := trim(coalesce(p_area_label, ''));
  clean_administrative_area text := nullif(trim(coalesce(p_administrative_area, '')), '');
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_geoname_id is null or p_geoname_id <= 0 then raise exception 'Enter a valid GeoNames ID'; end if;
  if clean_city = '' or char_length(clean_city) not between 2 and 100 then raise exception 'Enter a canonical city between 2 and 100 characters'; end if;
  if clean_area_key !~ '^GEOAREA:[A-Z]{2}$' then raise exception 'Choose a valid country-or-area key'; end if;
  clean_area_key := 'geoarea:' || right(clean_area_key, 2);
  if not public.econmind_is_supported_area_key(clean_area_key) then raise exception 'Choose a supported country-or-area key'; end if;
  clean_area_label := public.econmind_neutral_area_label(clean_area_key, clean_area_label);
  if clean_area_label = '' or char_length(clean_area_label) > 100 then raise exception 'Enter a country-or-area label up to 100 characters'; end if;
  if clean_administrative_area is not null and char_length(clean_administrative_area) > 100 then raise exception 'Administrative area must be 100 characters or fewer'; end if;
  if p_latitude is null or p_latitude::text in ('NaN', 'Infinity', '-Infinity') or p_latitude not between -90 and 90 then raise exception 'Latitude must be between -90 and 90'; end if;
  if p_longitude is null or p_longitude::text in ('NaN', 'Infinity', '-Infinity') or p_longitude not between -180 and 180 then raise exception 'Longitude must be between -180 and 180'; end if;

  resolved_key := 'geonames:' || p_geoname_id::text;
  select * into existing_location
  from public.school_location_catalog
  where location_key = resolved_key
  for update;

  if found then
    if public.econmind_location_text_key(existing_location.city) <> public.econmind_location_text_key(clean_city)
      or existing_location.area_key <> clean_area_key
      or public.econmind_location_text_key(existing_location.area_label) <> public.econmind_location_text_key(clean_area_label)
      or public.econmind_location_text_key(existing_location.administrative_area) <> public.econmind_location_text_key(clean_administrative_area)
      or abs(existing_location.latitude - p_latitude) > 0.000001
      or abs(existing_location.longitude - p_longitude) > 0.000001 then
      raise exception 'This GeoNames ID already exists with different canonical data';
    end if;
    return existing_location.location_key;
  end if;

  insert into public.school_location_catalog (
    location_key, geoname_id, city, area_key, area_label,
    administrative_area, latitude, longitude, source_url, verified_by
  ) values (
    resolved_key, p_geoname_id, clean_city, clean_area_key, clean_area_label,
    clean_administrative_area, p_latitude, p_longitude,
    'https://www.geonames.org/' || p_geoname_id::text || '/', auth.uid()
  );

  return resolved_key;
end;
$$;

create or replace function public.submit_league_application(
  p_school_name text,
  p_club_name text,
  p_contact_person text,
  p_curriculum_system text,
  p_expected_teams integer,
  p_expected_members integer,
  p_preferred_language text,
  p_preferred_format text,
  p_organising_committee_interest boolean,
  p_notes text,
  p_submitted_area_key text,
  p_submitted_area_label text,
  p_submitted_administrative_area text,
  p_submitted_city text
)
returns public.league_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  created_application public.league_applications%rowtype;
  clean_school_name text := trim(coalesce(p_school_name, ''));
  clean_club_name text := nullif(trim(coalesce(p_club_name, '')), '');
  clean_contact_person text := trim(coalesce(p_contact_person, ''));
  clean_curriculum_system text := lower(trim(coalesce(p_curriculum_system, '')));
  clean_area_key text := lower(trim(coalesce(p_submitted_area_key, '')));
  clean_area_label text := trim(coalesce(p_submitted_area_label, ''));
  clean_administrative_area text := nullif(trim(coalesce(p_submitted_administrative_area, '')), '');
  clean_city text := trim(coalesce(p_submitted_city, ''));
  clean_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('league-application:' || auth.uid()::text, 0));
  if char_length(clean_school_name) not between 2 and 160 then raise exception 'Enter a school name between 2 and 160 characters'; end if;
  if public.econmind_school_identity_key(clean_school_name) = '' then raise exception 'School name must contain letters or ideographs'; end if;
  if clean_club_name is not null and char_length(clean_club_name) > 160 then raise exception 'Club name must be 160 characters or fewer'; end if;
  if char_length(clean_contact_person) not between 2 and 120 then raise exception 'Enter a contact person between 2 and 120 characters'; end if;
  if clean_curriculum_system not in ('ap', 'ib', 'alevel', 'other') then raise exception 'Choose AP, IB, A-Level or Other as the school curriculum system'; end if;
  if p_expected_teams is null or p_expected_teams not between 1 and 50 then raise exception 'Expected teams must be between 1 and 50'; end if;
  if p_expected_members is null or p_expected_members not between 1 and 500 then raise exception 'Expected members must be between 1 and 500'; end if;
  if p_preferred_language is null or p_preferred_language not in ('English', 'Chinese', 'Bilingual') then raise exception 'Choose a supported language'; end if;
  if p_preferred_format is null or p_preferred_format not in ('online', 'offline', 'either') then raise exception 'Choose a supported participation format'; end if;
  if clean_notes is not null and char_length(clean_notes) > 2000 then raise exception 'Notes must be 2000 characters or fewer'; end if;
  if clean_area_key !~ '^geoarea:[a-z]{2}$' then raise exception 'Choose a country or area'; end if;
  clean_area_key := 'geoarea:' || upper(right(clean_area_key, 2));
  if not public.econmind_is_supported_area_key(clean_area_key) then raise exception 'Choose a supported country or area'; end if;
  clean_area_label := public.econmind_neutral_area_label(clean_area_key, clean_area_label);
  if clean_area_label = '' or char_length(clean_area_label) > 100 then raise exception 'Choose a country-or-area label'; end if;
  if clean_administrative_area is not null and char_length(clean_administrative_area) > 100 then raise exception 'Administrative area must be 100 characters or fewer'; end if;
  if char_length(clean_city) not between 2 and 100 then raise exception 'Enter a city or locality between 2 and 100 characters'; end if;
  if exists (
    select 1 from public.schools
    where status = 'approved'
      and public.econmind_school_identity_key(name) = public.econmind_school_identity_key(clean_school_name)
  ) then
    raise exception 'This school is already available. Choose it from the approved-school list.';
  end if;
  if exists (
    select 1 from public.league_applications
    where applicant_user_id = auth.uid() and status in ('submitted', 'under_review')
  ) then
    raise exception 'You already have an active school application';
  end if;

  insert into public.league_applications (
    applicant_user_id, school_name, club_name, contact_person, curriculum_system,
    expected_teams, expected_members, preferred_language, preferred_format,
    organising_committee_interest, notes,
    submitted_area_key, submitted_area_label, submitted_administrative_area,
    submitted_city, location_status
  ) values (
    auth.uid(), clean_school_name, clean_club_name, clean_contact_person, clean_curriculum_system,
    p_expected_teams, p_expected_members, p_preferred_language, p_preferred_format,
    coalesce(p_organising_committee_interest, false), clean_notes,
    clean_area_key, clean_area_label, clean_administrative_area,
    clean_city, 'pending_review'
  ) returning * into created_application;

  insert into public.school_location_review_events (
    application_id, event_type, from_status, to_status, actor_user_id, payload
  ) values (
    created_application.id, 'submitted', 'missing', 'pending_review', auth.uid(),
    jsonb_build_object(
      'submitted_area_key', clean_area_key,
      'submitted_area_label', clean_area_label,
      'submitted_administrative_area', clean_administrative_area,
      'submitted_city', clean_city
    )
  );

  return created_application;
end;
$$;

create or replace function public.resubmit_league_application_location(
  p_application_id uuid,
  p_submitted_area_key text,
  p_submitted_area_label text,
  p_submitted_administrative_area text,
  p_submitted_city text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.league_applications%rowtype;
  previous_status text;
  clean_area_key text := lower(trim(coalesce(p_submitted_area_key, '')));
  clean_area_label text := trim(coalesce(p_submitted_area_label, ''));
  clean_administrative_area text := nullif(trim(coalesce(p_submitted_administrative_area, '')), '');
  clean_city text := trim(coalesce(p_submitted_city, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into application from public.league_applications where id = p_application_id for update;
  if not found or application.applicant_user_id <> auth.uid() then raise exception 'Application not found'; end if;
  if application.status not in ('submitted', 'under_review') then raise exception 'This application can no longer be corrected'; end if;
  if application.location_status = 'verified' then raise exception 'A verified location can only be changed by a platform administrator'; end if;
  if clean_area_key !~ '^geoarea:[a-z]{2}$' then raise exception 'Choose a country or area'; end if;
  clean_area_key := 'geoarea:' || upper(right(clean_area_key, 2));
  if not public.econmind_is_supported_area_key(clean_area_key) then raise exception 'Choose a supported country or area'; end if;
  clean_area_label := public.econmind_neutral_area_label(clean_area_key, clean_area_label);
  if clean_area_label = '' or char_length(clean_area_label) > 100 then raise exception 'Choose a country-or-area label'; end if;
  if clean_administrative_area is not null and char_length(clean_administrative_area) > 100 then raise exception 'Administrative area must be 100 characters or fewer'; end if;
  if char_length(clean_city) not between 2 and 100 then raise exception 'Enter a city or locality between 2 and 100 characters'; end if;

  previous_status := application.location_status;
  update public.league_applications
  set submitted_area_key = clean_area_key,
      submitted_area_label = clean_area_label,
      submitted_administrative_area = clean_administrative_area,
      submitted_city = clean_city,
      location_status = 'pending_review',
      location_key = null,
      location_source = null,
      location_public_note = null,
      location_reviewed_by = null,
      location_reviewed_at = null
  where id = application.id;

  insert into public.school_location_review_events (
    application_id, event_type, from_status, to_status, actor_user_id, payload
  ) values (
    application.id, 'resubmitted', previous_status, 'pending_review', auth.uid(),
    jsonb_build_object(
      'submitted_area_key', clean_area_key,
      'submitted_area_label', clean_area_label,
      'submitted_administrative_area', clean_administrative_area,
      'submitted_city', clean_city
    )
  );

  return jsonb_build_object('application_id', application.id, 'location_status', 'pending_review');
end;
$$;

create or replace function public.match_league_application_location(
  p_application_id uuid,
  p_evidence_url text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.league_applications%rowtype;
  matched_location public.school_location_catalog%rowtype;
  candidate_count integer;
  clean_evidence_url text := trim(coalesce(p_evidence_url, ''));
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if not public.econmind_is_independent_location_evidence_url(clean_evidence_url) then raise exception 'Provide an independent HTTPS school or institutional evidence URL'; end if;
  if clean_note is not null and char_length(clean_note) > 2000 then raise exception 'Review note must be 2000 characters or fewer'; end if;
  select * into application from public.league_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if application.status in ('approved', 'rejected') then raise exception 'This application has already been decided'; end if;
  if application.location_status <> 'pending_review' then raise exception 'Only a pending location can use exact catalog matching'; end if;
  if application.submitted_area_key is null or application.submitted_city is null then raise exception 'The applicant must submit a location first'; end if;

  select count(*) into candidate_count
  from public.school_location_catalog catalog
  where catalog.area_key = application.submitted_area_key
    and public.econmind_location_text_key(catalog.city) = public.econmind_location_text_key(application.submitted_city)
    and public.econmind_location_text_key(catalog.administrative_area)
      = public.econmind_location_text_key(application.submitted_administrative_area);

  if candidate_count <> 1 then raise exception 'The submitted location does not match exactly one verified city'; end if;

  select * into matched_location
  from public.school_location_catalog catalog
  where catalog.area_key = application.submitted_area_key
    and public.econmind_location_text_key(catalog.city) = public.econmind_location_text_key(application.submitted_city)
    and public.econmind_location_text_key(catalog.administrative_area)
      = public.econmind_location_text_key(application.submitted_administrative_area)
  limit 1;

  update public.league_applications
  set location_status = 'verified',
      location_key = matched_location.location_key,
      location_source = 'catalog_match',
      location_public_note = null,
      location_reviewed_by = auth.uid(),
      location_reviewed_at = timezone('utc', now())
  where id = application.id;

  insert into public.school_location_review_events (
    application_id, event_type, from_status, to_status, location_key,
    evidence_url, note, actor_user_id, payload
  ) values (
    application.id, 'catalog_matched', application.location_status, 'verified',
    matched_location.location_key, clean_evidence_url, clean_note, auth.uid(),
    jsonb_build_object(
      'catalog_source', matched_location.source_name,
      'catalog_source_url', matched_location.source_url
    )
  );

  return jsonb_build_object(
    'application_id', application.id,
    'location_status', 'verified',
    'location_key', matched_location.location_key,
    'city', matched_location.city
  );
end;
$$;

create or replace function public.verify_league_application_location(
  p_application_id uuid,
  p_geoname_id bigint,
  p_city text,
  p_area_key text,
  p_area_label text,
  p_administrative_area text,
  p_latitude double precision,
  p_longitude double precision,
  p_evidence_url text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.league_applications%rowtype;
  resolved_key text;
  clean_evidence_url text := trim(coalesce(p_evidence_url, ''));
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if not public.econmind_is_independent_location_evidence_url(clean_evidence_url) then raise exception 'Provide an independent HTTPS school or institutional evidence URL'; end if;
  if clean_note is not null and char_length(clean_note) > 2000 then raise exception 'Review note must be 2000 characters or fewer'; end if;
  select * into application from public.league_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if application.status in ('approved', 'rejected') then raise exception 'This application has already been decided'; end if;
  if application.location_status = 'verified' then raise exception 'Withdraw the verified application location before replacing it'; end if;

  resolved_key := public.register_school_location_catalog_entry(
    p_geoname_id, p_city, p_area_key, p_area_label, p_administrative_area,
    p_latitude, p_longitude
  );

  update public.league_applications
  set location_status = 'verified',
      location_key = resolved_key,
      location_source = 'admin_review',
      location_public_note = null,
      location_reviewed_by = auth.uid(),
      location_reviewed_at = timezone('utc', now())
  where id = application.id;

  insert into public.school_location_review_events (
    application_id, event_type, from_status, to_status, location_key,
    evidence_url, note, actor_user_id
  ) values (
    application.id, 'verified', application.location_status, 'verified',
    resolved_key, clean_evidence_url, clean_note, auth.uid()
  );

  return jsonb_build_object(
    'application_id', application.id,
    'location_status', 'verified',
    'location_key', resolved_key
  );
end;
$$;

create or replace function public.request_league_application_location_correction(
  p_application_id uuid,
  p_public_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.league_applications%rowtype;
  clean_public_note text := trim(coalesce(p_public_note, ''));
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if char_length(clean_public_note) not between 2 and 500 then raise exception 'Explain the required correction in 2 to 500 characters'; end if;
  select * into application from public.league_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if application.status in ('approved', 'rejected') then raise exception 'This application has already been decided'; end if;

  update public.league_applications
  set location_status = 'needs_correction',
      location_key = null,
      location_source = null,
      location_public_note = clean_public_note,
      location_reviewed_by = auth.uid(),
      location_reviewed_at = timezone('utc', now())
  where id = application.id;

  insert into public.school_location_review_events (
    application_id, event_type, from_status, to_status, note, actor_user_id
  ) values (
    application.id, 'needs_correction', application.location_status,
    'needs_correction', clean_public_note, auth.uid()
  );

  return jsonb_build_object(
    'application_id', application.id,
    'location_status', 'needs_correction'
  );
end;
$$;

create or replace function public.verify_league_school_location(
  p_school_id uuid,
  p_geoname_id bigint,
  p_city text,
  p_area_key text,
  p_area_label text,
  p_administrative_area text,
  p_latitude double precision,
  p_longitude double precision,
  p_evidence_url text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_school public.schools%rowtype;
  resolved_key text;
  clean_evidence_url text := trim(coalesce(p_evidence_url, ''));
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if not public.econmind_is_independent_location_evidence_url(clean_evidence_url) then raise exception 'Provide an independent HTTPS school or institutional evidence URL'; end if;
  if clean_note is not null and char_length(clean_note) > 2000 then raise exception 'Review note must be 2000 characters or fewer'; end if;
  select * into selected_school from public.schools where id = p_school_id for update;
  if not found then raise exception 'School not found'; end if;
  if selected_school.location_status = 'verified' then raise exception 'Withdraw the verified school location before replacing it'; end if;

  resolved_key := public.register_school_location_catalog_entry(
    p_geoname_id, p_city, p_area_key, p_area_label, p_administrative_area,
    p_latitude, p_longitude
  );

  update public.schools
  set city = trim(p_city),
      location_status = 'verified',
      location_key = resolved_key,
      location_source = 'admin_review',
      location_public_note = null,
      location_verified_by = auth.uid(),
      location_verified_at = timezone('utc', now())
  where id = selected_school.id;

  insert into public.school_location_review_events (
    school_id, event_type, from_status, to_status, location_key,
    evidence_url, note, actor_user_id
  ) values (
    selected_school.id, 'verified', selected_school.location_status, 'verified',
    resolved_key, clean_evidence_url, clean_note, auth.uid()
  );

  return jsonb_build_object(
    'school_id', selected_school.id,
    'location_status', 'verified',
    'location_key', resolved_key
  );
end;
$$;

create or replace function public.request_league_school_location_correction(
  p_school_id uuid,
  p_public_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_school public.schools%rowtype;
  clean_public_note text := trim(coalesce(p_public_note, ''));
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if char_length(clean_public_note) not between 2 and 500 then raise exception 'Explain the required correction in 2 to 500 characters'; end if;

  select * into selected_school from public.schools where id = p_school_id for update;
  if not found then raise exception 'School not found'; end if;
  if selected_school.location_status <> 'verified' or selected_school.location_key is null then
    raise exception 'Only a verified school location can be withdrawn from the map';
  end if;

  update public.schools
  set city = null,
      location_status = 'needs_correction',
      location_key = null,
      location_source = null,
      location_public_note = clean_public_note,
      location_verified_by = null,
      location_verified_at = null
  where id = selected_school.id;

  insert into public.school_location_review_events (
    school_id, event_type, from_status, to_status, location_key,
    note, actor_user_id
  ) values (
    selected_school.id, 'needs_correction', selected_school.location_status,
    'needs_correction', selected_school.location_key, clean_public_note, auth.uid()
  );

  return jsonb_build_object(
    'school_id', selected_school.id,
    'location_status', 'needs_correction'
  );
end;
$$;

drop function if exists public.complete_econmind_onboarding(text, uuid, text, text, text);
drop function if exists public.complete_econmind_onboarding(text, uuid, text, text, text, text, text, text, text);

create function public.complete_econmind_onboarding(
  p_path text,
  p_school_id uuid default null,
  p_school_name text default null,
  p_club_name text default null,
  p_curriculum_system text default null,
  p_submitted_area_key text default null,
  p_submitted_area_label text default null,
  p_submitted_administrative_area text default null,
  p_submitted_city text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_school public.schools%rowtype;
  display_name_value text;
  created_application public.league_applications%rowtype;
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

  select coalesce(nullif(trim(display_name), ''), 'EconMind member')
  into display_name_value
  from public.profiles
  where user_id = auth.uid();

  select * into created_application
  from public.submit_league_application(
    p_school_name,
    p_club_name,
    display_name_value,
    p_curriculum_system,
    1,
    7,
    'English',
    'either',
    false,
    'Created from the first-session account chooser.',
    p_submitted_area_key,
    p_submitted_area_label,
    p_submitted_administrative_area,
    p_submitted_city
  );

  update public.profiles
  set onboarding_path = 'create_school', onboarding_completed_at = timezone('utc', now())
  where user_id = auth.uid();

  return jsonb_build_object(
    'path', 'create_school',
    'application_id', created_application.id,
    'status', created_application.status,
    'location_status', created_application.location_status
  );
end;
$$;

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
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_status not in ('approved', 'rejected', 'under_review') then raise exception 'Invalid application status'; end if;
  select * into application from public.league_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if application.status in ('approved', 'rejected') then raise exception 'This application has already been decided'; end if;

  if p_status = 'approved' then
    if application.location_status <> 'verified' or application.location_key is null then
      raise exception 'Verify the school location before approving this application';
    end if;
    select * into selected_location
    from public.school_location_catalog
    where location_key = application.location_key;
    if not found then raise exception 'Verified location is not available in the canonical catalog'; end if;

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
      if existing_school.location_status = 'verified'
        and existing_school.location_key is distinct from application.location_key then
        raise exception 'The approved school already has a different verified location';
      end if;
      new_school_id := existing_school.id;
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
    else
      insert into public.schools(
        name, club_name, city, curriculum_system, status, created_by,
        liaison_user_id, location_status, location_key, location_source,
        location_verified_by, location_verified_at
      ) values (
        coalesce(public.econmind_canonical_school_name(application_identity_key), application.school_name),
        application.club_name,
        selected_location.city,
        application.curriculum_system,
        'approved',
        application.applicant_user_id,
        application.applicant_user_id,
        'verified',
        selected_location.location_key,
        'application_review',
        application.location_reviewed_by,
        application.location_reviewed_at
      ) returning id into new_school_id;
    end if;

    insert into public.school_location_review_events (
      application_id, school_id, event_type, from_status, to_status,
      location_key, actor_user_id, payload
    ) values (
      application.id, new_school_id, 'application_applied',
      existing_school.location_status, 'verified', selected_location.location_key,
      auth.uid(), jsonb_build_object('application_status', 'approved')
    );

    update public.profiles
    set school_id = new_school_id, platform_role = 'school_leader'
    where user_id = application.applicant_user_id;
  end if;

  update public.league_applications
  set status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = timezone('utc', now())
  where id = application.id;

  return jsonb_build_object('application_id', application.id, 'status', p_status, 'school_id', new_school_id);
end;
$$;

create or replace function public.get_public_league_directory_v2()
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
  achievements jsonb,
  location_status text,
  location_source text,
  location_key text,
  location_city text,
  location_area_key text,
  location_area_label text,
  location_administrative_area text,
  location_latitude double precision,
  location_longitude double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select directory.school_id,
    directory.school_name,
    directory.club_name,
    directory.city,
    directory.description,
    directory.logo_url,
    directory.member_count,
    directory.team_count,
    directory.current_season_points,
    directory.official_challenge_count,
    directory.official_wins,
    directory.achievements,
    school.location_status,
    school.location_source,
    case when school.location_status = 'verified' then location.location_key else null end,
    case when school.location_status = 'verified' then location.city else null end,
    case when school.location_status = 'verified' then location.area_key else null end,
    case when school.location_status = 'verified' then location.area_label else null end,
    case when school.location_status = 'verified' then location.administrative_area else null end,
    case when school.location_status = 'verified' then location.latitude else null end,
    case when school.location_status = 'verified' then location.longitude else null end
  from public.get_public_league_directory() directory
  join public.schools school on school.id = directory.school_id
  left join public.school_location_catalog location on location.location_key = school.location_key
  order by directory.school_name;
$$;

alter table public.school_location_catalog enable row level security;
alter table public.school_location_review_events enable row level security;

drop policy if exists school_location_catalog_admin_select on public.school_location_catalog;
create policy school_location_catalog_admin_select
  on public.school_location_catalog for select to authenticated
  using (public.is_platform_admin());

drop policy if exists school_location_review_events_admin_select on public.school_location_review_events;
create policy school_location_review_events_admin_select
  on public.school_location_review_events for select to authenticated
  using (public.is_platform_admin());

drop policy if exists league_applications_insert_own on public.league_applications;
drop policy if exists schools_update_leaders on public.schools;

revoke insert, update, delete on public.league_applications from authenticated, anon;
revoke insert, update, delete on public.schools from authenticated, anon;
revoke all on public.school_location_catalog from public, anon;
revoke all on public.school_location_review_events from public, anon;
grant select on public.school_location_catalog, public.school_location_review_events to authenticated;

revoke all on function public.register_school_location_catalog_entry(bigint, text, text, text, text, double precision, double precision) from public, anon, authenticated;
revoke all on function public.submit_league_application(text, text, text, text, integer, integer, text, text, boolean, text, text, text, text, text) from public, anon;
revoke all on function public.resubmit_league_application_location(uuid, text, text, text, text) from public, anon;
revoke all on function public.match_league_application_location(uuid, text, text) from public, anon;
revoke all on function public.verify_league_application_location(uuid, bigint, text, text, text, text, double precision, double precision, text, text) from public, anon;
revoke all on function public.request_league_application_location_correction(uuid, text) from public, anon;
revoke all on function public.verify_league_school_location(uuid, bigint, text, text, text, text, double precision, double precision, text, text) from public, anon;
revoke all on function public.request_league_school_location_correction(uuid, text) from public, anon;
revoke all on function public.complete_econmind_onboarding(text, uuid, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.review_league_application(uuid, text) from public, anon;
revoke all on function public.get_public_league_directory_v2() from public;

grant execute on function public.submit_league_application(text, text, text, text, integer, integer, text, text, boolean, text, text, text, text, text) to authenticated;
grant execute on function public.resubmit_league_application_location(uuid, text, text, text, text) to authenticated;
grant execute on function public.match_league_application_location(uuid, text, text) to authenticated;
grant execute on function public.verify_league_application_location(uuid, bigint, text, text, text, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.request_league_application_location_correction(uuid, text) to authenticated;
grant execute on function public.verify_league_school_location(uuid, bigint, text, text, text, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.request_league_school_location_correction(uuid, text) to authenticated;
grant execute on function public.complete_econmind_onboarding(text, uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.review_league_application(uuid, text) to authenticated;
grant execute on function public.get_public_league_directory_v2() to anon, authenticated;
