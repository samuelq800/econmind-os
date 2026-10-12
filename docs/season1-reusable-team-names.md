# Season 1 dissolved team name repair

## Status and scope

Status: IMPLEMENTED_UNVERIFIED until independent review of the immutable
candidate and the required checks pass. Effective risk: P0, because this changes
a production database uniqueness constraint. The project owner authorized the
repair, preservation of existing data, independent review and a controlled
release on 2026-10-12. This is not owner approval of the P0 implementation.

The original UNIQUE(season_id, name) reserves names even after dissolution.
Migration `20261012040000_season1_reusable_team_names.sql` replaces it with a
unique index on the same columns for `status <> 'dissolved'`. Every other status
continues to reserve its name. Names in different seasons remain independent.

## Owners, permissions and stored data

Only the legacy Season 1 team discovery/collaboration schema is affected. World
V2 execution, economic state, command/event/receipt authority and settlement are
unchanged. Existing authorized team creation/dissolution RPCs remain the only
participant mutation paths. No RPC, RLS policy, grant, account, credential,
frontend contract or migration from another work package changes.

The migration has no row inserts, updates or deletes. Team UUIDs, names, codes,
captains, schools, timestamps, memberships, channels, chat messages, applications
and invitations are retained. A recreated team receives a new UUID/code and does
not inherit access to the dissolved team's private chat.

## Transaction and release safety

The table lock, replacement index, index-shape validation and old-constraint
removal occur in one transaction. The new index is installed before the old key
is removed. PostgreSQL validates the existing data against the replacement.
Lock wait is limited to five seconds and statements to thirty seconds. Unexpected
index/constraint shapes, dependencies or uniqueness failures roll back; no
CASCADE is used. Replay validates the existing index instead of rewriting data.

The dedicated publisher pins the project and migration version. It records the
exact migration text in `supabase_migrations.schema_migrations` in the same
transaction as DDL and verification. It never retries writes automatically and
performs a separate read-only catalogue readback. An installed version only gets
read-only verification. Failed or ambiguous publication must be diagnosed with
read-only schema/history checks before deciding on another release attempt.

The manual main-only workflow uses the existing `supabase-production`
concurrency group and requires successful CI for its exact main commit. It
publishes this file only, rather than running a general database push. The
production migration history and unrelated pending releases are preserved.

Rollback must not reinstate the old full uniqueness key after users have reused
a dissolved name: that would conflict with valid historical records. Pause
further publication and use a reviewed forward repair; never delete or rename
historical teams to restore the old constraint.

## Actual validation and evidence

The disposable database fixture includes all existing lifecycle and admin
overview regressions. It compares the complete rows in six affected tables
before/after migration and replay, then exercises original-captain reuse,
another-captain reuse, all seven non-dissolved statuses, cross-season uniqueness,
distinct UUID/code creation and historical private-chat isolation.

The separate publication fixture executes the actual generated release SQL. A
ledger failure is injected after DDL; the original constraint, rows and empty
ledger survive, and the replacement index is absent. Successful publication,
read-only replay, one history entry and two concurrent same-name insert attempts
are also tested.

Local evidence is kept at
`D:/data/temp/econmind-team-name-fix-20261012-01/`. PostgreSQL 18.4 runs only on
127.0.0.1:15487 in a new isolated cluster. Hosted production uses PostgreSQL 17;
the CI job validates the same fixtures on PostgreSQL 17. The local Node 22.20.0
runtime is under `D:/dev/node/isolated/`, pnpm is 11.9.0 and dependencies use the
unchanged frozen lockfile.

Commands already executed: disposable SQL fixture and publication fixture both
exit 0; `pnpm install --frozen-lockfile --ignore-scripts` exits 0; pinned Node
`pnpm test` exits 0 with 123 files, 1021 passing tests and one pre-existing skipped
test; workflow/changed-file Prettier and `git diff --check` exit 0. Final pinned
lint/build and sequential typecheck results must be attached to the candidate
evidence before release. An initial parallel typecheck failed because Next's
build was regenerating `.next/types`; it is not counted as PASS and must be
rerun after build finishes. The existing lint baseline has eight warnings and no
errors.

No production publication or participant write is claimed by this document.
The required next actions are independent approval of the immutable candidate,
passing CI, merge, exact-main CI, scoped workflow publication and production
read-only readback. Source-boundary and security regression checks are included
in the existing test suite; no new browser/server imports or secrets are added.
