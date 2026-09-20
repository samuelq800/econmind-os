# EconMind admin mail Email Worker

Source only. This task does not deploy a Worker or alter Email Routing, verified
destinations, DNS, MX, or production secrets. The official recipient remains
`admin@econmind.group`.

## Local checks

This directory is a separate pnpm workspace. Its pinned MIME/parser/Worker
dependencies do not enter the main Next.js dependency tree.

```powershell
cd infra/cloudflare/admin-mail-worker
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build:check
```

`build:check` runs Wrangler with `--dry-run` and writes a local bundle under the
ignored `.wrangler` directory. It does not upload or deploy anything. `pnpm typegen`
regenerates the checked-in binding declarations from the config, without real
secret values. The main repository's lint covers Worker source; its Vitest suite
is separate so a frontend-only install does not require these dependencies.

## Private operator configuration

Set these bindings privately in Cloudflare after code review:

| Binding | Meaning |
| --- | --- |
| `MANAGEMENT_FORWARD_TO_JSON` | JSON array containing the exact existing verified management destinations. Never commit actual addresses. |
| `INBOUND_MAIL_WEBHOOK_SECRET` | At least 32 characters of securely generated secret shared only with Supabase ingest. |
| `INBOUND_MAIL_INGEST_URL` | HTTPS URL ending `/functions/v1/ingest-admin-email`; stored as a secret binding although the URL itself is not a credential. |

No Supabase service-role key, user JWT, or Brevo key belongs in this Worker.
Do not place values in `wrangler.jsonc`, shell history, Git, or a build variable.
Ignored `.dev.vars` files are for operator-owned local configuration only; tests
use explicit synthetic fixtures and do not need these files.

## Reliability contract

1. Reject mail for any other envelope recipient.
2. Parse the secret destination array. Attempt every valid configured destination
   using Cloudflare's supported `message.forward(destination)`, with independent
   promise settlement. Invalid entries are logged as counts while valid entries
   still receive forwarding attempts. No count is hard-coded.
3. Wait for all forward attempts before accessing, teeing or reading `message.raw`,
   and before validating any Inbox configuration. If no forward succeeds, throw a
   sanitized forwarding error without consuming raw. If some succeed and others
   fail, keep the successes and log counts; no automatic resend to successes occurs.
4. Schedule the additional Inbox copy with `ctx.waitUntil`. Catch every copy error;
   no parse/ingest failure rejects mail or skips the completed management attempts.

Cloudflare officially documents forwarding to multiple verified destinations, and
its storage example uses both MIME data and `forward()`. We still do not rely on
raw being replayable: the stream is read at most once, after all forwards. An
exhausted, partial or unavailable stream skips the copy. Confirm actual remote
forwarding and Inbox behavior before routing the official mailbox to this Worker.
Local mocks cannot establish remote delivery guarantees or Cloudflare retry behavior.

Original management mail remains the recovery source if the best-effort Inbox copy
fails. V1 has no durable queue. Monitor sanitized Cloudflare codes for failed copies
and partial forwarding, and restore the prior direct forwarding route if necessary.
Configuration errors or destination rejection cannot be repaired by ingestion.

## MIME and payload limits

- Raw copy parsing: at most **2 MiB**, checked against both `rawSize` and actual
  streamed bytes; larger originals are still forwarded.
- Parser: postal-mime, max MIME depth 30 and aggregate headers 32 KiB. Nested
  `message/rfc822` messages stay attachment metadata rather than recursive bodies.
- Up to 100 attachments; metadata includes safe filename, MIME type and byte size.
  Binaries are not persisted or sent to Supabase.
- Plaintext and stored inert HTML are limited to 100,000 characters each. Text
  truncation includes a visible notice pointing to the full management copy.
- HTML-only messages use html-to-text without executing code or fetching external
  content. Script/style/iframe/object/embed/SVG/images are skipped; links become
  text. Failed/empty conversion uses an explicit management-copy fallback.
- Up to 100 canonical Message-ID references; case is preserved. No subject matching.
- Signed JSON is at most 1 MiB. The HTTPS ingestion request times out after 10 seconds
  and follows no redirects. No automatic retry is made.

The wire schema carries envelope/header identities, subject, text/inert HTML,
Message-ID, In-Reply-To, references, RFC Date, receipt time, raw SHA-256 and attachment
metadata/count. HMAC-SHA256 signs `timestamp + "." + exact JSON body`, with a
seconds timestamp and lowercase hexadecimal signature in `X-EconMind-Timestamp`
and `X-EconMind-Signature`. Supabase verifies freshness, signature and schema before
performing privileged writes. The frontend never reads or renders `body_html`.

Only structured codes/counts/HTTP status are logged. Provider response bodies,
management destinations, sender addresses, subjects, bodies, errors containing
private content, and secrets are not logged. Invocation logging is disabled.

See [the main deployment checklist](../../../docs/ADMIN-MAIL-TERMINAL.md) for the
required manual ordering and rollback. Do not switch routing until original mail
delivery to every existing verified destination has been tested remotely.

## Official references

- [Email handler and forwarding API](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/)
- [Cloudflare MIME/storage/forward example](https://developers.cloudflare.com/email-service/examples/email-routing/email-storage/)
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [postal-mime source and parsing documentation](https://github.com/postalsys/postal-mime)

The config is a skeleton without routes, account identifiers or private addresses.
