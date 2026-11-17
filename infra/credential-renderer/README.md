# Private credential renderer — development draft

This is retained only as a local visual-test reference. The current release
uses browser printing, and its former export/verification job migrations were
removed. Do not deploy or enable this service as part of the browser-print
release; the instructions below describe an unfinished future option.

This remains a draft: do not deploy until the migrations, private bucket
policies, authorization, concurrency and live integration have been reviewed
and verified against the target Supabase environment. The service and worker
have local tests but have not been exercised against production Supabase.

The service reads its approved HTML and Yale signature from private files;
neither file belongs in this repository, a public bucket, or static site assets.
The original Samuel signature is embedded in the approved private HTML. Both
signatures have the title `EconMind Initial Founder`. The template and Yale PNG
must match the digests in `render.mjs`; update versions rather than overwriting
an asset used by an issued credential.

For future deployment, supply `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CREDENTIAL_ALLOWED_ORIGIN`,
`CREDENTIAL_PRIVATE_TEMPLATE`, and `CREDENTIAL_PRIVATE_YALE_SIGNATURE` as
private service configuration. The service-role key must never be placed in a
browser environment variable. `NEXT_PUBLIC_CREDENTIAL_RENDERER_URL` is the
non-secret browser URL. `node service.mjs` starts the HTTP service and
`node worker.mjs` starts a separate durable-job worker. Run both behind reviewed
TLS and network controls, with private persistent assets and Chromium installed.
Jobs are leased in PostgreSQL and PDF artifacts are stored in a private bucket;
the authenticated service streams ZIPs without exposing storage credentials.
Verify existing Storage RLS policies cannot grant access to the new bucket.
ZIP files can be downloaded again and failed PDFs can be retried without
allocating new credential numbers. Browser downloads currently buffer the ZIP
locally; test memory usage for the intended maximum batch.

Local tests: set `ECONMIND_PRIVATE_CERTIFICATE_TEMPLATE` and
`ECONMIND_PRIVATE_YALE_SIGNATURE` to the private asset paths, then run
`pnpm test`. Without them the visual tests are skipped. PDF metadata inspection
requires `pdfinfo`; Playwright requires an installed Chromium runtime.
