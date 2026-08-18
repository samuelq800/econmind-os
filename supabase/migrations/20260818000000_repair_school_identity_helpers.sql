-- Repair the school-application approval dependency.
--
-- review_league_application() uses these immutable normalisation helpers when
-- approving an application.  Keep them in their own idempotent migration so
-- projects that were provisioned before the school-identity consolidation
-- migration can be repaired without touching existing school rows.

create or replace function public.econmind_school_identity_key(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_name, '')))
    when '南外仙林分校' then 'nanjingforeignlanguageschoolxianlincampus'
    when '苏州一中' then 'suzhouno1highschool'
    when '重庆南开中学' then 'chongqingnankaisecondaryschool'
    when '合肥一六八中学' then 'hefeino168highschool'
    when '江西师范大学附属中学' then 'theattachedmiddleschooltojiangxinormaluniversity'
    else case regexp_replace(lower(trim(coalesce(p_name, ''))), '[^[:alnum:]]', '', 'g')
      when 'baid' then 'beijingacademyinternationaldepartment'
      when 'suzhouscientificforeignlanguagehighschool' then 'suzhousciencetechnologytownforeignlanguageschool'
      when 'suzhouindustrialparkxinghaiexperimentalseniorhighschoolshenhuroadcampus' then 'suzhouindustrialparkxinghaiexperimentalseniorhighschool'
      else regexp_replace(lower(trim(coalesce(p_name, ''))), '[^[:alnum:]]', '', 'g')
    end
  end
$$;

create or replace function public.econmind_canonical_school_name(p_identity_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_identity_key
    when 'beijingacademyinternationaldepartment' then 'Beijing Academy International Department'
    when 'nanjingforeignlanguageschoolxianlincampus' then 'Nanjing Foreign Language School, Xianlin Campus'
    when 'suzhouno1highschool' then 'Suzhou No.1 High School'
    when 'chongqingnankaisecondaryschool' then 'Chongqing Nankai Secondary School'
    when 'hefeino168highschool' then 'Hefei No.168 High School'
    when 'theattachedmiddleschooltojiangxinormaluniversity' then 'The Attached Middle School To Jiangxi Normal University'
    when 'suzhousciencetechnologytownforeignlanguageschool' then 'SUZHOU SCIENCE&TECHNOLOGY TOWN FOREIGN LANGUAGE SCHOOL'
    when 'suzhouindustrialparkxinghaiexperimentalseniorhighschool' then 'Suzhou Industrial Park Xinghai Experimental Senior High School'
    else null
  end
$$;

-- These helpers are called only from SECURITY DEFINER functions.  They must
-- not be callable directly by browser roles.
revoke all on function public.econmind_school_identity_key(text) from public, anon, authenticated;
revoke all on function public.econmind_canonical_school_name(text) from public, anon, authenticated;
