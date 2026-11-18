# Credential handoff v0.3

This change extends the existing Credential Management editor and keeps the
current certificate HTML and private signature assets. It adds the four
categories SUP, CLB, PRT and GSP. The original five category prefixes, the
transaction that allocates certificate numbers, and existing issued records
use their current formats and data. Changes to issued information use the
existing revoke and replace workflow.

## Import and review

After the V2 and v0.3 database migrations have been applied, sign in as an
active superme platform administrator and open **Credential Management →
Wording Library → Import v0.3 wording library**. Select the JSON file from the
supplied handoff package. The import creates 46 Draft versions and 25 private
references. It uses one database transaction and can be retried. The same
handoff version will not create duplicates, change approval statuses, or create
any certificate numbers. The Word book is the editorial reference. This public
repository contains synthetic test copy only.

Review a wording, then explicitly approve it before use. Archived reference
wordings have no approval or issuance controls. Existing legacy records and
ordinary V1 template history remain accessible. For a Distinction, you can add an
achievement or approval reference for each recipient in the editor.
Review every preview and use the existing confirmation and issuance controls
only after recipient eligibility and issuance authorization are established.

## Research sources

The picker reloads the protected Supabase catalog each time it opens. It also
updates on the existing Research Library change signal, with polling as a
fallback. Selecting a candidate reads the current paper by ID. A known primary
byline can prefill a recipient. Coauthors are verified individually against the
source text, and a matching account is attached to the primary author only if
the uploader account matches the displayed author. Unstructured or ambiguous
bylines require a confirmed exact name in the source. Non-published statuses
require explicit review. Neither Featured nor library inclusion confers an
award.

Use **Refresh from source** on a draft whose paper changed, then reverify the
author. A reviewed batch with changed sources can be revised as a new draft.
Issuance checks the current paper and stores its confirmed metadata and the
final text with the issued credential. An earlier issued record is independent
of subsequent paper edits. Organization presets consult the matching role in
the current Team directory and label a static Team fallback when needed. The
credential directory query returns no contact fields.

## PDF and ZIP

Use **Print / Save PDF** for any active issued certificate. Batch ZIP downloads
are also available when the existing private renderer is configured. The
renderer generates numbered PDFs from issued snapshots and checks current
superme access and revocation status before sending the archive. The endpoint
does not need a Supabase service-role key or a storage bucket. Configure the
HTTPS service URL through the Pages build variable
`NEXT_PUBLIC_CREDENTIAL_RENDERER_URL`. The website keeps browser printing
available when a renderer is not configured. See
[renderer setup](../infra/credential-renderer/README.md).

## Verification and rollout

- Run `python3 scripts/test-credential-database.py` for the disposable database
  suite. Set `CREDENTIAL_HANDOFF_TEST_CATALOG` to a private copy of the supplied
  JSON to exercise the exact handoff text as well as the synthetic fixtures.
- Run `python3 scripts/test-credential-concurrency.py` to verify the original
  sequencing and retry guarantees.
- Run `python3 scripts/test-credential-v2-ui.py` with the approved local assets
  for the isolated browser baseline and print checks.
- Run `node --test infra/credential-renderer/test/service.test.mjs` with the
  renderer dependencies installed for access, snapshot and ZIP regression
  checks.

The website release checks the two database migrations before deployment.
The PR does not deploy Pages, apply production SQL, import wording into
production, approve copy, or issue production certificates.
