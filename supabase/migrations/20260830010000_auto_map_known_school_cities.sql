-- A city selected from the verified catalog is safe to use immediately.  We
-- still keep new city labels in the review flow: there is no fuzzy matching,
-- inference or runtime geocoding.

insert into public.school_location_catalog (
  location_key, geoname_id, city, area_key, area_label, administrative_area,
  latitude, longitude, source_url, source_name, source_snapshot_date
) values (
  'geonames:2158177', 2158177, 'Melbourne', 'geoarea:AU', 'Australia', 'Victoria',
  -37.814, 144.96332, 'https://www.geonames.org/2158177/', 'GeoNames', '2026-08-30'
)
on conflict (location_key) do update set
  city = excluded.city,
  area_key = excluded.area_key,
  area_label = excluded.area_label,
  administrative_area = excluded.administrative_area,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  source_url = excluded.source_url,
  source_name = excluded.source_name,
  source_snapshot_date = excluded.source_snapshot_date;

create or replace function public.submit_league_application(
  p_school_name text, p_club_name text, p_contact_person text, p_curriculum_system text,
  p_expected_teams integer, p_expected_members integer, p_preferred_language text,
  p_preferred_format text, p_organising_committee_interest boolean, p_notes text,
  p_submitted_area_key text, p_submitted_area_label text,
  p_submitted_administrative_area text, p_submitted_city text
)
returns public.league_applications
language plpgsql security definer set search_path = public
as $$
declare
  created_application public.league_applications%rowtype;
  matched_location public.school_location_catalog%rowtype;
  candidate_count integer := 0;
  resolved_location_status text := 'pending_review';
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
  if exists (select 1 from public.schools where status = 'approved' and public.econmind_school_identity_key(name) = public.econmind_school_identity_key(clean_school_name)) then
    raise exception 'This school is already available. Choose it from the approved-school list.';
  end if;
  if exists (select 1 from public.league_applications where applicant_user_id = auth.uid() and status in ('submitted', 'under_review')) then
    raise exception 'You already have an active school application';
  end if;

  -- Only exact city matches within the submitted country/area are accepted.
  select count(*) into candidate_count from public.school_location_catalog catalog
  where catalog.area_key = clean_area_key
    and public.econmind_location_text_key(catalog.city) = public.econmind_location_text_key(clean_city);
  if candidate_count = 1 then
    select * into matched_location from public.school_location_catalog catalog
    where catalog.area_key = clean_area_key
      and public.econmind_location_text_key(catalog.city) = public.econmind_location_text_key(clean_city);
    resolved_location_status := 'verified';
  end if;

  insert into public.league_applications (
    applicant_user_id, school_name, club_name, contact_person, curriculum_system,
    expected_teams, expected_members, preferred_language, preferred_format,
    organising_committee_interest, notes, submitted_area_key, submitted_area_label,
    submitted_administrative_area, submitted_city, location_status, location_key,
    location_source, location_reviewed_at
  ) values (
    auth.uid(), clean_school_name, clean_club_name, clean_contact_person, clean_curriculum_system,
    p_expected_teams, p_expected_members, p_preferred_language, p_preferred_format,
    coalesce(p_organising_committee_interest, false), clean_notes, clean_area_key, clean_area_label,
    clean_administrative_area, clean_city, resolved_location_status,
    case when candidate_count = 1 then matched_location.location_key else null end,
    case when candidate_count = 1 then 'catalog_match' else null end,
    case when candidate_count = 1 then timezone('utc', now()) else null end
  ) returning * into created_application;

  insert into public.school_location_review_events (
    application_id, event_type, from_status, to_status, actor_user_id, location_key, payload
  ) values (
    created_application.id,
    case when candidate_count = 1 then 'catalog_matched' else 'submitted' end,
    'missing', resolved_location_status, auth.uid(),
    case when candidate_count = 1 then matched_location.location_key else null end,
    jsonb_build_object('submitted_area_key', clean_area_key, 'submitted_area_label', clean_area_label,
      'submitted_administrative_area', clean_administrative_area, 'submitted_city', clean_city,
      'automatic_catalog_match', candidate_count = 1)
  );
  return created_application;
end;
$$;

create or replace function public.resubmit_league_application_location(
  p_application_id uuid, p_submitted_area_key text, p_submitted_area_label text,
  p_submitted_administrative_area text, p_submitted_city text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  application public.league_applications%rowtype;
  matched_location public.school_location_catalog%rowtype;
  candidate_count integer := 0;
  previous_status text;
  resolved_location_status text := 'pending_review';
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

  select count(*) into candidate_count from public.school_location_catalog catalog
  where catalog.area_key = clean_area_key
    and public.econmind_location_text_key(catalog.city) = public.econmind_location_text_key(clean_city);
  if candidate_count = 1 then
    select * into matched_location from public.school_location_catalog catalog
    where catalog.area_key = clean_area_key
      and public.econmind_location_text_key(catalog.city) = public.econmind_location_text_key(clean_city);
    resolved_location_status := 'verified';
  end if;
  previous_status := application.location_status;
  update public.league_applications set
    submitted_area_key = clean_area_key, submitted_area_label = clean_area_label,
    submitted_administrative_area = clean_administrative_area, submitted_city = clean_city,
    location_status = resolved_location_status,
    location_key = case when candidate_count = 1 then matched_location.location_key else null end,
    location_source = case when candidate_count = 1 then 'catalog_match' else null end,
    location_public_note = null, location_reviewed_by = null,
    location_reviewed_at = case when candidate_count = 1 then timezone('utc', now()) else null end
  where id = application.id;
  insert into public.school_location_review_events (
    application_id, event_type, from_status, to_status, actor_user_id, location_key, payload
  ) values (
    application.id, case when candidate_count = 1 then 'catalog_matched' else 'resubmitted' end,
    previous_status, resolved_location_status, auth.uid(),
    case when candidate_count = 1 then matched_location.location_key else null end,
    jsonb_build_object('submitted_area_key', clean_area_key, 'submitted_area_label', clean_area_label,
      'submitted_administrative_area', clean_administrative_area, 'submitted_city', clean_city,
      'automatic_catalog_match', candidate_count = 1)
  );
  return jsonb_build_object('application_id', application.id, 'location_status', resolved_location_status,
    'location_key', case when candidate_count = 1 then matched_location.location_key else null end,
    'city', clean_city);
end;
$$;

-- Finish the last legacy gaps.  The Shanghai UUID corrects the transposed
-- character in the preceding backfill migration.
with assignments(school_id, city, location_key) as (
  values
    ('4835a5db-d779-41ca-bd8b-2f38328e6b45'::uuid, 'Chengdu', 'geonames:1815286'),
    ('558ed747-91dd-4a89-a847-e3168148a29b'::uuid, 'Nanchang', 'geonames:1800163'),
    ('4d03e2dd-ba83-4b3d-bd4f-d739dfc9f134'::uuid, 'Melbourne', 'geonames:2158177'),
    ('7dda18da-62b7-46cd-bd73-f1adc22ea25a'::uuid, 'Shanghai', 'geonames:1796236')
)
update public.schools school
set city = assignments.city,
    location_status = 'verified',
    location_key = assignments.location_key,
    location_source = 'admin_review',
    location_verified_at = timezone('utc', now())
from assignments
where school.id = assignments.school_id;
