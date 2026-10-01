-- Detail-only view of a player in the viewer's NEC/IEO division. Do not expose
-- academic_profiles through a table policy: each category keeps its owner-set
-- public / matches / private visibility from visible_competition_academic.
begin;

create or replace function public.get_competition_player_detail(
  p_target uuid,
  p_competition text,
  p_division text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_viewer uuid := public.require_member_profile_user();
  v_match public.competition_matching_profiles%rowtype;
  v_academic public.academic_profiles%rowtype;
  v_viewer_team uuid;
  v_visible jsonb;
  v_school_visible boolean;
  v_gpa_visible boolean;
  v_profile public.profiles%rowtype;
  v_grade text;
begin
  if not exists (
    select 1 from public.competition_matching_profiles m
    where m.user_id = v_viewer and m.competition = p_competition
      and m.division = p_division and m.active
  ) then
    raise exception 'Join this competition division first';
  end if;

  select * into v_match from public.competition_matching_profiles m
  where m.user_id = p_target and m.competition = p_competition
    and m.division = p_division and m.active and m.status = 'looking_for_team';
  if not found then raise exception 'Player is not available in this division'; end if;
  if exists (
    select 1 from public.competition_blocks b
    where (b.user_id = v_viewer and b.blocked_user_id = p_target)
       or (b.user_id = p_target and b.blocked_user_id = v_viewer)
  ) then raise exception 'Player is not available'; end if;

  select m.team_id into v_viewer_team from public.competition_team_members m
  where m.user_id = v_viewer and m.competition = p_competition
    and m.division = p_division;
  select * into v_academic from public.academic_profiles a where a.user_id = p_target;
  select * into v_profile from public.profiles p where p.user_id = p_target;
  select d.grade into v_grade from public.member_profile_details d where d.user_id = p_target;
  v_visible := public.visible_competition_academic(p_target, v_viewer, v_viewer_team);
  v_school_visible := v_visible->>'school' is not null;
  v_gpa_visible := v_visible->>'gpa' is not null;

  return jsonb_build_object(
    'id', p_target,
    'name', v_profile.display_name,
    'avatar', v_profile.avatar_url,
    'school', v_visible->>'school',
    'curriculum', v_academic.curriculum,
    'bio', v_academic.bio,
    'strengths', v_match.strengths,
    'needs', v_match.needs,
    'preferences', v_match.preferences,
    'target', v_match.target,
    'academicDetails', v_visible || jsonb_build_object(
      'country', case when v_school_visible then v_academic.country else null end,
      'location', case when v_school_visible then v_academic.location else null end,
      'grade', case when v_school_visible then v_grade else null end,
      'graduationYear', case when v_school_visible then v_academic.graduation_year else null end,
      'gpaSystem', case when v_gpa_visible then v_academic.gpa_system else null end
    )
  );
end $$;

revoke all on function public.get_competition_player_detail(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.get_competition_player_detail(uuid,text,text)
  to authenticated;

commit;
