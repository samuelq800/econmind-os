# Existing reader update — immutable code candidate, production HOLD

Main-site base `fc5c328965403cbbbf9b77a3639559cc7bb619df`, tree `d40257fec85c2a70a11265eabf2a5862545299ad`. The initial snapshot workflow cannot be replayed: it requires an unused reader slug, whereas run `37130549747` deployed version 1 and verified all 34 selected snapshot objects, bounded countries GET200/OPTIONS204, and the seven old function identities. Storage and the original publisher are not modified by this new entry point.

## Immutable source binding

This is a bound code candidate, not production authorization. Root authorized binding after G's two-origin CORS PR #69 and A's reader execution-cost PR #70 received B's component-level `CODE_MERGE_GO` / `SOURCE_UPDATE_TECHNICAL_GO` and merged. `world-v2-reader-cors-update-binding.json` now has status `BOUND_CODE_CANDIDATE` and pins:

- World source commit `0ec30a28d19f4ae51d81edad42d0598c356dc127`, whole tree `5ee5ab30436d149142c2dbdcc3f4f405422a77d6`; actual parents `f259268e11b1338c574050024fafa59881bc9475` and `406ecdb98d6a819e168bd366f56dad785de244de`.
- Reader subtree `28d7ba3e102a7b4efb5cbb74088ed2a0f85f5d5b`, exactly 25 ordinary `100644` blobs.
- Exactly five changed paths within the reader directory from deployed source `ae57dc090f736ea17aa9d67b0e1295f10c97e4c6`: `index.ts`, `lib/official-dataset-source.d.ts`, `lib/official-dataset-source.js`, `lib/official-source-snapshot-reader.d.ts` and `lib/official-source-snapshot-reader.js`. The binding JSON contains their full paths.

G CI `37132265858` passed. A CI `37133868999` passed and tested reader subtree `28d7ba3e102a7b4efb5cbb74088ed2a0f85f5d5b`; its whole tested merge tree differs from A's head because of the contemporaneous web background changes. It is not evidence that the whole A candidate tree or final World tree was tested unchanged. The final exact function subtree is the combined reviewed A/G source. Unrelated committed World web, asset-base, icon and documentation changes are preserved, not part of E's function update review.

Guard rejects absent/null/float bindings before production contact. The source guard requires the exact clean checkout, exact remote, source SHA, subtree, count, blob modes and function-only changed-path manifest; no `latest`, branch source, permissive path fallback or inferred server source is accepted. This fixed main-site candidate still needs independent B entry-point review, verified main-site merge and a new Root single-run authorization. No lock is set or deployment dispatched by this code-only handoff.

The fixed planned confirmation is `UPDATE_WORLD_V2_READER_CORS_ONCE`; authorization identifier is `CT-WORLD-V2-READER-CORS-UPDATE-V1`. The independent lock is `WORLD_V2_READER_UPDATE_LOCK=READER_UPDATE_GO:<new fingerprint>`. These strings describe a prospective protocol, not an issued execution approval. Fingerprint binds the new workflow, runner, binding, tests/document and the existing publisher dependency fingerprint. It does not authorize an initial publish or a retry. Main repository/ref, attempt 1, valid main SHA, exact project, confirmation/id, existing Management token presence and fingerprint must pass. Root/E enforce unique dispatch and immediate terminal lock retirement; variables are not atomic single-use locks.

## Sole permitted update protocol

The new workflow/CLI has no key acquisition, Storage upload/list/create, database query/DDL, LOGIN activation, secret-setting, Pages configuration or raw response artifact capability. It uses the already-configured Management token only through the existing Supabase CLI. No credentials are created, rotated, found in old environment files, returned or persisted.

1. Verify the clean exact World checkout/remote, pinned reader tree, ordinary Git blobs, exact file count and reviewed changed paths. Stage only that function directory into the disposable main-site runner; reject an existing local destination.
2. Read function metadata once. Require exactly eight unique slugs and exactly one `world-v2-official-read` with exact name, nonempty bounded id, version 1, ACTIVE, `verify_jwt=false`, and a SHA256 bundle identity. The seven old normalized identities must hash to the initial run's `c6058e4edd593bad5b7c6ac97aceee95089af7ce1875766da6b54c1c07fb4db9`.
3. Freeze that current same-run reader identity internally, then immediately read metadata a second time and require every normalized reader identity field and old-seven hash unchanged. This is current preimage evidence, not retroactive recovery of the historical reader id/hash (which the initial receipt did not retain).
4. Execute exactly one fixed `supabase functions deploy world-v2-official-read` for the fixed project. No other slug, create-only snapshot replay, upload, retry, remote cleanup or rollback exists.
5. Read metadata once afterward. Require the same reader id/name/slug, version exactly 2, ACTIVE/no JWT, a changed valid bundle hash, and the same seven old identities. Any failure after the deploy attempt is `UNKNOWN_STOP_NO_RETRY`; replacement/race/conflict is not replayed or repaired.
6. Run one fixed countries `limit=1` GET and OPTIONS for each exact origin, `https://samuelq800.github.io` and `https://world.econmind.group`. Reject redirect, bad HTTP, ambiguous/wildcard ACAO, credentials, malformed/oversize JSON, wrong source SHA/shape/transport/status. Preserve the existing snapshot verifier byte-for-byte: normalize only an already-exact-validated ACAO to its historical origin for reuse. Summaries retain the actual tested origin.

Public response reads cap each GET at 262144 bytes; metadata stdout caps at 262144 bytes. Timeouts are bounded. The maximum successful protocol is three metadata lists, one deployment and four public requests (two GET/two OPTIONS). Failure stops further operations. Synthetic injected dependencies/expected old hash are unit-test only; the CLI accepts no overrides for identity hash, manifest, project, slug, route or origin.

## Evidence and authority

Output is sanitized fixed metadata, identity hashes/booleans, request counts, failed stage/allowlisted error, immutable source binding, and existing bounded route summary only. No raw function list, id, bundle value, header, body, key, token, or source payload enters the artifact. A receipt already present blocks local re-execution. Unknown deployment may leave the new reader updated remotely; report it honestly, do not delete/rollback/replay. The runner emits no claim about secure erasure of runtime strings.

Countries smoke verifies CORS and that bounded source route only; it does not prove all datasets, the separate observed geography HTTP546's historical cause/fix, Pages integration, a database projection, economic activation, Command execution or Gate B. A's full readback and any Pages variable/publication need separate Root authorization. Historical policy execution remains UNKNOWN; earlier failed snapshot runs remain failures with zero writes; the later bucket diagnostic is not rewritten as absence or credential-usability proof.

Main-site update ownership is E; World source/tests ownership is A/G. Existing main-site initial workflows, transport/publisher/permission guards, old site/UI/data, Supabase schema/ACL/LOGIN, World/Core/Worker and source/map assets stay untouched. Root dispatches B and alone decides merge and future production operation. Complete the fixed-candidate CI handoff, then stop.
