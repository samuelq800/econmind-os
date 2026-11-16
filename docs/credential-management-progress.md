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

## Required before release

- Reconcile and import the Team page's current appointments, retain all public
  page fields and existing functionality, and connect the public page and its
  administration tables to the same directory. Verify activation and deletion.
- Build the superme-only administration UI, source pickers, full search and
  export, manual entry, spreadsheet import, and audit/history management.
- Build an authorized private rendering service using the exact approved HTML,
  original badge and original private signature. Never publish the signature in
  static assets. Preserve the baseline and verify overflow without resizing.
- Implement the trusted renderer which must attest a successful preview and
  overflow checks before the database allows issuance. The local test harness
  simulates this attestation; it does not test an actual render.
- Implement PDF/ZIP generation, job progress, retries, replacement history,
  private storage, end-to-end authorization and visual/PDF regression tests.
- Wire Research Library and directory changes to the source pickers and verify
  live behavior with the actual Supabase Realtime and RLS configuration.
- Review database migrations and deployed environment prerequisites; this
  branch does not authorize production migration or deployment.

## Local database checks

`python3 scripts/test-credential-concurrency.py` creates and tears down a
disposable local PostgreSQL instance. It runs role/numbering checks, then tests
parallel issuance and duplicate submissions. `scripts/test-organization-directory.sql`
must likewise be run only in a fresh disposable PostgreSQL instance.

Verified locally on 2026-11-16: the normal Next.js production build generated
488 static pages; TypeScript and scoped lint passed; the two focused Vitest
files passed (4 tests); disposable PostgreSQL tests passed for admin/anonymous
access, directory visibility, numbering and revocation; 12 concurrent batches
with duplicate submissions produced exactly 12 distinct numbers. No production
database, worker or site deployment was performed.
