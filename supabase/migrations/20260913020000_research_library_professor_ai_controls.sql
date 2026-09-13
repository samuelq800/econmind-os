-- Research Library authorship and AI-linking controls. A Professor badge is
-- assigned from the authoritative profile role at upload time. AI linking is
-- enabled by default and can be disabled by the paper author.

alter table public.research_papers
  add column if not exists is_professor_upload boolean not null default false,
  add column if not exists ai_linking_consent boolean not null default true;

update public.research_papers paper
set is_professor_upload = true
from public.profiles profile
where paper.owner_user_id = profile.user_id
  and profile.role = 'professor';

drop function if exists public.create_research_paper(text, text, text, text, text, smallint, text, text, text, text, text, text, boolean);
create function public.create_research_paper(
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
  p_publication_permission boolean,
  p_ai_linking_consent boolean default true
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
    description, coauthors_text, visibility, is_professor_upload,
    ai_linking_consent, publication_permission_at
  ) values (
    auth.uid(), btrim(p_title), btrim(p_author_display_name), btrim(p_school_display_name), btrim(p_subject),
    nullif(btrim(p_competition_text), ''), p_competition_year, nullif(btrim(p_award_text), ''), nullif(btrim(p_abstract), ''), nullif(btrim(p_keywords), ''),
    nullif(btrim(p_description), ''), nullif(btrim(p_coauthors_text), ''), 'public',
    coalesce((select profile.role = 'professor' from public.profiles profile where profile.user_id = auth.uid()), false),
    coalesce(p_ai_linking_consent, true), timezone('utc', now())
  ) returning * into created_paper;
  return created_paper;
end;
$$;

drop function if exists public.update_research_paper_submission(uuid, text, text, text, text, text, smallint, text, text, text, text, text, text);
create function public.update_research_paper_submission(
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
  p_visibility text,
  p_ai_linking_consent boolean default true
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
      coauthors_text = nullif(btrim(p_coauthors_text), ''), visibility = 'public', ai_linking_consent = coalesce(p_ai_linking_consent, true),
      status = case when file_path is null then 'draft' when status = 'unpublished' then 'unpublished' else 'published' end,
      featured = false, award_verified = false, admin_review_note = null,
      published_at = case when file_path is null or status = 'unpublished' then null else coalesce(published_at, timezone('utc', now())) end
  where id = p_paper_id and owner_user_id = auth.uid()
  returning * into updated_paper;
  if updated_paper.id is null then raise exception 'Research submission not found or not owned by this account'; end if;
  return updated_paper;
end;
$$;

revoke all on function public.create_research_paper(text, text, text, text, text, smallint, text, text, text, text, text, text, boolean, boolean), public.update_research_paper_submission(uuid, text, text, text, text, text, smallint, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_research_paper(text, text, text, text, text, smallint, text, text, text, text, text, text, boolean, boolean), public.update_research_paper_submission(uuid, text, text, text, text, text, smallint, text, text, text, text, text, text, boolean) to authenticated;
