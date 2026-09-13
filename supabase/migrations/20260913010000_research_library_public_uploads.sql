-- Research Library public-upload model: every completed upload is readable by
-- everyone immediately. Platform administrators retain the sole ability to
-- take a paper down and later restore it.

update public.research_papers
set visibility = 'public'
where visibility <> 'public';

alter table public.research_papers
  drop constraint if exists research_papers_visibility_check,
  add constraint research_papers_visibility_check check (visibility = 'public'),
  drop constraint if exists research_papers_status_check,
  add constraint research_papers_status_check check (status in ('draft', 'pending_review', 'published', 'unpublished', 'revision_requested', 'rejected'));

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
        or (paper.status = 'published' and paper.visibility = 'public')
      )
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
  insert into public.research_papers (
    owner_user_id, title, author_display_name, school_display_name, subject,
    competition_text, competition_year, award_text, abstract, keywords,
    description, coauthors_text, visibility, publication_permission_at
  ) values (
    auth.uid(), btrim(p_title), btrim(p_author_display_name), btrim(p_school_display_name), btrim(p_subject),
    nullif(btrim(p_competition_text), ''), p_competition_year, nullif(btrim(p_award_text), ''), nullif(btrim(p_abstract), ''), nullif(btrim(p_keywords), ''),
    nullif(btrim(p_description), ''), nullif(btrim(p_coauthors_text), ''), 'public', timezone('utc', now())
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
  update public.research_papers
  set title = btrim(p_title), author_display_name = btrim(p_author_display_name), school_display_name = btrim(p_school_display_name), subject = btrim(p_subject),
      competition_text = nullif(btrim(p_competition_text), ''), competition_year = p_competition_year, award_text = nullif(btrim(p_award_text), ''),
      abstract = nullif(btrim(p_abstract), ''), keywords = nullif(btrim(p_keywords), ''), description = nullif(btrim(p_description), ''),
      coauthors_text = nullif(btrim(p_coauthors_text), ''), visibility = 'public',
      status = case when file_path is null then 'draft' when status = 'unpublished' then 'unpublished' else 'published' end,
      featured = false, award_verified = false, admin_review_note = null,
      published_at = case when file_path is null or status = 'unpublished' then null else coalesce(published_at, timezone('utc', now())) end
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
  set file_path = p_file_path, file_name = btrim(p_file_name), file_size = p_file_size, visibility = 'public',
      status = case when status = 'unpublished' then 'unpublished' else 'published' end,
      featured = false, award_verified = false, admin_review_note = null,
      published_at = case when status = 'unpublished' then null else timezone('utc', now()) end
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
  if p_status not in ('published', 'unpublished') then raise exception 'Invalid publication status'; end if;
  update public.research_papers
  set status = p_status,
      visibility = 'public',
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

revoke all on function public.can_read_research_paper(uuid, uuid), public.create_research_paper(text, text, text, text, text, smallint, text, text, text, text, text, text, boolean), public.update_research_paper_submission(uuid, text, text, text, text, text, smallint, text, text, text, text, text, text), public.attach_research_paper_file(uuid, text, text, integer), public.review_research_paper(uuid, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.can_read_research_paper(uuid, uuid) to anon, authenticated;
grant execute on function public.create_research_paper(text, text, text, text, text, smallint, text, text, text, text, text, text, boolean), public.update_research_paper_submission(uuid, text, text, text, text, text, smallint, text, text, text, text, text, text), public.attach_research_paper_file(uuid, text, text, integer), public.review_research_paper(uuid, text, text, boolean, boolean) to authenticated;
