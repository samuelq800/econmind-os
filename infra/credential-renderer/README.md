# Private credential renderer — development draft

The v0.3 credential editor can use this renderer for an optional private batch
PDF ZIP download. The site also supports browser printing independently. The
`/batch-zip` route reads issued snapshots through the administrator's Supabase
session. It does not require the legacy export worker, jobs or private bucket.

The service reads its approved HTML and Yale signature from private files;
neither file belongs in this repository, a public bucket, or static site assets.
The original Samuel signature is embedded in the approved private HTML. Both
signatures have the title `EconMind Initial Founder`. The template and Yale PNG
must match the digests in `render.mjs`; update versions rather than overwriting
an asset used by an issued credential.

Supply `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CREDENTIAL_ALLOWED_ORIGIN`,
`CREDENTIAL_PRIVATE_TEMPLATE`, and `CREDENTIAL_PRIVATE_YALE_SIGNATURE` to the
private Node process. Install this package with its lockfile and provision the
matching Playwright Chromium runtime. Run `node service.mjs` behind HTTPS and
configure `NEXT_PUBLIC_CREDENTIAL_RENDERER_URL` in the Pages build. The
endpoint renders up to 500 active certificates, with a 128 MiB aggregate PDF
limit. Configure the reverse proxy timeout for larger batches.

The legacy worker and its `/zip` job endpoint are retained for reference.
They depend on separate job migrations and require a service-role key. They
are not needed for the v0.3 batch download.

Local tests: set `ECONMIND_PRIVATE_CERTIFICATE_TEMPLATE` and
`ECONMIND_PRIVATE_YALE_SIGNATURE` to the private asset paths, then run
`pnpm test`. Without them the visual tests are skipped. PDF metadata inspection
requires `pdfinfo`; Playwright requires an installed Chromium runtime.
