# Private credential renderer — development draft

Do not deploy this service yet. It does not provide durable batch jobs, ZIP
generation, or persistent certificate storage. Preview verification currently
executes synchronously and is unsuitable for large batches.

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
browser environment variable. TLS, network access controls, durable storage,
service operations, deployment review and live authorization tests remain
required. `NEXT_PUBLIC_CREDENTIAL_RENDERER_URL` is the non-secret browser URL.

Local tests: set `ECONMIND_PRIVATE_CERTIFICATE_TEMPLATE` and
`ECONMIND_PRIVATE_YALE_SIGNATURE` to the private asset paths, then run
`pnpm test`. Without them the visual tests are skipped. PDF metadata inspection
requires `pdfinfo`; Playwright requires an installed Chromium runtime.
