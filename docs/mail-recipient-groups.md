# Mail recipient groups

The Mail composer retains manual addresses, per-user selection, school filtering,
the confirmation screen, private one-recipient delivery and the 500-address cap.
Selection never sends mail. Oversized selections fail without silently truncating.
Malformed legacy directory addresses are explicitly listed as unavailable; they
are excluded from displayed eligible counts and all bulk-selection paths. No
account record is changed. Invalid manually entered addresses block review with
an address-specific error. The same address predicate guards each send payload.

`admin_mail_recipient_directory(p_after uuid)` adds category metadata to the
existing keyset-paginated directory, at 200 users per page. The browser loads all
pages before enabling bulk selection. `Select all users` ignores filters;
`Add matching users` includes every match, not only the 50 visible rows. Multiple
categories form a union; school and search intersect it. Emails are deduplicated
case-insensitively, including manually entered addresses.

## Definitions

- All users: existing directory eligibility, profiles joined to non-deleted Auth
  users with an email. This intentionally includes setup-incomplete accounts.
- Season 1 team founders: `world_preseason_teams.created_by` for non-dissolved
  `season-1` teams. Original founders remain eligible after captain transfer or
  departure. Current captaincy and role preferences are not used (user request).
- Season 1 participants: actual members of non-dissolved Season 1 teams, plus
  available Season 1 free agents. A stale free-agent entry never double counts
  someone already on a current team.
- Season 1 team members: current membership, including current captains.
- Season 1 free agents: available Season 1 entries, excluding current members.
- School participants: profile currently has a school ID.
- Individual participants: no school ID and explicit `onboarding_path='visitor'`.
  A missing school alone does not imply individual participation.
- School leaders: canonical profile `platform_role='school_leader'`.
- Teachers & professors: canonical profile academic role.

The RPC is stable, SECURITY DEFINER, empty search path, and checks the existing
platform-admin predicate plus a non-null authenticated identity. Anonymous users
have no execute grant. Ordinary authenticated users are rejected inside the RPC.
No tables, records, roles, send functions, mail history or delivery semantics change.

## Verification and release

Run focused `admin-mail*` and `mail-recipient-groups-publisher` Vitest tests.
Run `scripts/test-mail-recipient-groups.sql` only in a fresh disposable PostgreSQL
database named `mail_recipient_groups_test`. It validates founder transfer,
membership, other seasons, dissolved teams, pagination, permissions, repeatability
and preservation of existing records.

The approved production migration is exactly
`20261019000000_admin_mail_recipient_groups.sql`. The scoped publisher requires
the exact project ref and explicit approval environment flag, records the migration
transactionally, and never retries writes after an unknown outcome. Deploy the
frontend only after independent RPC/grant readback passes. Do not use `db push`.
