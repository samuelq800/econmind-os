# Credential Management V1: implementation status

This branch is an **incomplete draft**. Do not merge, run its migrations against
production, activate the shared directory, or issue certificates from it.

## Implemented in the isolated development branch

- Uploaded Research Library source records can be read through a paginated RPC
  by an active superme administrator. Uploaders and credited authors are kept
  separate, and unstructured co-author text is not turned into identities.
- Private credential tables and guarded functions support versioned text
  templates, draft creation, review, atomic numbering, idempotent issuance,
  revocation, snapshots, and audit events. Numbering is transactional and
  shared by all subtypes within the same category and year.
- A separate organizational appointment directory supports guarded editing,
  a public/private distinction, and a separate activation flag. It starts empty
  and inactive; school team data is not treated as organizational staff data.
- A browser directory watcher coalesces refreshes and cleans up its channel.
- Team and its administrative tables can read the shared directory after
  activation, with an explicit legacy appointment link for preserving existing
  presentation data. A 2026-11-15 public snapshot is a candidate seed only;
  it must be reconciled before activation.
- A draft administrative page exposes real dashboard totals, manual drafts,
  template creation, organization/research source candidates and a two-choice
  signatory selector. Both signers have the same Initial Founder title and a
  versioned signature key is preserved with each draft and issuance. It can
  request previews, review, verify, issue and download an individual PDF when
  the separately hosted private rendering service is configured.
- CSV and XLSX import preserve per-recipient fields and support editing before
  draft creation. CSV parsing and a real XLSX fixture have focused local tests;
  the actual browser import still requires end-to-end verification.
- The private renderer checks the approved template digest, keeps the original
  default signature, optionally accepts the separately provisioned Yale
  signature only when its digest matches, and checks for text overflow.
  Local baseline PNG comparison is pixel-identical; PDF is a single landscape
  A4 page. A Node service validates the user session and guarded RPC before
  preview, layout attestation or individual PDF export; these paths have local
  mocked-auth tests, not an integrated production Supabase verification.

## Required before release

- Reconcile and import the Team page's current appointments, then verify its
  activation, all public fields, deletion, and admin tables in the deployed
  environment. Do not activate the unreviewed snapshot.
- Complete the superme-only administration UI, full search and export, richer
  template editing and audit/history management; verify browser imports and all
  per-recipient fields end to end.
- Provision and independently review the private rendering service, including
  both signature files, network controls, load limits and actual Supabase
  authorization. The local test harness simulates the trusted database role.
- Implement durable background PDF/ZIP jobs, progress, retry and replacement
  history, private storage, end-to-end authorization and broader visual/PDF
  regression tests. Synchronous verification is not suitable for large batches.
- Verify Research Library and directory source pickers with actual Supabase
  Realtime and RLS configuration.
- Review database migrations and deployed environment prerequisites; this
  branch does not authorize production migration or deployment.

## Local database checks

`python3 scripts/test-credential-concurrency.py` creates and tears down a
disposable local PostgreSQL instance. It runs role/numbering checks, then tests
parallel issuance and duplicate submissions. `scripts/test-organization-directory.sql`
must likewise be run only in a fresh disposable PostgreSQL instance.

On the earlier foundation commit, the normal Next.js production build generated
488 static pages. After subsequent Team and administrator changes, a full
production build and authenticated end-to-end test have not been completed.
Focused component, rendering and disposable PostgreSQL checks pass locally,
including 12 concurrent batches with duplicate submissions. No production
database, worker or site deployment was performed.
