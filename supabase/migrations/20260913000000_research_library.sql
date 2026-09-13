-- Research Library: an author-owned submission archive. Published work is
-- readable through narrowly scoped RLS policies; review authority stays with
-- the existing platform_admin role.

create table if not exists public.research_papers (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  author_display_name text not null check (char_length(btrim(author_display_name)) between 1 and 160),
  school_display_name text not null check (char_length(btrim(school_display_name)) between 1 and 240),
  subject text not null check (char_length(btrim(subject)) between 1 and 160),
  competition_text text check (competition_text is null or char_length(competition_text) <= 240),
  competition_year smallint check (competition_year is null or competition_year between 1900 and 2100),
  award_text text check (award_text is null or char_length(award_text) <= 240),
  award_verified boolean not null default false,
  abstract text check (abstract is null or char_length(abstract) <= 12000),
  keywords text check (keywords is null or char_length(keywords) <= 600),
  description text check (description is null or char_length(description) <= 4000),
  coauthors_text text check (coauthors_text is null or char_length(coauthors_text) <= 1000),
  file_path text unique check (file_path is null or file_path ~ E'^[0-9a-f-]{36}/[0-9a-f-]{36}/paper\\.pdf$'),
  file_name text check (file_name is null or char_length(file_name) between 1 and 240),
  file_size integer check (file_size is null or file_size between 1 and 26214400),
  visibility text not null default 'public' check (visibility in ('public', 'members')),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'revision_requested', 'rejected')),
  featured boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  admin_review_note text check (admin_review_note is null or char_length(admin_review_note) <= 4000),
  publication_permission_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz,
  check ((status = 'draft' and file_path is null) or (status <> 'draft' and file_path is not null)),
  check ((file_path is null and file_name is null and file_size is null) or (file_path is not null and file_name is not null and file_size is not null))
);

create index if not exists research_papers_published_idx on public.research_papers (published_at desc) where status = 'published';
create index if not exists research_papers_owner_idx on public.research_papers (owner_user_id, updated_at desc);
create index if not exists research_papers_review_idx on public.research_papers (status, updated_at desc);
create index if not exists research_papers_featured_idx on public.research_papers (featured, published_at desc) where featured and status = 'published';

drop trigger if exists research_papers_set_updated_at on public.research_papers;
create trigger research_papers_set_updated_at before update on public.research_papers for each row execute function public.set_updated_at();

create or replace function public.can_read_research_paper(p_paper_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.research_papers paper
    where paper.id = p_paper_id
      and (
        paper.owner_user_id = p_user_id
        or public.is_platform_admin(p_user_id)
        or (
          paper.status = 'published'
          and (paper.visibility = 'public' or p_user_id is not null)
        )
      )
  )
$$;

create or replace function public.can_read_research_paper_file(p_file_path text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.research_papers paper
    where paper.file_path = p_file_path
      and public.can_read_research_paper(paper.id, p_user_id)
  )
$$;

create or replace function public.create_research_paper(
  p_title text,
  p_author_display_name text,
  p_school_display_name text,
  p_subject text,
  p_competition_text text,
  p_competition_year smallint,
  p_award_text text,
  p_abstract text,
  p_keywords text,
  p_description text,
  p_coauthors_text text,
  p_visibility text,
  p_publication_permission boolean
)
returns public.research_papers
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  created_paper public.research_papers;
begin
  if auth.uid() is null then raise exception 'An authenticated account is required to submit research'; end if;
  if p_publication_permission is not true then raise exception 'Publication permission confirmation is required'; end if;
  if coalesce(char_length(btrim(p_title)), 0) not between 1 and 240
    or coalesce(char_length(btrim(p_author_display_name)), 0) not between 1 and 160
    or coalesce(char_length(btrim(p_school_display_name)), 0) not between 1 and 240
    or coalesce(char_length(btrim(p_subject)), 0) not between 1 and 160 then
    raise exception 'Title, author, school, and subject are required';
  end if;
  if p_visibility not in ('public', 'members') then raise exception 'Invalid visibility'; end if;
  insert into public.research_papers (
    owner_user_id, title, author_display_name, school_display_name, subject,
    competition_text, competition_year, award_text, abstract, keywords,
    description, coauthors_text, visibility, publication_permission_at
  ) values (
    auth.uid(), btrim(p_title), btrim(p_author_display_name), btrim(p_school_display_name), btrim(p_subject),
    nullif(btrim(p_competition_text), ''), p_competition_year, nullif(btrim(p_award_text), ''), nullif(btrim(p_abstract), ''), nullif(btrim(p_keywords), ''),
    nullif(btrim(p_description), ''), nullif(btrim(p_coauthors_text), ''), p_visibility, timezone('utc', now())
  ) returning * into created_paper;
  return created_paper;
end;
$$;

create or replace function public.update_research_paper_submission(
  p_paper_id uuid,
  p_title text,
  p_author_display_name text,
  p_school_display_name text,
  p_subject text,
  p_competition_text text,
  p_competition_year smallint,
  p_award_text text,
  p_abstract text,
  p_keywords text,
  p_description text,
  p_coauthors_text text,
  p_visibility text
)
returns public.research_papers
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_paper public.research_papers;
begin
  if auth.uid() is null then raise exception 'An authenticated account is required'; end if;
  if coalesce(char_length(btrim(p_title)), 0) not between 1 and 240
    or coalesce(char_length(btrim(p_author_display_name)), 0) not between 1 and 160
    or coalesce(char_length(btrim(p_school_display_name)), 0) not between 1 and 240
    or coalesce(char_length(btrim(p_subject)), 0) not between 1 and 160 then
    raise exception 'Title, author, school, and subject are required';
  end if;
  if p_visibility not in ('public', 'members') then raise exception 'Invalid visibility'; end if;
  update public.research_papers
  set title = btrim(p_title), author_display_name = btrim(p_author_display_name), school_display_name = btrim(p_school_display_name), subject = btrim(p_subject),
      competition_text = nullif(btrim(p_competition_text), ''), competition_year = p_competition_year, award_text = nullif(btrim(p_award_text), ''),
      abstract = nullif(btrim(p_abstract), ''), keywords = nullif(btrim(p_keywords), ''), description = nullif(btrim(p_description), ''),
      coauthors_text = nullif(btrim(p_coauthors_text), ''), visibility = p_visibility,
      status = case when file_path is null then 'draft' else 'pending_review' end,
      featured = false, award_verified = false, admin_review_note = null, published_at = null
  where id = p_paper_id and owner_user_id = auth.uid()
  returning * into updated_paper;
  if updated_paper.id is null then raise exception 'Research submission not found or not owned by this account'; end if;
  return updated_paper;
end;
$$;

create or replace function public.attach_research_paper_file(
  p_paper_id uuid,
  p_file_path text,
  p_file_name text,
  p_file_size integer
)
returns public.research_papers
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_paper public.research_papers;
begin
  if auth.uid() is null then raise exception 'An authenticated account is required'; end if;
  if p_file_path <> auth.uid()::text || '/' || p_paper_id::text || '/paper.pdf' then raise exception 'Invalid research file path'; end if;
  if coalesce(char_length(btrim(p_file_name)), 0) not between 1 and 240 or p_file_size not between 1 and 26214400 then raise exception 'Invalid research file details'; end if;
  if not exists (select 1 from storage.objects object where object.bucket_id = 'research-papers' and object.name = p_file_path) then raise exception 'Uploaded PDF was not found'; end if;
  update public.research_papers
  set file_path = p_file_path, file_name = btrim(p_file_name), file_size = p_file_size,
      status = 'pending_review', featured = false, award_verified = false, admin_review_note = null, published_at = null
  where id = p_paper_id and owner_user_id = auth.uid()
  returning * into updated_paper;
  if updated_paper.id is null then raise exception 'Research submission not found or not owned by this account'; end if;
  return updated_paper;
end;
$$;

create or replace function public.review_research_paper(
  p_paper_id uuid,
  p_status text,
  p_admin_review_note text,
  p_award_verified boolean,
  p_featured boolean
)
returns public.research_papers
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewed_paper public.research_papers;
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_status not in ('pending_review', 'published', 'revision_requested', 'rejected') then raise exception 'Invalid review status'; end if;
  update public.research_papers
  set status = p_status,
      admin_review_note = nullif(btrim(p_admin_review_note), ''),
      award_verified = coalesce(p_award_verified, false),
      featured = case when p_status = 'published' then coalesce(p_featured, false) else false end,
      published_at = case when p_status = 'published' then coalesce(published_at, timezone('utc', now())) else null end
  where id = p_paper_id
  returning * into reviewed_paper;
  if reviewed_paper.id is null then raise exception 'Research submission not found'; end if;
  return reviewed_paper;
end;
$$;

alter table public.research_papers enable row level security;

create policy research_papers_read_visible on public.research_papers
  for select to anon, authenticated using (public.can_read_research_paper(id));
create policy research_papers_admin_manage on public.research_papers
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('research-papers', 'research-papers', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 26214400, allowed_mime_types = array['application/pdf'];

create policy research_paper_files_read on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'research-papers' and public.can_read_research_paper_file(name)
  );
create policy research_paper_files_upload_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'research-papers'
    and name = auth.uid()::text || '/' || split_part(name, '/', 2) || '/paper.pdf'
    and exists (
      select 1 from public.research_papers paper
      where paper.owner_user_id = auth.uid()
        and paper.id::text = split_part(name, '/', 2)
        and paper.file_path is null
    )
  );
create policy research_paper_files_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'research-papers'
    and exists (
      select 1 from public.research_papers paper
      where paper.owner_user_id = auth.uid()
        and paper.file_path = name
    )
  );

revoke all on table public.research_papers from anon, authenticated;
grant select, update on table public.research_papers to authenticated;
grant select on table public.research_papers to anon;
revoke all on function public.can_read_research_paper(uuid, uuid), public.can_read_research_paper_file(text, uuid), public.create_research_paper(text, text, text, text, text, smallint, text, text, text, text, text, text, boolean), public.update_research_paper_submission(uuid, text, text, text, text, text, smallint, text, text, text, text, text), public.attach_research_paper_file(uuid, text, text, integer), public.review_research_paper(uuid, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.can_read_research_paper(uuid, uuid), public.can_read_research_paper_file(text, uuid) to anon, authenticated;
grant execute on function public.create_research_paper(text, text, text, text, text, smallint, text, text, text, text, text, text, boolean), public.update_research_paper_submission(uuid, text, text, text, text, text, smallint, text, text, text, text, text), public.attach_research_paper_file(uuid, text, text, integer), public.review_research_paper(uuid, text, text, boolean, boolean) to authenticated;
