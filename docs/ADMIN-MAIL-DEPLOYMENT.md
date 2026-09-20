# Mail Terminal deployment — 2026-09-20

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
