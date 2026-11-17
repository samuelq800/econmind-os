# Credential Management V1: browser-print status

Status: local candidate; not deployed. The user requested the basic version and
its publication after checks. The current browser-print version uses the static
website and Supabase, and does not depend on Cloudflare or a rendering worker.

The administrator can create text templates, import CSV/XLSX or select available
organization and Research Library source records, draft batches, review preview
pages, confirm a manual review, issue transactionally numbered credentials,
search history, revoke and correct records, view audits, and print an issued
certificate or save it through the browser's PDF dialog. Source selection
preserves article author names and linked article accounts. Name mismatches
require an administrator confirmation; coauthors and contributions are not
inferred. Both approved signatures have the same Initial Founder title.

The visual template and signatures are intended for a private database table behind
an active-superme-only RPC and checked against approved digests in the browser.
The template is rendered with scripts disabled; user-supplied text is inserted
as text, not HTML. Browser fonts and print settings can vary: manual inspection
of each preview and print dialog remains necessary. Print is reauthorized and
revoked credentials cannot be reopened for printing.

Local checks include disposable PostgreSQL role checks, numbering and race
conditions, frontend unit tests, isolated Next.js build and a synthetic browser
flow covering source import, real private template preview, selected signature,
overflow detection and print invocation. These do not establish live access,
production policies, real source synchronization, layout on every device, or a
complete site build. Consult `docs/credential-deployment-plan.md` for gates.

The user authorized the 26-appointment 2026-11-15 roster as a starting source;
it has not been independently verified against the current site. A production
schema rehearsal, using synthetic certificate data inside a transaction, passed
and rollback was independently confirmed. Production currently contains 15
uploaded research records; one record's author display name differs from its
linked account's current display name. No production migration, private asset
provisioning or website publication has been completed for this candidate.

The linked production project was checked on 2026-11-17. The source tables and
the existing superme authorization function are present, with two active
superme administrators. No credential or organization-directory objects were
present before the rehearsal; all rehearsed objects were absent afterwards.
The exact public-site full build, deployment pipeline, authenticated live
workflow and source activation have not been checked on this candidate.
