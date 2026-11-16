# Credential Management V1 deployment plan

Status: **not deployed**. The user authorized publication after checks pass.
The website cannot use the credential renderer until an appropriate private
Node.js + Chromium host is available and the complete release checks pass. Do
not merge this draft merely to publish a partial UI.

## Before production

1. Use a separate staging Supabase project and synthetic accounts. Apply the
   credential migrations there in timestamp order, including the export and
   verification jobs. Run `python3 scripts/test-credential-database.py` and
   both credential concurrency scripts against disposable local PostgreSQL.
2. Reconcile `supabase/seeds/organization_directory_snapshot_20261115.sql`
   against the current approved public appointments. It is an older candidate,
   not a current authoritative roster. Do not activate the directory until all
   groups, names, positions, ordering, and legacy links have been checked.
3. Review every existing Storage policy affecting `storage.objects`. Confirm
   that `credential-pdfs` is private, permits no anonymous or ordinary-user
   access and that no broad pre-existing policy exposes its files.
4. Provision a private service and worker with Node.js and Chromium. Configure
   the environment variables documented in `infra/credential-renderer/README.md`.
   Supply the approved certificate HTML and both signature versions through
   private files or equivalent protected secret storage, never public assets.
5. On the target runtime, run the visual baseline test with the private HTML and
   signatures. The runtime must reproduce the approved baseline exactly; the
   renderer refuses to claim jobs or produce individual previews/PDFs if the
   baseline digest differs. Fonts and browser rasterization can differ between
   hosts, so a successful macOS test does not establish Linux visual parity.
6. On staging, verify anonymous, signed-out, ordinary, other-admin, suspended
   superme and active-superme cases. Exercise an imported multi-recipient batch,
   every preview, duplicate acknowledgment, asynchronous verification, issuance,
   PDF jobs, worker restart/lease recovery, a failed item and retry, private ZIP
   retrieval, revocation, correction, and audit history. Verify 500-recipient
   limits and browser ZIP memory use under the expected load.
7. Verify Team and Research Library live updates with staged Supabase Realtime;
   inspect mobile and desktop layouts and test all relevant existing paths.
   Confirm CI's full frozen-install, security, typecheck, lint, test and static
   export checks pass on the exact release commit.

## Production sequence after all checks pass

1. Take a recoverable database backup. Check for naming conflicts and existing
   bucket policies. Apply the reviewed migrations in order; do not import or
   activate the Team seed yet. Confirm direct client writes and anonymous access
   are denied and the live site remains healthy.
2. Provision and verify the private service, worker, original template and
   signature assets. Confirm the target visual-baseline gate, health/monitoring,
   and private bucket access before exposing its HTTPS endpoint.
3. Set the non-secret GitHub variable `NEXT_PUBLIC_CREDENTIAL_RENDERER_URL` to
   that verified endpoint. The static Pages workflow passes it into the build.
   Never put a service-role key in a `NEXT_PUBLIC_` variable.
4. Import the reconciled directory, check the result and explicitly activate it
   through the guarded RPC. Verify the live Team page and admin tables before
   treating the database as the public source.
5. Merge the reviewed PR, wait for the exact GitHub Pages deployment to succeed,
   then verify the live assets and authenticated administrator workflow. Do not
   label a CI pass or a merge alone as publication.

If any stage fails, stop before the next stage. The initial release must not
issue real credentials merely to test the system.
