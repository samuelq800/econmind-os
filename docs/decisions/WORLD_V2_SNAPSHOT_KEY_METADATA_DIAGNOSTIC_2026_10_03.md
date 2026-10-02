# Snapshot publisher key selection: offline diagnosis and held metadata candidate

Base: main `9d1207921a5f2715268d9f98547ef81bd8775e08`.
Actual publish run `37038527126` stopped at `SNAPSHOT_PUBLISHER_KEY_AMBIGUOUS`:
34 planned, 0 attempted, 0 Storage calls, no Edge deployment. Original policy
release UNKNOWN is preserved; current-state readback is not original success.

## Evidence and uncertainty

Official sources checked 2026-10-03, not project-specific key metadata:

- [Management API operation](https://supabase.com/docs/reference/api/v1-get-project-api-keys)
- [Public OpenAPI schema](https://api.supabase.com/api/v1-json), operation
  `v1-get-project-api-keys`, component `ApiKeyResponse_Output`
- [API key roles](https://supabase.com/docs/guides/getting-started/api-keys)

The API takes a boolean-string `reveal`. Its response is an array; `api_key`,
`type`, and `secret_jwt_template` are nullable/optional, with only `name`
required. Types include legacy, publishable, secret, and null. Secret keys
resolve to service_role; legacy service_role JWTs are distinct, and both key
systems can coexist. The template schema does not require a role property.

These contract facts do not identify this project's failed response. The old
error mixed zero candidates, multiple candidates, and a non-string key. The
candidate now distinguishes NOT_FOUND, MULTIPLE, TYPE_INVALID, retaining the
exact admission predicate, legacy project/role JWT checks, and secret format
check. Missing/null secret templates still do NOT broaden selection. No
choose-first, prefer-new, dedup-by-key, reveal fallback, or new-key creation.
Mocks demonstrate each branch, not the production root cause. Offline root
cause remains NOT_EVIDENCED; no raw failed response was retained.

## Separately held diagnostic, not a release

No production diagnostic has run and no new lock is set. Root must bind B's
narrow review, immutable candidate SHA, actual merged main SHA, fingerprint,
and a **new explicit authorization** before the only allowed GET:
`/v1/projects/vimksjrhaxdpnkvgsavz/api-keys?reveal=false`.

Independent variable `WORLD_V2_SNAPSHOT_KEY_METADATA_LOCK` must equal
`METADATA_GO:<metadata fingerprint>`; confirmation is
`METADATA_GO_WORLD_V2_SNAPSHOT_KEY_METADATA_ONCE`; authorization ID is
`CT-SNAPSHOT-KEY-METADATA-37038527126-V1`. Guard requires main, exact repository,
fixed project, first run attempt, nonempty management token, and a nonexistent
local receipt. No existing publish/preflight/readback lock authorizes it.

One bounded GET, 10-second timeout, 32 KiB body / 100-entry cap, redirect denied,
no retry. Only aggregate counts of allowlisted types, field presence, key field
shape, and known role matches are emitted. No id, key, custom name/type value,
template, raw response, or response hash is printed/persisted. Unexpected
reveal=false key values are discarded as well; byte/reference cleanup cannot
promise secure memory erasure. Finite errors only; failure also stops.

Root/E's one-dispatch protocol must retire this lock immediately after the
single run, even on failure. The workflow blocks reruns, but repository vars
are not an atomic consumption mechanism: an operator must not redispatch
while the lock exists. Metadata receipt is never RELEASE_GO and cannot prove
the historical failed response or credential usability. Any selector change
after diagnosis requires a separate fixed patch/review/authorization.

The existing publisher fingerprint changes with the transport error-code
patch: old RELEASE_GO/PREFLIGHT_GO authorizations no longer match. All original
permission/source/old-function guards, ephemeral key lease, 34-byte whitelist,
create-only/no-overwrite behavior, and no remote cleanup remain intact.
No migrations, LOGIN, Core/World activation, old Storage/auth/UI changes,
Pages config changes, key creation/rotation, .env key search, or automatic
publication is part of this candidate. Root alone merges and dispatches B.
