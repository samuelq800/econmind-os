# EconMind Member Identity Center

## Scope and ownership

Replaces the existing `/profile` editor; no new admin UI, public-profile endpoint,
role assignment workflow, recommendation engine, or parallel membership system.

| Concern | Authority |
| --- | --- |
| Name/avatar/graduation/club/personal League preference | Existing `profiles` fields |
| Current school | Existing `profiles.school_id` and approved League school directory |
| School Leader, platform admin, academic role | Existing canonical `profiles.platform_role` / `profiles.role`; Superme helper |
| Bio/grade | New owner-only `member_profile_details` |
| Interests/skills/collaboration/research preferences | New catalog `member_profile_options` + owner-only `member_profile_choices` |
| Season 1 team/member role/status/office preferences | Existing `world_preseason_*` records; editing linked to My Team |
| Research | Own `research_papers`, with actual published count |
| Live Rooms | Own `live_world_rooms.created_by` count only |

Static founder/regional rosters have no authenticated account binding. Their names
are **not** matched to display names. No department membership source exists here.
Neither an interest nor a personal League role preference creates a verified badge.

## Files

- `components/league/profile-editor.tsx`: preserves route entry, auth-scoped loader/retry.
- `components/profile/member-identity-center.tsx`: identity hero/editor, preference
  sections, canonical-school dialog, read-only roles/activity, existing privacy controls.
- `lib/profile/member-identity.ts`: types and safe display/image helpers.
- `lib/supabase/member-identity.ts`: own-account RPC adapters, no target-user parameter.
- `supabase/migrations/20260926020000_member_identity_center.sql`: additive schema,
  owner-only RLS, narrow RPCs and school responsibility guard.
- `scripts/test-member-identity.sql`, `tests/member-identity.test.ts`: PostgreSQL and unit contracts.
- `scripts/verify-member-identity.sql`: read-only release preflight; included in Pages deployment.
- `.github/workflows/ci.yml`: disposable PostgreSQL 17 test job, separate from production.

## Editing and authorization

Each preference group saves independently, with a primary area required whenever
areas are selected. Empty legacy preferences remain valid. Adding catalog options
requires only a catalog insert, not a new profile column. Identity saves validate
field lengths, HTTPS avatar URLs, graduation range and the old personal-role enum.
Avatar editing accepts an HTTPS image URL; this task adds no upload bucket.

New tables expose no direct INSERT/UPDATE/DELETE privileges to authenticated users.
The callable security-definer RPCs pin `search_path`, derive `auth.uid()`, check an
active member account, and explicitly allowlist columns/categories. They cannot
change permissions, other users, or Season assignments. New details and choices
have own-row SELECT policies; no public visibility switches claim sharing that
the backend does not enforce. Existing display-name/school visibility is unchanged.

School changes use only approved canonical school IDs, compare the expected old
school under a profile-row lock, and require explicit UI confirmation. Leaving
sets the canonical school to null without deleting the account or historical
records. A trigger blocks a School Leader/liaison's self-reassignment even through
older onboarding RPCs. Conflicting active League-team school changes are blocked;
the old invite-code join may set the school matching its newly inserted membership.
Admin reassignment of other accounts remains in the existing League flow.

## Honest limitations

- No reliable school joined-at field; do not substitute account creation time.
- School directory approval is shown as directory status, not individual verification.
- Season team status and captain/member role are real. Assigned economy/office are
  not exposed by this main-site preseason service. Preferences remain preferences.
- Research count includes all own paper records; it is labeled “Papers in your library,”
  not falsely “published contributions.” Published papers are counted separately.
- Per the user's follow-up, Live Room participation counts and explanatory join-count
  notices are not displayed. Hosting is the only account-linked metric shown.
- Saved-paper/events attendance data unavailable: omitted.
- Granular public profile visibility unavailable: new profile extension data is private.

## Deployment order

This feature is not active on production merely because local/CI checks pass.
After release authorization, apply **only** the new migration to the confirmed
main-site Supabase project, then execute `scripts/verify-member-identity.sql`.
Only then publish the frontend. Pages now fails closed if the migration/RLS/RPC
prerequisites are missing. Do not reset the database or replay old migrations.
The migration is re-runnable and does not overwrite existing preference rows.
Frontend rollback can restore the previous ProfileEditor without deleting the
new tables; retain member data.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- PostgreSQL 17 CI: `psql -d member_identity_test -f scripts/test-member-identity.sql`.
  It refuses any other database name. Tests own/other-row access, suspended/anonymous
  callers, unknown options, primary constraints, direct-role mutation rejection,
  leader and team guards, invite compatibility, change/leave, preserved history,
  no preference-based roles/Season assignments, migration replay and catalog extension.
- Browser QA uses a local fake Supabase host, never real accounts: 1440px member,
  390px empty legacy member and 390px leader. Covers identity save, preferences,
  failure/retry, confirmations, private email absent from identity content, role guard,
  no participation count, no page errors and no horizontal overflow.

Manual product review: hero separates verified badges from neutral interests;
school shows canonical affiliation with change/leave or a League guard; activity is
separate from editable interest cards; existing privacy/support remains collapsible.
