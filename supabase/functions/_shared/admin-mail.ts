/** Runtime-independent mail handlers. Only the service-role adapter may write history. */
import { renderAdminMailHtml } from "./mail-template.ts";
export const OFFICIAL_MAIL_ADDRESS = "admin@econmind.group";

export const mailCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-econmind-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export function mailReply(body: Record<string, unknown>, status = 200, browser = false) {
  return new Response(JSON.stringify(body), { status, headers: browser ? mailCors : { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

type StoreError = { code?: string } | null;
export type MailStore = {
  getUser(token: string): Promise<{ user: { id: string } | null; error: StoreError }>;
  getProfile(userId: string): Promise<{ profile: { platform_role: string | null; display_name: string | null } | null; error: StoreError }>;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: StoreError }>;
};

class MailInputError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "invalid_request") { super(message); }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlCharacter = /[\u0000-\u001f\u007f]/;
const encoder = new TextEncoder();

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MailInputError("A JSON object is required.");
  return value as Record<string, unknown>;
}

function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new MailInputError("Unsupported mail fields were supplied.");
}

function string(value: unknown, max: number, label: string, allowEmpty = false) {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim())) throw new MailInputError(`Invalid ${label}.`);
  if (value.includes("\u0000")) throw new MailInputError(`Invalid ${label}.`);
  return value;
}

function header(value: unknown, max: number, label: string, allowEmpty = false) {
  const result = string(value, max, label, allowEmpty).trim();
  if (controlCharacter.test(result)) throw new MailInputError(`Invalid ${label}.`);
  return result;
}

function email(value: unknown) {
  const result = header(value, 254, "email address");
  // V1 accepts a single ordinary mailbox, never display-name syntax or a list.
  if (!/^[^\s<>(),;:@\[\]\\"]+@[^\s<>(),;:@\[\]\\"]+\.[^\s<>(),;:@\[\]\\"]+$/.test(result)) throw new MailInputError("A single valid email address is required.");
  return result;
}

export function normaliseMessageId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const result = header(value, 998, "message ID").replace(/^<([^<>]+)>$/, "$1");
  if (!result || /[\s<>]/.test(result)) throw new MailInputError("Invalid message ID.");
  return result;
}

async function boundedText(request: Request | Response, maxBytes: number): Promise<string> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new MailInputError("Mail request is too large.", 413);
  if (!request.body) throw new MailInputError("A request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new MailInputError("Mail request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes); }
  catch { throw new MailInputError("Mail request is not valid UTF-8."); }
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); }
  catch { throw new MailInputError("A valid JSON request is required."); }
}

function inputError(error: unknown, browser = false) {
  if (error instanceof MailInputError) return mailReply({ ok: false, code: error.code, message: error.message }, error.status, browser);
  // Provider bodies, SQL errors, addresses and message content are never echoed or logged.
  return mailReply({ ok: false, code: "mail_unavailable", message: "Mail service is temporarily unavailable." }, 503, browser);
}

export function canonicalAdminDisplayName(value: unknown) {
  if (typeof value !== "string" || controlCharacter.test(value)) return "EconMind Admin";
  const name = value.trim();
  return name.length >= 1 && name.length <= 80 ? name : "EconMind Admin";
}

async function requirePlatformAdmin(request: Request, store: MailStore) {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) throw new MailInputError("Authentication is required.", 401, "unauthorized");
  const auth = await store.getUser(match[1]);
  if (auth.error || !auth.user) throw new MailInputError("Your session is invalid.", 401, "unauthorized");
  const { profile, error } = await store.getProfile(auth.user.id);
  if (error) throw new Error("Profile lookup unavailable");
  if (profile?.platform_role !== "platform_admin") throw new MailInputError("Platform administrator permission is required.", 403, "forbidden");
  return { userId: auth.user.id, displayName: canonicalAdminDisplayName(profile.display_name) };
}

type SendRecord = { id: string; thread_id: string; delivery_status: string; provider_message_id?: string | null; created?: boolean };

function sendRecord(value: unknown): SendRecord {
  const row = object(value);
  if (typeof row.id !== "string" || typeof row.thread_id !== "string" || typeof row.delivery_status !== "string") throw new Error("Invalid mail persistence response");
  return row as SendRecord;
}

function sendResponse(record: SendRecord, extra: Record<string, unknown> = {}, status = 200) {
  return mailReply({ ok: true, messageId: record.id, threadId: record.thread_id, status: record.delivery_status, ...extra }, status, true);
}

function unknownSend(record: SendRecord) {
  return sendResponse(record, {
    code: "send_outcome_unknown",
    warning: "Sending outcome is uncertain. Do not send again. Check the pending record and Brevo before taking further action.",
  }, 202);
}

const providerErrorCodes = new Set(["invalid_parameter", "missing_parameter", "out_of_range", "permission_denied", "unauthorized", "not_enough_credits", "account_under_validation", "account_suspended", "document_not_found", "method_not_allowed", "too_many_requests"]);

export function createSendAdminEmailHandler(deps: { store: MailStore; brevoApiKey: string; fetcher?: typeof fetch }) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: mailCors });
    if (request.method !== "POST") return mailReply({ ok: false, message: "POST only" }, 405, true);
    try {
      const actor = await requirePlatformAdmin(request, deps.store);
      const requestId = request.headers.get("x-econmind-request-id") ?? "";
      if (!uuid.test(requestId)) throw new MailInputError("A unique mail request UUID is required.");
      const payload = object(parseJson(await boundedText(request, 128 * 1024)));
      onlyKeys(payload, ["to", "subject", "message", "threadId"]);
      const to = email(payload.to);
      const subject = header(payload.subject, 200, "subject");
      const message = string(payload.message, 20_000, "message").trim();
      const threadId = payload.threadId ?? null;
      if (threadId !== null && (typeof threadId !== "string" || !uuid.test(threadId))) throw new MailInputError("Invalid mail thread.");
      const begun = await deps.store.rpc("mail_begin_send", {
        p_request_id: requestId,
        p_actor_user_id: actor.userId,
        p_actor_display_name: actor.displayName,
        p_to: to,
        p_subject: subject,
        p_body_text: message,
        p_thread_id: threadId,
      });
      if (begun.error) {
        if (begun.error.code === "22023") throw new MailInputError("This request ID is already bound to a different message.", 409, "request_conflict");
        if (begun.error.code === "P0002") throw new MailInputError("The selected mail thread does not exist.", 404, "thread_not_found");
        if (begun.error.code === "42501") throw new MailInputError("Platform administrator permission is required.", 403, "forbidden");
        throw new Error("Cannot reserve mail request");
      }
      const record = sendRecord(begun.data);
      // The database atomically owns the UUID forever. A repeated request never calls Brevo.
      if (record.created !== true) return record.delivery_status === "pending" ? unknownSend(record) : sendResponse(record, { duplicate: true });

      let providerResponse: Response;
      try {
        providerResponse = await (deps.fetcher ?? fetch)("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          headers: { "api-key": deps.brevoApiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sender: { email: OFFICIAL_MAIL_ADDRESS, name: `${actor.displayName} · EconMind` },
            replyTo: { email: OFFICIAL_MAIL_ADDRESS, name: "EconMind" },
            to: [{ email: to }],
            subject,
            textContent: message,
            htmlContent: renderAdminMailHtml(message, actor.displayName),
            // Brevo's dedicated idempotency guide documents this JSON headers property,
            // not an HTTP Idempotency-Key. Its 30-minute TTL supplements our durable DB guard.
            // https://developers.brevo.com/docs/heterogenous-versions-batch-emails
            headers: { idempotencyKey: requestId },
          }),
        });
      } catch { return unknownSend(record); }

      let providerBody: Record<string, unknown> = {};
      try { providerBody = object(parseJson(await boundedText(providerResponse, 64 * 1024))); } catch { /* An unreadable response cannot prove delivery or rejection. */ }
      if (!providerResponse.ok) {
        // Timeouts, duplicate-key responses and server errors can follow acceptance.
        if (providerResponse.status < 400 || providerResponse.status >= 500 || [408, 409].includes(providerResponse.status) || providerBody.code === "duplicate_parameter") return unknownSend(record);
        const code = typeof providerBody.code === "string" && providerErrorCodes.has(providerBody.code) ? providerBody.code : `http_${providerResponse.status}`;
        try {
          const completed = await deps.store.rpc("mail_complete_send", { p_message_id: record.id, p_provider_message_id: null, p_failure_code: `brevo_${code}` });
          if (completed.error) return unknownSend(record);
          const failed = sendRecord(completed.data);
          return sendResponse(failed, { ok: false, code: "provider_rejected", message: "Brevo rejected this email. No retry was attempted." }, 502);
        } catch { return unknownSend(record); }
      }
      let providerMessageId: string | null;
      try { providerMessageId = normaliseMessageId(providerBody.messageId); } catch { return unknownSend(record); }
      if (!providerMessageId) return unknownSend(record);
      try {
        const completed = await deps.store.rpc("mail_complete_send", { p_message_id: record.id, p_provider_message_id: providerMessageId, p_failure_code: null });
        if (completed.error) return unknownSend(record);
        // The RPC reconciles any webhook that arrived before this acknowledgement.
        return sendResponse(sendRecord(completed.data));
      } catch { return unknownSend(record); }
    } catch (error) { return inputError(error, true); }
  };
}

function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function verifyInboundSignature(body: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()) {
  if (!secret || !timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g)!, (pair) => parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(`${timestamp}.${body}`));
}

function nullableHeader(value: unknown, max: number, label: string) { return value == null ? null : header(value, max, label, true) || null; }

function date(value: unknown, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value.length > 40 || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) throw new MailInputError("Invalid mail timestamp.");
  return new Date(value).toISOString();
}

export function validateInboundPayload(value: unknown) {
  const p = object(value);
  onlyKeys(p, ["envelope_from", "envelope_to", "sender_email", "sender_name", "recipient_email", "recipient_name", "subject", "body_text", "body_html", "internet_message_id", "in_reply_to", "references_ids", "sent_at", "received_at", "raw_sha256", "attachments", "attachment_count", "has_attachments"]);
  if (p.envelope_to !== OFFICIAL_MAIL_ADDRESS || p.recipient_email !== OFFICIAL_MAIL_ADDRESS) throw new MailInputError("Unsupported inbound mailbox.");
  if (typeof p.raw_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(p.raw_sha256)) throw new MailInputError("A raw message fingerprint is required.");
  if (!Array.isArray(p.references_ids) || p.references_ids.length > 100) throw new MailInputError("Invalid mail references.");
  if (!Array.isArray(p.attachments) || p.attachments.length > 100) throw new MailInputError("Invalid attachment metadata.");
  const attachments = p.attachments.map((entry) => {
    const item = object(entry);
    onlyKeys(item, ["filename", "content_type", "size"]);
    if (!Number.isSafeInteger(item.size) || (item.size as number) < 0 || (item.size as number) > 25 * 1024 * 1024) throw new MailInputError("Invalid attachment size.");
    return { filename: header(item.filename, 255, "attachment filename"), content_type: header(item.content_type, 255, "attachment type"), size: item.size as number };
  });
  if (p.attachment_count !== attachments.length || p.has_attachments !== (attachments.length > 0)) throw new MailInputError("Attachment metadata is inconsistent.");
  const bodyHtml = p.body_html == null ? null : string(p.body_html, 100_000, "HTML body", true);
  const bodyText = string(p.body_text, 100_000, "text body", true);
  return {
    envelope_from: header(p.envelope_from, 254, "envelope sender", true),
    envelope_to: OFFICIAL_MAIL_ADDRESS,
    sender_email: email(p.sender_email),
    sender_name: nullableHeader(p.sender_name, 200, "sender name"),
    recipient_email: OFFICIAL_MAIL_ADDRESS,
    recipient_name: nullableHeader(p.recipient_name, 200, "recipient name"),
    subject: header(p.subject, 998, "subject", true) || "(No subject)",
    body_text: bodyText.trim() ? bodyText : bodyHtml ? "HTML-only email. Original message was forwarded to management." : "(No text content)",
    body_html: bodyHtml,
    internet_message_id: normaliseMessageId(p.internet_message_id),
    in_reply_to: normaliseMessageId(p.in_reply_to),
    references_ids: [...new Set(p.references_ids.map(normaliseMessageId).filter((id): id is string => id !== null))],
    sent_at: date(p.sent_at, true),
    received_at: date(p.received_at),
    raw_sha256: p.raw_sha256,
    attachments,
    attachment_count: attachments.length,
    has_attachments: attachments.length > 0,
  };
}

export function createIngestAdminEmailHandler(deps: { store: MailStore; secret: string; now?: () => number }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return mailReply({ ok: false, message: "POST only" }, 405);
    try {
      const body = await boundedText(request, 1024 * 1024);
      if (!await verifyInboundSignature(body, request.headers.get("x-econmind-timestamp"), request.headers.get("x-econmind-signature"), deps.secret, deps.now?.())) throw new MailInputError("Invalid inbound signature or timestamp.", 401, "unauthorized");
      const payload = validateInboundPayload(parseJson(body));
      // Atomic dedupe by Message-ID, or raw SHA-256 when the original lacks one,
      // makes valid retries harmless; the signature window rejects stale replays.
      const result = await deps.store.rpc("mail_ingest_inbound", { p_message: payload });
      if (result.error) throw new Error("Cannot ingest mail");
      const row = object(result.data);
      return mailReply({ ok: true, messageId: row.id, threadId: row.thread_id, duplicate: row.duplicate === true });
    } catch (error) { return inputError(error); }
  };
}

export async function constantTimeTokenEquals(actual: string, expected: string) {
  // SHA-256 fixes both buffers to 32 bytes, avoiding a length-dependent early exit.
  const [left, right] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(actual)), crypto.subtle.digest("SHA-256", encoder.encode(expected))]);
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

const deliveryStatuses: Record<string, string> = {
  request: "accepted", sent: "accepted", delivered: "delivered", deferred: "deferred",
  softBounce: "soft_bounced", soft_bounce: "soft_bounced", hardBounce: "hard_bounced", hard_bounce: "hard_bounced",
  blocked: "blocked", invalid: "invalid", invalid_email: "invalid", error: "failed", spam: "spam",
};

export function createBrevoMailEventsHandler(deps: { store: MailStore; token: string; now?: () => number }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return mailReply({ ok: false, message: "POST only" }, 405);
    try {
      const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
      if (!deps.token || bearer.length > 1024 || !await constantTimeTokenEquals(bearer, deps.token)) throw new MailInputError("Webhook authorization is required.", 401, "unauthorized");
      const parsed = parseJson(await boundedText(request, 1024 * 1024));
      const events = Array.isArray(parsed) ? parsed : [parsed];
      if (events.length < 1 || events.length > 100) throw new MailInputError("Invalid webhook batch size.");
      // Validate the complete batch before persisting any event. We never retain the full webhook payload.
      const updates = events.map((value) => {
        const event = object(value);
        const status = typeof event.event === "string" && Object.hasOwn(deliveryStatuses, event.event) ? deliveryStatuses[event.event] : undefined;
        if (!status) return null; // Open/click/unsubscribe and other irrelevant events are ignored.
        const providerMessageId = normaliseMessageId(event["message-id"]);
        if (!providerMessageId) throw new MailInputError("A provider message ID is required.");
        const time = event.ts_event ?? event.ts;
        if (typeof time !== "number" || !Number.isSafeInteger(time) || time < 0 || time * 1000 > (deps.now?.() ?? Date.now()) + 300_000) throw new MailInputError("Invalid delivery event timestamp.");
        return { providerMessageId, status, eventAt: new Date(time * 1000).toISOString(), failureCode: ["soft_bounced", "hard_bounced", "blocked", "invalid", "failed", "spam"].includes(status) ? `brevo_${status}` : null };
      });
      let processed = 0;
      for (const update of updates) {
        if (!update) continue;
        // Brevo's `id` is a webhook ID, not a unique event ID. Hash stable event identity instead.
        const eventKey = hex(await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify([update.providerMessageId, update.status, update.eventAt]))));
        const result = await deps.store.rpc("mail_apply_delivery_event", { p_provider_message_id: update.providerMessageId, p_status: update.status, p_event_at: update.eventAt, p_event_key: eventKey, p_failure_code: update.failureCode });
        if (result.error) throw new Error("Cannot record delivery event");
        processed++;
      }
      return mailReply({ ok: true, processed, ignored: events.length - processed });
    } catch (error) { return inputError(error); }
  };
}
