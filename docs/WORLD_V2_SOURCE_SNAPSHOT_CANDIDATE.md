# World-only source snapshot candidate

PREPARATION_ONLY / PRODUCTION_RELEASE_HOLD. Forward topology decision and
publisher-only Storage management permission are NOT_APPROVED. No credentials
were acquired; no bucket/object/ACL was created or changed; no Edge deployment.
The previous database LOGIN publisher remains independently HOLD/NOLOGIN.

The fixed 34-source manifest is derived from the existing verified DB source
reconstruction in [0021 run 36672349466](https://github.com/samuelq800/econmind-os/actions/runs/36672349466),
artifact `world-v2-api-full-reader-evidence/evidence.json`, SHA256
`9378f985d40887fc93e910fc384399c8c9a4d9af31eb9588b070f4813ec15bd6`.
Preparation pins that entire receipt, verifies all 87 original artifacts via
the existing loader, compares the frozen registry plus every DB source digest,
and emits only a non-secret plan (no source body/key). It does not repeat SQL
or reinterpret that historical receipt as current privilege approval.

The mock-only protocol creates the new `world-v2-official-source-v1` bucket and
only selection-prefix/SHA-addressed JSON objects; exact existing bytes are
idempotent, conflicts/extra keys stop, writes never upsert, unknown writes are
not retried, and all 34 objects must read back before a byte-verification result.
This result is **not** connection/deployment or ACL evidence. Public Storage
is not WORM, and raw sources bypass Edge; other 53 original artifacts/map files
are not implicitly public.

World reader source `45cfa2e7a8f28148d3195448fba2fc19f00b147b`, function tree
`4d38784bf907397e2a71d0f1ff654d9e3cc3991c`, is pinned in the HOLD workflow.
Only credential-free GET with fixed hashes feeds existing server-owned DTOs;
no frontend, live World State, worker, OpeningSeed or Gate B change.

Production transport/credential acquisition and cleanup are NOT_IMPLEMENTED;
anon/ordinary-authenticated new-scope write/delete/upsert/move denial is NOT_RUN.
Official CLI remote Storage uploads obtain a service-role key internally; do
not treat a control-plane login as naturally bucket-scoped permission. A future
fixed, independently reviewed main-site publisher must explicitly authorize
publisher-only ephemeral privileges and bound their scope, evidence, cleanup,
unknown outcome and rollback before any production execution. No automatic
fallback or automatic destructive rollback exists in this candidate.
