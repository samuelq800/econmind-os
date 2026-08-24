-- Keep Daily Brief source-led, current, and attribution-safe.

alter table public.daily_brief_items
  add column if not exists summary_kind text not null default 'source_feed_excerpt'
  check (summary_kind in ('source_feed_excerpt'));

-- Earlier collector versions could fall back to a full feed content body. Retain
-- only a short source-feed excerpt before enforcing the new storage boundary.
update public.daily_brief_items
set summary = rtrim(left(summary, 359)) || '…'
where char_length(summary) > 360;

alter table public.daily_brief_items
  add constraint daily_brief_items_source_excerpt_length
  check (char_length(summary) between 1 and 360);

alter table public.daily_brief_items
  alter column published_source_at set not null;

update public.daily_brief_settings
set minimum_score = greatest(minimum_score, 55),
    publication_mode = 'review';

alter table public.daily_brief_settings
  drop constraint if exists daily_brief_settings_publication_mode_check;

alter table public.daily_brief_settings
  add constraint daily_brief_settings_publication_mode_check
  check (publication_mode = 'review');

alter table public.daily_brief_settings
  add constraint daily_brief_settings_minimum_quality_check
  check (minimum_score between 55 and 100);

create index if not exists daily_brief_items_source_date_idx
  on public.daily_brief_items(status, published_source_at desc);

-- This is an attribution label for the official public feed, not a partnership
-- claim. Existing administrators can still disable the source; conflict handling
-- deliberately leaves the enabled flag untouched.
insert into public.daily_brief_sources(name, feed_url, source_type, priority)
values ('WTO News', 'https://www.wto.org/library/rss/latest_news_e.xml', 'rss', 100)
on conflict (feed_url) do update
set name = excluded.name,
    source_type = excluded.source_type,
    priority = greatest(public.daily_brief_sources.priority, excluded.priority);

update public.daily_brief_items
set source_name = 'WTO News'
where source_url = 'https://www.wto.org/library/rss/latest_news_e.xml';

comment on column public.daily_brief_items.summary_kind is
  'Provenance of the short summary. Daily Brief currently stores source-feed excerpts only.';
