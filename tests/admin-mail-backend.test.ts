import { describe, expect, it, vi } from "vitest";
import {
  canonicalAdminDisplayName,
  createBrevoMailEventsHandler,
  createIngestAdminEmailHandler,
  createSendAdminEmailHandler,
  validateInboundPayload,
  type MailStore,
} from "../supabase/functions/_shared/admin-mail";
import { renderAdminMailHtml } from "../supabase/functions/_shared/mail-template";

const requestId = "10000000-0000-4000-8000-000000000001";
const actorId = "10000000-0000-4000-8000-000000000002";
const messageId = "10000000-0000-4000-8000-000000000003";
const threadId = "10000000-0000-4000-8000-000000000004";
const pending = { id: messageId, thread_id: threadId, delivery_status: "pending", provider_message_id: null, created: true };
const validSend = { to: "recipient@example.com", subject: "A message", message: "Plain text only" };
const now = Date.parse("2026-09-20T12:00:00Z");
const testSecret = "unit-test-only-inbound-signing-secret";
const testToken = "unit-test-only-brevo-webhook-token";

function mockStore() {
  return {
    getUser: vi.fn<MailStore["getUser"]>().mockResolvedValue({ user: { id: actorId }, error: null }),
    getProfile: vi.fn<MailStore["getProfile"]>().mockResolvedValue({ profile: { platform_role: "platform_admin", display_name: "David Zhang" }, error: null }),
    rpc: vi.fn<MailStore["rpc"]>().mockResolvedValue({ data: pending, error: null }),
  };
}

function sendRequest(payload: unknown = validSend, id = requestId) {
  return new Request("https://example.test/send-admin-email", { method: "POST", headers: { Authorization: "Bearer test-user-jwt", "Content-Type": "application/json", "X-EconMind-Request-Id": id }, body: JSON.stringify(payload) });
}

const inbound = {
  envelope_from: "sender@example.com", envelope_to: "admin@econmind.group",
  sender_email: "sender@example.com", sender_name: "External sender", recipient_email: "admin@econmind.group", recipient_name: null,
  subject: "Re: A message", body_text: "An external reply", body_html: null,
  internet_message_id: "<Inbound.CaseSensitive@example.com>", in_reply_to: "<Provider.CaseSensitive@brevo.example>", references_ids: ["<first@example.com>", "<Provider.CaseSensitive@brevo.example>"],
  received_at: "2026-09-20T12:00:00Z", sent_at: "2026-09-20T11:59:30Z", raw_sha256: "a".repeat(64),
  attachments: [{ filename: "notes.pdf", content_type: "application/pdf", size: 42 }], attachment_count: 1, has_attachments: true,
};

async function signedInbound(payload: unknown = inbound, options: { timestamp?: number; secret?: string; alteredBody?: string } = {}) {
  const body = JSON.stringify(payload);
  const timestamp = String(options.timestamp ?? Math.floor(now / 1000));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(options.secret ?? testSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`))), (value) => value.toString(16).padStart(2, "0")).join("");
  return new Request("https://example.test/ingest-admin-email", { method: "POST", headers: { "Content-Type": "application/json", "X-EconMind-Timestamp": timestamp, "X-EconMind-Signature": signature }, body: options.alteredBody ?? body });
}

function eventRequest(payload: unknown, token = testToken) {
  return new Request("https://example.test/brevo-mail-events", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

describe("admin mail send authorization and immutable identity", () => {
  it("rejects an ordinary authenticated account before creating history or calling Brevo", async () => {
    const store = mockStore();
    store.getProfile.mockResolvedValue({ profile: { platform_role: "student", display_name: "Student" }, error: null });
    const fetcher = vi.fn<typeof fetch>();
    const response = await createSendAdminEmailHandler({ store, brevoApiKey: "test-only", fetcher })(sendRequest());
    expect(response.status).toBe(403);
    expect(store.getUser).toHaveBeenCalledWith("test-user-jwt");
    expect(store.getProfile).toHaveBeenCalledWith(actorId);
    expect(store.rpc).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects an invalid JWT without trusting frontend identity", async () => {
    const store = mockStore();
    store.getUser.mockResolvedValue({ user: null, error: { code: "bad_jwt" } });
    const response = await createSendAdminEmailHandler({ store, brevoApiKey: "test-only" })(sendRequest());
    expect(response.status).toBe(401);
    expect(store.getProfile).not.toHaveBeenCalled();
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it.each(["sender", "senderEmail", "senderName", "replyTo", "actorUserId", "role", "headers", "htmlContent", "bcc"])("rejects client-supplied %s", async (field) => {
    const store = mockStore();
    const response = await createSendAdminEmailHandler({ store, brevoApiKey: "test-only" })(sendRequest({ ...validSend, [field]: "tampered" }));
    expect(response.status).toBe(400);
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { ...validSend, to: "a@example.com,b@example.com" },
    { ...validSend, to: "Recipient <a@example.com>" },
    { ...validSend, subject: "hello\r\nBcc: attacker@example.com" },
    { ...validSend, subject: " " },
    { ...validSend, message: " " },
    { ...validSend, message: "x".repeat(20_001) },
    { ...validSend, threadId: "bad-id" },
  ])("rejects invalid input %# before durable reservation", async (payload) => {
    const store = mockStore();
    expect((await createSendAdminEmailHandler({ store, brevoApiKey: "test-only" })(sendRequest(payload))).status).toBe(400);
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it("binds the canonical name and actor snapshot, fixes both email identities, and accepts without claiming delivery", async () => {
    const store = mockStore();
    store.rpc.mockResolvedValueOnce({ data: pending, error: null }).mockResolvedValueOnce({ data: { ...pending, delivery_status: "accepted", provider_message_id: "Provider.CaseSensitive@brevo.example" }, error: null });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ messageId: "<Provider.CaseSensitive@brevo.example>" }), { status: 201 }));
    const response = await createSendAdminEmailHandler({ store, brevoApiKey: "test-only", fetcher })(sendRequest({ ...validSend, subject: "  A message  " }));
    expect(await response.json()).toMatchObject({ ok: true, messageId, threadId, status: "accepted" });
    expect(store.rpc.mock.calls[0]).toEqual(["mail_begin_send", { p_request_id: requestId, p_actor_user_id: actorId, p_actor_display_name: "David Zhang", p_to: validSend.to, p_subject: validSend.subject, p_body_text: validSend.message, p_thread_id: null }]);
    const request = fetcher.mock.calls[0][1]!;
    expect(JSON.parse(request.body as string)).toEqual({ sender: { email: "admin@econmind.group", name: "David Zhang · EconMind" }, replyTo: { email: "admin@econmind.group", name: "EconMind" }, to: [{ email: validSend.to }], subject: validSend.subject, textContent: validSend.message, htmlContent: renderAdminMailHtml(validSend.message, "David Zhang"), headers: { idempotencyKey: requestId } });
    expect(request.headers).not.toHaveProperty("Idempotency-Key");
    expect(store.rpc.mock.calls[1]).toEqual(["mail_complete_send", { p_message_id: messageId, p_provider_message_id: "Provider.CaseSensitive@brevo.example", p_failure_code: null }]);
  });

  it("uses a safe fallback for absent, overlong, and control-character profile names", () => {
    for (const value of [null, "", " ", "x".repeat(81), "Admin\nBcc: attacker@example.com", "Admin\u0000"]) expect(canonicalAdminDisplayName(value)).toBe("EconMind Admin");
    expect(canonicalAdminDisplayName(" David Zhang ")).toBe("David Zhang");
  });

  it("has POST/OPTIONS semantics and allows the request UUID in CORS", async () => {
    const handler = createSendAdminEmailHandler({ store: mockStore(), brevoApiKey: "test-only" });
    expect((await handler(new Request("https://example.test", { method: "GET" }))).status).toBe(405);
    const preflight = await handler(new Request("https://example.test", { method: "OPTIONS" }));
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("x-econmind-request-id");
  });
});

describe("outbound failure and duplicate safety", () => {
  it("never sends twice when the durable reservation already exists", async () => {
    const store = mockStore();
    store.rpc.mockResolvedValueOnce({ data: pending, error: null }).mockResolvedValueOnce({ data: { ...pending, delivery_status: "accepted" }, error: null }).mockResolvedValueOnce({ data: { ...pending, created: false, delivery_status: "accepted" }, error: null });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ messageId: "<provider@example.com>" }), { status: 201 }));
    const handler = createSendAdminEmailHandler({ store, brevoApiKey: "test-only", fetcher });
    await handler(sendRequest());
    expect(await (await handler(sendRequest())).json()).toMatchObject({ duplicate: true, status: "accepted" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps a reused pending UUID pending without a send", async () => {
    const store = mockStore();
    store.rpc.mockResolvedValue({ data: { ...pending, created: false }, error: null });
    const fetcher = vi.fn<typeof fetch>();
    expect(await (await createSendAdminEmailHandler({ store, brevoApiKey: "test-only", fetcher })(sendRequest())).json()).toMatchObject({ status: "pending", code: "send_outcome_unknown" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([["22023", 409], ["P0002", 404], ["42501", 403]])("does not call provider on database authorization/idempotency error %s", async (code, status) => {
    const store = mockStore();
    store.rpc.mockResolvedValue({ data: null, error: { code: code as string } });
    const fetcher = vi.fn<typeof fetch>();
    expect((await createSendAdminEmailHandler({ store, brevoApiKey: "test-only", fetcher })(sendRequest())).status).toBe(status);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("records a confirmed rejection with a sanitized code and never repeats the send", async () => {
    const store = mockStore();
    store.rpc.mockResolvedValueOnce({ data: pending, error: null }).mockResolvedValueOnce({ data: { ...pending, delivery_status: "failed" }, error: null });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ code: "private provider contents", message: "private body must not escape" }), { status: 400 }));
    const response = await createSendAdminEmailHandler({ store, brevoApiKey: "test-only", fetcher })(sendRequest());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private");
    expect(store.rpc.mock.calls[1]).toEqual(["mail_complete_send", { p_message_id: messageId, p_provider_message_id: null, p_failure_code: "brevo_http_400" }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["network", "server_error", "bad_success_body", "duplicate_parameter", "database_error"])("retains pending for ambiguous %s without a second send", async (mode) => {
    const store = mockStore();
    store.rpc.mockResolvedValueOnce({ data: pending, error: null }).mockResolvedValueOnce({ data: null, error: { code: "database_unavailable" } });
    const fetcher = vi.fn<typeof fetch>();
    if (mode === "network") fetcher.mockRejectedValue(new Error("network failed"));
    else fetcher.mockResolvedValue(new Response(mode === "bad_success_body" ? "not JSON" : JSON.stringify(mode === "duplicate_parameter" ? { code: "duplicate_parameter" } : { messageId: "<provider@example.com>" }), { status: mode === "server_error" ? 503 : mode === "duplicate_parameter" ? 400 : 201 }));
    const response = await createSendAdminEmailHandler({ store, brevoApiKey: "test-only", fetcher })(sendRequest());
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ status: "pending", code: "send_outcome_unknown" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.rpc).toHaveBeenCalledTimes(mode === "database_error" ? 2 : 1);
  });

  it("returns a reconciled delivery event instead of overwriting webhook-first delivery with accepted", async () => {
    const store = mockStore();
    store.rpc.mockResolvedValueOnce({ data: pending, error: null }).mockResolvedValueOnce({ data: { ...pending, delivery_status: "delivered" }, error: null });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ messageId: "<provider@example.com>" }), { status: 201 }));
    expect(await (await createSendAdminEmailHandler({ store, brevoApiKey: "test-only", fetcher })(sendRequest())).json()).toMatchObject({ status: "delivered" });
  });
});

describe("inbound cryptographic authentication and safe data", () => {
  it("authenticates exact wire bytes and preserves IDs, MIME metadata and RFC date", async () => {
    const store = mockStore();
    store.rpc.mockResolvedValue({ data: { id: messageId, thread_id: threadId, duplicate: false }, error: null });
    const response = await createIngestAdminEmailHandler({ store, secret: testSecret, now: () => now })(await signedInbound());
    expect(response.status).toBe(200);
    expect(store.rpc).toHaveBeenCalledWith("mail_ingest_inbound", { p_message: expect.objectContaining({ internet_message_id: "Inbound.CaseSensitive@example.com", in_reply_to: "Provider.CaseSensitive@brevo.example", references_ids: ["first@example.com", "Provider.CaseSensitive@brevo.example"], attachments: inbound.attachments, has_attachments: true, sent_at: "2026-09-20T11:59:30.000Z" }) });
  });

  it.each(["wrong_secret", "tamper", "stale", "future", "unsigned"])("rejects %s before database access", async (mode) => {
    const store = mockStore();
    const options = mode === "wrong_secret" ? { secret: "different-test-secret" } : mode === "tamper" ? { alteredBody: JSON.stringify({ ...inbound, body_text: "altered" }) } : mode === "stale" ? { timestamp: Math.floor(now / 1000) - 301 } : mode === "future" ? { timestamp: Math.floor(now / 1000) + 301 } : {};
    const request = mode === "unsigned" ? new Request("https://example.test", { method: "POST", body: JSON.stringify(inbound) }) : await signedInbound(inbound, options);
    expect((await createIngestAdminEmailHandler({ store, secret: testSecret, now: () => now })(request)).status).toBe(401);
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it("returns duplicate for a retried signed identity; forwards all threading inputs to the atomic RPC", async () => {
    const store = mockStore();
    store.rpc.mockResolvedValueOnce({ data: { id: messageId, thread_id: threadId, duplicate: false }, error: null }).mockResolvedValueOnce({ data: { id: messageId, thread_id: threadId, duplicate: true }, error: null });
    const handler = createIngestAdminEmailHandler({ store, secret: testSecret, now: () => now });
    await handler(await signedInbound());
    expect(await (await handler(await signedInbound())).json()).toMatchObject({ messageId, threadId, duplicate: true });
    expect(store.rpc.mock.calls[0]).toEqual(store.rpc.mock.calls[1]);
  });

  it("rejects mailbox changes, forged actor, inconsistent attachments, and absent fingerprints", async () => {
    for (const change of [{ recipient_email: "other@example.com" }, { actor_user_id: actorId }, { attachment_count: 0 }, { raw_sha256: "" }]) {
      const store = mockStore();
      const response = await createIngestAdminEmailHandler({ store, secret: testSecret, now: () => now })(await signedInbound({ ...inbound, ...change }));
      expect(response.status).toBe(400);
      expect(store.rpc).not.toHaveBeenCalled();
    }
  });

  it("uses safe plaintext for HTML-only mail without executing or stripping through a fragile regex", () => {
    const malicious = '<script>alert("unsafe")</script><img src="https://example.com/tracker" onerror="alert(1)">';
    const parsed = validateInboundPayload({ ...inbound, body_text: "", body_html: malicious, internet_message_id: null });
    expect(parsed.body_text).toBe("HTML-only email. Original message was forwarded to management.");
    expect(parsed.body_html).toBe(malicious);
    expect(parsed.internet_message_id).toBeNull();
    expect(parsed.raw_sha256).toBe(inbound.raw_sha256);
  });

  it("limits the actual streamed request even without Content-Length", async () => {
    const store = mockStore();
    const request = new Request("https://example.test", { method: "POST", body: "x".repeat(1024 * 1024 + 1) });
    expect((await createIngestAdminEmailHandler({ store, secret: testSecret })(request)).status).toBe(413);
    expect(store.rpc).not.toHaveBeenCalled();
  });
});

describe("Brevo delivery webhook", () => {
  const event = { event: "delivered", "message-id": "<provider@example.com>", ts_event: now / 1000, id: 77, reason: "private provider data" };

  it.each(["", "incorrect-token"])("rejects missing or incorrect Bearer authentication", async (token) => {
    const store = mockStore();
    expect((await createBrevoMailEventsHandler({ store, token: testToken, now: () => now })(eventRequest(event, token))).status).toBe(401);
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it("fails closed if the configured webhook token is absent", async () => {
    const store = mockStore();
    expect((await createBrevoMailEventsHandler({ store, token: "" })(eventRequest(event, ""))).status).toBe(401);
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it.each([["request", "accepted"], ["delivered", "delivered"], ["deferred", "deferred"], ["soft_bounce", "soft_bounced"], ["hardBounce", "hard_bounced"], ["invalid_email", "invalid"], ["error", "failed"], ["spam", "spam"]])("maps %s to %s and passes only minimal metadata to transactional storage", async (providerEvent, status) => {
    const store = mockStore();
    const response = await createBrevoMailEventsHandler({ store, token: testToken, now: () => now })(eventRequest({ ...event, event: providerEvent }));
    expect(response.status).toBe(200);
    expect(store.rpc).toHaveBeenCalledWith("mail_apply_delivery_event", expect.objectContaining({ p_provider_message_id: "provider@example.com", p_status: status, p_event_at: "2026-09-20T12:00:00.000Z", p_event_key: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(JSON.stringify(store.rpc.mock.calls)).not.toContain("private provider data");
  });

  it("deduplicates a repeat using stable content identity rather than the shared webhook ID", async () => {
    const store = mockStore();
    const handler = createBrevoMailEventsHandler({ store, token: testToken, now: () => now });
    await handler(eventRequest(event));
    await handler(eventRequest(event));
    await handler(eventRequest({ ...event, event: "request", ts_event: now / 1000 - 10 }));
    expect(store.rpc.mock.calls[0][1].p_event_key).toBe(store.rpc.mock.calls[1][1].p_event_key);
    expect(store.rpc.mock.calls[2][1].p_event_key).not.toBe(store.rpc.mock.calls[0][1].p_event_key);
  });

  it("ignores open/click events and validates a whole batch before writing", async () => {
    const store = mockStore();
    const handler = createBrevoMailEventsHandler({ store, token: testToken, now: () => now });
    expect(await (await handler(eventRequest([{ event: "opened" }, { event: "click" }]))).json()).toMatchObject({ processed: 0, ignored: 2 });
    expect((await handler(eventRequest([event, { ...event, "message-id": null }]))).status).toBe(400);
    expect(store.rpc).not.toHaveBeenCalled();
  });

  it("asks the provider to retry database errors instead of acknowledging lost events", async () => {
    const store = mockStore();
    store.rpc.mockResolvedValue({ data: null, error: { code: "db_unavailable" } });
    expect((await createBrevoMailEventsHandler({ store, token: testToken, now: () => now })(eventRequest(event))).status).toBe(503);
  });
});
