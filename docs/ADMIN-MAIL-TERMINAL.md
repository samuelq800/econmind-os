# EconMind Admin Mail Terminal V1

Current rollout status following the user's deployment authorization is recorded
in [ADMIN-MAIL-DEPLOYMENT.md](ADMIN-MAIL-DEPLOYMENT.md). The source-only statements
below describe the original implementation phase.

This is a source-only implementation. No migration, deployment, production
configuration, real email, secret change, or Git push is part of this task.

## Architecture and authority

- Outbound: static GitHub Pages `/admin/mail` → Supabase `send-admin-email` →
  Brevo transactional email → one recipient.
- Inbound: `admin@econmind.group` → Cloudflare Email Worker → each existing
  verified management destination; after forwarding, an additional signed copy
  goes to `ingest-admin-email` → Supabase → Inbox.
- Delivery: Brevo → Bearer-authenticated `brevo-mail-events` → event ledger →
  `mail_messages` status.

`admin@econmind.group` is the only public mail identity. No enterprise mailbox,
alternative reply domain, per-thread reply address, or Brevo inbound parser is
introduced. GitHub Pages remains a static export; there are no mail API routes,
Server Actions, server runtime, or frontend provider calls.

The existing `profiles.platform_role` is the operational authority, and existing
`public.is_platform_admin(auth.uid())` controls reads. The send endpoint validates
the Bearer JWT with `auth.getUser`, then loads the caller's profile. Every current
platform admin is eligible; protected administrator UUIDs are not an allowlist
for this feature. No existing profile or role is changed.

The canonical name is `profiles.display_name` (schema limit 80 characters).
Trimmed names containing controls or invalid lengths fall back to `EconMind Admin`.
The endpoint constructs `{name} · EconMind`, fixes the sender and Reply-To to
`admin@econmind.group`, and stores the sending-time actor/name snapshot. Client
JSON accepts only `to`, `subject`, `message`, and optional `threadId`. The separate
`X-EconMind-Request-Id` header identifies a logical send; it does not set identity.

## Database source

Review `supabase/migrations/20260920000200_admin_mail_terminal.sql` independently
before any later application. It creates only new mail objects:

- `mail_threads`: subject, timestamps, inbound/outbound activity, count, latest
  sender/preview and attachment indicator.
- `mail_messages`: plaintext and optional untrusted HTML, routing and provider
  identifiers, attachments metadata, immutable sender/actor snapshot, status and
  timestamps. The actor UUID intentionally has no cascading account FK, so an
  unrelated account deletion cannot erase audit identity.
- `mail_delivery_events`: minimal deduplicated provider events, including events
  that arrive before the provider ID is saved. It stores no full payload or body.

Indexes support inbox order, per-thread chronology, Sent, Message-ID matching,
unique outbound request/provider IDs, unique inbound identity, and provider
event reconciliation. Checks constrain direction, actors, mailbox, status,
content lengths and attachment metadata arrays. Message content cannot be edited
or deleted through the history trigger. Only delivery fields and the initial
provider identity can change on outbound messages.

RLS is enabled on all three tables. `authenticated` has SELECT on threads and
messages only, further restricted to `is_platform_admin`. Ordinary accounts
cannot read mail; anonymous clients have no privileges; neither can write.
Even platform admins have no browser INSERT/UPDATE/DELETE privileges or policies.
The event ledger has no browser grants or policies. New RPCs use invoker rights;
EXECUTE is revoked from PUBLIC, anon and authenticated and granted to service_role.
There are no mail-history deletion/edit/status controls in the UI.

RPC responsibilities:

- `mail_begin_send`: canonical role recheck, transactionally creates the thread
  and pending message, serializes request UUIDs, rejects reused IDs with changed
  actor/payload and returns an existing attempt without sending again.
- `mail_complete_send`: records a confirmed acceptance or rejection and
  reconciles any early webhook events under the provider lock.
- `mail_ingest_inbound`: serializes inbound identity, deduplicates and associates
  a conversation atomically before inserting one inbound snapshot.
- `mail_apply_delivery_event` and `mail_reconcile_delivery`: persist event
  identity and apply monotone status precedence with timestamp tie-breaking.
- `mail_update_thread_summary`, `mail_preserve_message_history`, and
  `mail_delivery_rank`: scoped summary, immutability and status helpers.

## Threading and ingestion safety

Message IDs are trimmed and surrounding angle brackets removed consistently;
case is preserved. Inbound deduplication uses `mid:<Message-ID>`, or
`raw:<SHA-256 of MIME bytes>` if no ID is available. Repeating the same inbound
identity acknowledges the existing record and never increments the thread again.
Matching checks `In-Reply-To` first, then `References` from newest/rightmost to
oldest. No header match creates a new thread, even if the subject is identical.
This is conversation association, not cryptographic sender authentication.

Replies from the UI reuse the internal thread ID and default to the latest
inbound sender. Subject prefixes are normalized to one `Re:`. Standard reply
headers are not smuggled through unsupported Brevo custom options. A recipient
client may therefore display an outbound reply separately; internal conversation
history stays joined, and subsequent replies can match the saved provider ID.

The Worker signs the exact JSON bytes using HMAC-SHA256 over
`epochSeconds + "." + body`, sent as `X-EconMind-Timestamp` and
`X-EconMind-Signature`. The endpoint checks freshness, verifies the signature
with Web Crypto, validates limits/schema, and uses the service-role RPC. Old or
invalid requests are rejected; fresh duplicate deliveries are harmless no-ops.
The Worker has only the dedicated HMAC secret and forwarding configuration,
never a Supabase service-role key or Brevo key.

All inbound content is untrusted. The UI renders text through React escaping;
it does not render stored HTML, remote images, scripts, or attachment binaries.
Attachment filename/type/size/count are preserved for supported-size copies;
binary attachments remain in the original forwarded management message.
See the isolated Worker's README for MIME parsing limits and HTML conversion.

## Forwarding and known limits

The Worker calls `forward()` for all configured verified destinations and waits
for their individual outcomes before touching the MIME stream or Inbox settings.
An invalid ingestion configuration, parsing error, size limit, network failure,
HMAC failure or database error cannot skip those forwarding attempts. One failed
destination does not prevent attempts to the other destinations. Logs are limited
to event codes/counts/status, never addresses, raw messages or secrets.

Cloudflare documents multiple `forward()` calls and an example using both raw
MIME and forwarding. This implementation does not assume an infinitely replayable
stream: it forwards first, reads raw once with a byte limit, and abandons the Inbox
copy safely if raw is unavailable. The original management copy is the recovery
source. Inbox ingestion is best effort, without a durable retry queue or replay
console in V1. Oversize originals still go to management but may not get an Inbox
copy. Forwarding failures must be investigated in Cloudflare; this code cannot
guarantee delivery when Cloudflare or a destination rejects the forward.

## Sending, duplicates and delivery status

A confirmation dialog shows From, To and Subject. Both a synchronous UI lock and
disabled controls prevent double clicks. Each deliberate attempt gets one UUID;
the database guard remains authoritative beyond any provider retention window.
There is no automatic retry at the frontend, function, or provider call layer.

Brevo's dedicated idempotency guide documents JSON `headers.idempotencyKey` with
a UUID and a limited retention window. That is the provider mechanism used here,
not a guessed HTTP header. The current endpoint reference also shows a differently
spelled `Idempotency-Key` custom header; the durable local request guard is the
primary guarantee and does not depend on resolving that documentation discrepancy.
Only one provider call is made after a newly created pending record.

A successful send response means **Accepted by Brevo**, not delivered. The returned
Message-ID is saved in provider and Internet ID columns for delivery and replies.
A confirmed rejection becomes failed with a sanitized code. Timeouts, transport
errors, ambiguous server failures, invalid success responses, or a failed database
update after provider success leave pending/unknown and require manual inspection
of the Sent record and Brevo logs. Do not resend simply because a response was lost.
If the provider ID could not be stored, an unmatched delivery event is retained,
but automatic reconciliation is impossible until an operator verifies that identity;
V1 deliberately provides no resend or manual history-edit endpoint.

The future webhook requires an independent `BREVO_WEBHOOK_TOKEN`. Relevant event
aliases map request/sent→accepted, delivered, deferred, soft/hard bounce, blocked,
invalid, error→failed and spam. Opens/clicks are ignored. Identical event keys are
no-ops. Provider advisory locks close the webhook-before-send-update race.
Status precedence is pending < accepted < deferred < soft bounce < failed <
delivered < permanent failure < spam, with timestamps resolving equal priority.
This conservative rule keeps permanent failures visible and prevents delayed
accepted/deferred events from overwriting delivered. It is not a claim that every
provider event always arrives in chronological order.

## Configuration boundary

Supabase Edge Function secrets, set later by an operator:

- `BREVO_API_KEY`
- `INBOUND_MAIL_WEBHOOK_SECRET`
- `BREVO_WEBHOOK_TOKEN`
- Existing runtime `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

Cloudflare Worker secrets, set later by an operator:

- `INBOUND_MAIL_WEBHOOK_SECRET` (same signing value as Supabase)
- `MANAGEMENT_FORWARD_TO_JSON` (JSON array of the exact existing verified destinations)
- `INBOUND_MAIL_INGEST_URL` (the non-sensitive endpoint URL is stored as a Worker
  secret too, keeping the checked-in skeleton free of project-specific settings)

`INBOUND_MAIL_INGEST_URL` is non-sensitive HTTPS configuration. No actual management
address belongs in source/config/docs. There are no new NEXT_PUBLIC secrets.
The public `.env.example` remains public-only; local `.dev.vars` files and Worker
runtime output are ignored. Worker dependencies and lockfile are isolated from
the Next.js package and excluded from its TypeScript program.

## Manual production checklist — not performed by Codex

1. Review source, migration, RLS, functions and the validation report. Review
   existing migration-history drift separately; do not blindly apply unrelated
   pending migrations or reset the database.
2. Apply the reviewed mail migration to the intended Supabase project using the
   existing operator process. Verify new objects/grants without changing roles.
3. Generate a high-entropy `INBOUND_MAIL_WEBHOOK_SECRET` privately.
4. Generate a separate high-entropy `BREVO_WEBHOOK_TOKEN` privately.
5. Set the three Supabase mail secrets through the dashboard/secret prompts;
   retain runtime service credentials only in Supabase. Never put values in Git,
   shell history, frontend builds, or this task.
6. Deploy `send-admin-email`, `ingest-admin-email`, and `brevo-mail-events`.
   Follow `supabase/config.toml`: JWT gateway verification applies to send;
   ingestion and Brevo endpoints use their own cryptographic/token authentication.
7. In the Worker package, install the pinned local dependencies. Set
   `INBOUND_MAIL_INGEST_URL` to the deployed ingest function's HTTPS URL, and
   configure the HMAC secret and `MANAGEMENT_FORWARD_TO_JSON` privately.
8. Deploy the reviewed Worker through the manual Cloudflare workflow.
9. Before changing the official address routing, verify every exact existing
   verified management destination receives an original message including
   attachments. Use Cloudflare's remote Email Worker test facility where available
   with envelope recipient `admin@econmind.group`; check actual destination receipt.
   A local forwarding mock alone is insufficient. If a pre-cutover remote test is
   unavailable, keep the existing official route until a controlled validation
   path has been arranged. Do not create a new public reply identity.
10. Only after forwarding is verified, switch the existing
    `admin@econmind.group` Email Routing action from direct management forwarding
    to the Worker. Preserve the original destination configuration for rollback;
    do not change DNS/MX just to install this application feature.
11. Send one controlled inbound test and verify both management receipt and Inbox
    appearance. Test ingestion unavailable while management forwarding continues.
12. Manually configure a Brevo transactional webhook for `brevo-mail-events`
    using Bearer authentication with `BREVO_WEBHOOK_TOKEN`.
13. Subscribe only to delivery events supported by the endpoint (sent/request,
    delivered, deferred, soft/hard bounce, blocked, invalid, error if offered,
    spam). Leave open/click tracking out of this feature.
14. Confirm the existing `admin@econmind.group` sender/domain remains verified
    and valid in Brevo; no replacement sender or domain is needed.
15. Deploy the GitHub Pages frontend with the existing public Supabase variables
    and static export configuration.
16. Send one deliberately confirmed outbound test from a platform-admin account.
17. Verify Sent snapshot, recipient receipt, correct From/Reply-To, management
    receipt of the reply, Inbox appearance, header-based thread association and
    delivery-event updates. Verify an ordinary account receives 403 from send,
    cannot SELECT history, and that even admins cannot write history directly.

Rollback for an ingestion issue: restore the original direct management routing
action. Keep mail audit records. Do not bulk replay sends or reset the database.

## Primary references checked

- [Brevo send API](https://developers.brevo.com/reference/send-transac-email)
- [Brevo idempotency guide](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
- [Brevo secured webhooks](https://developers.brevo.com/docs/secured-webhooks)
- [Brevo transactional payloads](https://developers.brevo.com/docs/transactional-webhooks)
- [Cloudflare Email handler API](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/)
- [Cloudflare raw MIME and forwarding example](https://developers.cloudflare.com/email-service/examples/email-routing/email-storage/)

These references explain API choices; none of the production configuration actions
described by them was executed as part of implementation.
