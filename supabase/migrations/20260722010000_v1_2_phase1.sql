-- EconMind OS V1.2 Phase 1
-- Keeps cloud usage bounded: one progress row and one activity row per
-- user/module/activity type. Saved scenarios continue to use model_runs.

alter table public.model_runs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.model_runs
  drop constraint if exists model_runs_metadata_is_object;

alter table public.model_runs
  add constraint model_runs_metadata_is_object
  check (jsonb_typeof(metadata) = 'object');

create table if not exists public.recent_activity (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  module_slug text not null check (module_slug ~ '^[a-z0-9-]{2,64}$'),
  activity_type text not null check (activity_type in ('visit', 'simulation_run', 'save', 'completion')),
  event_count integer not null default 1 check (event_count between 1 and 2147483647),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, module_slug, activity_type)
);

create index if not exists recent_activity_user_last_seen_idx
  on public.recent_activity(user_id, last_seen_at desc);

create index if not exists recent_activity_user_module_idx
  on public.recent_activity(user_id, module_slug, last_seen_at desc);

create index if not exists learning_progress_user_last_visited_idx
  on public.learning_progress(user_id, last_visited_at desc);

drop trigger if exists recent_activity_set_updated_at on public.recent_activity;
create trigger recent_activity_set_updated_at
before update on public.recent_activity
for each row execute function public.set_updated_at();

alter table public.recent_activity enable row level security;

drop policy if exists "recent_activity_select_own" on public.recent_activity;
create policy "recent_activity_select_own"
on public.recent_activity for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "recent_activity_insert_own" on public.recent_activity;
create policy "recent_activity_insert_own"
on public.recent_activity for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "recent_activity_update_own" on public.recent_activity;
create policy "recent_activity_update_own"
on public.recent_activity for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "recent_activity_delete_own" on public.recent_activity;
create policy "recent_activity_delete_own"
on public.recent_activity for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.record_module_visit(
  p_module_slug text,
  p_parameters jsonb default '{}'::jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_module_slug !~ '^[a-z0-9-]{2,64}$' then
    raise exception 'Invalid module slug';
  end if;
  if jsonb_typeof(p_parameters) <> 'object' then
    raise exception 'Parameters must be a JSON object';
  end if;

  insert into public.learning_progress (
    user_id, model_key, status, progress_percent, last_parameters, last_visited_at
  ) values (
    current_user_id, p_module_slug, 'in_progress', 10, p_parameters, now_utc
  )
  on conflict (user_id, model_key) do update set
    status = case
      when public.learning_progress.status = 'completed' then 'completed'
      else 'in_progress'
    end,
    progress_percent = greatest(public.learning_progress.progress_percent, 10),
    last_parameters = case
      when p_parameters = '{}'::jsonb then public.learning_progress.last_parameters
      else p_parameters
    end,
    last_visited_at = now_utc;

  insert into public.recent_activity (
    user_id, module_slug, activity_type, event_count, metadata, first_seen_at, last_seen_at
  ) values (
    current_user_id, p_module_slug, 'visit', 1, '{}'::jsonb, now_utc, now_utc
  )
  on conflict (user_id, module_slug, activity_type) do update set
    event_count = public.recent_activity.event_count + 1,
    last_seen_at = now_utc;
end;
$$;

create or replace function public.record_module_activity(
  p_module_slug text,
  p_activity_type text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_module_slug !~ '^[a-z0-9-]{2,64}$' then
    raise exception 'Invalid module slug';
  end if;
  if p_activity_type not in ('simulation_run', 'completion') then
    raise exception 'Unsupported activity type';
  end if;
  if jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object';
  end if;

  insert into public.recent_activity (
    user_id, module_slug, activity_type, event_count, metadata, first_seen_at, last_seen_at
  ) values (
    current_user_id, p_module_slug, p_activity_type, 1, p_metadata, now_utc, now_utc
  )
  on conflict (user_id, module_slug, activity_type) do update set
    event_count = public.recent_activity.event_count + 1,
    metadata = p_metadata,
    last_seen_at = now_utc;
end;
$$;

create or replace function public.mark_module_complete(p_module_slug text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_module_slug !~ '^[a-z0-9-]{2,64}$' then
    raise exception 'Invalid module slug';
  end if;

  insert into public.learning_progress (
    user_id, model_key, status, progress_percent, last_visited_at, completed_at
  ) values (
    current_user_id, p_module_slug, 'completed', 100, now_utc, now_utc
  )
  on conflict (user_id, model_key) do update set
    status = 'completed',
    progress_percent = 100,
    last_visited_at = now_utc,
    completed_at = now_utc;

  insert into public.recent_activity (
    user_id, module_slug, activity_type, event_count, metadata, first_seen_at, last_seen_at
  ) values (
    current_user_id, p_module_slug, 'completion', 1, '{}'::jsonb, now_utc, now_utc
  )
  on conflict (user_id, module_slug, activity_type) do update set
    event_count = public.recent_activity.event_count + 1,
    last_seen_at = now_utc;
end;
$$;

create or replace function public.handle_model_run_saved()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  now_utc timestamptz := timezone('utc', now());
begin
  insert into public.learning_progress (
    user_id, model_key, status, progress_percent, last_parameters, last_visited_at
  ) values (
    new.user_id, new.model_key, 'in_progress', 50, new.parameters, now_utc
  )
  on conflict (user_id, model_key) do update set
    status = case
      when public.learning_progress.status = 'completed' then 'completed'
      else 'in_progress'
    end,
    progress_percent = greatest(public.learning_progress.progress_percent, 50),
    last_parameters = new.parameters,
    last_visited_at = now_utc;

  insert into public.recent_activity (
    user_id, module_slug, activity_type, event_count, metadata, first_seen_at, last_seen_at
  ) values (
    new.user_id, new.model_key, 'save', 1, jsonb_build_object('run_id', new.id), now_utc, now_utc
  )
  on conflict (user_id, module_slug, activity_type) do update set
    event_count = public.recent_activity.event_count + 1,
    metadata = jsonb_build_object('run_id', new.id),
    last_seen_at = now_utc;

  return new;
end;
$$;

drop trigger if exists model_runs_record_save on public.model_runs;
create trigger model_runs_record_save
after insert on public.model_runs
for each row execute function public.handle_model_run_saved();

revoke all on function public.record_module_visit(text, jsonb) from public, anon;
revoke all on function public.record_module_activity(text, text, jsonb) from public, anon;
revoke all on function public.mark_module_complete(text) from public, anon;
revoke all on function public.handle_model_run_saved() from public, anon, authenticated;

grant execute on function public.record_module_visit(text, jsonb) to authenticated;
grant execute on function public.record_module_activity(text, text, jsonb) to authenticated;
grant execute on function public.mark_module_complete(text) to authenticated;
grant select, insert, update, delete on public.recent_activity to authenticated;
