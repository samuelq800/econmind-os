-- An event contains no author, document or account data. Authorized clients
-- refetch through the existing guarded research-source RPC after each change.
begin;
create table public.credential_source_revisions (
  source text primary key check (source in ('research','jobs')),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.credential_source_revisions(source) values ('research'),('jobs');
alter table public.credential_source_revisions enable row level security;
revoke all on public.credential_source_revisions from public, anon, authenticated;
grant select on public.credential_source_revisions to authenticated;
create function public.is_credential_source_observer() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and coalesce(public.is_superme_platform_admin(auth.uid()), false)
    and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.account_status = 'active')
$$;
revoke all on function public.is_credential_source_observer() from public, anon, authenticated;
grant execute on function public.is_credential_source_observer() to authenticated;
create policy "Only active superme may observe source changes" on public.credential_source_revisions
for select to authenticated using (public.is_credential_source_observer());

create function private.bump_credential_research_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.credential_source_revisions set revision = revision + 1, updated_at = now() where source = 'research';
  return null;
end;
$$;
revoke all on function private.bump_credential_research_revision() from public, anon, authenticated;
create function private.bump_credential_jobs_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.credential_source_revisions set revision = revision + 1, updated_at = now() where source = 'jobs';
  return null;
end;
$$;
revoke all on function private.bump_credential_jobs_revision() from public, anon, authenticated;
create trigger credential_research_source_changed
after insert or update or delete or truncate on public.research_papers
for each statement execute function private.bump_credential_research_revision();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'credential_source_revisions') then
    alter publication supabase_realtime add table public.credential_source_revisions;
  end if;
end $$;
commit;
