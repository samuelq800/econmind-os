do $$ begin if current_database()<>'season1_test' then raise exception 'Disposable season1_test only'; end if; end $$;
insert into public.profiles(user_id,display_name,account_status)
select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid, 'Approval fixture '||n, case when n=40 then 'inactive' else 'active' end
from generate_series(31,42) n;
insert into public.world_preseason_teams(id,season_id,name,capacity,captain_user_id,created_by)
select ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid, s.id, 'Approval fixture team '||n,
  case when n=3 then 2 else 6 end,
  ('00000000-0000-0000-0000-'||lpad((case n when 1 then 31 when 2 then 33 when 3 then 35 when 4 then 39 else 41 end)::text,12,'0'))::uuid,
  ('00000000-0000-0000-0000-'||lpad((case n when 1 then 31 when 2 then 33 when 3 then 35 when 4 then 39 else 41 end)::text,12,'0'))::uuid
from public.world_preseason_seasons s cross join generate_series(1,5) n where s.code='season-1';
insert into public.world_preseason_team_members(season_id,team_id,user_id,member_role)
select season_id,id,captain_user_id,'captain' from public.world_preseason_teams where name like 'Approval fixture team %';
insert into public.world_preseason_team_members(season_id,team_id,user_id)
select season_id,id,'00000000-0000-0000-0000-000000000036'::uuid from public.world_preseason_teams where id='20000000-0000-0000-0000-000000000003';
insert into public.world_preseason_team_members(season_id,team_id,user_id)
select season_id,id,'00000000-0000-0000-0000-000000000038'::uuid from public.world_preseason_teams where id='20000000-0000-0000-0000-000000000004';
update public.world_preseason_teams set recruitment_locked=true where id='20000000-0000-0000-0000-000000000002';
update public.world_preseason_teams set status='dissolved',recruitment_locked=true where id='20000000-0000-0000-0000-000000000005';
insert into public.world_preseason_team_applications(id,season_id,team_id,applicant_user_id,created_at)
select ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid, s.id,
  ('20000000-0000-0000-0000-'||lpad((case n when 2 then 2 when 3 then 3 when 7 then 4 when 8 then 5 else 1 end)::text,12,'0'))::uuid,
  ('00000000-0000-0000-0000-'||lpad((case n when 1 then 32 when 2 then 34 when 3 then 37 when 4 then 38 when 5 then 31 when 6 then 40 when 7 then 32 else 42 end)::text,12,'0'))::uuid,
  '2026-01-01'::timestamptz + make_interval(secs=>n)
from public.world_preseason_seasons s cross join generate_series(1,8) n where s.code='season-1';
insert into public.world_preseason_seasons(code,display_name) values ('season-other','Other season');
insert into public.world_preseason_teams(id,season_id,name,captain_user_id,created_by)
select '20000000-0000-0000-0000-000000000006',id,'Other season team','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000031'
from public.world_preseason_seasons where code='season-other';
insert into public.world_preseason_team_applications(id,season_id,team_id,applicant_user_id)
select '10000000-0000-0000-0000-000000000009',id,'20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000032'
from public.world_preseason_seasons where code='season-other';
