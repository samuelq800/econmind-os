# Postwar production prerequisites: render-only handoff

This candidate lives in the companion release owner's repository. It does not
register a migration, approve P0 code, obtain a credential or execute SQL.
`world-v2-postwar-production-preflight.mjs` verifies the complete clean World
commit `8cbe03cc125a0e59d380cd9198110f7e438c70ab`, exact tree, origin, all 23
registered migration bytes and six proposal hashes. It then writes a fixed,
read-only catalog request, SQL and expectation JSON to a fresh output directory.

```sh
node scripts/world-v2-postwar-production-preflight.mjs \
  --source-root /absolute/clean/world-candidate \
  --output-directory /absolute/fresh/handoff
```

The query uses a READ ONLY repeatable-read transaction and ends with ROLLBACK.
It reads PostgreSQL catalogs only: schema/table/column shape, RLS, trigger and
policy hashes, function identity/owner/security-definer/search-path/body hash,
PUBLIC execute, selected server-role flags/memberships and reader privilege
shape. It never selects application rows, identities, JWTs, seed content,
function bodies, role settings or passwords. A function definition hash is an
observation, not an automatic equivalence or release approval. Missing namespace,
roles and objects are returned as missing; no repair is attempted.

Six proposals exist in this source, but they are not six mandatory migrations:

- `runtime-read-binding-storage` is the seat/admission boundary.
- `runtime-admission-publication` depends on it and provides the controlled,
  signature-verified permit entry. SQL byte presence does not verify a signature.
- `postwar-office-derived-read` depends on both plus existing authorization and
  entitlement baseline tables; runtime receives only bounded function EXECUTE.
- `postwar-runtime-source-read-policy` is optional offline original-source
  access. Its separately reviewed `world_v2_postwar_offline_seed_reader` NOLOGIN
  group is not created by any of these proposals. Do not enroll online readers.
- `current-authorization-writer-preparation` is optional default-deny context,
  not a functioning authority publisher or a bounded-reader hard dependency.
- `isolated-world-clock` is inventoried and explicitly excluded. No Clock schema
  or start is necessary to publish these H0 read projections.

Definer owners and privilege groups remain NOLOGIN. An existing bounded login
can be considered for reuse only after actual privilege shape and its approved
connection/Hyperdrive binding are checked. The catalog boolean alone never
proves that binding or permits a login, membership, credential or grant change.
No new runtime principal is named by this handoff. Existing public dataset
reader roles are not substitutes for the bounded runtime identity.

The existing `.github/workflows/release-world-v2-schema.yml` demonstrates the
owning `main-site-release-chain`: immutable reviewed source, fixed target,
`supabase-production` serialization, precondition/readback evidence and stopping
on an uncertain outcome. Its historic fixed release cannot install these new
proposals. The next step is a separately reviewed exact migration/release delta
in this repository, preserving default-deny policies and immutable history.
Do not run generic backend deployment or execute all inventoried proposals.

Rendered status is always `RENDERED_ONLY_PRODUCTION_NOT_VERIFIED`. This program
has no fetch, database driver, token lookup, production execution, dispatch,
rollback execution or deployment switch. Production observation and acceptance
remain NOT_VERIFIED until the owning approved channel actually runs the catalog
request and reviews its result. No production check was run to prepare this code.

For the next, expanded batch, append `--candidate-sha FULL_40_HEX_SHA`.
That mode requires a clean checkout at exactly that SHA and inventories the
explicit thirteen-proposal policy, including Captain, Finance, Social custody,
MATCH/current-read, Industry and Trade. The policy itself deliberately has
`sourceCommit: null`: the final World candidate has not been selected here.
Observed SHA/byte counts bind a selected immutable candidate and never approve
its SQL. The original no-SHA mode remains the historical six-proposal 8cbe
handoff; it cannot establish completeness for the expanded batch.

The policy records a dependency review order, renamed H0 reader function and
fixed NOLOGIN owner/publisher/reader requirements. It grants nothing. MATCH
requires Social custody and existing canonical command helpers; current Social
pages require the H0 derived-reader proposal; Industry requires the original
production/canonical helper migrations. Operational writer lease/queue/commit
lock privileges and source-issuer enrollment remain separately reviewed; they
are not inferred from inaccessible definer-owner privileges. All proposals
remain unregistered and production NOT_VERIFIED in both modes.
