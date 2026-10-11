# Season 1 admin overview

Entry: `/season1` → **Admin overview**. Only platform admins (including the
existing supreme-admin designees) mount the panel. The server independently
requires `world_preseason_require_admin()`; captains and regular members cannot
read other teams through the new RPC.

Counts and all rosters come from one read-only database statement, with a server
snapshot timestamp. Counts do not depend on current search or paginated cards:

- Season 1 participants: distinct current team members plus available free agents.
- Teams: Season 1 teams excluding dissolved teams.
- In teams / ready members: actual membership rows / ready membership rows.
- Free agents: available Season 1 listings excluding people already in a team.
- Platform accounts: all active registered profiles, **not** concurrent visitors
  or people who have merely opened the lobby.

Each team opens a responsive, keyboard-accessible detail dialog: team code,
description, status, capacity, lock, language, home school, pending-application
count and full roster (name, school, captain/member, role preferences, readiness,
join time). There are no new member mutations, private-chat reads, email/phone
disclosures or role-management permissions.

Realtime team/member/free-agent/application invalidations refetch the guarded
snapshot. DELETE notifications are unfiltered because old rows may contain only
their primary key; their payload is not used as data. The existing coordinator
provides single-flight refresh, one trailing refresh, stable identity, late
subscription cleanup, 15s healthy / 5s unhealthy fallback, error backoff and
hidden-tab pause. Profile-only changes (e.g. a new platform account) appear on the
next fallback, without publishing the profiles table. An open dialog reads the
latest snapshot rather than a frozen copy of the team.

Deployment: merge with `[frontend-only]` to skip unrelated database publishers;
run `Season 1 · Deploy admin overview read API` on the reviewed main SHA. The
scoped publisher targets `vimksjrhaxdpnkvgsavz` and applies only
`20261011000000_season1_admin_overview.sql`, verifies grants in the same
transaction, and records that migration. No broad `db push`, data deletion,
existing RLS rewrite, Auth configuration change or World Simulation deployment.

Checks: `tests/season1-admin-overview.test.ts`, existing refresh lifecycle tests,
and `scripts/test-season1-admin-overview.sql` on disposable PostgreSQL, including
anonymous/member denial, all-roster/count consistency and migration replay.
