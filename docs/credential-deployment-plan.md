# Credential management: browser-print release plan

Status: not deployed. This initial release uses the existing static site and
Supabase; it does not use the optional private rendering service, background
jobs, Cloudflare Browser Run, batch ZIP generation or server-generated PDFs.

The approved HTML and the Yale signature are provisioned in a private database
table, never in the repository or a public bucket. Only an active superme
administrator can retrieve them. The browser checks both asset hashes, renders
in a script-disabled sandbox and allows printing or saving PDF from its print
dialog. Browser and font differences can change the result; the administrator
must inspect every certificate and the actual print preview. Manual review is
recorded as such and does not assert a server-side pixel-perfect verification.

## Release gates

1. Check the target project, migration history and existing object names.
   Independently review the selected migrations and the private asset RPC and
   existing public policies. Use a staging environment and synthetic accounts
   first, including tests for signed-out, ordinary, other-admin, suspended
   superme and active-superme users. Verify the SQL scripts and concurrent
   numbering with disposable PostgreSQL.
2. Apply only the credential research source, issuance core, organization
   directory, research Realtime and browser-print migrations in order. Provision
   the original assets using `scripts/provision-credential-print-assets.py` with
   protected environment variables and a verified database connection. Never
   put private assets or a service-role key into public website files.
3. Reconcile the candidate organization directory against the current authorized
   roster before importing or activating it. Do not enable the existing public
   Team-page integration from an unverified historical snapshot. Test actual
   Research Library and organizational-source refreshes and role boundaries.
4. In a real authenticated browser, test draft creation, CSV/XLSX import,
   source selection, both signatures, multiple recipients, long text, manual
   preview/review, issuance, non-reused numbering, print/save PDF, revocation,
   rechecking before print, and audit history. Verify exact layout and fonts on
   the supported printing devices; do not issue real certificates merely to
   test. Run the repository's required checks on the exact release commit.
5. After all checks pass, apply the reviewed changes to production, merge,
   wait for the website deployment and verify the live site and authenticated
   workflow. Report database migration and website publication separately.

If any gate fails, stop before publication. The local isolated browser test is
not evidence of live Supabase authorization or a successful deployment.
