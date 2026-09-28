do $verify$
begin
  if to_regclass('public.academic_profiles') is null
     or to_regclass('public.competition_matching_profiles') is null
     or to_regclass('public.competition_teams') is null
     or to_regclass('public.competition_requests') is null
     or to_regclass('public.competition_lobby_messages') is null
     or to_regprocedure('public.get_competition_home(text,text,integer,text)') is null
     or to_regprocedure('public.get_competition_lounge(text,text)') is null
     or to_regprocedure('public.resolve_competition_request(uuid,text)') is null then
    raise exception 'Competition matching migration is required before website deployment';
  end if;
end
$verify$;
