-- EconMind OS Phase F completion:
-- expose the immutable mechanism chain in reports, permit the experiment owner
-- (student or teacher) to create a revocable share link, and give teachers the
-- saved attempt number in their submission review export.

create or replace function public.report_json(p_submission_id uuid, p_allow_unreleased boolean default false)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'submission_id', s.id,
    'title', e.title,
    'model_key', e.model_key,
    'code', e.code,
    'submitted_at', s.created_at,
    'prediction', s.prediction,
    'explanation', s.explanation,
    'parameters', s.final_parameters,
    'results', s.calculated_results,
    'mechanism_chain', s.mechanism_chain,
    'auto_score', case when s.feedback_released or p_allow_unreleased then s.auto_score else null end,
    'final_score', case when s.feedback_released or p_allow_unreleased then s.final_score else null end,
    'feedback_released', s.feedback_released,
    'score_details', case when s.feedback_released or p_allow_unreleased then s.score_details else '{}'::jsonb end,
    'teacher_feedback', case when s.feedback_released or p_allow_unreleased then f.feedback else null end,
    'share_token', (select token from public.report_share_tokens where submission_id = s.id and revoked_at is null)
  )
  from public.submissions s
  join public.experiments e on e.id = s.experiment_id
  left join public.teacher_feedback f on f.submission_id = s.id
  where s.id = p_submission_id
$$;

create or replace function public.create_report_share(p_submission_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare value text;
begin
  if not exists(
    select 1
    from public.submissions s
    join public.experiments e on e.id = s.experiment_id
    where s.id = p_submission_id
      and (s.student_id = auth.uid() or e.teacher_id = auth.uid())
  ) then
    raise exception 'Report access denied';
  end if;

  insert into public.report_share_tokens(submission_id, owner_id)
  values(p_submission_id, auth.uid())
  on conflict(submission_id) do update
    set token = encode(extensions.gen_random_bytes(24), 'hex'),
        owner_id = auth.uid(),
        revoked_at = null,
        created_at = timezone('utc', now())
  returning token into value;
  return value;
end;
$$;

create or replace function public.list_teacher_experiment_submissions(p_experiment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when exists(
    select 1 from public.experiments
    where id = p_experiment_id and teacher_id = auth.uid() and public.is_teacher(auth.uid())
  ) then coalesce((
    select jsonb_agg(
      to_jsonb(s)
      || jsonb_build_object('attempt_number', a.attempt_number)
      || jsonb_build_object('feedback', case when f.id is null then '[]'::jsonb else jsonb_build_array(to_jsonb(f)) end)
      order by s.created_at desc
    )
    from public.submissions s
    join public.experiment_attempts a on a.id = s.attempt_id
    left join public.teacher_feedback f on f.submission_id = s.id
    where s.experiment_id = p_experiment_id
  ), '[]'::jsonb) else null end
$$;
