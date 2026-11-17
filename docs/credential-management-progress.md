# Credential Management V1: browser-print status

Status: local candidate; not deployed. The user requested the basic version and
its publication after checks. The current browser-print version uses the static
website and Supabase, and does not depend on Cloudflare or a rendering worker.

The administrator can create text templates, import CSV/XLSX or select available
organization and Research Library source records, draft batches, review preview
pages, confirm a manual review, issue transactionally numbered credentials,
search history, revoke and correct records, view audits, and print an issued
certificate or save it through the browser's PDF dialog. Source selection
preserves only explicitly recorded fields; it does not infer coauthors or
contributions. Both approved signatures have the same Initial Founder title.

The visual template and signatures are kept in a private database table behind
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

The organization roster candidate must be reconciled before it is activated;
the new directory is initially empty and inactive. Research sources use the
existing guarded backend data. No production migration or website publication
has been completed for this candidate.
