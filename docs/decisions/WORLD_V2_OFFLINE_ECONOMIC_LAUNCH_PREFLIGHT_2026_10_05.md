# Offline economic launch manifest — preparation only

Risk: submit at the highest applicable P0 runtime-identity/permission boundary. Root authorized only preparation of a new offline validator, tests and this runbook. No P0 self-approval, merge, production launch, database read/write, seed, key acquisition, configuration or Worker operation is authorized. Root dispatches B's fixed-candidate narrow review.

## Scope

`scripts/world-v2-economic-launch-preflight.mjs` is one standalone document validator. It imports only Node crypto and URL, reads bounded standard input (65536 bytes), returns a sanitized summary to stdout, and performs no network, file/path traversal, environment lookup, SQL, secret read, Worker, configuration, artifact write or subprocess operation. It does not import or change any existing source publisher/fingerprint or the old `world:launch` path. Tests use synthetic in-memory documents only; no approved seed, production World ID or economic decision is generated.

The baseline literals pin main-site base `d82a199ebd76dec1cb5d46421bb2eb6f76648514` / tree `54ff520a4b24466eecab46eaa4c51549db0130a9`; World `5e4b9d9ae50b04149a5a6e67478051dc1b1d8ec1` / tree `3e36c396e39a7ed9bd516e447e83254c1c72ddae`; source reader `0ec30a28d19f4ae51d81edad42d0598c356dc127` / function tree `28d7ba3e102a7b4efb5cbb74088ed2a0f85f5d5b`; selected package/checksum and the existing mapping fingerprint. These are reviewed-baseline identities, **not** assertions that the later candidate tree or an executing server has these bytes. A future baseline change requires a fixed new candidate/review, not a CLI source override.

## Input contract

The exact JSON object has `schemaVersion="WORLD_V2_ECONOMIC_LAUNCH_MANIFEST_V1"`, `candidate`, and `independentReview`. Unknown or missing keys fail closed. The test factory is the only complete fixture; no production template containing invented approved values is shipped.

`candidate` requires:

- `evidenceKind`: `FIXTURE` for explicit fixture mode, otherwise `DECLARED_PRODUCTION_CANDIDATE`. Fixture world IDs cannot pass production mode. These labels are declarations, not authenticated provenance.
- `baseline`: exactly every public literal in exported `LAUNCH_BASELINE`, including project, publisher base, World/source/function trees, selected source and baseline mapping.
- `worldId`, `mappingWorldId`, `seedWorldId`: one explicit, identical, bounded identity matching the pinned Core uppercase WorldId lexical contract. No default, coercion or newly created World. `countryIds`: exact ordered `COUNTRY_01` through `COUNTRY_70`, with no duplicates or omissions. This validates a roster, not the contents of a mapping or seed.
- `references`: nonzero lowercase SHA256 strings for `admittedMappingSha256`, `coverageSha256`, `seedSha256`, `schemaChainSha256`, `leastPrivilegeReviewSha256`, `oldPublicHoldDispositionSha256`, `trustedHostBindingSha256`, `apiBridgeSha256`, `singleWriterProtocolSha256`, `withdrawKillProtocolSha256`, and `recoveryRollbackProtocolSha256`. Baseline mapping remains distinct from the future admitted mapping. No reference has a fabricated default. Hash fields **do not** prove bytes, schema availability, host deployment, least privilege or clearance of old PUBLIC/NOLOGIN HOLD.
- `economicDecisions`: exactly `worldIdentity`, `currencyBinding`, `titleAndRiskBinding`, `treasuryCentralBankTreatment`, `depositLiabilityReconciliation`, `equityReconciliation`. Each has the same World ID, a record SHA256 and declared decision `APPROVED` in production-shaped mode or `FIXTURE_NOT_APPROVAL` in fixture mode. The tool does not interpret an economic choice or authenticate an approver. C/Root must supply independently reviewed actual decision records later; selected-source ownership does not substitute for these decisions.
- `runtime`: same World ID, distinct API and sole writer principal references, and exact true declarations of `singleWriter`, `noBrowserWriter`, `withdrawStopsAdmission`, `killStopsDispatch`, `preserveCommittedHistory`. These are checked document claims, not observed operational controls. No process is started, withdrawn, killed or rolled back.

`independentReview` has a record SHA256, declared `TECHNICAL_GO` (or `FIXTURE_NOT_APPROVAL`) and `candidateSha256`. The latter must match SHA256 of JSON for the recursively lexically key-sorted candidate, preserving array order. The review envelope is excluded to avoid circular hashing. This binds the reference to the whole submitted candidate; it does not verify the review record's bytes, signature, reviewer, timestamp or authority. A matching digest or caller-provided APPROVED string never grants approval.

## Invocation and safe interpretation

Pass a caller-owned document on stdin to `node scripts/world-v2-economic-launch-preflight.mjs`. Add only `--fixture` for the synthetic fixture test mode. Do not paste credentials or old environment contents. The CLI has no filenames, URLs, environment overrides, execute/SQL/launch options or output-file mode.

Missing/invalid/conflicting inputs return `HOLD` with an allowlisted code, no input echo. A complete fixture returns only `FIXTURE_NOT_APPROVAL` (fixture CLI exit 0). Complete production-shaped claims return `OFFLINE_MANIFEST_COMPLETE_AUTHORITY_UNVERIFIED`, `referencedBytesVerified=false`, `currentDatabaseStateVerified=false`, and `productionDisposition=HOLD_SEPARATE_B_REVIEW_AND_ROOT_AUTHORIZATION_REQUIRED`; default/production CLI always exits 1. All outcomes have `launchAllowed=false` and no execution capability. Consequently this CLI cannot be installed as a successful production gate or bypassed by a fixture exit 0.

Document completeness is not approval, byte verification, current-state preflight, OpeningSeed admission or a release. There is deliberately no three-stage automatic runner or credential lookup. Do not transform this summary into a database/worker authorization or call the old twelve-country `public.continuous_worlds` script.

## Remaining launch conditions

The existing mapping still has worldId null and six opening blocker classes; original exact source amounts/proposals remain unchanged. Shared PUBLIC effective privileges / original DB reader NOLOGIN HOLD are not cleared by the source API or by filling a hash field. Existing `OfficialWorldOpeningBootstrapper`, authoritative Core/Worker and A's bridge remain their owners' boundaries. Root must reconcile its formal gate record separately (ADR-18 text already approves non-production isolation, not production topology).

After a fixed B review, Root may separately approve verification of actual referenced bytes and records, a fresh narrowly scoped runtime preflight, and later separately authorized seed/cutover actions. None of these actions is implemented or authorized here. Kill/withdraw/recovery must preserve committed seed, event and ledger history; no rollback/delete/repair shortcut is introduced.

Verify the fixed candidate with the 16 normal offline focused tests, typecheck, changed-file lint, format and actual automatic CI. Record tested SHA/tree separately, preserve existing release fingerprint and receipt results, hand off to Root→B, then STOP.
