# Shared group registration implementation report

Date: 2026-10-11 (Asia/Shanghai). Repository: `D:\projects\econmind-os`.
Status: **IMPLEMENTED_UNVERIFIED** for release. Repository implementation and
the local checks below are complete; core independent review and real Auth
integration have passed, while final candidate review and release remain pending. This is not a production
activation or a self-awarded P0 verification.

## Approved scope and behavior

The owner selected repository-only implementation and clarified that the group
code is shared and reusable by multiple people. The chosen code is entered into
the private administrator policy after an authorized release; it is not
hard-coded in public source or the website bundle.

The registration/email-code dialog now links to group registration. One active
shared code permits new registrations without email OTP delivery. Pending
email-only accounts must prove their original password before native Admin
confirmation. Native sign-in and current legal consent follow acceptance.
Existing confirmed/OAuth/suspended/banned accounts cannot use this activation
route. Passwords and permissions of existing accounts are not overwritten.

An administrator panel on the existing viewing-invitations page can set, stop,
rotate or expire the shared campaign. The existing view-only codes remain
separate. Global email confirmation, Google sign-in, ordinary email OTP,
password recovery and ordinary onboarding remain enabled.

## Owners, permissions and migration

- Affected owners: authentication, platform administration, website and release.
- Browser credentials: existing public Supabase configuration only.
- Server credentials: existing Edge service-role and public Auth keys; no new
  privileged key, public secret or email-provider configuration is added.
- Migration: `20261011120000_group_registration.sql`, additive private policy
  and rate tables; RLS enabled; only the administrator settings RPCs and
  service-only authorization RPC can access them.
- The policy starts disabled. Native Auth mutation uses supported Admin APIs;
  this migration does not update Auth user rows, passwords or economic state.
- Legacy impact: existing viewer invitations and account access retain their
  behavior. The administrator route now also has an explicit administrator page
  policy, while backend RPC authorization remains decisive.
- No production migration, arbitrary SQL, reset, seed, email, Auth settings
  change, deployment, push or commit was performed.

## Final local evidence

Environment: Windows; isolated Node.js 22.20.0 under `D:\dev\node\isolated`,
pnpm 11.9.0, Supabase JS 2.110.7, Deno 2.5.6. Frozen lockfile unchanged.
Disposable PostgreSQL 18.4 on `127.0.0.1:54843`, with task data/cache under
`D:\dev\automation\econmind-group-registration-check`. No production database
connection was used. CI now defines the same SQL test on PostgreSQL 17; that
remote CI job has not been executed in this task.

| Command / check                                                                | Final exit | Result                                                                                                                |
| ------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                               | 0          | Already up to date; lockfile unchanged                                                                                |
| `pnpm typecheck`                                                               | 0          | Passed                                                                                                                |
| `pnpm lint`                                                                    | 0          | No errors; 8 existing warnings in unrelated files                                                                     |
| `pnpm exec vitest run --maxWorkers=2 --reporter=dot`                           | 0          | 120 test files; 1006 passed, 1 existing skipped test                                                                  |
| Targeted auth/group/Google/viewer/page suite                                   | 0          | 55 passed                                                                                                             |
| `deno check --no-config supabase/functions/register-with-group-code/index.ts`  | 0          | Actual Edge entry point and runtime imports passed                                                                    |
| `psql ... -d group_registration_final2 -f scripts/test-group-registration.sql` | 0          | Actual policy, reuse, rotation, closure, expiry, limits, administrator/service permissions and migration retry passed |
| `pnpm exec prettier --check ".github/workflows/*.yml"`                         | 0          | All workflows passed                                                                                                  |
| Prettier check of new TS/TSX, edited auth dialog, feature docs and CI file     | 0          | Passed                                                                                                                |
| `git diff --check`                                                             | 0          | Passed                                                                                                                |
| `pnpm build`                                                                   | 0          | Passed                                                                                                                |
| `GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH="" pnpm build`                        | 0          | Static website build passed; 474 pages generated                                                                      |

The browser source/export literal scan also passed (exit 0): no chosen shared-code
literal or secret-key patterns were found in browser source or `out/_next/static`.

Initial checks caught a formatting assertion, an impure render-time clock read
and a PostgreSQL conditional syntax error. These were fixed and the affected
checks rerun successfully. Existing regression tests were not weakened or
deleted.

## Remaining acceptance and decisions

After deployment authorization, native Auth v2.197.0 was built in an isolated
directory from official source. Windows compatibility required removing only the
Linux SO_REUSEPORT socket option; authentication source was unchanged. Its 75 native
migrations ran in the disposable `group_native_auth_test` database, and the native
password-proof/activation/login/session-cleanup script passed (exit 0). CI repeats
this against the unmodified pinned source on Linux. This does not prove hosted
inbox delivery; no production test account was created. Independent core review
found no P0/P1 defect; final immutable candidate review is still required.

The request-header-dependent peer bucket was replaced with a global protection
bucket (30 attempts per ten minutes) plus the existing per-email bucket (6).
Different forwarding headers cannot bypass it. This temporary group fallback
shares capacity across members and can be exhausted by wrong-code requests.
The dedicated bounded publisher/workflow require matching CI and website release,
exact migration fingerprint, ledger/permissions checks and unchanged Auth settings.

The exception deliberately skips email ownership verification. Server-owned
metadata records this distinction; possession of the group code cannot prove
membership independently of the group's distribution process. A code holder
could register another person's unused email address. The chosen expiry and the
date to close the campaign remain administrator decisions. The policy remains
closed until explicitly configured through the controlled release described in
[`group-registration.md`](group-registration.md).
