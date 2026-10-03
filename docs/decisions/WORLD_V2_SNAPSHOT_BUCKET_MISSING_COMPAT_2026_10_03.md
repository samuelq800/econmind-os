# Fixed bucket HTTP400 compatibility — code-only candidate

Base: `2b629e0f29261647cce952808b9b7fa7ccb3e10b` (tree `51d77cd4f6c32237dcfd8ccbc591d82c824977fa`). No production request, lock, dispatch, retry, schema/SQL/permission change, or publication is authorized by this patch.

## Evidence and narrow change

Single diagnostic run `37128962923`, attempt 1, observed HTTP400 and `KNOWN_NO_SUCH_BUCKET_SHAPE_NOT_ABSENCE_PROOF`, four fixed string fields, and zero unknown fields. Its sanitized receipt SHA256 is `83a6a392ac169e77e7914d15d17cef16d626173a8c582ebe6091738b3629618c`; request counts were one Management key GET, one fixed bucket GET, zero writes. Diagnostic lock retirement was confirmed by an empty World lock-name readback. No raw response, key, header, custom field, or raw-response hash was retained.

Only the fixed `getBucket(world-v2-official-source-v1)` missing-response branch gains compatibility. Existing HTTP404 and legacy HTTP400/status404/error `not_found` behavior is retained. The new HTTP400 branch requires an object with exactly four own fields, no extras:

- `statusCode` is exactly `404` or `"404"`;
- `code` is exactly `NoSuchBucket`;
- `error` is exactly `NoSuchBucket` or `Bucket not found`;
- `message` is exactly `Bucket not found`.

No substring match, coercion, generic HTTP400, malformed JSON, altered field, or unknown field is admitted by the new branch. Bodies retain the existing 16 KiB bound. HTTP401/403/5xx do not enter it. The diagnostic classifier is not used to authorize a write.

This branch permits only the existing fixed create-only bucket attempt. It proves neither absence nor credential usability. The publisher still requires its separate, fresh immutable release authorization, verified permission evidence, pinned source, and existing ephemeral lease. `createBucket` remains the fixed POST with exact id/name/public/size/MIME properties; no overwrite, alter, update, delete, or permission repair exists. Any result other than HTTP200/201, a duplicate conflict, or network uncertainty remains `SNAPSHOT_BUCKET_OUTCOME_UNKNOWN_NO_RETRY`. A masked permission error cannot turn into an alteration of an existing bucket.

Historical authoritative new-scope bucket/object counts of zero are historical only, not current absence evidence. No new existence query or schema gate is added: create-only rejection remains the collision safety boundary. Any future publication must independently satisfy the unchanged release guards; this candidate does not bypass them. The original policy execution stays `UNKNOWN`; both historical publication failures remain failures with zero writes, and their HTTP/body/root cause is not inferred from this later observation.

## Prechecked next-step contracts, without widening them

Official Storage source is pinned to `eccef5e70a67fb4030e0646e5e22602c94f568bc`, not the unknown actual server version. The [public-object route](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/http/routes/object/getPublicObject.ts) calls the fixed bucket lookup and object lookup. The [database adapter](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/storage/database/pg.ts) raises `NoSuchKey` on an empty object result. The [error definitions](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/internal/errors/codes.ts) and [REST error handler](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/http/error-handler.ts) yield the existing supported HTTP400/semantic404/error `not_found` path. The [official public missing-version test](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/test/object.test.ts#L419) asserts four fields including code `NoSuchKey` and message `Object not found`. Thus no object recognizer change is needed for that pinned REST contract. A hypothetical error `NoSuchKey` variant is still rejected; no deployed support for it is claimed.

The [list route](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/src/http/routes/object/listObjects.ts) returns HTTP200 arrays. Adapter prefix search and [relative-name/folder SQL](https://github.com/supabase/storage/blob/eccef5e70a67fb4030e0646e5e22602c94f568bc/migrations/tenant/0063-fix-search-name-relative-to-prefix.sql) support the existing empty-root, root-folder/id-null, and prefix-relative filename fixture. The fixture checks both exact list payloads and all 34 manifest keys, without changing list behavior or claiming live server verification.

[Official error guidance](https://supabase.com/docs/guides/storage/debugging/error-codes) warns that missing-resource categories may mask lack of access. No absence claim or RLS relaxation follows from this compatibility change.

## Verification and scope

Mocks cover both exact bucket error variants and string/numeric semantic404, reconstructed reviewed diagnostic shape, wrong HTTP/status/code/error/message, missing/unknown fields, non-object/invalid/oversize bodies, create conflicts and failure statuses with one attempt, wrong bucket/properties/unlisted hash keys, public-object supported/unsupported contracts, and empty/populated prefix lists. Existing byte/hash/readback/upsert restrictions stay unchanged.

Transport changes are limited to the new private bucket helper and its one `getBucket` call site. General `isMissing`, `readObject`, `createBucket`, list/createObject, key selector/lease, diagnostic, permission SQL/verifier, publisher/runner/workflows, source manifest/data, UI/auth/old site, LOGIN/World/Core/Worker/Pages configuration, 53 extra source originals, and 203 maps are unchanged.

Changing transport bytes invalidates both old release and diagnostic fingerprints. Compute and hand off new fingerprints on the fixed committed tip; do not reuse previous locks or authorization. Root dispatches B's independent fixed-tip review and alone decides merge or any future production run. After CI evidence handoff, stop.
