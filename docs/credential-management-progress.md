# Credential Management V1: implementation status

This branch is a **release candidate under verification**. The user authorized
publication after checks pass, but that condition is not yet met. Do not merge,
apply production migrations, activate the shared directory, or issue real
certificates until the documented checks and deployment prerequisites pass.

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
  draft creation. CSV parsing, an XLSX fixture and an isolated browser import
  using synthetic data have passed; production integration is not yet verified.
- The private renderer checks the approved template digest, keeps the original
  default signature, optionally accepts the separately provisioned Yale
  signature only when its digest matches, and checks for text overflow.
  Local baseline PNG comparison is pixel-identical; PDF is a single landscape
  A4 page. A Node service validates the user session and guarded RPC before
  preview, layout attestation or individual PDF export; these paths have local
  mocked-auth tests, not an integrated production Supabase verification.
- Leased verification and PDF-export jobs support per-item failures and retry,
  with private PDF storage, authorized ZIP downloads and replacement history.
  These mechanisms have local tests; production integration remains unverified.

## Required before release

- Reconcile and import the Team page's current appointments, then verify its
  activation, all public fields, deletion, and admin tables in the deployed
  environment. Do not activate the unreviewed snapshot.
- Verify the superme-only administration UI, full search, spreadsheet import,
  per-recipient editing, template versions and audit/history management in a
  real browser with the intended Supabase policies.
- Provision and independently review the private rendering service, including
  both signature files, network controls, load limits and actual Supabase
  authorization. The local test harness simulates the trusted database role.
- Review and verify the implemented leased background verification/PDF jobs,
  retry, private bucket, ZIP streaming and replacement history with real
  Supabase, multiple workers, failure recovery and the intended batch size.
  The browser currently buffers downloaded ZIPs, so test peak memory usage.
- Verify Research Library and directory source pickers with actual Supabase
  Realtime and RLS configuration.
- Review database migrations and deployment prerequisites; publication is
  authorized only after the documented checks pass.

## Local database checks

`python3 scripts/test-credential-concurrency.py` creates and tears down a
disposable local PostgreSQL instance. It runs role/numbering checks, then tests
parallel issuance and duplicate submissions. `scripts/test-organization-directory.sql`
must likewise be run only in a fresh disposable PostgreSQL instance.

On the earlier foundation commit, the normal Next.js production build generated
488 static pages. After subsequent Team and administrator changes, a full
production build and authenticated end-to-end test have not been completed. An
isolated Next.js build and browser test using synthetic data passed for draft
entry, Yale signatory selection and XLSX import; it is not a full-site build.
Focused component, rendering and disposable PostgreSQL checks pass locally,
including simultaneous issuance, duplicate submissions, replacement races,
job leases, recovery and PDF retry. On 2026-11-16 the focused frontend suite
passed 11 tests, the private renderer passed 11 tests with no skips, all five
disposable PostgreSQL suites passed, and both concurrency suites passed.
The signature-switch image check confines pixel changes to the signature area.
The private renderer's baseline matches pixel-for-pixel on the local Mac, with
single-page A4 output.

On 2026-11-17 the user authorized a scoped development dependency fix and a
Next.js security update. This branch updates Next.js and its matching ESLint
configuration from 16.4.2 to 16.4.5, and overrides the TypeScript ESLint
parser's minimatch to 11.0.1. The root security check reports zero raw
advisories. Under the pinned Node 24.22.1, the focused ESLint run, six frontend
test files (11 tests), the private renderer suite (11 tests) and the isolated
Next.js build/browser test pass. Five disposable PostgreSQL suites also pass.
The isolated build is not a full-site or production integration test; the
complete release pipeline remains to be verified.
No production database, worker or site deployment was performed.
