# Continuous World Economy: launch runbook

The persistent world is designed to stay within the free Supabase/GitHub Pages setup. The browser only uses the public project URL and publishable key. The protected service-role credential is used only by the Supabase Edge Function and an optional local launch command; it must never appear in `.env.local` used by Next.js, GitHub Pages variables, source files or the client bundle.

## What is already protected

- `20260730000000_continuous_world_foundation.sql` adds versioned calibration packages, persistent world state, multi-role assignments, policy actions, audit records, indexes, update triggers and RLS.
- `20260730010000_continuous_world_long_running.sql` changes the experience from rounds to natural time: approved League Teams may claim one country, policy actions can be amended or cancelled, contracts settle continuously, shocks are time-bounded, and country states can deteriorate and recover. It also adds RLS-protected Model Composer drafts and teacher/admin publication.
- `20260804000000_world_governance_continuous_upgrade.sql` restarts only the simulation data, preserving accounts, schools and teams. It moves the world to the agreed six-office cabinet, enforces role-specific policy authority, adds cross-office approvals, budget/cabinet/project/contract records and compact 30-day reports, removes learner rollback snapshots, and schedules a two-hour tick.
- New platform role assignments are additive. Existing `profiles.role` and `profiles.platform_role` remain compatible with current experiments and League pages.
- `process-continuous-world` is a protected Edge Function. It only accepts a league administrator session or `CONTINUOUS_WORLD_CRON_SECRET`, claims an atomic database lock, applies a deterministic tick, saves a compact report every 30 simulation days, and faults a world after five failed worker attempts.
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

The baseline calibration package remains useful for the original twelve-country engine. The final teaching package adds the long-running world specification, contracts, Economic Bench, Mechanism Arena, Evidence Lab and extended model tests. The world-governance migration intentionally deletes only old `continuous_worlds` records and their dependent state; it does not touch accounts, schools or teams. Apply migrations first, then create the new world only from a server-controlled terminal session:

```bash
pnpm calibration:check
pnpm world:render-teaching-seed-sql > /private/tmp/econmind-final-world-teaching-seed.sql
supabase db query --linked --file /private/tmp/econmind-final-world-teaching-seed.sql
pnpm world:launch -- --confirm-launch --start --tick-seconds=7200
```

The command verifies the complete data package, stores immutable versioned calibration rows, activates those rows, creates exactly one initial 12-country world state, and starts it with a two-hour tick. It refuses to overwrite an existing world.

## Server-only scheduled tick

Set the protected Edge Function secret once:

```bash
supabase secrets set CONTINUOUS_WORLD_CRON_SECRET='use-a-long-random-value' --project-ref YOUR_PROJECT_REF
```

Then, in Supabase SQL Editor, create the Vault secret before applying the world-governance migration. The migration creates the two-hour cron job automatically. Replace the values before running the commands:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('use-the-same-long-random-value', 'continuous_world_cron_secret');

```

This uses Supabase `pg_cron`, `pg_net` and Vault—no paid server or external automation. The worker claims at most four worlds per run. One simulation day equals two real hours, so policy lags, contract deadlines, shocks and recovery expand gradually against the shared clock; there are no Q1/Q2 locks, fixed rounds, or mandatory deadlines.

## Final release check

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm calibration:check`.
2. Run the manual GitHub Supabase workflow, then the local launch command once.
3. Confirm the first worker event and compact 30-day report in Supabase, and ensure an ordinary account cannot read another country’s private actions, approvals, budget records or audit rows.
4. Set `NEXT_PUBLIC_ENABLE_CONTINUOUS_WORLD=true` in GitHub Actions variables, push/merge the approved branch, and let the Pages workflow deploy.

If a data package changes later, add a new version. Never overwrite a launched world’s calibration manifest or the compact policy/contract/crisis/report timeline.
