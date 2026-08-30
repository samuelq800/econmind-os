-- Complete the public school-location register for the schools whose submitted
-- city had been saved before the verified-location workflow was introduced.
--
-- Locations are deliberately city centroids, not campus addresses.  This keeps
-- the public map useful without exposing more precise school-location data.

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
  ('geonames:1815456', 1815456, 'Changzhou', 'geoarea:CN', 'China — mainland areas', 'Jiangsu', 31.77359, 119.95401, 'GeoNames', date '2026-08-30', 'https://www.geonames.org/1815456/'),
  ('geonames:1810845', 1810845, 'Foshan', 'geoarea:CN', 'China — mainland areas', 'Guangdong', 23.02677, 113.13148, 'GeoNames', date '2026-08-30', 'https://www.geonames.org/1810845/'),
  ('geonames:1808722', 1808722, 'Hefei', 'geoarea:CN', 'China — mainland areas', 'Anhui', 31.86389, 117.28083, 'GeoNames', date '2026-08-30', 'https://www.geonames.org/1808722/'),
  ('geonames:1809858', 1809858, 'Guangzhou', 'geoarea:CN', 'China — mainland areas', 'Guangdong', 23.11667, 113.25000, 'GeoNames', date '2026-08-30', 'https://www.geonames.org/1809858/'),
  ('geonames:1819729', 1819729, 'Hong Kong', 'geoarea:HK', 'Hong Kong SAR', null, 22.27832, 114.17469, 'GeoNames', date '2026-08-30', 'https://www.geonames.org/1819729/'),
  ('geonames:1790630', 1790630, 'Xi’an', 'geoarea:CN', 'China — mainland areas', 'Shaanxi', 34.25833, 108.92861, 'GeoNames', date '2026-08-30', 'https://www.geonames.org/1790630/'),
  ('geonames:1795855', 1795855, 'Shijiazhuang', 'geoarea:CN', 'China — mainland areas', 'Hebei', 38.04139, 114.47861, 'GeoNames', date '2026-08-30', 'https://www.geonames.org/1795855/'),
  ('geonames:1806408', 1806408, 'Yangjiang', 'geoarea:CN', 'China — mainland areas', 'Guangdong', 21.85563, 111.96272, 'GeoNames', date '2026-08-30', 'https://www.geonames.org/1806408/')
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

-- The IDs make this robust against similar English and Chinese school names.
-- River Valley intentionally shares Singapore's city marker with Victoria
-- World Academy, as requested by the school register.
with assignments (school_id, city, location_key) as (
  values
    ('89988e87-7571-4e15-9224-eac128709ca1'::uuid, 'Beijing', 'geonames:1816670'),
    ('558153bb-2060-42ce-8be3-2489148d74f4'::uuid, 'Beijing', 'geonames:1816670'),
    ('dae7b6db-93f9-461a-a113-e27d38648050'::uuid, 'Changzhou', 'geonames:1815456'),
    ('4aa15aae-62f8-43ff-89fa-f600f5b3af36'::uuid, 'Chongqing', 'geonames:1814906'),
    ('ff831755-5664-4872-be4b-4b57ef2023a3'::uuid, 'Shanghai', 'geonames:1796236'),
    ('2d1bf67c-a693-45b7-a094-91cc832b634a'::uuid, 'Foshan', 'geonames:1810845'),
    ('a3f84645-41a3-415f-acd8-884c3373ee60'::uuid, 'Foshan', 'geonames:1810845'),
    ('338d8feb-ff45-4f36-96a6-9c95503b48de'::uuid, 'Hefei', 'geonames:1808722'),
    ('156c5123-461b-4e56-b3a0-ba6dd67a305c'::uuid, 'Guangzhou', 'geonames:1809858'),
    ('e293a9ea-40c5-4829-947d-a84e8af2d69f'::uuid, 'Hong Kong', 'geonames:1819729'),
    ('3ca8d49e-099f-4bce-99cd-cc494d19aff9'::uuid, 'Jinan', 'geonames:1805753'),
    ('677241b3-2af6-4622-bc1c-594f75cb1720'::uuid, 'Ningbo', 'geonames:1799397'),
    ('56118c2d-3b7a-45d1-87ef-d750aca2ba0b'::uuid, 'Qingdao', 'geonames:1797929'),
    ('6baf5e86-e188-4e00-8970-fbdc67d44c6a'::uuid, 'Singapore', 'geonames:1880252'),
    ('9ba52832-018b-41dd-be58-e6af3ed04a89'::uuid, 'Shanghai', 'geonames:1796236'),
    ('da51e47b-e6f3-49c4-b750-f5ba1f64a53b'::uuid, 'Chengdu', 'geonames:1815286'),
    ('cb567dd1-fd24-4a35-91af-c947e7bf883b'::uuid, 'Shanghai', 'geonames:1796236'),
    ('3dcebd64-0aae-4772-9a0b-ccc4f4a6608e'::uuid, 'Xi’an', 'geonames:1790630'),
    ('d08a2855-1b4d-4d1d-87bf-56162e77557c'::uuid, 'Shanghai', 'geonames:1796236'),
    ('7dda18da-62f7-46cd-bd73-f1adc22ea25a'::uuid, 'Shanghai', 'geonames:1796236'),
    ('bd12bf4a-4a4e-4962-9340-1d335f19230a'::uuid, 'Shanghai', 'geonames:1796236'),
    ('93d81e3a-32af-4fce-b70f-e8e2a48337fd'::uuid, 'Hefei', 'geonames:1808722'),
    ('8e9a340c-ab42-47fc-a7f1-2daf0c4f0361'::uuid, 'Hefei', 'geonames:1808722'),
    ('13109642-8cc8-418e-a0c5-0b503ab4d83e'::uuid, 'Chengdu', 'geonames:1815286'),
    ('02653b08-ba9a-415f-82e6-aa76403c5214'::uuid, 'Nanchang', 'geonames:1800163'),
    ('1c50f050-69d7-4592-a219-65c9b49479d4'::uuid, 'Shijiazhuang', 'geonames:1795855'),
    ('5ae13186-30ee-4941-bd1c-140666297cc4'::uuid, 'Shijiazhuang', 'geonames:1795855'),
    ('9aefb390-3e16-429f-b42a-a907cabb084a'::uuid, 'Chongqing', 'geonames:1814906'),
    ('28dd90b3-25cb-4835-b992-4d24e34215bc'::uuid, 'Chongqing', 'geonames:1814906'),
    ('bfe03e62-950d-47db-b2cf-e61b07b311de'::uuid, 'Yangjiang', 'geonames:1806408')
)
update public.schools as school
set city = assignments.city,
    location_status = 'verified',
    location_key = assignments.location_key,
    location_source = 'admin_review',
    location_public_note = null,
    location_verified_at = timezone('utc', now())
from assignments
where school.id = assignments.school_id;

-- After this migration, every approved school returned by
-- get_public_league_directory_v2() has a verified public city marker.
