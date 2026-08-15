-- Professor is an independent academic-author role. It is intentionally not
-- a League platform role: assigning Professor never joins a school or Team and
-- never grants World Simulation, country, or settlement authority.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'teacher', 'professor'));

-- Existing experiment storage calls this predicate is_teacher. Keeping the
-- function name preserves the established experiment API while making the
-- academic-author boundary explicit and backwards compatible.
create or replace function public.is_teacher(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where user_id = p_user_id and role in ('teacher', 'professor')
  )
$$;

-- Daily Brief curation remains a teaching-staff responsibility.  The legacy
-- policies below call is_teacher(), which now intentionally includes academic
-- authors, so rebuild those policies against this narrower predicate rather
-- than accidentally expanding a Professor into a news editor.
create or replace function public.can_curate_daily_brief(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where user_id = p_user_id and role = 'teacher'
  )
$$;

revoke all on function public.can_curate_daily_brief(uuid) from public, anon;
grant execute on function public.can_curate_daily_brief(uuid) to authenticated;

drop policy if exists "economic_cases_teacher_read" on public.economic_cases;
drop policy if exists "economic_cases_teacher_write" on public.economic_cases;
drop policy if exists "daily_brief_items_teacher_read" on public.daily_brief_items;
drop policy if exists "daily_brief_items_teacher_write" on public.daily_brief_items;
drop policy if exists "daily_brief_sources_teacher_only" on public.daily_brief_sources;
drop policy if exists "daily_brief_settings_teacher_only" on public.daily_brief_settings;
drop policy if exists "daily_brief_jobs_teacher_only" on public.daily_brief_jobs;

create policy "economic_cases_teacher_read" on public.economic_cases
  for select to authenticated using (public.can_curate_daily_brief());
create policy "economic_cases_teacher_write" on public.economic_cases
  for all to authenticated using (public.can_curate_daily_brief()) with check (public.can_curate_daily_brief());
create policy "daily_brief_items_teacher_read" on public.daily_brief_items
  for select to authenticated using (public.can_curate_daily_brief());
create policy "daily_brief_items_teacher_write" on public.daily_brief_items
  for all to authenticated using (public.can_curate_daily_brief()) with check (public.can_curate_daily_brief());
create policy "daily_brief_sources_teacher_only" on public.daily_brief_sources
  for all to authenticated using (public.can_curate_daily_brief()) with check (public.can_curate_daily_brief());
create policy "daily_brief_settings_teacher_only" on public.daily_brief_settings
  for all to authenticated using (public.can_curate_daily_brief()) with check (public.can_curate_daily_brief());
create policy "daily_brief_jobs_teacher_only" on public.daily_brief_jobs
  for select to authenticated using (public.can_curate_daily_brief());

create or replace function public.is_professor(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where user_id = p_user_id and role = 'professor'
  )
$$;

create or replace function public.set_econmind_academic_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  if p_role not in ('student', 'teacher', 'professor') then
    raise exception 'Invalid academic role';
  end if;

  update public.profiles
  set role = p_role
  where user_id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

-- The earlier continuous-world migration mirrors student/teacher into a
-- helper table. Replacing the synchroniser here prevents a Professor (in
-- particular a former Teacher) from inheriting that historical world-facing
-- helper role. Professor deliberately has no entry in profile_platform_roles.
create or replace function public.sync_profile_platform_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profile_platform_roles
  where user_id = new.user_id and role in ('student', 'teacher');

  if new.role in ('student', 'teacher') then
    insert into public.profile_platform_roles(user_id, role)
    values (new.user_id, new.role)
    on conflict do nothing;
  end if;

  if new.platform_role = 'team_member' then
    insert into public.profile_platform_roles(user_id, role) values (new.user_id, 'league_participant') on conflict do nothing;
  elsif new.platform_role = 'school_leader' then
    insert into public.profile_platform_roles(user_id, role) values (new.user_id, 'league_admin') on conflict do nothing;
  elsif new.platform_role = 'platform_admin' then
    insert into public.profile_platform_roles(user_id, role) values (new.user_id, 'platform_admin') on conflict do nothing;
  end if;
  return new;
end;
$$;

delete from public.profile_platform_roles helper
using public.profiles profile
where helper.user_id = profile.user_id
  and profile.role = 'professor'
  and helper.role in ('student', 'teacher');

create table public.professor_projects (
  id uuid primary key default extensions.gen_random_uuid(),
  professor_id uuid not null references public.profiles(user_id) on delete cascade,
  project_type text not null check (project_type in ('mechanism_arena', 'evidence_lab', 'econbench', 'model_assignment')),
  title text not null check (char_length(trim(title)) between 3 and 160),
  summary text not null default '' check (char_length(summary) <= 600),
  brief text not null default '' check (char_length(brief) <= 6000),
  source_key text not null default '' check (char_length(source_key) <= 120),
  participation_scope text not null default 'open' check (participation_scope in ('open', 'invited')),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  official_review_status text not null default 'not_requested' check (official_review_status in ('not_requested', 'pending', 'approved', 'rejected')),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.professor_project_audiences (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.professor_projects(id) on delete cascade,
  audience_type text not null check (audience_type in ('school', 'team', 'account')),
  school_id uuid references public.schools(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (audience_type = 'school' and school_id is not null and team_id is null and user_id is null)
    or (audience_type = 'team' and school_id is null and team_id is not null and user_id is null)
    or (audience_type = 'account' and school_id is null and team_id is null and user_id is not null)
  ),
  unique (project_id, audience_type, school_id, team_id, user_id)
);

create index professor_projects_owner_updated_idx
  on public.professor_projects(professor_id, updated_at desc);
create index professor_projects_public_idx
  on public.professor_projects(status, participation_scope, published_at desc)
  where status = 'published';
create index professor_projects_review_idx
  on public.professor_projects(official_review_status, updated_at desc)
  where official_review_status = 'pending';
create index professor_project_audiences_project_idx
  on public.professor_project_audiences(project_id);

create trigger professor_projects_set_updated_at
before update on public.professor_projects
for each row execute function public.set_updated_at();

create or replace function public.save_professor_project(
  p_project_id uuid,
  p_payload jsonb,
  p_audiences jsonb default '[]'::jsonb
)
returns public.professor_projects
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row public.professor_projects;
  audience jsonb;
  target_type text;
  target_id uuid;
begin
  if not public.is_professor(auth.uid()) then
    raise exception 'Professor role required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_audiences) <> 'array' then
    raise exception 'Invalid Professor Studio payload';
  end if;
  if coalesce(jsonb_array_length(p_audiences), 0) > 50 then
    raise exception 'At most 50 invitation targets may be saved at once';
  end if;

  if p_project_id is null then
    insert into public.professor_projects (
      professor_id, project_type, title, summary, brief, source_key,
      participation_scope, status, official_review_status, configuration,
      published_at, closed_at
    ) values (
      auth.uid(), p_payload->>'project_type', p_payload->>'title',
      coalesce(p_payload->>'summary', ''), coalesce(p_payload->>'brief', ''),
      coalesce(p_payload->>'source_key', ''), coalesce(p_payload->>'participation_scope', 'open'),
      coalesce(p_payload->>'status', 'draft'), 'not_requested',
      coalesce(p_payload->'configuration', '{}'::jsonb),
      case when coalesce(p_payload->>'status', 'draft') = 'published' then timezone('utc', now()) else null end,
      case when coalesce(p_payload->>'status', 'draft') = 'closed' then timezone('utc', now()) else null end
    ) returning * into project_row;
  else
    update public.professor_projects
    set project_type = p_payload->>'project_type',
        title = p_payload->>'title',
        summary = coalesce(p_payload->>'summary', ''),
        brief = coalesce(p_payload->>'brief', ''),
        source_key = coalesce(p_payload->>'source_key', ''),
        participation_scope = coalesce(p_payload->>'participation_scope', participation_scope),
        status = coalesce(p_payload->>'status', status),
        configuration = coalesce(p_payload->'configuration', configuration),
        published_at = case when coalesce(p_payload->>'status', status) = 'published' then coalesce(published_at, timezone('utc', now())) else published_at end,
        closed_at = case when coalesce(p_payload->>'status', status) = 'closed' then coalesce(closed_at, timezone('utc', now())) else closed_at end
    where id = p_project_id and professor_id = auth.uid()
    returning * into project_row;
    if not found then
      raise exception 'Professor project ownership required';
    end if;
    delete from public.professor_project_audiences where project_id = project_row.id;
  end if;

  for audience in select value from jsonb_array_elements(p_audiences) loop
    target_type := audience->>'audience_type';
    if target_type not in ('school', 'team', 'account') then
      raise exception 'Invalid audience type';
    end if;
    target_id := nullif(audience->>'target_id', '')::uuid;
    if target_id is null then
      raise exception 'Audience target is required';
    end if;
    insert into public.professor_project_audiences(project_id, audience_type, school_id, team_id, user_id)
    values (
      project_row.id,
      target_type,
      case when target_type = 'school' then target_id else null end,
      case when target_type = 'team' then target_id else null end,
      case when target_type = 'account' then target_id else null end
    );
  end loop;
  return project_row;
end;
$$;

create or replace function public.request_professor_project_official_review(
  p_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.professor_projects
  set official_review_status = 'pending'
  where id = p_project_id and professor_id = auth.uid() and public.is_professor(auth.uid());
  if not found then
    raise exception 'Professor project ownership required';
  end if;
end;
$$;

create or replace function public.review_professor_project(
  p_project_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Platform administrator role required';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected';
  end if;
  update public.professor_projects
  set official_review_status = p_status
  where id = p_project_id and official_review_status = 'pending';
  if not found then
    raise exception 'Pending Professor project not found';
  end if;
end;
$$;

create or replace function public.list_my_professor_projects()
returns setof public.professor_projects
language sql
stable
security definer
set search_path = public
as $$
  select * from public.professor_projects
  where professor_id = auth.uid() and public.is_professor(auth.uid())
  order by updated_at desc
$$;

alter table public.professor_projects enable row level security;
alter table public.professor_project_audiences enable row level security;

-- Keep invitation checks inside a definer function: a project policy that
-- reads its own audience table would otherwise recurse through both RLS
-- policies. It also keeps invitation targets private from other invitees.
create or replace function public.can_access_professor_project(
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.professor_projects project
    where project.id = p_project_id
      and (
        project.professor_id = auth.uid()
        or public.is_platform_admin(auth.uid())
        or (project.status = 'published' and project.participation_scope = 'open')
        or (
          project.status = 'published'
          and project.participation_scope = 'invited'
          and exists(
            select 1
            from public.professor_project_audiences audience
            where audience.project_id = project.id
              and (
                (audience.audience_type = 'school' and public.is_school_member(audience.school_id))
                or (audience.audience_type = 'team' and public.is_team_member(audience.team_id))
                or (audience.audience_type = 'account' and audience.user_id = auth.uid())
              )
          )
        )
      )
  )
$$;

create or replace function public.list_accessible_professor_projects()
returns setof public.professor_projects
language sql
stable
security definer
set search_path = public
as $$
  select project.*
  from public.professor_projects project
  where project.status = 'published'
    and public.can_access_professor_project(project.id)
  order by project.published_at desc, project.updated_at desc
$$;

create policy professor_projects_select_accessible
on public.professor_projects for select to authenticated
using (public.can_access_professor_project(id));

create policy professor_projects_author_insert
on public.professor_projects for insert to authenticated
with check (professor_id = auth.uid() and public.is_professor(auth.uid()));

create policy professor_projects_author_update
on public.professor_projects for update to authenticated
using (professor_id = auth.uid() and public.is_professor(auth.uid()))
with check (professor_id = auth.uid() and public.is_professor(auth.uid()));

create policy professor_projects_author_delete
on public.professor_projects for delete to authenticated
using (professor_id = auth.uid() and public.is_professor(auth.uid()));

create policy professor_project_audiences_select_author_or_admin
on public.professor_project_audiences for select to authenticated
using (
  exists(select 1 from public.professor_projects p where p.id = project_id and (p.professor_id = auth.uid() or public.is_platform_admin(auth.uid())))
);

revoke all on public.professor_projects, public.professor_project_audiences from public, anon, authenticated;
revoke all on function public.is_professor(uuid), public.set_econmind_academic_role(uuid, text), public.save_professor_project(uuid, jsonb, jsonb), public.request_professor_project_official_review(uuid), public.review_professor_project(uuid, text), public.list_my_professor_projects(), public.list_accessible_professor_projects(), public.can_access_professor_project(uuid) from public, anon, authenticated;
grant execute on function public.is_professor(uuid), public.save_professor_project(uuid, jsonb, jsonb), public.request_professor_project_official_review(uuid), public.list_my_professor_projects(), public.list_accessible_professor_projects(), public.can_access_professor_project(uuid) to authenticated;
grant execute on function public.set_econmind_academic_role(uuid, text), public.review_professor_project(uuid, text) to authenticated;
