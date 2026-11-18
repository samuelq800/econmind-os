# Credential Management V2: visual editor and compatibility

## Scope and delivery

This branch adds a visual editor, a bulk worksheet, a wording library, and a
sectioned administration workspace. It is a PR candidate, not a production
deployment. It does not create a member system, determine eligibility, send
mail, establish awards, change public verification, or publish official text.
The five categories and their requested subtypes are navigation structure only.
New wording versions begin as drafts and can be approved only explicitly.
Existing V1 template versions remain available and retain their V1 active state;
that state is labelled separately from V2 approval.

## Original certificate and printing

The administrator-only `get_credential_visual_assets` RPC supplies the same
private approved HTML and signature bytes used by V1. The browser checks the
existing SHA-256 digests and renders the same `certificatePrintHtml` output in a
script-disabled iframe. Editing is confined to fixed plain-text fields; paste is
reduced to text. No image, badge, watermark, fonts, spacing, geometry, embedded
HTML, or signing image is uploaded to the repository or rewritten. The existing
print/save-PDF flow and signature keys remain in use. Overflow is reported; no
font shrinking or automatic layout adjustment is applied. As in V1, the
administrator must inspect each certificate and the browser print dialog.

The isolated browser regression uses the real protected HTML and synthetic
people. It compares the pixels of the edited canvas and the existing print
renderer with identical dynamic text, exercises editing, untrusted content,
long text, both source types, both signers, CSV/XLSX, saved drafts, review, and
one landscape A4 browser PDF. It separately compares normalized certificate
markup, embedded assets, and the original stylesheets against a V1 renderer
baseline using the same test values. The private visual assets are required locally
via the existing protected locations or `CREDENTIAL_PRIVATE_TEMPLATE` and
`CREDENTIAL_PRIVATE_YALE_SIGNATURE`; they must never be committed or logged.

## Additive database extension

`20261117000000_credential_visual_editor.sql` adds private wording versions,
editor draft data, guarded RPCs, and two narrowly scoped triggers. There is no
update, deletion, reseed, or backfill of existing templates, issued credentials,
batches, counters, audit rows, or signatures. No historical migration or V1
issuance/numbering function is modified. The new draft save calls the original
V1 draft creation function. It creates an empty technical base template only
when the selected category/subtype has no active V1 base; that base is not an
approved wording version. Wording text and source references are stored
separately from official templates.

For V2 batches only, the insert trigger snapshots each recipient's final text,
wording-version reference and source into the new issued record. V1 records do
not enter this path. Updates are limited to unreviewed drafts and use optimistic
revision checks. A V2-only review guard calls the original review function after
checking the version that was previewed, preventing a concurrent edit from being
silently reviewed. The original transactional issuance function still assigns
numbers, handles duplicate acknowledgement, and provides idempotency. Issued
snapshots are not editable; corrections create a new draft using the existing
replacement rules. Incomplete placeholder text cannot be issued from a V2 batch.

Research paper source identity is saved independently from the account link.
An uploader is linked only when the article already links that account and the
author name matches; an unmatched uploader is not linked. Changing a linked
recipient display name retains the research source and account; saving requires
an explicit identity check or unlinking. This does not create a member record.

## Validation and release order

- `python3 scripts/test-credential-database.py`: disposable PostgreSQL checks
  old data, template and counter preservation, role denial, draft revision,
  wording versioning, reviewed/issued locking, issuance snapshots and release
  guard behavior.
- `python3 scripts/test-credential-concurrency.py`: disposable V1 and V2
  parallel issuance, idempotency, duplicates and replacement races.
- `python3 scripts/test-credential-v2-ui.py`: isolated browser and PDF checks;
  the legacy test entry point delegates to this suite.
- `vitest`, TypeScript, ESLint, and the static production build are run on the
  candidate separately. GitHub CI also runs the disposable database suite.

The Pages workflow runs a read-only V2 prerequisite check before exporting the
site, so merging the client without the V2 database objects does not publish a
broken editor. Review the PR and apply the additive migration through the
project's normal database release process before expecting the Pages job to
pass. This branch does not apply it. A local synthetic test is not an
admin-authenticated production test. The linked live project and production
certificate counters are not touched by this V2 development work.
