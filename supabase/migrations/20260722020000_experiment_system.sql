-- EconMind OS V1.3 formal experiments
-- One migration for roles, experiment authoring, immutable attempts,
-- server-side validation/scoring, private reports, and anonymous aggregates.

alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'teacher'));

-- Authenticated users may edit their profile fields, but never their own role.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, preferred_theme) on public.profiles to authenticated;

create or replace function public.is_teacher(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where user_id = p_user_id and role = 'teacher') $$;

revoke all on function public.is_teacher(uuid) from public;
grant execute on function public.is_teacher(uuid) to authenticated;

create or replace function public.generate_experiment_code()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; result text := '';
begin
  for i in 1..8 loop result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1); end loop;
  return result;
end;
$$;

create table public.experiments (
  id uuid primary key default extensions.gen_random_uuid(),
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  code text not null default public.generate_experiment_code() unique check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
  title text not null check (char_length(title) between 1 and 160),
  model_key text not null check (model_key in ('supply-demand','policy','price-controls','elasticity','externalities','monopoly','ppf','ad-as')),
  context text not null check (char_length(context) between 1 and 6000),
  objective text not null check (char_length(objective) between 1 and 3000),
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  prediction_question text not null check (char_length(prediction_question) between 1 and 2000),
  prediction_type text not null check (prediction_type in ('choice','numeric','text')),
  prediction_options jsonb not null default '[]'::jsonb check (jsonb_typeof(prediction_options) = 'array'),
  attempt_limit integer check (attempt_limit is null or attempt_limit between 1 and 50),
  explanation_required boolean not null default true,
  immediate_feedback boolean not null default true,
  result_visibility text not null default 'private' check (result_visibility in ('private','aggregate')),
  aggregate_published boolean not null default false,
  scoring_weights jsonb not null default '{"prediction":20,"success":30,"compliance":20,"accuracy":20,"attempts":10}'::jsonb check (jsonb_typeof(scoring_weights) = 'object'),
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.experiment_parameter_permissions (
  id uuid primary key default extensions.gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  parameter_key text not null check (parameter_key ~ '^[A-Za-z][A-Za-z0-9]{0,63}$'),
  is_editable boolean not null default true,
  minimum numeric not null,
  maximum numeric not null,
  initial_value numeric not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (experiment_id, parameter_key),
  check (minimum <= initial_value and initial_value <= maximum)
);

create table public.experiment_success_conditions (
  id uuid primary key default extensions.gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  condition_kind text not null check (condition_kind in ('prediction','result')),
  metric_key text,
  operator text not null check (operator in ('gte','lte','between','equals')),
  target_minimum numeric not null default 0,
  target_maximum numeric not null default 0,
  tolerance numeric not null default 0 check (tolerance >= 0),
  expected_value jsonb not null default '{}'::jsonb check (jsonb_typeof(expected_value) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  check ((condition_kind = 'prediction' and metric_key is null) or (condition_kind = 'result' and metric_key is not null))
);
create unique index experiment_one_prediction_rule_idx on public.experiment_success_conditions(experiment_id) where condition_kind = 'prediction';

create table public.experiment_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'joined' check (status in ('joined','in_progress','submitted')),
  attempt_epoch integer not null default 1 check (attempt_epoch > 0),
  prediction jsonb,
  prediction_submitted_at timestamptz,
  joined_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (experiment_id, student_id)
);

create or replace function public.is_experiment_participant(p_experiment_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.experiment_participants where experiment_id=p_experiment_id and student_id=p_user_id) $$;

revoke all on function public.is_experiment_participant(uuid,uuid) from public,anon;
grant execute on function public.is_experiment_participant(uuid,uuid) to authenticated;

create table public.experiment_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  participant_id uuid not null references public.experiment_participants(id) on delete cascade,
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  attempt_epoch integer not null check (attempt_epoch > 0),
  attempt_number integer not null check (attempt_number > 0),
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object'),
  results jsonb not null check (jsonb_typeof(results) = 'object'),
  mechanism_chain jsonb not null default '[]'::jsonb check (jsonb_typeof(mechanism_chain) = 'array'),
  score_details jsonb not null default '{}'::jsonb check (jsonb_typeof(score_details) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (participant_id, attempt_epoch, attempt_number)
);

create table public.submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  participant_id uuid not null references public.experiment_participants(id) on delete cascade,
  attempt_id uuid not null unique references public.experiment_attempts(id) on delete restrict,
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  attempt_epoch integer not null check (attempt_epoch > 0),
  prediction jsonb,
  final_parameters jsonb not null check (jsonb_typeof(final_parameters) = 'object'),
  calculated_results jsonb not null check (jsonb_typeof(calculated_results) = 'object'),
  mechanism_chain jsonb not null check (jsonb_typeof(mechanism_chain) = 'array'),
  explanation jsonb not null default '{"schema_version":1,"response":""}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  score_details jsonb not null default '{}'::jsonb check (jsonb_typeof(score_details) = 'object'),
  auto_score numeric not null check (auto_score between 0 and 100),
  final_score numeric not null check (final_score between 0 and 100),
  feedback_released boolean not null default false,
  completion_status text not null default 'submitted' check (completion_status = 'submitted'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (participant_id, attempt_epoch)
);

create table public.teacher_feedback (
  id uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  explanation_score numeric check (explanation_score between 0 and 100),
  feedback text not null default '' check (char_length(feedback) <= 10000),
  override_final_score numeric check (override_final_score between 0 and 100),
  released_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.report_share_tokens (
  token text primary key default encode(extensions.gen_random_bytes(24), 'hex') check (token ~ '^[a-f0-9]{48}$'),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create index experiments_teacher_updated_idx on public.experiments(teacher_id, updated_at desc);
create index experiments_public_idx on public.experiments(status, published_at desc) where status = 'published';
create index participants_experiment_status_idx on public.experiment_participants(experiment_id, status);
create index attempts_participant_epoch_idx on public.experiment_attempts(participant_id, attempt_epoch, attempt_number desc);
create index submissions_student_created_idx on public.submissions(student_id, created_at desc);
create index submissions_experiment_created_idx on public.submissions(experiment_id, created_at desc);

create trigger experiments_set_updated_at before update on public.experiments for each row execute function public.set_updated_at();
create trigger experiment_participants_set_updated_at before update on public.experiment_participants for each row execute function public.set_updated_at();
create trigger teacher_feedback_set_updated_at before update on public.teacher_feedback for each row execute function public.set_updated_at();

create or replace function public.validate_experiment_configuration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare total numeric;
begin
  if not public.is_teacher(new.teacher_id) then raise exception 'Teacher role required'; end if;
  total := coalesce((new.scoring_weights->>'prediction')::numeric, -1) + coalesce((new.scoring_weights->>'success')::numeric, -1) + coalesce((new.scoring_weights->>'compliance')::numeric, -1) + coalesce((new.scoring_weights->>'accuracy')::numeric, -1) + coalesce((new.scoring_weights->>'attempts')::numeric, -1);
  if total <> 100 then raise exception 'Scoring weights must total 100'; end if;
  if exists(select 1 from jsonb_each_text(new.scoring_weights) where value::numeric < 0 or value::numeric > 100) then raise exception 'Scoring weights must be between 0 and 100'; end if;
  if tg_op = 'UPDATE' and new.teacher_id <> old.teacher_id then raise exception 'Experiment ownership cannot be transferred'; end if;
  if new.status = 'published' and new.published_at is null then new.published_at := timezone('utc', now()); end if;
  if new.status = 'closed' and new.closed_at is null then new.closed_at := timezone('utc', now()); end if;
  return new;
end;
$$;
create trigger validate_experiment_configuration_trigger before insert or update on public.experiments for each row execute function public.validate_experiment_configuration();

create or replace function public.model_parameter_bounds(p_model_key text, p_parameter_key text)
returns table(minimum numeric, maximum numeric) language sql immutable set search_path = '' as $$
  select v.minimum, v.maximum from (values
    ('supply-demand','demandIntercept',60,160),('supply-demand','demandSlope',0.5,5),('supply-demand','supplyIntercept',0,60),('supply-demand','supplySlope',0.5,5),
    ('policy','demandIntercept',60,160),('policy','demandSlope',0.5,5),('policy','supplyIntercept',0,60),('policy','supplySlope',0.5,5),('policy','wedge',-20,30),
    ('price-controls','demandIntercept',60,160),('price-controls','demandSlope',0.5,5),('price-controls','supplyIntercept',0,60),('price-controls','supplySlope',0.5,5),('price-controls','controlType',0,1),('price-controls','controlPrice',0,60),
    ('elasticity','demandIntercept',60,160),('elasticity','demandSlope',0.5,5),('elasticity','price',1,45),
    ('externalities','demandIntercept',60,160),('externalities','demandSlope',0.5,5),('externalities','supplyIntercept',0,60),('externalities','supplySlope',0.5,5),('externalities','externalCost',-20,30),
    ('monopoly','demandIntercept',60,180),('monopoly','demandSlope',0.5,5),('monopoly','marginalCost',0,40),('monopoly','fixedCost',0,500),
    ('ppf','capacityX',50,200),('ppf','capacityY',50,200),('ppf','curvature',1,3),('ppf','allocation',0,100),('ppf','capacityUse',50,120),('ppf','growthRate',-25,40),
    ('ad-as','potentialOutput',80,140),('ad-as','demandShock',-25,25),('ad-as','supplyShock',-25,25),('ad-as','demandSensitivity',0.3,1.5),('ad-as','supplySensitivity',0.3,1.5)
  ) as v(model_key, parameter_key, minimum, maximum)
  where v.model_key = p_model_key and v.parameter_key = p_parameter_key
$$;

create or replace function public.validate_parameter_permission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare bounds record; model text;
begin
  select model_key into model from public.experiments where id = new.experiment_id;
  select * into bounds from public.model_parameter_bounds(model, new.parameter_key);
  if not found then raise exception 'Unknown parameter % for model %', new.parameter_key, model; end if;
  if new.minimum < bounds.minimum or new.maximum > bounds.maximum then raise exception 'Teacher range must stay inside global bounds'; end if;
  return new;
end;
$$;
create trigger validate_parameter_permission_trigger before insert or update on public.experiment_parameter_permissions for each row execute function public.validate_parameter_permission();

-- Deterministic mirror of the eight browser-side TypeScript engines.
create or replace function public.calculate_experiment_model(p_model text, p jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare a numeric; b numeric; c numeric; d numeric; e numeric; t numeric; pe numeric; qe numeric; q numeric; pc numeric; pp numeric; base_q numeric; cs numeric; ps numeric; total numeric; mc numeric; fc numeric; x numeric; y numeric; curvature numeric; allocation numeric; use_factor numeric; growth numeric; sx numeric; sy numeric; frontier_y numeric; gap numeric; demand_base numeric; supply_base numeric; price_level numeric; output numeric; output_gap numeric; effective_price numeric; qd numeric; qs numeric; traded numeric; baseline_total numeric;
begin
  a := coalesce((p->>'demandIntercept')::numeric, 0); b := coalesce((p->>'demandSlope')::numeric, 0); c := coalesce((p->>'supplyIntercept')::numeric, 0); d := coalesce((p->>'supplySlope')::numeric, 0);
  if p_model in ('supply-demand','policy','price-controls','externalities') then pe := (a-c)/(b+d); qe := a-b*pe; end if;
  if p_model = 'supply-demand' then cs := .5*(a/b-pe)*qe; ps := .5*(pe+c/d)*qe; return jsonb_build_object('price',round(pe,2),'quantity',round(qe,2),'consumerSurplus',round(cs,2),'producerSurplus',round(ps,2),'totalSurplus',round(cs+ps,2),'valid',1); end if;
  if p_model = 'policy' then t := (p->>'wedge')::numeric; pc := (a-c+d*t)/(b+d); pp := pc-t; q := a-b*pc; return jsonb_build_object('consumerPrice',round(pc,2),'producerPrice',round(pp,2),'quantity',round(q,2),'governmentBalance',round(t*q,2),'consumerShare',case when t=0 then 0 else round(abs(pc-pe)/abs(t)*100,1) end,'producerShare',case when t=0 then 0 else round(abs(pp-pe)/abs(t)*100,1) end,'deadweightLoss',round(.5*abs(t)*abs(q-qe),2),'valid',1); end if;
  if p_model = 'price-controls' then effective_price := case when ((p->>'controlType')::numeric=0 and (p->>'controlPrice')::numeric<pe) or ((p->>'controlType')::numeric=1 and (p->>'controlPrice')::numeric>pe) then (p->>'controlPrice')::numeric else pe end; qd := greatest(0,a-b*effective_price); qs := greatest(0,c+d*effective_price); traded := case when effective_price=pe then qe else least(qd,qs) end; cs := greatest(0,a/b*traded-traded*traded/(2*b)-effective_price*traded); ps := greatest(0,effective_price*traded-(traded*traded/(2*d)-c/d*traded)); baseline_total := .5*(a/b-pe)*qe+.5*(pe+c/d)*qe; return jsonb_build_object('equilibriumPrice',round(pe,2),'controlledPrice',round(effective_price,2),'quantityTraded',round(traded,2),'shortage',round(case when (p->>'controlType')::numeric=0 and effective_price<>pe then greatest(0,qd-qs) else 0 end,2),'surplus',round(case when (p->>'controlType')::numeric=1 and effective_price<>pe then greatest(0,qs-qd) else 0 end,2),'totalSurplus',round(cs+ps,2),'deadweightLoss',round(greatest(0,baseline_total-cs-ps),2),'binding',case when effective_price<>pe then 1 else 0 end,'valid',1); end if;
  if p_model = 'elasticity' then pc := (p->>'price')::numeric; q := a-b*pc; return jsonb_build_object('price',pc,'quantity',round(q,2),'elasticity',round(abs(b*pc/q),2),'totalRevenue',round(pc*q,2),'revenueMaximizingPrice',round(a/(2*b),2),'valid',case when q>0 then 1 else 0 end); end if;
  if p_model = 'externalities' then e := (p->>'externalCost')::numeric; q := greatest(0,(d*a+b*c-b*d*e)/(b+d)); cs := .5*(a/b-pe)*qe; ps := .5*(pe+c/d)*qe; total := cs+ps-e*qe; return jsonb_build_object('marketPrice',round(pe,2),'marketQuantity',round(qe,2),'efficientQuantity',round(q,2),'correctivePolicy',round(e,2),'externalImpact',round(e*qe,2),'welfareGain',round(.5*abs(e)*abs(qe-q),2),'socialWelfare',round(total+.5*abs(e)*abs(qe-q),2),'valid',1); end if;
  if p_model = 'monopoly' then mc := (p->>'marginalCost')::numeric; fc := (p->>'fixedCost')::numeric; q := greatest(0,(a-b*mc)/2); pc := case when q>0 then (a-q)/b else a/b end; qe := greatest(0,a-b*mc); total := .5*greatest(0,a/b-pc)*q+(pc-mc)*q; return jsonb_build_object('monopolyPrice',round(pc,2),'monopolyQuantity',round(q,2),'competitivePrice',round(mc,2),'competitiveQuantity',round(qe,2),'profit',round((pc-mc)*q-fc,2),'markup',round(greatest(0,pc-mc),2),'lernerIndex',round(greatest(0,pc-mc)/nullif(pc,0),3),'deadweightLoss',round(greatest(0,.5*greatest(0,a/b-mc)*qe-total),2),'valid',1); end if;
  if p_model = 'ppf' then x := (p->>'capacityX')::numeric; y := (p->>'capacityY')::numeric; curvature := (p->>'curvature')::numeric; allocation := (p->>'allocation')::numeric/100; use_factor := (p->>'capacityUse')::numeric/100; growth := greatest(.1,1+(p->>'growthRate')::numeric/100); sx := x*growth; sy := y*growth; output := sx*allocation*use_factor; frontier_y := sy*(1-power(allocation,curvature))*use_factor; gap := case when output between 0 and sx then sy*(1-power(output/sx,curvature))-frontier_y else -frontier_y end; return jsonb_build_object('outputX',round(output,2),'outputY',round(frontier_y,2),'opportunityCost',round(sy*curvature/sx*power(allocation,curvature-1),2),'capacityGap',round(gap,2),'shiftedCapacityX',round(sx,2),'shiftedCapacityY',round(sy,2),'statusCode',case when output>sx or gap < -greatest(sy*.005,.05) then -1 when abs(gap)<=greatest(sy*.005,.05) then 1 else 0 end,'valid',1); end if;
  if p_model = 'ad-as' then pe := (p->>'potentialOutput')::numeric; a := (p->>'demandSensitivity')::numeric; b := (p->>'supplySensitivity')::numeric; demand_base := pe+(p->>'demandShock')::numeric; supply_base := pe+(p->>'supplyShock')::numeric; price_level := 100+(demand_base-supply_base)/(a+b); output := demand_base-a*(price_level-100); output_gap := (output-pe)/pe*100; return jsonb_build_object('output',round(output,2),'priceLevel',round(price_level,2),'outputGap',round(output_gap,2),'inflationPressure',round(price_level-100,2),'unemploymentGap',round(-.5*output_gap,2),'valid',1); end if;
  raise exception 'Unsupported model';
end;
$$;

create or replace function public.experiment_mechanism_chain(p_model text, p_parameters jsonb, p_results jsonb)
returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_array(
   jsonb_build_object('stage','Policy or parameter','text','The recorded parameter set changes the model assumptions.'),
   jsonb_build_object('stage','Curve or constraint','text','The relevant curve, constraint, or operating point responds.'),
   jsonb_build_object('stage','Incentive','text','Households, firms, or policymakers face a changed incentive.'),
   jsonb_build_object('stage','Behavior','text','Modeled choices adjust according to the deterministic equations.'),
   jsonb_build_object('stage','Equilibrium','text','The model solves a new internally consistent outcome.'),
   jsonb_build_object('stage','Welfare or trade-off','text','The results expose the model-specific trade-off for interpretation.')
 )
$$;

create or replace function public.join_experiment(p_experiment_id uuid)
returns public.experiment_participants language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); row_value public.experiment_participants;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if public.is_teacher(uid) then raise exception 'Teacher accounts cannot join as students'; end if;
  if not exists(select 1 from public.experiments where id=p_experiment_id and status='published') then raise exception 'Experiment is not open'; end if;
  insert into public.experiment_participants(experiment_id,student_id) values(p_experiment_id,uid) on conflict(experiment_id,student_id) do update set updated_at=timezone('utc',now()) returning * into row_value;
  return row_value;
end;
$$;

create or replace function public.submit_experiment_prediction(p_experiment_id uuid, p_answer jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.experiment_participants set prediction=p_answer,prediction_submitted_at=timezone('utc',now()),status=case when status='joined' then 'in_progress' else status end where experiment_id=p_experiment_id and student_id=auth.uid() and status<>'submitted';
  if not found then raise exception 'Active participation not found'; end if;
end;
$$;

create or replace function public.run_experiment_attempt(p_experiment_id uuid, p_parameters jsonb)
returns public.experiment_attempts language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); exp public.experiments; part public.experiment_participants; permission record; supplied numeric; sanitized jsonb := '{}'::jsonb; attempt_no integer; result_values jsonb; inserted public.experiment_attempts;
begin
  if uid is null or public.is_teacher(uid) then raise exception 'Student authentication required'; end if;
  if jsonb_typeof(p_parameters)<>'object' then raise exception 'Parameters must be an object'; end if;
  select * into exp from public.experiments where id=p_experiment_id and status='published'; if not found then raise exception 'Experiment is not open'; end if;
  select * into part from public.experiment_participants where experiment_id=p_experiment_id and student_id=uid for update; if not found or part.status='submitted' then raise exception 'Active participation not found'; end if;
  if exists(select 1 from jsonb_object_keys(p_parameters) k where not exists(select 1 from public.experiment_parameter_permissions x where x.experiment_id=p_experiment_id and x.parameter_key=k)) then raise exception 'Unknown parameter supplied'; end if;
  for permission in select * from public.experiment_parameter_permissions where experiment_id=p_experiment_id loop
    supplied := coalesce((p_parameters->>permission.parameter_key)::numeric,permission.initial_value);
    if (not permission.is_editable and supplied<>permission.initial_value) or supplied<permission.minimum or supplied>permission.maximum then raise exception 'Parameter % violates experiment permissions',permission.parameter_key; end if;
    sanitized := sanitized || jsonb_build_object(permission.parameter_key,supplied);
  end loop;
  select count(*)+1 into attempt_no from public.experiment_attempts where participant_id=part.id and attempt_epoch=part.attempt_epoch;
  if exp.attempt_limit is not null and attempt_no>exp.attempt_limit then raise exception 'Attempt limit reached'; end if;
  result_values := public.calculate_experiment_model(exp.model_key,sanitized);
  insert into public.experiment_attempts(experiment_id,participant_id,student_id,attempt_epoch,attempt_number,parameters,results,mechanism_chain) values(exp.id,part.id,uid,part.attempt_epoch,attempt_no,sanitized,result_values,public.experiment_mechanism_chain(exp.model_key,sanitized,result_values)) returning * into inserted;
  update public.experiment_participants set status='in_progress' where id=part.id;
  return inserted;
end;
$$;

create or replace function public.submit_experiment(p_experiment_id uuid, p_explanation jsonb)
returns public.submissions language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); exp public.experiments; part public.experiment_participants; att public.experiment_attempts; pred_rule public.experiment_success_conditions; cond record; prediction_score numeric:=100; success_score numeric:=100; passed integer:=0; cond_count integer:=0; attempts_score numeric; auto_value numeric; details jsonb; inserted public.submissions; answer_num numeric; metric_value numeric;
begin
  select * into exp from public.experiments where id=p_experiment_id and status='published'; if not found then raise exception 'Experiment is not open'; end if;
  select * into part from public.experiment_participants where experiment_id=p_experiment_id and student_id=uid for update; if not found or part.status='submitted' then raise exception 'Active participation not found'; end if;
  if part.prediction is null then raise exception 'Prediction required'; end if;
  if exp.explanation_required and length(trim(coalesce(p_explanation->>'response','')))=0 then raise exception 'Explanation required'; end if;
  select * into att from public.experiment_attempts where participant_id=part.id and attempt_epoch=part.attempt_epoch order by attempt_number desc limit 1; if not found then raise exception 'Run the experiment before submitting'; end if;
  select * into pred_rule from public.experiment_success_conditions where experiment_id=exp.id and condition_kind='prediction';
  if exp.prediction_type='choice' then prediction_score:=case when part.prediction#>>'{}'=pred_rule.expected_value->>'choice' then 100 else 0 end;
  elsif exp.prediction_type='numeric' then answer_num:=(part.prediction#>>'{}')::numeric; prediction_score:=case when answer_num between (pred_rule.expected_value->>'minimum')::numeric and (pred_rule.expected_value->>'maximum')::numeric then 100 else 0 end; end if;
  for cond in select * from public.experiment_success_conditions where experiment_id=exp.id and condition_kind='result' loop
    cond_count:=cond_count+1; metric_value:=(att.results->>cond.metric_key)::numeric;
    if (cond.operator='gte' and metric_value>=cond.target_minimum) or (cond.operator='lte' and metric_value<=cond.target_maximum) or (cond.operator='between' and metric_value between cond.target_minimum and cond.target_maximum) or (cond.operator='equals' and abs(metric_value-cond.target_minimum)<=cond.tolerance) then passed:=passed+1; end if;
  end loop;
  if cond_count>0 then success_score:=passed::numeric/cond_count*100; end if;
  attempts_score:=greatest(0,100-(att.attempt_number-1)*20);
  auto_value:=round((prediction_score*(exp.scoring_weights->>'prediction')::numeric+success_score*(exp.scoring_weights->>'success')::numeric+100*(exp.scoring_weights->>'compliance')::numeric+100*(exp.scoring_weights->>'accuracy')::numeric+attempts_score*(exp.scoring_weights->>'attempts')::numeric)/100,2);
  details:=jsonb_build_object('prediction',prediction_score,'success',round(success_score,2),'compliance',100,'accuracy',100,'attempts',attempts_score,'passedConditions',passed,'totalConditions',cond_count,'weightedTotal',auto_value);
  update public.experiment_attempts set score_details=details where id=att.id;
  insert into public.submissions(experiment_id,participant_id,attempt_id,student_id,attempt_epoch,prediction,final_parameters,calculated_results,mechanism_chain,explanation,score_details,auto_score,final_score,feedback_released) values(exp.id,part.id,att.id,uid,part.attempt_epoch,part.prediction,att.parameters,att.results,att.mechanism_chain,p_explanation,details,auto_value,auto_value,exp.immediate_feedback) returning * into inserted;
  update public.experiment_participants set status='submitted' where id=part.id;
  return inserted;
end;
$$;

create or replace function public.reset_experiment_participant(p_participant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.experiment_participants p set attempt_epoch=p.attempt_epoch+1,status='joined',prediction=null,prediction_submitted_at=null where p.id=p_participant_id and exists(select 1 from public.experiments e where e.id=p.experiment_id and e.teacher_id=auth.uid());
  if not found then raise exception 'Teacher ownership required'; end if;
end;
$$;

create or replace function public.apply_teacher_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select e.teacher_id into owner from public.submissions s join public.experiments e on e.id=s.experiment_id where s.id=new.submission_id;
  if new.teacher_id<>owner then raise exception 'Teacher ownership required'; end if;
  update public.submissions set final_score=coalesce(new.override_final_score,auto_score),feedback_released=(new.released_at is not null) where id=new.submission_id;
  return new;
end;
$$;
create trigger apply_teacher_feedback_trigger after insert or update on public.teacher_feedback for each row execute function public.apply_teacher_feedback();

create or replace function public.report_json(p_submission_id uuid, p_allow_unreleased boolean default false)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('submission_id',s.id,'title',e.title,'model_key',e.model_key,'code',e.code,'submitted_at',s.created_at,'prediction',s.prediction,'explanation',s.explanation,'parameters',s.final_parameters,'results',s.calculated_results,'auto_score',case when s.feedback_released or p_allow_unreleased then s.auto_score else null end,'final_score',case when s.feedback_released or p_allow_unreleased then s.final_score else null end,'feedback_released',s.feedback_released,'score_details',case when s.feedback_released or p_allow_unreleased then s.score_details else '{}'::jsonb end,'teacher_feedback',case when s.feedback_released or p_allow_unreleased then f.feedback else null end,'share_token',(select token from public.report_share_tokens where submission_id=s.id and revoked_at is null))
  from public.submissions s join public.experiments e on e.id=s.experiment_id left join public.teacher_feedback f on f.submission_id=s.id where s.id=p_submission_id
$$;

create or replace function public.get_private_experiment_report(p_submission_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare allowed boolean; teacher_view boolean;
begin
  select s.student_id=auth.uid() or e.teacher_id=auth.uid(),e.teacher_id=auth.uid() into allowed,teacher_view from public.submissions s join public.experiments e on e.id=s.experiment_id where s.id=p_submission_id;
  if not coalesce(allowed,false) then raise exception 'Report access denied'; end if;
  return public.report_json(p_submission_id,teacher_view);
end;
$$;

create or replace function public.get_shared_experiment_report(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
 select public.report_json(submission_id,false) from public.report_share_tokens where token=p_token and revoked_at is null
$$;

create or replace function public.create_report_share(p_submission_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare value text;
begin
  if not exists(select 1 from public.submissions where id=p_submission_id and student_id=auth.uid()) then raise exception 'Submission ownership required'; end if;
  insert into public.report_share_tokens(submission_id,owner_id) values(p_submission_id,auth.uid()) on conflict(submission_id) do update set token=encode(extensions.gen_random_bytes(24),'hex'),revoked_at=null,created_at=timezone('utc',now()) returning token into value;
  return value;
end;
$$;

create or replace function public.get_experiment_aggregate(p_experiment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare exp public.experiments; participant_count integer; submission_count integer; avg_score numeric; predictions jsonb; averages jsonb:='{}'::jsonb; metric text; metric_avg numeric;
begin
  select * into exp from public.experiments where id=p_experiment_id; if not found then return null; end if;
  if not coalesce(exp.teacher_id=auth.uid(),false) and not(exp.status='published' and exp.result_visibility='aggregate' and exp.aggregate_published) then raise exception 'Aggregate access denied'; end if;
  select count(*) into participant_count from public.experiment_participants where experiment_id=exp.id;
  select count(*),avg(final_score) into submission_count,avg_score from public.submissions where experiment_id=exp.id;
  select coalesce(jsonb_object_agg(answer,total),'{}'::jsonb) into predictions from (select coalesce(prediction#>>'{}','No answer') answer,count(*) total from public.submissions where experiment_id=exp.id group by 1) q;
  for metric in select distinct key from public.submissions s cross join lateral jsonb_object_keys(s.calculated_results) key where s.experiment_id=exp.id and key<>'valid' loop
    select avg((calculated_results->>metric)::numeric) into metric_avg from public.submissions where experiment_id=exp.id and calculated_results ? metric;
    averages:=averages||jsonb_build_object(metric,round(metric_avg,2));
  end loop;
  return jsonb_build_object('participant_count',participant_count,'submission_count',submission_count,'completion_rate',case when participant_count=0 then 0 else round(submission_count::numeric/participant_count*100,2) end,'average_score',coalesce(round(avg_score,2),0),'prediction_distribution',predictions,'average_result_metrics',averages);
end;
$$;

-- Sanitized read/write gateways prevent published scoring weights and hidden
-- condition targets from being exposed through PostgREST table selection.
create or replace function public.list_public_experiments()
returns table(id uuid,teacher_id uuid,code text,title text,model_key text,context text,objective text,status text,prediction_question text,prediction_type text,prediction_options jsonb,attempt_limit integer,explanation_required boolean,immediate_feedback boolean,result_visibility text,aggregate_published boolean,created_at timestamptz,updated_at timestamptz,published_at timestamptz,closed_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select e.id,e.teacher_id,e.code,e.title,e.model_key,e.context,e.objective,e.status,e.prediction_question,e.prediction_type,e.prediction_options,e.attempt_limit,e.explanation_required,e.immediate_feedback,e.result_visibility,e.aggregate_published,e.created_at,e.updated_at,e.published_at,e.closed_at from public.experiments e where e.status='published' order by e.published_at desc limit 50
$$;

create or replace function public.get_public_experiment(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',e.id,'teacher_id',e.teacher_id,'code',e.code,'title',e.title,'model_key',e.model_key,'context',e.context,'objective',e.objective,'status',e.status,'prediction_question',e.prediction_question,'prediction_type',e.prediction_type,'prediction_options',e.prediction_options,'attempt_limit',e.attempt_limit,'explanation_required',e.explanation_required,'immediate_feedback',e.immediate_feedback,'result_visibility',e.result_visibility,'aggregate_published',e.aggregate_published,'created_at',e.created_at,'updated_at',e.updated_at,'published_at',e.published_at,'closed_at',e.closed_at,'experiment_parameter_permissions',coalesce((select jsonb_agg(to_jsonb(pp)) from public.experiment_parameter_permissions pp where pp.experiment_id=e.id),'[]'::jsonb)) from public.experiments e where e.code=upper(trim(p_code)) and e.status='published'
$$;

create or replace function public.list_teacher_experiments()
returns setof public.experiments language sql stable security definer set search_path = '' as $$
 select * from public.experiments where teacher_id=auth.uid() and public.is_teacher(auth.uid()) order by updated_at desc
$$;

create or replace function public.get_teacher_experiment(p_experiment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id',e.id,'teacher_id',e.teacher_id,'code',e.code,'title',e.title,'model_key',e.model_key,'context',e.context,'objective',e.objective,'status',e.status,'prediction_question',e.prediction_question,'prediction_type',e.prediction_type,'prediction_options',e.prediction_options,'attempt_limit',e.attempt_limit,'explanation_required',e.explanation_required,'immediate_feedback',e.immediate_feedback,'result_visibility',e.result_visibility,'aggregate_published',e.aggregate_published,'scoring_weights',e.scoring_weights,'created_at',e.created_at,'updated_at',e.updated_at,'published_at',e.published_at,'closed_at',e.closed_at,'experiment_parameter_permissions',coalesce((select jsonb_agg(to_jsonb(pp)) from public.experiment_parameter_permissions pp where pp.experiment_id=e.id),'[]'::jsonb),'experiment_success_conditions',coalesce((select jsonb_agg(to_jsonb(sc)) from public.experiment_success_conditions sc where sc.experiment_id=e.id),'[]'::jsonb)) from public.experiments e where e.id=p_experiment_id and e.teacher_id=auth.uid() and public.is_teacher(auth.uid())
$$;

create or replace function public.save_teacher_experiment(p_experiment_id uuid, p_payload jsonb, p_permissions jsonb, p_conditions jsonb)
returns public.experiments language plpgsql security definer set search_path = '' as $$
declare exp public.experiments; permission jsonb; condition jsonb;
begin
  if not public.is_teacher(auth.uid()) then raise exception 'Teacher role required'; end if;
  if jsonb_typeof(p_permissions)<>'array' or jsonb_typeof(p_conditions)<>'array' then raise exception 'Invalid configuration arrays'; end if;
  if p_experiment_id is null then
    insert into public.experiments(teacher_id,title,model_key,context,objective,status,prediction_question,prediction_type,prediction_options,attempt_limit,explanation_required,immediate_feedback,result_visibility,scoring_weights,published_at)
    values(auth.uid(),p_payload->>'title',p_payload->>'model_key',p_payload->>'context',p_payload->>'objective',p_payload->>'status',p_payload->>'prediction_question',p_payload->>'prediction_type',coalesce(p_payload->'prediction_options','[]'::jsonb),nullif(p_payload->>'attempt_limit','')::integer,coalesce((p_payload->>'explanation_required')::boolean,true),coalesce((p_payload->>'immediate_feedback')::boolean,true),p_payload->>'result_visibility',p_payload->'scoring_weights',case when p_payload->>'status'='published' then timezone('utc',now()) else null end) returning * into exp;
  else
    update public.experiments set title=p_payload->>'title',model_key=p_payload->>'model_key',context=p_payload->>'context',objective=p_payload->>'objective',status=p_payload->>'status',prediction_question=p_payload->>'prediction_question',prediction_type=p_payload->>'prediction_type',prediction_options=coalesce(p_payload->'prediction_options','[]'::jsonb),attempt_limit=nullif(p_payload->>'attempt_limit','')::integer,explanation_required=(p_payload->>'explanation_required')::boolean,immediate_feedback=(p_payload->>'immediate_feedback')::boolean,result_visibility=p_payload->>'result_visibility',scoring_weights=p_payload->'scoring_weights' where id=p_experiment_id and teacher_id=auth.uid() returning * into exp;
    if not found then raise exception 'Experiment ownership required'; end if;
    delete from public.experiment_parameter_permissions where experiment_id=exp.id;
    delete from public.experiment_success_conditions where experiment_id=exp.id;
  end if;
  for permission in select value from jsonb_array_elements(p_permissions) loop
    insert into public.experiment_parameter_permissions(experiment_id,parameter_key,is_editable,minimum,maximum,initial_value) values(exp.id,permission->>'parameter_key',(permission->>'is_editable')::boolean,(permission->>'minimum')::numeric,(permission->>'maximum')::numeric,(permission->>'initial_value')::numeric);
  end loop;
  for condition in select value from jsonb_array_elements(p_conditions) loop
    insert into public.experiment_success_conditions(experiment_id,condition_kind,metric_key,operator,target_minimum,target_maximum,tolerance,expected_value) values(exp.id,condition->>'condition_kind',nullif(condition->>'metric_key',''),condition->>'operator',coalesce((condition->>'target_minimum')::numeric,0),coalesce((condition->>'target_maximum')::numeric,0),coalesce((condition->>'tolerance')::numeric,0),coalesce(condition->'expected_value','{}'::jsonb));
  end loop;
  return exp;
end;
$$;

create or replace function public.set_experiment_status(p_experiment_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('draft','published','closed','archived') then raise exception 'Invalid status'; end if;
  update public.experiments set status=p_status,published_at=case when p_status='published' then coalesce(published_at,timezone('utc',now())) else published_at end,closed_at=case when p_status='closed' then timezone('utc',now()) else closed_at end where id=p_experiment_id and teacher_id=auth.uid() and public.is_teacher(auth.uid());
  if not found then raise exception 'Experiment ownership required'; end if;
end;
$$;

create or replace function public.set_experiment_aggregate_published(p_experiment_id uuid,p_published boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.experiments set aggregate_published=p_published where id=p_experiment_id and teacher_id=auth.uid() and result_visibility='aggregate' and public.is_teacher(auth.uid());
  if not found then raise exception 'Experiment ownership or aggregate visibility required'; end if;
end;
$$;

create or replace function public.list_student_submissions()
returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',s.id,'experiment_id',s.experiment_id,'participant_id',s.participant_id,'attempt_id',s.attempt_id,'student_id',s.student_id,'attempt_epoch',s.attempt_epoch,'prediction',s.prediction,
   'final_parameters',s.final_parameters,'calculated_results',s.calculated_results,'mechanism_chain',s.mechanism_chain,'explanation',s.explanation,
   'score_details',case when s.feedback_released then s.score_details else '{}'::jsonb end,'auto_score',case when s.feedback_released then s.auto_score else 0 end,'final_score',case when s.feedback_released then s.final_score else 0 end,
   'feedback_released',s.feedback_released,'completion_status',s.completion_status,'created_at',s.created_at,
   'experiment',jsonb_build_object('id',e.id,'teacher_id',e.teacher_id,'code',e.code,'title',e.title,'model_key',e.model_key,'context',e.context,'objective',e.objective,'status',e.status,'prediction_question',e.prediction_question,'prediction_type',e.prediction_type,'prediction_options',e.prediction_options,'attempt_limit',e.attempt_limit,'explanation_required',e.explanation_required,'immediate_feedback',e.immediate_feedback,'result_visibility',e.result_visibility,'aggregate_published',e.aggregate_published,'created_at',e.created_at,'updated_at',e.updated_at,'published_at',e.published_at,'closed_at',e.closed_at),
   'feedback',case when f.id is null or not s.feedback_released then '[]'::jsonb else jsonb_build_array(to_jsonb(f)) end
 ) order by s.created_at desc),'[]'::jsonb)
 from public.submissions s join public.experiments e on e.id=s.experiment_id left join public.teacher_feedback f on f.submission_id=s.id where s.student_id=auth.uid()
$$;

create or replace function public.list_teacher_experiment_submissions(p_experiment_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select case when exists(select 1 from public.experiments where id=p_experiment_id and teacher_id=auth.uid() and public.is_teacher(auth.uid())) then
   coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('feedback',case when f.id is null then '[]'::jsonb else jsonb_build_array(to_jsonb(f)) end) order by s.created_at desc) from public.submissions s left join public.teacher_feedback f on f.submission_id=s.id where s.experiment_id=p_experiment_id),'[]'::jsonb)
 else null end
$$;

alter table public.experiments enable row level security;
alter table public.experiment_parameter_permissions enable row level security;
alter table public.experiment_success_conditions enable row level security;
alter table public.experiment_participants enable row level security;
alter table public.experiment_attempts enable row level security;
alter table public.submissions enable row level security;
alter table public.teacher_feedback enable row level security;
alter table public.report_share_tokens enable row level security;

create policy experiments_public_or_owner_select on public.experiments for select to anon,authenticated using(status='published' or teacher_id=auth.uid() or public.is_experiment_participant(id,auth.uid()));
create policy experiments_teacher_insert on public.experiments for insert to authenticated with check(teacher_id=auth.uid() and public.is_teacher(auth.uid()));
create policy experiments_teacher_update on public.experiments for update to authenticated using(teacher_id=auth.uid() and public.is_teacher(auth.uid())) with check(teacher_id=auth.uid() and public.is_teacher(auth.uid()));
create policy experiments_teacher_delete on public.experiments for delete to authenticated using(teacher_id=auth.uid() and public.is_teacher(auth.uid()));

create policy permissions_public_or_teacher_select on public.experiment_parameter_permissions for select to anon,authenticated using(exists(select 1 from public.experiments e where e.id=experiment_id and (e.status='published' or e.teacher_id=auth.uid())));
create policy permissions_teacher_write on public.experiment_parameter_permissions for all to authenticated using(exists(select 1 from public.experiments e where e.id=experiment_id and e.teacher_id=auth.uid())) with check(exists(select 1 from public.experiments e where e.id=experiment_id and e.teacher_id=auth.uid()));
create policy conditions_teacher_only on public.experiment_success_conditions for all to authenticated using(exists(select 1 from public.experiments e where e.id=experiment_id and e.teacher_id=auth.uid())) with check(exists(select 1 from public.experiments e where e.id=experiment_id and e.teacher_id=auth.uid()));

create policy participants_student_or_teacher_select on public.experiment_participants for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.experiments e where e.id=experiment_id and e.teacher_id=auth.uid()));
create policy attempts_student_or_teacher_select on public.experiment_attempts for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.experiments e where e.id=experiment_id and e.teacher_id=auth.uid()));
create policy submissions_student_or_teacher_select on public.submissions for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.experiments e where e.id=experiment_id and e.teacher_id=auth.uid()));
create policy feedback_teacher_all on public.teacher_feedback for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy feedback_student_released_select on public.teacher_feedback for select to authenticated using(released_at is not null and exists(select 1 from public.submissions s where s.id=submission_id and s.student_id=auth.uid()));
create policy share_tokens_owner_select on public.report_share_tokens for select to authenticated using(owner_id=auth.uid());
create policy share_tokens_owner_update on public.report_share_tokens for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());

-- Let a teacher see display names only for students in that teacher's experiments.
create policy profiles_teacher_participant_select on public.profiles for select to authenticated using(public.is_teacher(auth.uid()) and exists(select 1 from public.experiment_participants p join public.experiments e on e.id=p.experiment_id where p.student_id=profiles.user_id and e.teacher_id=auth.uid()));

revoke all on function public.generate_experiment_code() from public,anon,authenticated;
revoke all on function public.model_parameter_bounds(text,text) from public,anon,authenticated;
revoke all on function public.calculate_experiment_model(text,jsonb) from public,anon,authenticated;
revoke all on function public.experiment_mechanism_chain(text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.validate_experiment_configuration() from public,anon,authenticated;
revoke all on function public.validate_parameter_permission() from public,anon,authenticated;
revoke all on function public.apply_teacher_feedback() from public,anon,authenticated;
revoke all on function public.report_json(uuid,boolean) from public,anon,authenticated;
revoke all on function public.join_experiment(uuid) from public,anon,authenticated;
revoke all on function public.submit_experiment_prediction(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.run_experiment_attempt(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.submit_experiment(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.reset_experiment_participant(uuid) from public,anon,authenticated;
revoke all on function public.get_private_experiment_report(uuid) from public,anon,authenticated;
revoke all on function public.get_shared_experiment_report(text) from public,anon,authenticated;
revoke all on function public.create_report_share(uuid) from public,anon,authenticated;
revoke all on function public.get_experiment_aggregate(uuid) from public,anon,authenticated;
revoke all on function public.list_public_experiments() from public,anon,authenticated;
revoke all on function public.get_public_experiment(text) from public,anon,authenticated;
revoke all on function public.list_teacher_experiments() from public,anon,authenticated;
revoke all on function public.get_teacher_experiment(uuid) from public,anon,authenticated;
revoke all on function public.save_teacher_experiment(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.set_experiment_status(uuid,text) from public,anon,authenticated;
revoke all on function public.set_experiment_aggregate_published(uuid,boolean) from public,anon,authenticated;
revoke all on function public.list_student_submissions() from public,anon,authenticated;
revoke all on function public.list_teacher_experiment_submissions(uuid) from public,anon,authenticated;

revoke all on public.experiments,public.experiment_parameter_permissions,public.experiment_success_conditions from anon,authenticated;
grant select (id,teacher_id,code,title,model_key,context,objective,status,prediction_question,prediction_type,prediction_options,attempt_limit,explanation_required,immediate_feedback,result_visibility,aggregate_published,created_at,updated_at,published_at,closed_at) on public.experiments to authenticated;
grant select,insert,update,delete on public.teacher_feedback to authenticated;
grant select on public.experiment_participants to authenticated;
grant select,update on public.report_share_tokens to authenticated;

grant execute on function public.join_experiment(uuid) to authenticated;
grant execute on function public.submit_experiment_prediction(uuid,jsonb) to authenticated;
grant execute on function public.run_experiment_attempt(uuid,jsonb) to authenticated;
grant execute on function public.submit_experiment(uuid,jsonb) to authenticated;
grant execute on function public.reset_experiment_participant(uuid) to authenticated;
grant execute on function public.get_private_experiment_report(uuid) to authenticated;
grant execute on function public.get_shared_experiment_report(text) to anon,authenticated;
grant execute on function public.create_report_share(uuid) to authenticated;
grant execute on function public.get_experiment_aggregate(uuid) to anon,authenticated;
grant execute on function public.list_public_experiments() to anon,authenticated;
grant execute on function public.get_public_experiment(text) to anon,authenticated;
grant execute on function public.list_teacher_experiments() to authenticated;
grant execute on function public.get_teacher_experiment(uuid) to authenticated;
grant execute on function public.save_teacher_experiment(uuid,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.set_experiment_status(uuid,text) to authenticated;
grant execute on function public.set_experiment_aggregate_published(uuid,boolean) to authenticated;
grant execute on function public.list_student_submissions() to authenticated;
grant execute on function public.list_teacher_experiment_submissions(uuid) to authenticated;
