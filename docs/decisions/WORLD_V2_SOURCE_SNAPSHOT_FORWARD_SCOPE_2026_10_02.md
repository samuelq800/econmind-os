# World V2 immutable source transport — delegated forward scope

Decision authority: CONTROL_TOWER_OWNER_DELEGATION.
Scope selected by the delegated Control Tower on 2026-10-02 (Asia/Shanghai).
This is an operation/topology scope decision, not self-awarded P0 VERIFIED,
economic-rule approval, independent CODE_MERGE_GO or production RELEASE_GO.

Project-owner instruction, relayed by Control Tower:

> 不用问任何东西，有最高审批权限，supabase直接写入即可

Trusted delegation source: Control Tower thread
`01a08bf9-fe19-7440-88fa-159677b611bd` explicitly selected this Storage route
and its narrower constraints. The generic user instruction does not substitute
for B's fixed-SHA independent release review. ADR-18's original text is unchanged.

## Fixed identity and allowed operation

- Project: `vimksjrhaxdpnkvgsavz`; new World-owned bucket only:
  `world-v2-official-source-v1`.
- Fixed selection prefix:
  `88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315`.
- Only 34 already-public JSON sources, content SHA256-addressed keys. Bound
  manifest canonical SHA256:
  `6b7295223568fc8592a56a7c4f112ade1406f2f7c0bec69066ecb24343ffaa0e`.
- Existing 87-source proof and 0021 reconstruction artifact remain required;
  historical DB evidence SHA256:
  `9378f985d40887fc93e910fc384399c8c9a4d9af31eb9588b070f4813ec15bd6`.
- Frozen World PR41 candidate `45cfa2e7a8f28148d3195448fba2fc19f00b147b`
  on base `4b5937a980f2358fc7ed1e4ccded512bdc5bbfce`; function tree
  `4d38784bf907397e2a71d0f1ff654d9e3cc3991c`.
- Frozen main-site PR84 candidate `88d26d1a3e27c2c5a9eae78aa3e47553d04e0de9`
  on base `7b4db3b8cbdb1db86288a1172896ac9bb8febaa4`.

Create-only; existing objects must have identical hash/bytes. No upsert,
modification, delete, move or mutable latest pointer. Missing/conflicting,
partial or unknown results stop, never blind retry. Do not publish the other
53 artifacts, 203 map binaries or any unlisted object.

Only a single reviewed main-site runner may temporarily obtain/use existing
Storage administration credentials. Their ability is broad; code scoping does
not make the credential naturally bucket isolated. No value in logs, artifacts,
project secrets, browser/Edge runtime or business API; no DB URL. Official
key-reveal API acquisition occurs in memory, not via implicit CLI configuration.
No new credential is created. JS/fetch strings cannot promise secure memory
erasure; cleanup retires the capability and drops owned references in finally.

## Independent release and protected surfaces

This transport module is PARALLEL_PREPARATION, independent of unreviewed PR84.
It has no CLI, workflow or automatic execution. Only mock HTTP/disposable
fixtures are authorized now: actual key acquisition, SQL, Storage writes and
deployment remain NOT_RUN. PR41/84 heads are not modified by this preparation.
Root alone merges; E alone executes production through the approved main-site
publisher **after** fixed SHA, necessary CI, B RELEASE_GO and the actual merged
base are recorded. The old DB publisher and its HOLD remain intact.

Before any new-scope production publication, one bounded real permission
evidence collection must establish ordinary anon/authenticated write/delete/
upsert/move denial. The candidate catalog query covers only Storage objects/
buckets, their RLS flags, two ordinary roles' effective table/column privileges
and applicable policies; no data/routine-body/full-catalog read. It refuses to
guess arbitrary policies. If denial cannot be proved, submit a World-new-scope
RLS/DDL candidate via the existing unique V02 main-site chain and B review;
do not execute manual SQL or change old grants/policies.

Never modify old buckets/objects/ACLs/public/auth data/business SQL. No DB LOGIN,
OpeningSeed, World/Worker/Clock activation, second World State or Gate B claim.
Public snapshots are hash-validated source copies, not WORM or live economics.
No automatic destructive rollback is authorized or implemented.
