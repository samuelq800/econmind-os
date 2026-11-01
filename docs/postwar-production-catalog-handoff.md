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
explicit twenty-two-proposal policy, including Captain, Finance, Social custody,
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

The expanded inventory now includes Finance capacity and mixed-source originals,
complete Social prefix reads, complete no-posting financial current reads, and
physical opening-history reads. `sourceRoleDeps` maps every required role to its
actual source proposal, including transitive dependencies; denied-role names and
the controlled admission session-name prefix are separate context, not enrollment.
The fixed extractor rejects a new role reference even when no object name changed.
All twenty-two entries remain source proposals; production review is `false`.
No new final SHA is selected by this policy. Use the final clean immutable World
checkout with `--candidate-sha` only after it is supplied; do not reuse an older
checkpoint as evidence for this batch.

The minimal release gaps are: finish the exact candidate check/review; review and
register an exact companion migration delta through `supabase-production`; verify
the existing bounded reader/Hyperdrive binding and actual signed admission; then
prepare the existing Cloudflare release with its previous Worker version retained.
Required configuration names are `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `RUNTIME_MODE`,
`POSTWAR_READ_CONFIGURATION_JSON`, and `POSTWAR_READER`. Names do not prove secret
presence, binding approval, disabled query caching or connection-role privileges.
The current source config still declares `RUNTIME_MODE=HOLD` and no
`POSTWAR_READER`/admitted-read configuration.

Network approval and environment publication are separate: approved GitHub access
still has unapplied cloud environment draft revision 6 and observed CONNECT 403
at `api.github.com:443`, before token permissions can be evaluated. The draft is
not published by these scripts. `api.cloudflare.com:443` additionally needs
explicit network access for provider version/settings/binding reads and, only
through the reviewed release channel, a later publication/rollback. No provider
request, network-policy change, credential request or deployment occurs here.

The nineteenth proposal adds a direct inventory-source V2 attestation and new
read version over the existing immutable inventory documents/pages. It does not
rewrite their legacy version or imply current stock. Its dependencies are the H0
bounded-reader and physical opening-history proposals. The latest Finance mixed
source proposal derives its private all-country index directly from the admitted
stored seed; it depends on Finance capacity/custody, not Social projection roles
or H0 read data as economic authority. Both additions remain unregistered and
production review is `false`.

This second candidate adds `social-intake-authorization` after Social custody,
with the separate `world_v2_social_intake_lock_reader` NOLOGIN privilege group.
Its fixed lock function uses the existing private Social owner and bounded
metadata only; the group receives function EXECUTE, with no membership enrollment
or authority/entitlement UPDATE grant to online readers. The new inventory is
23 baseline + 20 source proposals (43 files), and the delta selects 19 non-Clock
proposals. These counts belong to the second candidate, not the sealed
62261b5c/1118bd3 package or its independent evidence. No uncommitted source is
rendered or approved here.

## FX candidate: 44 source files, 20 non-Clock proposal transactions

The FX candidate extends the prior `498e01a` Social catalog. Its fixed inventory
is **23 registered baseline + 21 unregistered proposals = 44 source SQL files**.
The non-Clock review delta contains **20 proposals**. The previous 43/20/19
counts and all rendered predecessor packages remain historical evidence and are
not overwritten. `isolated-world-clock` remains the last inventory entry and is
excluded from the generated catalog target objects and non-Clock delta.

`postwar-day-one-fx-custody` directly depends on
`runtime-read-binding-storage` and `runtime-admission-publication`, plus baseline
0002 immutable history, 0011 current authorization, 0013 entitlement, and 0016
opening seed. The reviewed object inventory is:

- Three fixed NOLOGIN groups: `world_v2_day_one_fx_source_owner`,
  `world_v2_day_one_fx_source_publisher`, and
  `world_v2_day_one_fx_source_reader`.
- Four immutable/RLS tables: `postwar_day_one_fx_source_original`,
  `postwar_day_one_fx_quote_original`, `postwar_day_one_fx_source_revocation`,
  and `postwar_day_one_fx_quote_revocation`.
- Ten functions: `postwar_day_one_fx_require_role`,
  `postwar_day_one_fx_admission`, `postwar_day_one_fx_quote_canonical`,
  `publish_postwar_day_one_fx_originals`, `lock_postwar_day_one_fx_original`,
  `revoke_postwar_day_one_fx_source`, `revoke_postwar_day_one_fx_quote`,
  `lock_postwar_day_one_fx_current_authorization`,
  `lock_postwar_day_one_fx_revoked_authorization`, and
  `lock_postwar_day_one_fx_intake_binding`.

The candidate SQL constrains initial publication to H0 of the fixed new GCU
World/seed and adopted policy/receipt/source hashes. Its reader and publisher
receive fixed function EXECUTE; only the inaccessible owner reads originals.
All four new tables declare ENABLE and FORCE RLS with an exact-World owner
scope and immutable history triggers. This metadata does not prove a signature,
runtime role enrollment, 70-country quote installation, native test success,
production catalog state or deployment approval. No LOGIN, membership,
credential, balances, admission, lease or Clock is generated by this renderer.

Render an explicitly selected **clean immutable World candidate** into a new
directory, using the companion's pinned Node 24.22.1 toolchain:

```sh
bash /workspace/.cloud-setup/run.sh econmind-os bash -c '
  cd /workspace/.cloud-setup/worktrees/postwar-social-release-preflight &&
  node scripts/world-v2-postwar-production-preflight.mjs \
    --source-root /absolute/clean/world-fx-candidate \
    --output-directory /absolute/fresh/fx-catalog \
    --candidate-sha FULL_40_HEX_WORLD_SHA
'
```

This command only writes the read-only catalog query, request, expectations and
hash-bound inventory. The existing World `postwar-schema-delta.mjs` can consume
this companion policy to render a separate 20-transaction review package; it
also executes no SQL, excludes Clock, and records transaction/failure recovery
boundaries rather than promising an automatic global rollback. Actual schema
installation and any production release remain separate, unapproved actions.

## Decimal validator forward-fix: 45 source files, 21 non-Clock transactions

The next candidate adds `financial-posting-decimal-validation` before FX custody:
**23 unchanged registered baseline + 22 unregistered proposals = 45 source SQL
files**, with **21 non-Clock transactions**. The prior 44/21/20 FX review package
remains immutable historical evidence. Clock is still excluded.

This is an explicit collision with the already installed
`world_v2.validate_financial_posting_payload(jsonb,world_v2.financial_posting_batch)`
from `0009_world_v2_posting_payload_integrity`, not a new function slot. The 0009
artifact remains byte-identical, SHA-256
`88d54a0abccc91e23a1384c5cff4fe2918671169db6e2c67fc9a6440a6cdfa11`.
The new proposal has no tables or roles. It uses CREATE OR REPLACE to correct
only the double-backslash decimal separator to `[.]`; the amount precision,
positive-value, exact balance, account, currency, counterparty and canonical
shape checks remain byte-identical. Its immutable source SHA-256 is
`dde9725df3ad327f52ffb85686c4eae2a3d21cfbf08e65eed6a1047da363ff82`.

`namedFunctionReplacements` records the exact qualified signature, 0009 dependency,
and predecessor/successor raw SQL declaration hashes. The loader verifies the
registered baseline and that the replacement changes exactly that one literal.
These are raw source hashes, **not** `pg_get_functiondef` catalog hashes; do not
compare the two representations as though their bytes were equivalent. The
catalog request includes this function name and its actual identity, owner,
definition hash and PUBLIC EXECUTE observation. Before any approved installation,
require the expected existing signature and review the actual predecessor;
missing or unexpected definitions stop the release. CREATE OR REPLACE preserves
its existing owner and EXECUTE ACL; read back both after the reviewed change.
The ordinary function-conflict stop rule remains in force, and no grant or
function-owner change is implied.

FX custody now explicitly depends on this forward-fix. The function declaration
receives its own single transaction in the review delta. A failure before known
COMMIT may roll back only that transaction; prior commits remain. An uncertain
COMMIT stops without retry, and committed outcomes require a separately reviewed
forward-fix. Neither the old migration checksum nor existing sealed evidence is
rewritten. Isolated native evidence is tracked separately: actual posting or
quote observations do not convert a whole-test failure, or a source-only package,
into a native or production PASS.

## Mixed FX current-read companion policy (final World SHA pending)

This revision inventories **23 registered baseline + 31 unregistered source
proposals = 54 SQL files**, with **30 non-Clock proposal transactions**. It
selects no final World commit (`sourceCommit: null`, `finalCandidateSelected:
false`) and does not render or replace a sealed candidate package. In particular,
the previous 078/checkpoint package remains predecessor evidence. The immutable
World SHA and exact source bytes must still be supplied to the existing renderer
from a clean checkout before any new review package exists.

The nine additions are separate from the older H0/no-posting paths:

| Proposal | Required predecessor proposals | Fixed function / permission difference |
| --- | --- | --- |
| `postwar-social-startup-seed-header` | Social custody | `lock_social_startup_seed_header(text,text)`; existing Social owner computes the actual stored seed SHA at startup, source reader gets metadata EXECUTE, never raw payload SELECT. |
| `postwar-finance-social-source-publication` | Finance mixed source + Social custody | Three exact publication/verification signatures; existing Finance/Social publishers and owners only. The fixed cfc country derivation manifest is data provenance, not a signature or role enrollment. |
| `postwar-day-one-fx-history-read` | FX custody + Social custody + Finance custody | One eleven-text-argument committed-quote reader under a new inaccessible NOLOGIN history owner. Existing three source-reader groups receive EXECUTE only; private exact-World SHARE locks use owner column grants with `WITH CHECK(false)`, not runtime UPDATE. |
| `postwar-mixed-current-projection-read` | Complete Social prefix, FX custody/history and startup header | Six exact signatures and two append-only derived page tables. Bounded reader gets only the six-argument page function; publisher gets fixed Social publication. Complete Budget/Social/FX frames and actual posting hashes distinguish current global head from the last Social state origin. |
| `postwar-mixed-financial-current-publication` | New mixed-current store + existing financial bounded originals | One three-text-argument publisher. Finance/CB derived balances, TGA/GCU and reservation capacity use the same genuine replay snapshot and independently checked SQL originals; no reader financial-table SELECT or old no-posting fallback. |
| `postwar-social-mixed-match-publisher` | Existing MATCH, FX custody/history and startup header | `publish_social_operating_mixed_match_due(text,text,text,text)` uses the existing fixed Social publisher and canonical queue path, complete prefix and pending-plan binding. It does not authorize an actor or depend on a UI cache. |
| `postwar-bounded-journal-read` | Committed FX history reader | `read_postwar_bounded_journal(text,text,text)` reuses the inaccessible history owner; only Social/Finance source readers get EXECUTE. Exact held head/admission/host/permit, maximum H256, 512 batches, 64KiB each/1MiB total and nonzero-inventory refusal; no raw reader table grants. |
| `postwar-bounded-prefix-read` | Bounded journal reader | `read_postwar_bounded_prefix(text,text,text)` reuses the history owner/journal locks, returning complete World command/event/COMMITTED-receipt sets. Only Social/Finance source readers get EXECUTE; no raw table grants or country/family filtering. |
| `postwar-office-recovery-read` | H0 metadata reader + Social intake authorization + Finance/FX custody groups | `read_postwar_office_recovery_binding(text,uuid,text,text,text,text,text,text)` is nonlocking READ ONLY metadata under the existing projection owner. EXECUTE goes to actual intake privilege groups: Finance budget reader, FX reader and **Social intake lock reader**, not Social source reader. Exact command capability remains required. |

The JSON policy contains each full qualified signature, owner, SECURITY DEFINER
mode, fixed `pg_catalog` search path, PUBLIC EXECUTE expectation and named
EXECUTE groups. The source extractor rejects signature, owner and execution-mode
drift. The render-only catalog query adds exact-signature OID observations,
missing roles, actual named-role EXECUTE, unexpected direct EXECUTE grantees and
owner/mode/search-path observations. These observations do not prove approval,
cryptographic admission, credentials, connection bindings or successful runtime
execution. Inherited memberships still require the separate role observations
and owner review. No source function body or application row is returned.

Historical committed FX is deliberately different from new settlement: later
quote expiry/revocation does not erase an already COMMITTED event/receipt/quote
binding. A new FX command must still pass the unchanged current custody gate.
The old no-posting current paths remain closed when their assumptions fail;
new current publication is absent/unsupported rather than a fabricated EMPTY or
an H0 balance relabeled as current.

Rollback review is metadata only. Each addition records pre/post signature,
owner/ACL, policy and trigger hash checks, and a separate operational prerequisite:
stop new publication, drain the one consumer/borrowers as applicable, inventory
queued/FINAL outcomes, and preserve all immutable originals, publications and
economic history. A known uncommitted transaction can roll back only itself.
An uncertain COMMIT stops for readback, without blind retry. After committed FX
or MATCH, do not delete events, restore pre-FX balances, drop required history
readers, or start another consumer to bypass a queue head. Release reversal or
forward repair requires its own reviewed companion channel. This tool emits no
rollback DDL and grants no approval to execute one.

The journal baseline tables `financial_posting_batch` and `inventory_posting`
do **not** have RLS enabled. This additive proposal does not globally enable it.
Its exact-World/host/permit checks run inside the fixed definer; the reused owner
remains NOLOGIN with no members, and operational readers lack raw table grants.
The new policy declarations alone are not an RLS isolation claim. Catalog and
rollback review must check actual relrowsecurity flags, function identity/ACL,
owner flags/memberships and direct reader privileges together. A role enrollment
or raw SELECT workaround would change that boundary and is not authorized here.

The complete-prefix addition holds the existing journal H/admission/host/permit
locks, checks up to 256 events, commands and COMMITTED receipts, and retains all
unknown/correction/foreign-country frames for strict Core replay. It bounds raw
event payloads at 64KiB and raw command payloads at 16KiB; serialized history
plus raw financial payloads must fit 1MiB. Returned data is not a replay-ready or
authority token. A missing, oversized or incomplete prefix closes; rollback
cannot substitute a raw reader SELECT grant, discard frames or alter versions.
The catalog request also observes baseline command_submission/command_receipt
metadata for these explicit owner column grants. Final World SHA remains pending.

The recovery metadata function fixes the READ ONLY-to-row-lock incompatibility
without granting a write/lock capability to recovery. It checks exact JWT subject,
World/country/office, seat and revision, **command** capability, entitlement and
immutable admission/permit. An arbitrary office capability or the generic seat
header is insufficient. Existing Finance/Treasury intake pools already use the
Finance-budget/FX groups; Social intake uses its separate intake-lock group and
must never gain Social source-reader membership as a workaround. The original
legacy mode remains default until the explicit postwar recovery option is set.
Rollback requires draining recovery requests and retaining submissions, queues
and FINAL receipts; missing metadata cannot prove a write did not commit.
