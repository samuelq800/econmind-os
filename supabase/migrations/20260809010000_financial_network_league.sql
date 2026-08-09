-- Financial Network: fourth asynchronous League format.
-- This migration extends the existing generic Challenge tables; it does not
-- touch the persistent World Simulation, its countries, or its seven offices.

alter table public.league_challenges
  drop constraint if exists league_challenges_simulation_type_check;
alter table public.league_challenges
  add constraint league_challenges_simulation_type_check
  check (simulation_type in ('world', 'time_machine', 'industry', 'financial'));

alter table public.league_ghost_strategies
  drop constraint if exists league_ghost_strategies_simulation_type_check;
alter table public.league_ghost_strategies
  add constraint league_ghost_strategies_simulation_type_check
  check (simulation_type in ('world', 'time_machine', 'industry', 'financial'));

-- The database remains the final authority for the published score. The
-- browser provides the same visible formula for learning feedback, but no
-- client can submit a different final score.
create or replace function public.derive_league_challenge_score(p_simulation_type text, p_state jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_simulation_type
    when 'world' then greatest(0, least(100,
      100
      - greatest(0, least(25, (2 - coalesce((p_state->>'growth')::numeric, 0)) * 6.25))
      - greatest(0, least(25, abs(coalesce((p_state->>'inflation')::numeric, 2) - 2) * 4.2))
      - greatest(0, least(25, (coalesce((p_state->>'unemployment')::numeric, 4) - 4) * 4.2))
      - greatest(0, least(25, (coalesce((p_state->>'debtToGdp')::numeric, 60) - 60) * .55))
    ))
    when 'time_machine' then greatest(0, least(100,
      greatest(0, least(40,
        40 - abs(coalesce((p_state->>'inflation')::numeric, 3) - 3) * 2.3
           - greatest(0, coalesce((p_state->>'unemployment')::numeric, 5) - 5) * 1.9
      ))
      + greatest(0, least(30,
        30 * ((coalesce((p_state->>'realOutput')::numeric, 70) - 70) / 65)
           + coalesce((p_state->>'recovery')::numeric, 0) * .12
      ))
      + greatest(0, least(30,
        30 - greatest(0, coalesce((p_state->>'debtToGdp')::numeric, 45) - 45) * .32
           - greatest(0, -coalesce((p_state->>'fiscalBalance')::numeric, -2) - 2) * .9
      ))
    ))
    when 'industry' then greatest(0, least(100,
      greatest(0, least(40,
        20 + coalesce((p_state->>'profit')::numeric, 0) * 8 + coalesce((p_state->>'revenue')::numeric, 0) * .7
      ))
      + greatest(0, least(30,
        coalesce((p_state->>'marketShare')::numeric, 0) * 1.15 + coalesce((p_state->>'brandStrength')::numeric, 0) * .09
      ))
      + greatest(0, least(30,
        coalesce((p_state->>'technologyLevel')::numeric, 0) * .18
          + greatest(0, 18 - coalesce((p_state->>'inventory')::numeric, 600) * .03)
          + coalesce((p_state->>'firmValue')::numeric, 0) * .04
      ))
    ))
    when 'financial' then greatest(0, least(100,
      greatest(0, least(40,
        (coalesce((p_state->>'capitalRatio')::numeric, 0) / 12) * 40
        - case when coalesce((p_state->>'capital')::numeric, 0) <= 0 then 40 else 0 end
      ))
      + greatest(0, least(30,
        15 + coalesce((p_state->>'cumulativeProfit')::numeric, 0) * 3.2
           - greatest(0, coalesce((p_state->>'defaultRisk')::numeric, 100) - 28) * .15
      ))
      + greatest(0, least(30,
        (coalesce((p_state->>'liquidityRatio')::numeric, 0) / 24) * 30
           - greatest(0, coalesce((p_state->>'defaultRisk')::numeric, 100) - 40) * .08
      ))
    ))
    else 0
  end
$$;

-- Active asynchronous Challenges must not reveal a leading team, a score
-- distribution or a parameter-search target. Admin reporting can inspect the
-- underlying rows through its separate privileged workflow; the participant
-- leaderboard releases only after the Challenge has closed.
create or replace function public.get_league_challenge_leaderboard(p_challenge_slug text)
returns table(
  rank bigint,
  team_id uuid,
  team_name text,
  school_id uuid,
  school_name text,
  challenges_completed bigint,
  performance_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with selected_challenge as (
    select id from public.league_challenges where slug = p_challenge_slug and status = 'closed'
  ), best_attempt as (
    select distinct on (attempt.team_id)
      attempt.team_id, attempt.school_id, attempt.final_score
    from public.league_challenge_attempts attempt
    join selected_challenge challenge on challenge.id = attempt.challenge_id
    where attempt.mode = 'official' and attempt.status = 'submitted'
    order by attempt.team_id, attempt.final_score desc, attempt.submitted_at asc
  ), completed as (
    select attempt.team_id, count(*)::bigint as total
    from public.league_challenge_attempts attempt
    where attempt.mode = 'official' and attempt.status = 'submitted'
    group by attempt.team_id
  )
  select rank() over(order by best_attempt.final_score desc, team.name), best_attempt.team_id, team.name,
    school.id, school.name, coalesce(completed.total, 0), best_attempt.final_score
  from best_attempt
  join public.teams team on team.id = best_attempt.team_id
  join public.schools school on school.id = best_attempt.school_id
  left join completed on completed.team_id = best_attempt.team_id
  order by best_attempt.final_score desc, team.name
$$;

-- Seed only the static, public Challenge definition. It is idempotent and
-- does not create teams, attempts, scores, or hidden Ghost behaviour.
insert into public.league_challenges(
  season_id, slug, simulation_type, title, description, status,
  scenario_snapshot, scoring_config, official_attempt_limit, stage_count, replay_visibility
)
select season.id,
  'financial-network-contagion',
  'financial',
  'Financial Network: Financial Contagion',
  'Run a fictional commercial bank through credit expansion, an asset shock and interbank liquidity stress.',
  'open',
  '{"bank":"Aster Bank","network":["Northstar Bank","Meridian Bank","League Ghost 07","Harbour Bank"],"stages":["normal","credit_expansion","asset_shock","liquidity_stress","system_recovery"]}'::jsonb,
  '{"solvency":40,"profitability":30,"liquidity":30,"systemic_impact":"analysis_only"}'::jsonb,
  5,
  5,
  'after_challenge_close'
from public.league_seasons season
where season.slug = 'asynchronous-league-foundation'
on conflict (slug) do update
set simulation_type = excluded.simulation_type,
    title = excluded.title,
    description = excluded.description,
    scenario_snapshot = excluded.scenario_snapshot,
    scoring_config = excluded.scoring_config,
    official_attempt_limit = 5,
    stage_count = 5,
    replay_visibility = excluded.replay_visibility;

-- Existing Challenge RLS policies and security-definer RPCs are generic. They
-- continue to limit students to their own team attempts, block edits to locked
-- stages, and keep Ghost behaviour data server-side during an open Challenge.
