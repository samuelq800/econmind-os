-- Member-owned preferences are never authorization or participation records.
-- Existing profiles.school_id and profiles.platform_role remain authoritative.
begin;

create table if not exists public.member_profile_details (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 600),
  grade text not null default '' check (char_length(grade) <= 40),
  updated_at timestamptz not null default now()
);
create table if not exists public.member_profile_options (
  category text not null check (category in ('area','economics','activity','skill','collaboration','research')),
  key text not null check (key ~ '^[a-z0-9-]{1,64}$'),
  label text not null check (char_length(label) between 1 and 100),
  sort_order integer not null default 0,
  primary key (category,key)
);
create table if not exists public.member_profile_choices (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  category text not null,
  option_key text not null,
  is_primary boolean not null default false check (not is_primary or category = 'area'),
  primary key (user_id,category,option_key),
  foreign key (category,option_key) references public.member_profile_options(category,key)
);
create unique index if not exists member_profile_one_primary on public.member_profile_choices(user_id) where is_primary;

insert into public.member_profile_options(category,key,label,sort_order) values
('area','academic','Academic & Research',1),('area','technology','Technology',2),
('area','publicity','Publicity & Content',3),('area','community','Community & Operations',4),('area','partnerships','Partnerships & School Network',5),
('economics','macro','Macroeconomics',1),('economics','micro','Microeconomics',2),('economics','development','Development Economics',3),
('economics','behavioral','Behavioral Economics',4),('economics','finance','Finance',5),('economics','trade','International Trade',6),
('economics','econometrics','Econometrics',7),('economics','policy','Public Policy',8),('economics','game-theory','Game Theory',9),
('economics','environment','Environmental Economics',10),('economics','labour','Labour Economics',11),
('activity','season1','World Simulation / Season 1',1),('activity','research','Research Library',2),('activity','live-rooms','Live Rooms',3),
('activity','events','Talks & Events',4),('activity','projects','Community Projects',5),
('skill','research','Economics Research',1),('skill','data','Data Analysis',2),('skill','econometrics','Econometrics',3),
('skill','python','Python',4),('skill','stata','Stata',5),('skill','web','Web Development',6),('skill','design','UI/UX',7),
('skill','graphics','Graphic Design',8),('skill','writing','Writing',9),('skill','speaking','Public Speaking',10),('skill','debate','Debate',11),('skill','events','Event Organization',12),
('collaboration','research','Research collaboration',1),('collaboration','season1','Season 1 team opportunities',2),('collaboration','projects','EconMind projects',3),
('research','reading','Reading',1),('research','writing','Writing',2),('research','data','Data Analysis',3),('research','collaboration','Research Collaboration',4)
on conflict (category,key) do nothing;

alter table public.member_profile_details enable row level security;
alter table public.member_profile_options enable row level security;
alter table public.member_profile_choices enable row level security;
drop policy if exists member_details_own on public.member_profile_details;
create policy member_details_own on public.member_profile_details for select to authenticated using (user_id = auth.uid());
drop policy if exists member_choices_own on public.member_profile_choices;
create policy member_choices_own on public.member_profile_choices for select to authenticated using (user_id = auth.uid());
drop policy if exists member_options_read on public.member_profile_options;
create policy member_options_read on public.member_profile_options for select to authenticated using (true);
revoke all on public.member_profile_details, public.member_profile_choices, public.member_profile_options from public, anon, authenticated;
grant select on public.member_profile_details, public.member_profile_choices, public.member_profile_options to authenticated;

create or replace function public.require_member_profile_user() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := auth.uid();
begin
  if v_id is null or not exists(select 1 from public.profiles where user_id=v_id and account_status='active') then
    raise exception 'An active member account is required';
  end if;
  return v_id;
end $$;
revoke all on function public.require_member_profile_user() from public,anon,authenticated;

-- Also protects older self-service onboarding RPCs from bypassing leader safety.
-- Administrative reassignment of other accounts is left to existing League APIs.
create or replace function public.guard_member_school_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.school_id is distinct from new.school_id and auth.uid() = old.user_id then
    if old.platform_role = 'school_leader' or exists(select 1 from public.schools where liaison_user_id=old.user_id) then
      raise exception 'Please step down or transfer your School Leader responsibility through League before changing or leaving school';
    end if;
    -- The existing invite-code join inserts the new membership before setting
    -- its school. Permit that consistent update; reject a conflicting move.
    if exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id where m.user_id=old.user_id and t.status='active' and t.school_id is distinct from new.school_id) then
      raise exception 'Please resolve your active League school-team membership through League before changing or leaving school';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_member_school_change() from public,anon,authenticated;
drop trigger if exists profiles_guard_member_school_change on public.profiles;
create trigger profiles_guard_member_school_change before update of school_id on public.profiles for each row execute function public.guard_member_school_change();

create or replace function public.save_my_member_identity(
  p_display_name text, p_avatar_url text, p_bio text, p_grade text,
  p_graduation_year integer, p_club_name text, p_role_preference text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.require_member_profile_user();
begin
  if char_length(coalesce(p_display_name,''))>80 or char_length(coalesce(p_avatar_url,''))>2048
    or char_length(coalesce(p_bio,''))>600 or char_length(coalesce(p_grade,''))>40 or char_length(coalesce(p_club_name,''))>160 then raise exception 'Profile field exceeds its length limit'; end if;
  if nullif(trim(p_avatar_url),'') is not null and p_avatar_url !~ '^https://[^[:space:]]+$' then raise exception 'Avatar must be an HTTPS image URL'; end if;
  if p_graduation_year is not null and p_graduation_year not between 2024 and 2045 then raise exception 'Graduation year must be between 2024 and 2045'; end if;
  if p_role_preference is not null and p_role_preference not in ('participant','team_lead','school_liaison') then raise exception 'Invalid personal League preference'; end if;
  -- Explicit column allowlist: no role, school, account status or auth metadata.
  update public.profiles set display_name=nullif(trim(p_display_name),''),avatar_url=nullif(trim(p_avatar_url),''),
    graduation_year=p_graduation_year,economics_club_name=nullif(trim(p_club_name),''),role_preference=p_role_preference where user_id=v_id;
  insert into public.member_profile_details(user_id,bio,grade) values(v_id,trim(coalesce(p_bio,'')),trim(coalesce(p_grade,'')))
  on conflict(user_id) do update set bio=excluded.bio,grade=excluded.grade,updated_at=now();
end $$;

create or replace function public.save_my_member_preferences(p_category text,p_keys text[],p_primary text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.require_member_profile_user(); v_keys text[] := coalesce(p_keys,'{}');
begin
  if p_category is null or p_category not in ('area','economics','activity','skill','collaboration','research') then raise exception 'Invalid preference category'; end if;
  if cardinality(v_keys)>64 or exists(select 1 from unnest(v_keys) k where k is null or not exists(select 1 from public.member_profile_options o where o.category=p_category and o.key=k)) then raise exception 'Choose only supported preference options'; end if;
  if p_category='area' and cardinality(v_keys)>0 then
    if p_primary is null or not p_primary=any(v_keys) then raise exception 'Choose exactly one primary interest'; end if;
  elsif p_primary is not null then raise exception 'Only a selected area of interest can be primary'; end if;
  -- Serializes section saves without modifying any role or participation data.
  perform 1 from public.profiles where user_id=v_id for update;
  delete from public.member_profile_choices where user_id=v_id and category=p_category;
  insert into public.member_profile_choices(user_id,category,option_key,is_primary)
    select v_id,p_category,k,coalesce(k=p_primary,false) from (select distinct unnest(v_keys) k) selected;
end $$;

create or replace function public.change_my_member_school(p_school_id uuid,p_expected_school_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.require_member_profile_user(); v_old uuid;
begin
  select school_id into v_old from public.profiles where user_id=v_id for update;
  if v_old is distinct from p_expected_school_id then raise exception 'Your school affiliation changed. Refresh before trying again'; end if;
  if p_school_id is not null and not exists(select 1 from public.schools where id=p_school_id and status='approved') then raise exception 'Choose a school from the approved League directory'; end if;
  update public.profiles set school_id=p_school_id,onboarding_path=case when p_school_id is null then 'visitor' else 'school' end,
    onboarding_completed_at=coalesce(onboarding_completed_at,now()) where user_id=v_id;
  -- No deletes: school teams, papers, Season membership and activity remain intact.
end $$;

create or replace function public.get_my_member_identity() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.require_member_profile_user(); p public.profiles%rowtype;
  v_school jsonb; v_season jsonb; v_research jsonb; v_hosted bigint; v_roles jsonb := '[]';
  v_guard text; v_super boolean := false;
begin
  select * into p from public.profiles where user_id=v_id;
  select jsonb_build_object('id',s.id,'name',s.name,'logoUrl',s.logo_url,'city',s.city,'area',l.area_label,'status',s.status)
    into v_school from public.schools s left join public.school_location_catalog l on l.location_key=s.location_key where s.id=p.school_id;
  if p.platform_role='school_leader' or exists(select 1 from public.schools where liaison_user_id=v_id) then v_guard:='leader';
  elsif exists(select 1 from public.team_members m join public.teams t on t.id=m.team_id where m.user_id=v_id and t.status='active') then v_guard:='league-team'; end if;
  if to_regprocedure('public.is_superme_platform_admin(uuid)') is not null then execute 'select public.is_superme_platform_admin($1)' into v_super using v_id; end if;
  if p.platform_role='school_leader' then v_roles:=v_roles||jsonb_build_array(jsonb_build_object('label','School Leader','context',v_school->>'name','href','/league/dashboard')); end if;
  if p.platform_role='platform_admin' then v_roles:=v_roles||jsonb_build_array(jsonb_build_object('label',case when v_super then 'Superme Platform Admin' else 'Platform Admin' end,'context','EconMind OS','href','/league/dashboard')); end if;
  if p.platform_role='team_member' then v_roles:=v_roles||jsonb_build_array(jsonb_build_object('label','League Member','context','EconMind League','href','/league')); end if;
  if p.role in ('teacher','professor') then v_roles:=v_roles||jsonb_build_array(jsonb_build_object('label',initcap(p.role),'context','Academic role','href','/learn')); end if;
  if to_regclass('public.world_preseason_team_members') is not null then
    execute 'select jsonb_build_object(''teamId'',t.id,''teamName'',t.name,''teamStatus'',t.status,''memberRole'',m.member_role,''rolePreferences'',m.role_preferences,''joinedAt'',m.joined_at) from public.world_preseason_team_members m join public.world_preseason_teams t on t.id=m.team_id join public.world_preseason_seasons s on s.id=m.season_id where m.user_id=$1 and s.code=''season-1''' into v_season using v_id;
  end if;
  if to_regclass('public.research_papers') is not null then
    execute 'select jsonb_build_object(''submissions'',count(*),''publications'',count(*) filter(where status=''published'')) from public.research_papers where owner_user_id=$1' into v_research using v_id;
  end if;
  if to_regclass('public.live_world_rooms') is not null then
    execute 'select count(*) from public.live_world_rooms where created_by=$1' into v_hosted using v_id;
  end if;
  return jsonb_build_object(
    'userId',v_id,'identity',jsonb_build_object('displayName',p.display_name,'avatarUrl',p.avatar_url,'graduationYear',p.graduation_year,'clubName',p.economics_club_name,'leaguePreference',p.role_preference,'memberSince',p.created_at,
      'bio',coalesce((select bio from public.member_profile_details where user_id=v_id),''),'grade',coalesce((select grade from public.member_profile_details where user_id=v_id),'')),
    'school',v_school,'schoolChangeGuard',v_guard,'roles',v_roles,
    'options',coalesce((select jsonb_agg(jsonb_build_object('category',category,'key',key,'label',label) order by category,sort_order,key) from public.member_profile_options),'[]'::jsonb),
    'choices',coalesce((select jsonb_agg(jsonb_build_object('category',category,'key',option_key,'primary',is_primary) order by category,option_key) from public.member_profile_choices where user_id=v_id),'[]'::jsonb),
    'activity',jsonb_build_object('season1',v_season,'research',v_research,'liveRoomsHosted',v_hosted)
  );
end $$;

revoke all on function public.get_my_member_identity(),public.save_my_member_identity(text,text,text,text,integer,text,text),public.save_my_member_preferences(text,text[],text),public.change_my_member_school(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_my_member_identity(),public.save_my_member_identity(text,text,text,text,integer,text,text),public.save_my_member_preferences(text,text[],text),public.change_my_member_school(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
