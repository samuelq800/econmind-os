# Fixed bucket read diagnosis: held read-only candidate, not new write admission

Code-only Root delegation; base main `acb02114a847c2debef9dcfff492b7c334c32a91`.
Publish run `37044748085` failed at its first bucket GET, Storage writes 0 and
34 objects not attempted. Preserve handoff SHA256
`ecdce9a1a9d2c9be223d0fbb4109005e6c1277978a4efd5f2ba8b2e179789add`,
the previous publish failure and original policy UNKNOWN. Its HTTP status,
response body, Storage server version and actual root cause remain UNKNOWN.

## Official sources, not a production-version assertion

Storage repository pinned on 2026-10-03 at
`eccef5e70a67fb4030e0646e5e22602c94f568bc`:

- [codes.ts](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/internal/errors/codes.ts),
  SHA256 `a764f5c70e593402c8f89865d1b5690fbebbec929a123d978c2d9578f720c099`
- [storage-error.ts](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/internal/errors/storage-error.ts),
  SHA256 `808af79d568a9343c08208df560ac11410607b005230c0acffc568ece1af9cac`
- [error-handler.ts](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/http/error-handler.ts),
  SHA256 `3f76e8c37c2928e3e59416aea0673e8aec435a1671550dd72286006fd64427d3`
- [bucket.test.ts](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/test/bucket.test.ts),
  SHA256 `e77d1db16f7d8db3a131e2a340f733a8b80756d1aafee5034b25321d4eb38242`
- [Official error-code guide](https://supabase.com/docs/guides/storage/debugging/error-codes)
- [Official API key contract](https://supabase.com/docs/guides/getting-started/api-keys)
- [Pinned supabase-js fetch.ts](https://github.com/supabase/supabase-js/blob/cb7682857665fd9e83cfae4212f8d1550370b41c/packages/core/supabase-js/src/lib/fetch.ts),
  SHA256 `9b9b92c53df44c448ce35269ed07624fcd72bc08a0b159c4320db0b1a160b3e3`

The pinned error class has semantic 404 for NoSuchBucket, while user-facing
compatibility status may be 400 unless overridden. The render/formatter can
carry statusCode, code, error and message; the bucket tests cover nonexistent
404 and auth/RLS failures with 400. This supplies mock shapes, not this
project's actual version or response. The official guide explicitly warns
that NoSuchBucket/not_found can also hide insufficient access.

The current publisher accepts any HTTP404 and one narrow HTTP400 not_found
shape. Its HTTP404 rule can mask access/existence; this candidate leaves it
unchanged and does NOT expand missing recognition. Neither 404 nor a classified
NoSuchBucket shape proves absence. No classifier is wired into create/upload.
Official modern keys belong in apikey, not as JWT Bearer; retain existing
modern apikey-only and legacy JWT Bearer branches. Do not assume another header
will repair this unknown failure. Gateway/service implementation can differ.
The pinned SDK also retains a configurable Bearer fallback in some paths;
therefore its generic fetch helper does not itself prove that omitting a
Bearer header caused the failed direct REST call. This candidate does not
change headers or experimentally try both variants.

## Independent, still unexecuted diagnostic

Future new authorization must bind B's fixed SHA review, actual merged main,
tree and diagnostic fingerprint. Lock variable is
`WORLD_V2_SNAPSHOT_BUCKET_DIAGNOSTIC_LOCK=BUCKET_DIAGNOSTIC_GO:<fingerprint>`;
confirmation `BUCKET_DIAGNOSTIC_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE`; ID
`CT-SNAPSHOT-BUCKET-DIAGNOSTIC-37044748085-V1`. No lock is set in this code task.

The private shared lease retains the exact existing selector, validation and
finally retirement. Public publisher gets its unchanged Storage capability;
diagnostic gets only a private fixed read function, no callback/write/list API.
Exactly one existing Management reveal=true GET (10s/32KiB) obtains the temporary
key, then one fixed `/storage/v1/bucket/world-v2-official-source-v1` GET
(10s/16KiB). An additional request gate rejects every other URL/method/repeat.
No fallback request, retries, redirect, key creation/rotation, SQL or deployment.

Only numeric HTTP status, finite error categories, known-field presence/shape,
and unknown-field count/shape counts leave the parser. No body/header/key,
identifier/custom name, unknown field names/values, raw text or response hash
is emitted/persisted. Invalid/oversize bodies preserve only status + finite
unreadable category. Keys/response bytes remain memory-only; owned byte buffers
are cleared and lease finally retires, not a secure JS/fetch erasure guarantee.

HTTP200 observation and known error shapes mean diagnostic collection only,
never RELEASE_GO, valid credential, actual bucket absence or historical cause.
Unknown/malformed/network outcomes STOP with a bounded receipt; no retry.
Reruns and non-main are guarded. Root/E must enforce unique dispatch and retire
the independent lock immediately after terminal outcome: repo vars are not an
atomic consumption primitive. Old release/metadata locks cannot authorize it.

No new publisher recognizer is enabled. Actual diagnostic evidence, separate
fixed patch/B review and Root new authorization are prerequisites for any
future change of missing handling or publication. UI/auth/old permissions,
schema/World/Core/worker and source data stay untouched; all historical
receipts remain literal. Root alone merges and arranges B; E prepares and stops.
