-- Read-only candidate data for Credential Management. An uploader is not
-- assumed to be the author, and coauthor free text is not split into people.
begin;

create or replace function public.list_credential_research_sources(
  p_after_id uuid default null,
  p_limit integer default 100
)
returns table (
  paper_id uuid,
  uploader_user_id uuid,
  author_display_name text,
  owner_name_matches boolean,
  coauthors_text text,
  title text,
  subject text,
  institution text,
  status text,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null
    or not coalesce(public.is_superme_platform_admin(auth.uid()), false)
    or not exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.account_status = 'active'
    ) then
    raise exception 'Superme platform administrator required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Page size must be between 1 and 100' using errcode = '22023';
  end if;
  return query
    select p.id, p.owner_user_id, p.author_display_name,
      case when nullif(trim(pr.display_name),'') is null then null
        else lower(trim(pr.display_name))=lower(trim(p.author_display_name)) end, p.coauthors_text,
      p.title, p.subject, p.school_display_name, p.status, p.published_at, p.updated_at
    from public.research_papers p left join public.profiles pr on pr.user_id=p.owner_user_id
    where p.file_path is not null and (p_after_id is null or p.id > p_after_id)
    order by p.id
    limit p_limit;
end;
$$;

revoke all on function public.list_credential_research_sources(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.list_credential_research_sources(uuid, integer)
  to authenticated;

commit;
