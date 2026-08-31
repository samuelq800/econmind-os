-- gov.uk is no longer an approved Daily Brief candidate source.
-- Deleting a source preserves any historical briefing text and attribution:
-- daily_brief_items.source_id uses ON DELETE SET NULL, while source_name and
-- source_url remain stored with the item.
delete from public.daily_brief_sources
where lower(feed_url) ~ '^https://([a-z0-9-]+\.)*gov\.uk(?:[:/]|$)';

-- Keep the candidate-source register free of this domain even if an
-- administrator later attempts to add it again.
alter table public.daily_brief_sources
  drop constraint if exists daily_brief_sources_not_gov_uk_check;

alter table public.daily_brief_sources
  add constraint daily_brief_sources_not_gov_uk_check
  check (lower(feed_url) !~ '^https://([a-z0-9-]+\.)*gov\.uk(?:[:/]|$)');
