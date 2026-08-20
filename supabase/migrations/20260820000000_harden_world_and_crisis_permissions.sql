-- Close the three client-side permission gaps reported in issue #37.
--
-- 1. Full World state is limited to eligible League participants and World
--    administrators instead of every authenticated account.
-- 2. Scheduled shocks remain hidden until they become active.
-- 3. Quick Policy Challenge results are written atomically through a
--    server-calculated RPC; authenticated clients can no longer insert or
--    update score-bearing rows directly.

begin;

create or replace function public.can_view_continuous_world(
  p_world_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (
    public.can_administer_continuous_world(p_world_id, p_user_id)
    or exists(
      select 1
      from public.continuous_world_memberships membership
      where membership.world_id = p_world_id
        and membership.user_id = p_user_id
        and membership.membership_status = 'active'
    )
    -- An approved League Team member must be able to discover the live World
    -- before join_continuous_world creates their first membership row.
    or public.continuous_world_team_for_user(p_user_id) is not null
  )
$$;

drop policy if exists continuous_worlds_read_authenticated
  on public.continuous_worlds;
drop policy if exists continuous_worlds_read_participants
  on public.continuous_worlds;
create policy continuous_worlds_read_participants
on public.continuous_worlds
for select
to authenticated
using (public.can_view_continuous_world(id));

drop policy if exists continuous_world_shocks_read_authenticated
  on public.continuous_world_shocks;
drop policy if exists continuous_world_shocks_read_visible
  on public.continuous_world_shocks;
create policy continuous_world_shocks_read_visible
on public.continuous_world_shocks
for select
to authenticated
using (
  public.can_administer_continuous_world(world_id)
  or (
    public.can_view_continuous_world(world_id)
    and status in ('active', 'expired')
    and starts_at <= timezone('utc', now())
  )
);

-- Revoke the old table-write path before exposing the replacement RPC.
drop policy if exists crisis_runs_insert_own on public.crisis_runs;
drop policy if exists crisis_runs_update_own on public.crisis_runs;
drop policy if exists crisis_decisions_insert_owner on public.crisis_decisions;
revoke insert, update, delete on public.crisis_runs from authenticated;
revoke insert, update, delete on public.crisis_decisions from authenticated;

create or replace function public.submit_crisis_run(
  p_team_id uuid,
  p_decisions jsonb
)
returns public.crisis_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  decision jsonb;
  decision_rows jsonb := '[]'::jsonb;
  round_number integer;
  monetary_policy text;
  fiscal_policy text;
  energy_policy text;
  metrics_before jsonb;
  metrics_after jsonb;
  explanation jsonb;

  growth numeric := 1.4;
  inflation numeric := 5.2;
  unemployment numeric := 6.8;
  debt numeric := 72;
  approval numeric := 55;
  emissions numeric := 100;
  delta_growth numeric;
  delta_inflation numeric;
  delta_unemployment numeric;
  delta_debt numeric;
  delta_approval numeric;
  delta_emissions numeric;

  growth_score numeric;
  price_stability_score numeric;
  employment_score numeric;
  fiscal_sustainability_score numeric;
  social_welfare_score numeric;
  environmental_sustainability_score numeric;
  total_score numeric;
  result_type text;
  strongest_label text;
  weakest_label text;
  strongest_decision text;
  unintended_consequence text;
  improvement text;
  initial_metrics jsonb := jsonb_build_object(
    'growth', 1.4,
    'inflation', 5.2,
    'unemployment', 6.8,
    'debt', 72,
    'approval', 55,
    'emissions', 100
  );
  final_metrics jsonb;
  dimension_scores jsonb;
  result_summary jsonb;
  created_run public.crisis_runs%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if p_team_id is not null and not public.is_team_member(p_team_id, actor_id) then
    raise exception 'You can only submit a result for one of your Teams';
  end if;
  if jsonb_typeof(p_decisions) <> 'array'
     or jsonb_array_length(p_decisions) <> 2 then
    raise exception 'Exactly two policy decisions are required';
  end if;

  for round_number in 1..2 loop
    decision := p_decisions -> (round_number - 1);
    if jsonb_typeof(decision) <> 'object'
       or coalesce(decision ->> 'round_number', '') <> round_number::text then
      raise exception 'Policy decisions must contain rounds 1 and 2 in order';
    end if;

    monetary_policy := decision ->> 'monetary_policy';
    fiscal_policy := decision ->> 'fiscal_policy';
    energy_policy := decision ->> 'energy_policy';
    if not coalesce(monetary_policy in ('cut', 'hold', 'raise'), false)
       or not coalesce(fiscal_policy in ('reduce', 'maintain', 'increase'), false)
       or not coalesce(energy_policy in ('none', 'targeted', 'broad'), false) then
      raise exception 'Invalid crisis policy choice';
    end if;

    -- The oil-price shock is a fixed part of the scenario between rounds.
    if round_number = 2 then
      growth := round(greatest(-8, least(8, growth - 1.1)), 1);
      inflation := round(greatest(0, least(18, inflation + 1.7)), 1);
      unemployment := round(greatest(2, least(22, unemployment + 0.5)), 1);
      debt := round(greatest(25, least(180, debt + 0.6)), 1);
      approval := round(greatest(0, least(100, approval - 4.2)), 1);
      emissions := round(greatest(50, least(180, emissions + 0.7)), 1);
    end if;

    metrics_before := jsonb_build_object(
      'growth', growth,
      'inflation', inflation,
      'unemployment', unemployment,
      'debt', debt,
      'approval', approval,
      'emissions', emissions
    );
    delta_growth := 0;
    delta_inflation := 0;
    delta_unemployment := 0;
    delta_debt := 0;
    delta_approval := 0;
    delta_emissions := 0;

    case monetary_policy
      when 'cut' then
        delta_growth := delta_growth + 0.5;
        delta_inflation := delta_inflation + 0.4;
        delta_unemployment := delta_unemployment - 0.2;
        delta_approval := delta_approval + 0.4;
        delta_emissions := delta_emissions + 0.2;
      when 'raise' then
        delta_growth := delta_growth - 0.4;
        delta_inflation := delta_inflation - 0.6;
        delta_unemployment := delta_unemployment + 0.3;
        delta_approval := delta_approval - 0.5;
      else null;
    end case;

    case fiscal_policy
      when 'reduce' then
        delta_growth := delta_growth - 0.5;
        delta_inflation := delta_inflation - 0.2;
        delta_unemployment := delta_unemployment + 0.4;
        delta_debt := delta_debt - 1.8;
        delta_approval := delta_approval - 0.8;
        delta_emissions := delta_emissions - 0.2;
      when 'increase' then
        delta_growth := delta_growth + 0.8;
        delta_inflation := delta_inflation + 0.4;
        delta_unemployment := delta_unemployment - 0.5;
        delta_debt := delta_debt + 2.5;
        delta_approval := delta_approval + 0.7;
        delta_emissions := delta_emissions + 0.5;
      else null;
    end case;

    case energy_policy
      when 'none' then
        delta_approval := delta_approval - 0.5;
      when 'targeted' then
        delta_growth := delta_growth + 0.2;
        delta_inflation := delta_inflation - 0.4;
        delta_debt := delta_debt + 1.1;
        delta_approval := delta_approval + 2;
        delta_emissions := delta_emissions + 0.1;
      when 'broad' then
        delta_growth := delta_growth + 0.4;
        delta_inflation := delta_inflation - 0.8;
        delta_debt := delta_debt + 3.6;
        delta_approval := delta_approval + 4.2;
        delta_emissions := delta_emissions + 2.2;
    end case;

    if monetary_policy = 'raise' and fiscal_policy = 'increase' then
      delta_growth := delta_growth - 0.2;
      delta_inflation := delta_inflation - 0.2;
      delta_unemployment := delta_unemployment + 0.1;
    end if;
    if monetary_policy = 'raise' and fiscal_policy = 'reduce' then
      delta_growth := delta_growth - 0.5;
      delta_inflation := delta_inflation - 0.2;
      delta_unemployment := delta_unemployment + 0.3;
      delta_debt := delta_debt - 0.6;
    end if;
    if round_number = 2 and energy_policy = 'broad' then
      delta_inflation := delta_inflation - 0.4;
      delta_debt := delta_debt + 1.2;
      delta_approval := delta_approval + 1.8;
      delta_emissions := delta_emissions + 0.8;
    elsif round_number = 2 and energy_policy = 'targeted' then
      delta_inflation := delta_inflation - 0.2;
      delta_debt := delta_debt + 0.3;
      delta_approval := delta_approval + 1;
    end if;

    growth := round(greatest(-8, least(8, growth + delta_growth)), 1);
    inflation := round(greatest(0, least(18, inflation + delta_inflation)), 1);
    unemployment := round(greatest(2, least(22, unemployment + delta_unemployment)), 1);
    debt := round(greatest(25, least(180, debt + delta_debt)), 1);
    approval := round(greatest(0, least(100, approval + delta_approval)), 1);
    emissions := round(greatest(50, least(180, emissions + delta_emissions)), 1);

    metrics_after := jsonb_build_object(
      'growth', growth,
      'inflation', inflation,
      'unemployment', unemployment,
      'debt', debt,
      'approval', approval,
      'emissions', emissions
    );
    explanation := jsonb_build_object(
      'serverValidated', true,
      'mechanisms', jsonb_build_array(
        'The recorded monetary choice changes demand and the inflation-employment trade-off.',
        'The recorded fiscal choice changes public demand and the debt trajectory.',
        'The recorded energy choice changes household protection, fiscal costs and price signals.'
      )
    );
    decision_rows := decision_rows || jsonb_build_array(jsonb_build_object(
      'round_number', round_number,
      'monetary_policy', monetary_policy,
      'fiscal_policy', fiscal_policy,
      'energy_policy', energy_policy,
      'shock_id', case when round_number = 2 then 'oil-price-spike' else null end,
      'metrics_before', metrics_before,
      'metrics_after', metrics_after,
      'explanation', explanation
    ));
  end loop;

  final_metrics := jsonb_build_object(
    'growth', growth,
    'inflation', inflation,
    'unemployment', unemployment,
    'debt', debt,
    'approval', approval,
    'emissions', emissions
  );
  growth_score := round(greatest(0, least(100, 100 - abs(growth - 2.5) * 16)), 1);
  price_stability_score := round(greatest(0, least(100, 100 - abs(inflation - 2) * 14)), 1);
  employment_score := round(greatest(0, least(100, 100 - abs(unemployment - 4.5) * 13)), 1);
  fiscal_sustainability_score := round(greatest(0, least(100,
    100 - greatest(0, debt - 55) * 1.05 - greatest(0, 55 - debt) * 0.15
  )), 1);
  social_welfare_score := round(greatest(0, least(100,
    approval * 0.72
      + (100 - abs(inflation - 2) * 10) * 0.18
      + (100 - abs(unemployment - 4.5) * 8) * 0.1
  )), 1);
  environmental_sustainability_score := round(greatest(0, least(100,
    100 - greatest(0, emissions - 78) * 0.9
  )), 1);
  total_score := round(
    growth_score * 0.2
      + price_stability_score * 0.2
      + employment_score * 0.15
      + fiscal_sustainability_score * 0.15
      + social_welfare_score * 0.2
      + environmental_sustainability_score * 0.1,
    1
  );
  dimension_scores := jsonb_build_object(
    'growth', growth_score,
    'priceStability', price_stability_score,
    'employment', employment_score,
    'fiscalSustainability', fiscal_sustainability_score,
    'socialWelfare', social_welfare_score,
    'environmentalSustainability', environmental_sustainability_score
  );

  result_type := case
    when total_score < 38 then 'Crisis Mismanagement'
    when price_stability_score >= 78 and growth_score < 55 then 'Inflation Fighter'
    when growth_score >= 75 and fiscal_sustainability_score < 48 then 'Growth at All Costs'
    when social_welfare_score >= 78 and fiscal_sustainability_score < 58 then 'Socially Protective'
    when fiscal_sustainability_score >= 80 and growth_score < 60 then 'Fiscal Conservative'
    when price_stability_score >= 70 and growth_score < 62 then 'Stable but Slow'
    else 'Balanced Economy'
  end;

  select label into strongest_label
  from (values
    (1, 'Growth', growth_score),
    (2, 'Price Stability', price_stability_score),
    (3, 'Employment', employment_score),
    (4, 'Fiscal Sustainability', fiscal_sustainability_score),
    (5, 'Social Welfare', social_welfare_score),
    (6, 'Environmental Sustainability', environmental_sustainability_score)
  ) as scores(position, label, score)
  order by score desc, position
  limit 1;
  select label into weakest_label
  from (values
    (1, 'Growth', growth_score),
    (2, 'Price Stability', price_stability_score),
    (3, 'Employment', employment_score),
    (4, 'Fiscal Sustainability', fiscal_sustainability_score),
    (5, 'Social Welfare', social_welfare_score),
    (6, 'Environmental Sustainability', environmental_sustainability_score)
  ) as scores(position, label, score)
  order by score, position
  limit 1;

  strongest_decision := case
    when exists(
      select 1 from jsonb_array_elements(p_decisions) item
      where item ->> 'energy_policy' = 'targeted'
    ) then 'Targeted household support protected welfare while containing the fiscal cost.'
    when exists(
      select 1 from jsonb_array_elements(p_decisions) item
      where item ->> 'monetary_policy' = 'raise'
    ) then 'Using monetary restraint created a clear channel for reducing inflation.'
    else 'Your policy mix kept demand from collapsing during a difficult shock.'
  end;
  unintended_consequence := case
    when exists(
      select 1 from jsonb_array_elements(p_decisions) item
      where item ->> 'energy_policy' = 'broad'
    ) then 'Broad subsidy improved immediate approval but weakened price signals and raised debt.'
    when exists(
      select 1 from jsonb_array_elements(p_decisions) item
      where item ->> 'fiscal_policy' = 'increase'
    ) then 'Fiscal support improved activity but added to inflation and debt pressure.'
    else 'Caution protected one objective but left households and activity more exposed to the shock.'
  end;
  improvement := case
    when inflation > 3.5 then 'A more credible anti-inflation stance or tighter targeting could reduce persistent price pressure.'
    when debt > 80 then 'A smaller or more targeted fiscal commitment would improve sustainability.'
    when unemployment > 6 then 'Add carefully targeted support for demand and employment while protecting price stability.'
    else 'Preserve the balance, but monitor the next shock rather than assuming the recovery is complete.'
  end;
  result_summary := jsonb_build_object(
    'strongestDecision', strongest_decision,
    'largestTradeOff', format('Your largest trade-off was between %s and %s.', strongest_label, weakest_label),
    'unintendedConsequence', unintended_consequence,
    'improvement', improvement,
    'serverValidated', true
  );

  insert into public.crisis_runs(
    user_id,
    team_id,
    scenario_id,
    current_round,
    initial_metrics,
    final_metrics,
    dimension_scores,
    total_score,
    result_type,
    result_summary
  ) values (
    actor_id,
    p_team_id,
    'energy-inflation-dilemma',
    2,
    initial_metrics,
    final_metrics,
    dimension_scores,
    total_score,
    result_type,
    result_summary
  )
  returning * into created_run;

  insert into public.crisis_decisions(
    crisis_run_id,
    round_number,
    monetary_policy,
    fiscal_policy,
    energy_policy,
    shock_id,
    metrics_before,
    metrics_after,
    explanation
  )
  select
    created_run.id,
    (row ->> 'round_number')::smallint,
    row ->> 'monetary_policy',
    row ->> 'fiscal_policy',
    row ->> 'energy_policy',
    row ->> 'shock_id',
    row -> 'metrics_before',
    row -> 'metrics_after',
    row -> 'explanation'
  from jsonb_array_elements(decision_rows) row;

  return created_run;
end;
$$;

revoke all on function public.can_view_continuous_world(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.can_view_continuous_world(uuid, uuid)
  to authenticated;
revoke all on function public.submit_crisis_run(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_crisis_run(uuid, jsonb)
  to authenticated;

commit;
