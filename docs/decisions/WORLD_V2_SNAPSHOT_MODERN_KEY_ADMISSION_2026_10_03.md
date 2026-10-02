# Snapshot credential admission: modern-first, strictly classified fallback

Code-only authority: Root Control Tower delegation, 2026-10-03.
Base main `33d504540d0f11f7f61d3a601a394911eed8795d`.
This candidate is NOT production retry authorization or RELEASE_GO.

## Evidence remains literal

Original publish run `37038527126` failed before Storage; its historical
response/root cause remains NOT_EVIDENCED. Original policy release UNKNOWN is
unchanged. Authorized metadata-only run `37042407081` completed with receipt
SHA256 `cff069ca818066dd13042d0b14f04876b87e833dc92f41fb75a9a60f4febbefc`:
current legacy role match 1, modern template role match 1, old predicate count 2.
These are current metadata counts, not proof of historical failure or usable
credentials. Original receipts/diagnostic workflow are not rewritten or rerun.

## Exact new policy

The fixed project reveal response must be an array of non-array objects.
An eligible modern candidate requires exact `type=secret` and an object template
with exact `role=service_role`; custom names never select or rank keys.

1. More than one eligible modern: MULTIPLE, even if values match or are invalid.
2. Exactly one eligible modern: select that tier; missing/non-string value is
   TYPE_INVALID, malformed secret format is INVALID. Neither error falls back.
3. Zero eligible modern: only exact `type=legacy`, `name=service_role` entries
   may be legacy candidates. Exactly one is required; zero is NOT_FOUND, more
   than one MULTIPLE. Validate its JWT format, fixed project ref and exact role.

Nullable/omitted/unknown types are never legacy fallback candidates. Publishable
entries and unknown names are never adopted by guessing, ordering or dedup.
Modern format validation remains the existing `sb_secret_` check; opaque keys
provide no locally verifiable project claims, so project binding still relies
on the fixed Management endpoint. Legacy JWT validation is unchanged, not a
new local signature verification claim.

## Matching-field safety boundary

- Every secret entry needs an object template with a nonempty string role.
  Missing/null/array/non-object template or missing/non-string/empty role stops
  with METADATA_INVALID, even with a usable legacy fallback. Unknown metadata
  cannot hide another possible modern candidate.
- A well-formed secret with another explicit role is not eligible. It cannot
  be promoted through its name; a contradictory standard `service_role` name
  with a non-service-role template stops. A nonconflicting other-role secret
  does not itself prevent an otherwise valid legacy fallback.
- When legacy is the selected tier, absent/null template or absent template
  role is allowed; supplied non-object/array template or explicit conflicting
  role stops. The JWT still must prove its role/ref. Unused legacy values or
  templates do not override a uniquely selected modern tier.

The metadata aggregate's old `existing_selector_candidates` predicate stays
frozen for historical receipt compatibility; it does not describe new admission.

## Unchanged boundaries and verification

No new requests are added. `reveal=true` remains solely inside the already
guarded publish operation; this candidate neither dispatches it nor sets any
lock. Source/permission/function guards, ephemeral lease retirement, fixed
34 SHA-addressed bytes, create-only/no-upsert/no-overwrite/no-delete and bounded
Storage protocol are unchanged. No UI/auth/original-site permissions, schema,
source data, DB/World/Core activation, key creation/rotation or .env search.

Mocks cover both input orders, coexistence, duplicate modern/legacy, invalid
selected modern without fallback, role/ref faults, matching-field anomalies,
sanitized callback errors and exact request counts. Existing permission and
publisher tests remain required. Both fingerprints change because they bind
the transport file; all old publication/diagnostic authorizations are invalid
for this candidate. Fixed SHA/tree, CI, B review and new Root authorization
must precede any future production attempt. Root alone merges/dispatches B;
E hands off this code/test PR and stops.
