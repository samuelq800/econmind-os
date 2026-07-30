# Continuous World Economy: launch runbook

The persistent world is designed to stay within the free Supabase/GitHub Pages setup. The browser only uses the public project URL and publishable key. The protected service-role credential is used only by the Supabase Edge Function and an optional local launch command; it must never appear in `.env.local` used by Next.js, GitHub Pages variables, source files or the client bundle.

## What is already protected

- `20260730000000_continuous_world_foundation.sql` adds versioned calibration packages, persistent world state, multi-role assignments, policy actions, snapshots, audit records, indexes, update triggers and RLS.
- `20260730010000_continuous_world_long_running.sql` changes the experience from rounds to natural time: approved League Teams may claim one country, one person may hold several of the seven portfolios, policy actions can be amended or cancelled, contracts settle continuously, shocks are time-bounded, and country states can deteriorate and recover. It also adds RLS-protected Model Composer drafts and teacher/admin publication.
- New platform role assignments are additive. Existing `profiles.role` and `profiles.platform_role` remain compatible with current experiments and League pages.
- `process-continuous-world` is a protected Edge Function. It only accepts a league administrator session or `CONTINUOUS_WORLD_CRON_SECRET`, claims an atomic database lock, applies a deterministic tick, saves a replayable snapshot, and faults a world after five failed worker attempts.
- `NEXT_PUBLIC_ENABLE_CONTINUOUS_WORLD` only controls navigation visibility. It is not permission control; RLS and server procedures are the security boundary.

## One-time GitHub configuration

In the repository’s **Settings → Secrets and variables → Actions**, set:

| Type | Name | Purpose |
| --- | --- | --- |
| Secret | `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL used at build time. |
| Secret | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public publishable/anon key used at build time. |
| Secret | `SUPABASE_ACCESS_TOKEN` | Only for the manual Supabase deployment workflow. |
| Secret | `SUPABASE_DB_PASSWORD` | Only for the manual Supabase deployment workflow. |
| Variable | `SUPABASE_PROJECT_REF` | The Supabase project reference, not a secret. |
| Variable | `NEXT_PUBLIC_ENABLE_CONTINUOUS_WORLD` | Set to `true` only after the world has launched successfully. |

Run **Deploy Supabase backend** manually with both options enabled. It applies migrations and deploys the three Edge Functions without putting protected credentials in the Pages build.

## Calibration and world launch

The checked-in package is deliberately rejected by strict launch validation until every file declared in `package_metadata.json` exists, including `calibration_test_suite.json`. Do not bypass this gate.

The baseline calibration package remains useful for the original twelve-country engine. The final teaching package adds the long-running world specification, contracts, Economic Bench, Mechanism Arena, Evidence Lab and extended model tests. Render and apply it only from a server-controlled terminal session:

```bash
pnpm calibration:check
pnpm world:launch -- --confirm-launch --start
pnpm world:render-teaching-seed-sql > /private/tmp/econmind-final-world-teaching-seed.sql
supabase db query --linked --file /private/tmp/econmind-final-world-teaching-seed.sql
```

The command verifies the complete data package, stores immutable versioned calibration rows, activates those rows, creates exactly one initial 12-country world state, and starts it with an hourly tick. It refuses to overwrite an existing world.

## Server-only scheduled tick

Set the protected Edge Function secret once:

```bash
supabase secrets set CONTINUOUS_WORLD_CRON_SECRET='use-a-long-random-value' --project-ref YOUR_PROJECT_REF
```

Then, in Supabase SQL Editor, create a Vault secret and an hourly cron job. Replace the values before running the commands:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('use-the-same-long-random-value', 'continuous_world_cron_secret');

select cron.unschedule(jobid)
from cron.job
where jobname = 'econmind-continuous-world-hourly';

select cron.schedule(
  'econmind-continuous-world-hourly',
  '0 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/process-continuous-world',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'continuous_world_cron_secret' limit 1)
      ),
      body := '{"limit":4}'::jsonb
    );
  $$
);
```

This uses Supabase `pg_cron`, `pg_net` and Vault—no paid server or external automation. Retain the hourly default until usage is observed; the worker claims at most four worlds per run. Policy lags, contract deadlines, shocks and recovery therefore expand gradually against real clock time; there are no Q1/Q2 locks, fixed rounds, or mandatory deadlines.

## Final release check

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm calibration:check`.
2. Run the manual GitHub Supabase workflow, then the local launch command once.
3. Confirm the first worker event and snapshot in Supabase, and ensure an ordinary account cannot read another country’s private actions or audit rows.
4. Set `NEXT_PUBLIC_ENABLE_CONTINUOUS_WORLD=true` in GitHub Actions variables, push/merge the approved branch, and let the Pages workflow deploy.

If a data package changes later, add a new version. Never overwrite a launched world’s calibration manifest or historical snapshots.
