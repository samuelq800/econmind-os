# Fixed-window authentication email codes

Scope: the platform's **email registration and password-recovery** code-entry
flows. Google sign-in, passwords, permissions, legal acknowledgement metadata,
native account creation and native token validation are unchanged.

For a normalized email address plus purpose, the first signed native Auth email
hook establishes a fixed 60-minute window. Subsequent accepted sends use the same
outward eight-digit code and original expiry, while encrypted native verification
hashes are updated. Resending does not reset failed attempts. A new window starts
after expiry or successful consumption. Native Auth remains the session-issuing
authority; no `auth.users` token columns are written by this feature.

The cache is AES-GCM encrypted and addressed using keyed HMAC identifiers. Public
and authenticated roles cannot read the private tables or execute the three
service-only RPCs. Atomic PostgreSQL row/advisory locks serialize resends and
verification leases across Edge instances. The signed hook rejects invalid or
stale webhook signatures through Standard Webhooks. Verification is limited to
10 attempts per fixed window plus 30 attempts per peer per 10 minutes. The native
one-minute email resend limit and existing project mail quotas remain in place.

For pre-activation codes with no cache, the backend tries native OTP verification.
It never exposes a cache-existence flag to the browser and never falls back for
an expired, consumed or incorrectly entered cached code. Both invalid cases
return the same outward error. Secret-key IP forwarding preserves native
per-client rate attribution rather than pooling every user into an Edge-IP bucket.

Unused native invitation, magic-link, reauthentication and secure email-change
flows are passed through with their original token/link semantics; they do not
currently have fixed-code UI integration. The double email-change token/hash
pairing follows Supabase's documented old/new mapping. Registration/recovery
emails use code entry rather than a native link that a scanner could consume.
Users with an already-open old website build should refresh before verification.

## Production activation

Use `Auth · Deploy stable 60-minute codes`, on main only. It targets exactly
`vimksjrhaxdpnkvgsavz`, applies only migration `20261008120000`, records that
migration version, verifies private permissions, installs new protected feature
secrets without enabling them, and deploys only `stable-auth-email` and
`verify-stable-email`. It will not replace an existing enabled hook or silently
create/rotate a project API key. An existing `BREVO_API_KEY` and `sb_secret_` API
key are prerequisites. Generated feature keys are kept only in protected Edge
secrets and a runner-local 0600 file, never artifacts or repository source.

Activation waits for the matching Pages commit to succeed. Only native email
expiry, the three Send Email hook settings, and secure IP-forwarding enablement
are patched. All other Auth settings are independently fingerprinted/read back.
Optional owner-authorized real-mail testing requests two recovery emails 65 seconds
apart, checks identical encrypted outward code and fixed expiry, verifies the
original code after resend, rejects reuse, and closes only the newly issued test
session. It does **not** change passwords or delete accounts. Provider acceptance
does not independently prove inbox delivery. On activation/test failure it
disables the hook and feature verifier and restores expiry/IP-forwarding, leaving
native authentication operational. Dormant hook URI/secrets and cache data remain.

## Tests and boundaries

- `tests/stable-email-codes.test.ts`: clock boundaries, same-code resends,
  encryption context, purpose separation, attempt limits, concurrency, failure
  recovery, legacy compatibility, native double email-change pairing and UI bridge.
- `scripts/test-stable-email-codes.sql`: actual PostgreSQL semantics, grants,
  expiration, limits, consumed-secret clearing and idempotent migration.
- `scripts/test-stable-email-code-concurrency.mjs`: concurrent independent
  PostgreSQL connections, proving one send and one verification lease.
- `tests/stable-email-deployment.test.ts`: bounded settings/functions and rollback.

Expired rows contain only encrypted values/opaque subjects and are ineligible for
verification. This first release does not install a production retention/cleanup
job. Native Auth ultimately enforces token use, account bans and session security.
Do not claim an exact hour wait was exercised by a short online smoke: the fixed
60-minute boundary is tested with controlled clocks and PostgreSQL fixtures.
