\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table public.profiles (user_id uuid primary key, account_status text not null, superme boolean not null);
create function public.is_superme_platform_admin(p_user uuid) returns boolean language sql stable security definer as $$
  select exists(select 1 from public.profiles where user_id=p_user and superme)
$$;
create table public.research_papers (
  id uuid primary key, owner_user_id uuid not null, author_display_name text not null,
  coauthors_text text, title text not null, subject text not null,
  school_display_name text not null, status text not null, file_path text,
  published_at timestamptz, updated_at timestamptz not null default now()
);
insert into public.profiles values
  ('00000000-0000-0000-0000-000000000001','active',true),
  ('00000000-0000-0000-0000-000000000002','active',false),
  ('00000000-0000-0000-0000-000000000003','suspended',true);
insert into public.research_papers (id,owner_user_id,author_display_name,coauthors_text,title,subject,school_display_name,status,file_path)
select ('10000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000002','Author', 'Names supplied by author',
  'Paper ' || i, 'Economics', 'School', case when i = 1 then 'unpublished' else 'published' end,
  case when i = 103 then null else 'uploaded.pdf' end from generate_series(1,103) i;
\ir ../supabase/migrations/20261116000000_credential_research_sources.sql
do $$ begin
  if has_function_privilege('anon','public.list_credential_research_sources(uuid,integer)','EXECUTE') then
    raise exception 'anonymous role has execute privilege';
  end if;
  if has_table_privilege('authenticated','public.research_papers','SELECT') then
    raise exception 'fixture accidentally grants direct table access';
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  begin perform * from public.list_credential_research_sources(); raise exception 'ordinary user admitted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin perform * from public.list_credential_research_sources(); raise exception 'suspended superme admitted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare first_count integer; rest_count integer; begin
  select count(*) into first_count from public.list_credential_research_sources(null,100);
  select count(*) into rest_count from public.list_credential_research_sources('10000000-0000-0000-0000-000000000100',100);
  if first_count <> 100 or rest_count <> 2 then raise exception 'incorrect uploaded-record pagination'; end if;
  if not exists(select 1 from public.list_credential_research_sources(null,100) where status='unpublished' and author_display_name='Author' and coauthors_text='Names supplied by author') then
    raise exception 'source fields or unpublished upload were lost';
  end if;
  begin perform * from public.list_credential_research_sources(null,101); raise exception 'invalid limit accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
update public.research_papers set author_display_name='Updated' where id='10000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin
  if not exists(select 1 from public.list_credential_research_sources(null,1) where author_display_name='Updated') then
    raise exception 'source update was not reflected';
  end if;
end $$;
