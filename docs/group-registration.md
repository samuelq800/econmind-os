# Shared group registration code

This is a reusable code for one group registration campaign. Multiple members
can use the same code; it is not tied to one person and is not consumed on use.
A platform administrator distributes it within the group and can stop, rotate,
or expire it. Possession of the code is the access condition; the website cannot
independently verify membership of an external chat group.

## Account flows

- Ordinary email registration still requires the email verification code.
- Google sign-in and existing `VIEW-...` view-only invitations remain available.
- The registration dialog offers **Use your group's registration code** both
  before registration and on the email-code screen. Members enter the shared
  code, email, password and current legal acknowledgements.
- A new account is created through server-only native Auth Admin APIs. It then
  signs in normally using its password and completes the existing onboarding.
- A pending email-only account requires its **original password**. Native Auth
  must return `email_not_confirmed` after validating that password, followed by
  a fresh account check before native Admin confirmation. This path never sets
  or changes an existing password, role, school, team or user metadata.
- Confirmed, OAuth-linked, anonymous, deleted, banned and suspended accounts are
  excluded. Existing accounts use normal sign-in or email recovery. Registration
  retries after a completed registration use normal sign-in as well.
- Recovery still requires the actual email recovery code. The shared code is
  accepted only by the dedicated registration endpoint.

The global `enable_confirmations = true` setting stays enabled. Native Auth
requires its confirmation flag for password login, so this explicit exception
sets that flag through the Admin API. This does **not** establish inbox ownership:
server-owned `app_metadata.group_registration` records `method`, activation time
and `email_ownership_verified: false`. The group code itself is never written to
user metadata or the browser bundle. Because email ownership is skipped, a code
holder can register an unused address they do not own; distribute the code only
inside the intended group and stop the campaign when no longer needed. This
exception should not be used as evidence of verified email ownership elsewhere.

## Configuration and controlled publication

The migration `20261011120000_group_registration.sql` creates a **disabled**
private singleton policy and durable rate counters. Applying it alone does not
enable bypass registration. Anonymous/authenticated users cannot read the policy
hash or counters or call the service-only authorization RPC.

After the owner authorizes publication, use the repository's approved migration
publication process for **only this reviewed migration**. Do not blindly apply
other pending migrations, repair migration history, or run arbitrary production
SQL. Deploy only `register-with-group-code` and publish the matching website.
The function's `verify_jwt = false` is intentional: it verifies the shared code
before using its protected service-role client. No service credential belongs
in `NEXT_PUBLIC_*` or a frontend environment file. No Auth configuration push,
SMTP change, Brevo change or Google provider change is required.

In **Viewing invitations → Shared group registration**, a platform administrator
enters the approved group code and optional future expiry, then selects **Save
and enable shared code**. The endpoint treats code case and outer whitespace
consistently. The code is stored as a SHA-256 hash in a private table, never
returned by the settings RPC and never displayed in public UI. Leave the field
blank to retain the current code when updating the campaign. **Stop group
registration** closes further use without disabling accounts already created.

The owner subsequently authorized deployment. The manual `deploy-group-registration.yml`
workflow requires matching successful CI and website releases on main. Its bounded
publisher checks the reviewed migration SHA-256, atomically records that exact
migration, verifies private permissions, and deploys only the dedicated function.
Activation reads the approved code hash from the protected repository secret
`GROUP_REGISTRATION_CODE_HASH`. It checks unchanged Auth settings before and after
activation; uncertain activation readback closes the feature. It never pushes the
migration directory or changes Auth, SMTP, Google, recovery or native user tables.
Independent review must cover the fixed publication candidate before merging.

## Verification

- `pnpm test`: handler/browser behavior plus existing email, Google, viewer and
  authorization regressions.
- `deno check --no-config supabase/functions/register-with-group-code/index.ts`:
  the real Edge entry point and pinned Supabase client types.
- `psql -f scripts/test-group-registration.sql` **in a disposable database**:
  reuse, expiry, rotation, closure, pending/confirmed/provider/suspension checks,
  actual private permissions and durable limits, including failed-code attempts.
- `pnpm typecheck`, `pnpm lint`, formatting checks and `pnpm build`.

Limits are six attempts per email and thirty globally per ten minutes, enforced
by atomic PostgreSQL upserts across function instances. Counters are identifiers
and counts, with no raw code, password or email stored in them. The global identifier
uses HMAC with a protected server key; forwarding headers cannot change it.
This temporary fallback shares its capacity across all members; wrong-code attempts
can exhaust that capacity until the ten-minute window resets. Requests are bounded to 4 KiB.
No raw Auth errors, passwords, codes or session tokens are logged or returned.

Native password-before-confirmation ordering is checked against the
[Supabase Auth password grant implementation](https://github.com/supabase/auth/blob/master/internal/api/token.go).
Server-only account confirmation uses the documented
[createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
and [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
APIs. A release must verify the pending-password behavior against the deployed
Auth version using disposable local Auth fixtures, including wrong passwords.
Unit fixtures and PostgreSQL tests alone do not prove hosted Auth behavior or
inbox delivery.

`scripts/test-group-registration-native-auth.mjs` accepts only a disposable
loopback HTTP Auth instance. It exercises native wrong-password rejection,
pending-password proof, Admin activation preserving the original password and
metadata, normal login, and closure of the transient concurrent-confirmation
session. CI builds official Auth v2.197.0 at commit
`4eee58f296d9698a1c2c0ae14d7a0b379c7622d3` against its own disposable database.
