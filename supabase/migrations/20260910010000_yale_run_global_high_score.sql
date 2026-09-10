-- Public, monotonic high score for the Yale Run arcade. The game remains
-- playable without an account, but only an authenticated player may submit a
-- platform record. Clients never receive direct table-write privileges.

create table if not exists public.yale_run_global_scores (
  game_key text primary key check (game_key = 'yale-run'),
  best_score integer not null default 0 check (best_score between 0 and 99999),
  player_id uuid references auth.users(id) on delete set null,
  achieved_at timestamptz not null default timezone('utc', now())
);

alter table public.yale_run_global_scores enable row level security;

create or replace function public.get_yale_run_global_high_score()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select score.best_score
    from public.yale_run_global_scores score
    where score.game_key = 'yale-run'
  ), 0)
$$;

create or replace function public.submit_yale_run_score(p_score integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  global_high_score integer;
begin
  if auth.uid() is null then
    raise exception 'An authenticated account is required to submit a Global High';
  end if;

  if p_score is null or p_score < 0 or p_score > 99999 then
    raise exception 'Yale Run score is out of range';
  end if;

  insert into public.yale_run_global_scores (
    game_key,
    best_score,
    player_id,
    achieved_at
  )
  values (
    'yale-run',
    p_score,
    auth.uid(),
    timezone('utc', now())
  )
  on conflict (game_key) do update
  set
    best_score = excluded.best_score,
    player_id = excluded.player_id,
    achieved_at = excluded.achieved_at
  where excluded.best_score > public.yale_run_global_scores.best_score;

  select score.best_score
  into global_high_score
  from public.yale_run_global_scores score
  where score.game_key = 'yale-run';

  return global_high_score;
end;
$$;

revoke all on table public.yale_run_global_scores from anon, authenticated;
revoke all on function public.get_yale_run_global_high_score() from public;
revoke all on function public.submit_yale_run_score(integer) from public;
grant execute on function public.get_yale_run_global_high_score() to anon, authenticated;
grant execute on function public.submit_yale_run_score(integer) to authenticated;
