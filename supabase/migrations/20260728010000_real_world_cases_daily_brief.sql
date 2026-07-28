-- EconMind OS Real-World Cases and Daily Brief
-- Public content is deliberately small and review-first. Learner work remains private.

create table public.economic_cases (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,96}$'),
  title text not null check (char_length(title) between 1 and 180),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  definition jsonb not null default '{}'::jsonb check (jsonb_typeof(definition) = 'object'),
  created_by uuid references public.profiles(user_id) on delete set null,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.case_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  case_slug text not null check (case_slug ~ '^[a-z0-9-]{3,96}$'),
  title text not null default 'Untitled case run' check (char_length(title) between 1 and 160),
  current_stage text not null default 'context' check (current_stage in ('context','problem','mapping','conditions','prediction','simulation','comparison','evaluation','recommendation','reflection')),
  problem_answer jsonb not null default '{}'::jsonb check (jsonb_typeof(problem_answer) = 'object'),
  predictions jsonb not null default '{}'::jsonb check (jsonb_typeof(predictions) = 'object'),
  policy_settings jsonb not null default '{}'::jsonb check (jsonb_typeof(policy_settings) = 'object'),
  scenarios jsonb not null default '{}'::jsonb check (jsonb_typeof(scenarios) = 'object'),
  results jsonb not null default '{}'::jsonb check (jsonb_typeof(results) = 'object'),
  evaluation jsonb not null default '{}'::jsonb check (jsonb_typeof(evaluation) = 'object'),
  recommendation jsonb not null default '{}'::jsonb check (jsonb_typeof(recommendation) = 'object'),
  completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.daily_brief_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  feed_url text not null unique check (feed_url ~ '^https://'),
  source_type text not null default 'rss' check (source_type in ('rss','atom')),
  priority smallint not null default 50 check (priority between 0 and 100),
  enabled boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.daily_brief_settings (
  id boolean primary key default true check (id),
  publication_mode text not null default 'review' check (publication_mode in ('review','automatic')),
  minimum_score numeric not null default 55 check (minimum_score between 0 and 100),
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);
insert into public.daily_brief_settings(id) values (true) on conflict (id) do nothing;

create table public.daily_brief_items (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{6,160}$'),
  source_id uuid references public.daily_brief_sources(id) on delete set null,
  source_name text not null check (char_length(source_name) between 1 and 120),
  source_url text not null check (source_url ~ '^https://'),
  canonical_url text not null check (canonical_url ~ '^https://'),
  title text not null check (char_length(title) between 1 and 500),
  summary text not null check (char_length(summary) between 1 and 5000),
  published_source_at timestamptz,
  fetched_at timestamptz not null default timezone('utc', now()),
  topic_tags text[] not null default '{}'::text[],
  case_slugs text[] not null default '{}'::text[],
  teaching_score numeric not null default 0 check (teaching_score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb check (jsonb_typeof(score_breakdown) = 'object'),
  status text not null default 'candidate' check (status in ('candidate','selected','published','rejected','archived')),
  review_note text check (review_note is null or char_length(review_note) <= 3000),
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  fingerprint text not null unique check (fingerprint ~ '^[a-f0-9]{32,128}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.daily_brief_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('cron','manual')),
  status text not null check (status in ('running','completed','failed','skipped')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  sources_checked integer not null default 0 check (sources_checked >= 0),
  candidates_found integer not null default 0 check (candidates_found >= 0),
  items_inserted integer not null default 0 check (items_inserted >= 0),
  error_message text check (error_message is null or char_length(error_message) <= 5000),
  run_by uuid references public.profiles(user_id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index economic_cases_public_idx on public.economic_cases(status, published_at desc) where status = 'published';
create index case_runs_user_updated_idx on public.case_runs(user_id, updated_at desc);
create index case_runs_user_case_idx on public.case_runs(user_id, case_slug, updated_at desc);
create index case_runs_settings_gin_idx on public.case_runs using gin(policy_settings);
create index daily_brief_sources_enabled_idx on public.daily_brief_sources(priority desc) where enabled = true;
create index daily_brief_items_public_idx on public.daily_brief_items(status, published_at desc) where status = 'published';
create index daily_brief_items_review_idx on public.daily_brief_items(status, teaching_score desc, created_at desc);
create index daily_brief_items_tags_gin_idx on public.daily_brief_items using gin(topic_tags);
create index daily_brief_jobs_started_idx on public.daily_brief_jobs(started_at desc);

create trigger economic_cases_set_updated_at before update on public.economic_cases for each row execute function public.set_updated_at();
create trigger case_runs_set_updated_at before update on public.case_runs for each row execute function public.set_updated_at();
create trigger daily_brief_sources_set_updated_at before update on public.daily_brief_sources for each row execute function public.set_updated_at();
create trigger daily_brief_settings_set_updated_at before update on public.daily_brief_settings for each row execute function public.set_updated_at();
create trigger daily_brief_items_set_updated_at before update on public.daily_brief_items for each row execute function public.set_updated_at();

alter table public.economic_cases enable row level security;
alter table public.case_runs enable row level security;
alter table public.daily_brief_sources enable row level security;
alter table public.daily_brief_settings enable row level security;
alter table public.daily_brief_items enable row level security;
alter table public.daily_brief_jobs enable row level security;

create policy "economic_cases_public_read" on public.economic_cases for select to anon, authenticated using (status = 'published');
create policy "economic_cases_teacher_read" on public.economic_cases for select to authenticated using (public.is_teacher());
create policy "economic_cases_teacher_write" on public.economic_cases for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy "case_runs_own_select" on public.case_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "case_runs_own_insert" on public.case_runs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "case_runs_own_update" on public.case_runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "case_runs_own_delete" on public.case_runs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "daily_brief_items_public_read" on public.daily_brief_items for select to anon, authenticated using (status = 'published');
create policy "daily_brief_items_teacher_read" on public.daily_brief_items for select to authenticated using (public.is_teacher());
create policy "daily_brief_items_teacher_write" on public.daily_brief_items for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy "daily_brief_sources_teacher_only" on public.daily_brief_sources for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy "daily_brief_settings_teacher_only" on public.daily_brief_settings for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy "daily_brief_jobs_teacher_only" on public.daily_brief_jobs for select to authenticated using (public.is_teacher());

grant select on public.economic_cases, public.daily_brief_items to anon, authenticated;
grant select, insert, update, delete on public.case_runs, public.economic_cases, public.daily_brief_sources, public.daily_brief_settings, public.daily_brief_items, public.daily_brief_jobs to authenticated;

-- Seed only lightweight metadata. Full teaching definitions live in the versioned
-- frontend library and may later be copied into definition by a teacher workflow.
insert into public.economic_cases (slug, title, status, definition, published_at) values
  ('oil-price-shock', 'Oil Price Shock', 'published', '{"version":1}'::jsonb, timezone('utc', now())),
  ('carbon-tax', 'Carbon Tax Design', 'published', '{"version":1}'::jsonb, timezone('utc', now())),
  ('housing-rent-control', 'Housing Rent Control', 'published', '{"version":1}'::jsonb, timezone('utc', now())),
  ('minimum-wage', 'Minimum Wage', 'published', '{"version":1}'::jsonb, timezone('utc', now())),
  ('tariff-conflict', 'Tariff Conflict', 'published', '{"version":1}'::jsonb, timezone('utc', now())),
  ('restaurant-food-waste', 'Restaurant Food Waste', 'published', '{"version":1}'::jsonb, timezone('utc', now()))
on conflict (slug) do nothing;
