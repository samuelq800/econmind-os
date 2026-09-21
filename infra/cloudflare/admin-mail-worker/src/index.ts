import PostalMime, { type Address, type Email } from "postal-mime";
import { compile } from "html-to-text";

export const OFFICIAL_MAILBOX = "admin@econmind.group";
export const MAX_RAW_BYTES = 2 * 1024 * 1024;
export const MAX_BODY_CHARS = 100_000;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_ATTACHMENTS = 100;
const INGEST_TIMEOUT_MS = 10_000;
const HTML_FALLBACK = "HTML-only email. Original message was forwarded to management.";
const TRUNCATED = "\n[Inbox copy truncated. Full message is in the forwarded management copy.]";

export type InboundPayload = {
  envelope_from: string;
  envelope_to: string;
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  internet_message_id: string | null;
  in_reply_to: string | null;
  references_ids: string[];
  sent_at: string | null;
  received_at: string;
  raw_sha256: string;
  attachments: { filename: string; content_type: string; size: number }[];
  attachment_count: number;
  has_attachments: boolean;
};

// Pure formatter configuration is shared; no request data is kept globally.
const htmlToText = compile({
  wordwrap: false,
  limits: { maxInputLength: MAX_BODY_CHARS, maxDepth: 40, maxChildNodes: 5000 },
  selectors: [
    ...["script", "style", "iframe", "object", "embed", "svg", "img"].map((selector) => ({
      selector,
      format: "skip",
    })),
    { selector: "a", options: { ignoreHref: true } },
  ],
});

class CopyError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function log(code: string, metadata: Record<string, number> = {}): void {
  // Never include recipient destinations, sender, subject, body, error.message, or credentials.
  console.log(JSON.stringify({ component: "admin-mail-worker", code, ...metadata }));
}

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value);
}

function forwardDestinations(secret: string | undefined): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(secret ?? "");
  } catch {
    throw new Error("management_forwarding_configuration_invalid");
  }
  if (!Array.isArray(parsed)) throw new Error("management_forwarding_configuration_invalid");
  const addresses: string[] = [];
  let invalidCount = 0;
  for (const item of parsed) {
    const address = typeof item === "string" ? item.trim() : "";
    if (!validEmail(address) || address.toLowerCase() === OFFICIAL_MAILBOX) {
      invalidCount += 1;
      continue;
    }
    if (!addresses.includes(address)) addresses.push(address);
  }
  if (invalidCount) log("forwarding_invalid_destinations", { count: invalidCount });
  if (!addresses.length) throw new Error("management_forwarding_configuration_invalid");
  return addresses;
}

function cleanHeader(value: string | undefined | null, max: number): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function cleanBody(value: string): string {
  // PostgreSQL text/JSONB cannot contain U+0000.
  return value.replace(/\u0000/g, "");
}

function boundedText(value: string): string {
  const text = cleanBody(value);
  return text.length <= MAX_BODY_CHARS ? text : text.slice(0, MAX_BODY_CHARS - TRUNCATED.length) + TRUNCATED;
}

function mailbox(address: Address | undefined): { name: string; address: string } | null {
  return address && !address.group && validEmail(address.address) ? address : null;
}

function recipientName(addresses: Address[] = []): string | null {
  for (const address of addresses) {
    const members = address.group ?? [address];
    for (const member of members) {
      if (member.address?.toLowerCase() === OFFICIAL_MAILBOX) {
        return cleanHeader(member.name, 200) || null;
      }
    }
  }
  return null;
}

export function messageIds(value: string | undefined): string[] {
  if (!value) return [];
  // Preserve case; angle brackets are framing, not identity. Prefer nearest ancestors.
  const framed = Array.from(value.matchAll(/<([^<>\s]{1,998})>/g), (match) => match[1]);
  const candidates = framed.length ? framed : value.trim().split(/\s+/);
  return [...new Set(candidates.filter((id) => id.length <= 998 && /^[\x21-\x7e]+$/.test(id) && !/[<>]/.test(id)))].slice(-100);
}

function isoDate(value: string | undefined): string | null {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function plaintext(email: Pick<Email, "text" | "html">): string {
  if (email.text?.trim()) return boundedText(email.text);
  if (email.html) {
    try {
      const html = cleanBody(email.html);
      const converted = htmlToText(html.slice(0, MAX_BODY_CHARS)).trim();
      if (!converted) return HTML_FALLBACK;
      return boundedText(converted + (html.length > MAX_BODY_CHARS ? TRUNCATED : ""));
    } catch {
      return HTML_FALLBACK;
    }
  }
  return "[No readable text body. See the forwarded management copy.]";
}

async function readRaw(message: ForwardableEmailMessage): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isSafeInteger(message.rawSize) || message.rawSize <= 0 || message.rawSize > MAX_RAW_BYTES) {
    throw new CopyError("copy_raw_size_limit");
  }
  // No access, locking, teeing, or consumption of raw occurs before all forwards settle.
  const reader = message.raw.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new CopyError("copy_raw_unavailable");
      size += value.byteLength;
      if (size > MAX_RAW_BYTES) {
        await reader.cancel();
        throw new CopyError("copy_raw_size_limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  // An exhausted or partial stream must not silently become an empty Inbox message.
  if (size !== message.rawSize) throw new CopyError("copy_raw_unavailable");
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return raw;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signBody(secret: string, timestamp: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`)));
}

async function makePayload(message: ForwardableEmailMessage): Promise<InboundPayload> {
  const raw = await readRaw(message);
  let email: Email;
  try {
    email = await PostalMime.parse(raw, {
      attachmentEncoding: "arraybuffer",
      maxNestingDepth: 30,
      maxHeadersSize: 32 * 1024,
      maxRfc822NestingDepth: 0,
      forceRfc822Attachments: true,
    });
  } catch {
    throw new CopyError("copy_mime_parse_failed");
  }
  if (email.attachments.length > MAX_ATTACHMENTS) throw new CopyError("copy_attachment_count_limit");
  const from = mailbox(email.from);
  const sender = from?.address ?? (validEmail(message.from) ? message.from : null);
  // Delivery-status notifications may legally use an empty SMTP reverse path.
  // Their parsed From still needs to identify a valid mailbox for the Inbox.
  if (!sender || (message.from !== "" && !validEmail(message.from))) throw new CopyError("copy_sender_invalid");
  const attachments = email.attachments.map((attachment) => {
    if (typeof attachment.content === "string") throw new CopyError("copy_attachment_encoding_invalid");
    return {
      filename: cleanHeader(attachment.filename, 255) || "unnamed attachment",
      content_type: cleanHeader(attachment.mimeType, 255) || "application/octet-stream",
      size: attachment.content.byteLength,
    };
  });
  return {
    envelope_from: message.from,
    envelope_to: OFFICIAL_MAILBOX,
    sender_email: sender,
    sender_name: cleanHeader(from?.name, 200) || null,
    recipient_email: OFFICIAL_MAILBOX,
    recipient_name: recipientName(email.to),
    subject: cleanHeader(email.subject, 998) || "(No subject)",
    body_text: plaintext(email),
    // Inert audit field only. The application must never render this as HTML.
    body_html: email.html ? cleanBody(email.html).slice(0, MAX_BODY_CHARS) : null,
    internet_message_id: messageIds(email.messageId)[0] ?? null,
    in_reply_to: messageIds(email.inReplyTo).at(-1) ?? null,
    references_ids: messageIds(email.references),
    sent_at: isoDate(email.date),
    received_at: new Date().toISOString(),
    raw_sha256: hex(await crypto.subtle.digest("SHA-256", raw)),
    attachments,
    attachment_count: attachments.length,
    has_attachments: attachments.length > 0,
  };
}

function ingestUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !url.pathname.endsWith("/functions/v1/ingest-admin-email")) {
      throw new Error();
    }
    return url.href;
  } catch {
    throw new CopyError("copy_ingest_configuration_invalid");
  }
}

async function ingestCopy(message: ForwardableEmailMessage, env: Env): Promise<void> {
  try {
    const url = ingestUrl(env.INBOUND_MAIL_INGEST_URL);
    if (!env.INBOUND_MAIL_WEBHOOK_SECRET || env.INBOUND_MAIL_WEBHOOK_SECRET.length < 32) {
      throw new CopyError("copy_ingest_configuration_invalid");
    }
    const body = JSON.stringify(await makePayload(message));
    if (new TextEncoder().encode(body).byteLength > MAX_JSON_BYTES) throw new CopyError("copy_json_size_limit");
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await signBody(env.INBOUND_MAIL_WEBHOOK_SECRET, timestamp, body);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-EconMind-Timestamp": timestamp, "X-EconMind-Signature": signature },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
    log(response.ok ? "copy_ingested" : "copy_ingest_http_failed", { status: response.status });
    // No response bodies or upstream error text are read or logged.
    await response.body?.cancel();
  } catch (error) {
    // Management forwarding already completed. Never reject/rethrow for a copy failure.
    log(error instanceof CopyError ? error.code : "copy_processing_failed");
  }
}

export async function handleEmail(message: ForwardableEmailMessage, env: Env, ctx: Pick<ExecutionContext, "waitUntil">): Promise<void> {
  if (message.to.toLowerCase() !== OFFICIAL_MAILBOX) {
    message.setReject("This Worker only accepts the official admin mailbox.");
    return;
  }
  let destinations: string[];
  try {
    destinations = forwardDestinations(env.MANAGEMENT_FORWARD_TO_JSON);
  } catch {
    log("management_forwarding_configuration_invalid");
    throw new Error("management_forwarding_configuration_invalid");
  }
  const forwarded = await Promise.allSettled(destinations.map(async (destination) => {
    await message.forward(destination);
  }));
  const succeeded = forwarded.filter((result) => result.status === "fulfilled").length;
  log("management_forwarding_finished", { succeeded, failed: forwarded.length - succeeded });
  if (!succeeded) {
    // Surface a forwarding failure rather than acknowledging success or consuming raw.
    // No assumption is made about Cloudflare retrying a failed email invocation.
    throw new Error("management_forwarding_failed");
  }
  ctx.waitUntil(ingestCopy(message, env));
}

export default { email: handleEmail } satisfies ExportedHandler<Env>;
