# Mail Terminal deployment

## 2026-09-21 — Forward and recipient selection

- Each inbound/outbound message has a Forward action. It creates a fresh draft
  with the original plaintext, sender, date, subject and recipient. It does not
  reuse the original thread. Attachment binaries are unavailable in the terminal;
  the forwarded text explicitly says attachments are not included.
- To supports manual addresses, user name/email/school search, checkboxes and
  adding every user associated with a selected school. Matching uses the profile's
  school ID. Duplicate addresses are removed; sends are limited to 500 recipients.
  Schools above that limit must be split into smaller sends; they are never silently truncated.
- Each recipient receives a separate message through the existing authenticated
  send endpoint, with its own request UUID and Sent record. Keep the page open
  while sending. A failure or uncertain result stops subsequent recipients and
  shows their unattempted count. No automatic retries or bulk To disclosure.
- Applied only `20260921000000_admin_mail_recipients.sql` and its migration ledger
  entry to `vimksjrhaxdpnkvgsavz`. The directory RPC checks the canonical platform
  admin role, denies anon execution and pages results by user ID. Deleted auth
  users and users without email addresses are excluded.
- Validation: 525 tests, typecheck, lint (seven existing auction warnings),
  production export of 463 pages, isolated PostgreSQL permission/pagination tests,
  and browser checks for forwarding, school selection, deduplication, confirmation,
  double-click prevention, unknown-result stop and 390px layout. Browser email
  requests were intercepted; no real email was sent.
- Cloudflare is managed by the user for this release. No Worker deployment or
  Email Routing changes were made. Local uncommitted Worker debugging edits were
  discarded at the user's request; the tracked Worker source is retained.

## Initial deployment — 2026-09-20

The user explicitly authorized deployment after the source-only implementation.
The account dropdown entry is immediately below **Governance requests** and is
restricted to current platform administrators. The live-auction changes already
on the remote main branch were preserved during integration.

## Database and backend

- Project: Econmind OS Project (`vimksjrhaxdpnkvgsavz`).
- Applied only `20260920000200_admin_mail_terminal.sql` in a transaction, together
  with its matching migration ledger record. Its version was moved after the
  live-auction migrations to avoid a timestamp collision.
- Unrelated migration-history differences were not repaired or replayed.
- Existing profiles, roles and business records were not changed.
- Deploy the three mail functions using the existing runtime credentials;
  the normal Supabase deployment workflow now includes them for future releases.
- An isolated in-memory PostgreSQL/PGlite test executed the actual migration and
  verified duplicate guards, reply matching, event precedence, early webhook
  reconciliation, immutable history, admin reads and denied ordinary/anon access.
  It used simulated auth/profile fixtures and a built-in SHA-256 wrapper for the
  pgcrypto digest signature; multi-session race stress testing was not performed.

## Private setup

Run this locally in PowerShell; do not paste secrets or private addresses in chat:

```powershell
powershell -ExecutionPolicy Bypass -File D:\projects\econmind-os\scripts\configure-admin-mail.ps1
```

Provide a **Brevo API key**, not the SMTP password, and the **exact existing verified
management destinations**, separated by commas. The helper generates independent
HMAC and Brevo webhook secrets, uploads the Supabase secrets, and prepares the
Cloudflare secrets file. The files are ignored by Git and restricted to the
current Windows account before writing values:

- `.env.admin-mail.local`: Supabase mail secrets and the future webhook Bearer token.
- `infra/cloudflare/admin-mail-worker/.dev.vars`: only Worker HMAC, destinations and URL.

Rerunning the helper preserves previously generated signing tokens. Do not delete
the private files while completing setup or manually rotate only one side of HMAC.
No private file belongs in Git, GitHub Actions artifacts or frontend builds.

Cloudflare deployment reads the private file through Wrangler without printing it:

```powershell
cd D:\projects\econmind-os\infra\cloudflare\admin-mail-worker
pnpm exec wrangler deploy --secrets-file .dev.vars
```

Keep the current production Email Routing action unchanged until every existing
management destination has been verified with the Worker. Worker creation alone
does not route `admin@econmind.group` to it.

## Remaining activation steps

1. Finish private setup if it has not been completed.
2. Verify original management delivery through the Worker before routing cutover.
   If a pre-cutover remote test is unavailable, keep direct forwarding until a
   controlled verification path is arranged.
3. Change only the existing official-address routing action to the Worker, after
   verification. Do not change DNS/MX or create an alternative public mail address.
4. Create the Brevo transactional webhook for
   `https://vimksjrhaxdpnkvgsavz.supabase.co/functions/v1/brevo-mail-events`, choosing
   Bearer authentication. Privately copy `BREVO_WEBHOOK_TOKEN` from the ignored
   local file; do not send the token through chat.
5. Subscribe to delivery events; omit open/click tracking. Confirm the existing
   official sender/domain remains verified in Brevo.
6. Send a deliberate controlled outbound message from Mail Terminal and verify
   receipt, management forwarding, Inbox threading and delivery status.

The source-only report remains a historical record; deployment results and pending
operator steps must be communicated separately from its original No/NOT RUN table.
