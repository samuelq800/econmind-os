# GitHub Actions guide

The repository keeps verification, website deployment, and privileged Supabase
operations separate. A workflow name indicates whether it is safe validation,
a deployment, or narrowly scoped maintenance.

| Workflow                                  | Trigger                            | Production effect                                                                                        |
| ----------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `CI · Verify source`                      | Pull requests to `main`, or manual | None. Runs formatting, type, lint, test, and build checks.                                               |
| `Deploy · Website (GitHub Pages)`         | Pushes to `main`, or manual        | Atomically replaces the Pages artifact after source and Supabase schema checks pass.                     |
| `Deploy · Supabase backend`               | Manual only                        | Dry-runs migrations by default; optional inputs apply migrations, Auth configuration, or Edge Functions. |
| `Maintenance · Account suspension schema` | Manual only                        | Reapplies and verifies the checked-in account-suspension migration.                                      |
| `Maintenance · Daily Brief source policy` | Manual only                        | Reapplies the checked-in Daily Brief source-policy migration.                                            |
| `Maintenance · Live World schema`         | Manual only                        | Reapplies the checked-in Live World migration.                                                           |

## Safety rules

- All workflows capable of changing Supabase share the `supabase-production`
  concurrency group, preventing production changes from running at the same
  time.
- Maintenance workflows read SQL from `supabase/migrations`; do not duplicate
  migration SQL inside workflow files.
- The general Supabase workflow performs a dry run when no deployment checkbox
  is selected. Migration operations require the database password and a linked
  project; Auth and Edge Function deployments do not.
- The website workflow checks required public Supabase objects before building.
  A failed check leaves the currently deployed Pages artifact untouched.
- Keep production workflows manual. New application work should be verified in
  a pull request by `CI · Verify source` before merging to `main`.

## Required repository configuration

Repository secrets:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

Repository variables:

- `NEXT_PUBLIC_ENABLE_CONTINUOUS_WORLD`
- `SUPABASE_PROJECT_REF`

Never place secret values in workflow inputs, logs, repository variables, or
tracked files.

## Migration-history note

As of 2026-09-02, the linked production project reports remote migration
versions `20260827010000` through `20260827070000` that are absent from this
repository. Do not mark those versions reverted or fabricate placeholder
migrations. Recover and verify their provenance before using the general
migration-apply option. The narrow maintenance workflows remain available for
already-reviewed, checked-in migrations while that history is reconciled.
