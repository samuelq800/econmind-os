import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PostalMime from "postal-mime";
import { handleEmail, MAX_BODY_CHARS, MAX_RAW_BYTES, OFFICIAL_MAILBOX, type InboundPayload } from "../src/index";
import { createIngestAdminEmailHandler, type MailStore } from "../../../../supabase/functions/_shared/admin-mail";

const env: Env = {
  MANAGEMENT_FORWARD_TO_JSON: JSON.stringify(["management-one@example.com", "management-two@example.com"]),
  INBOUND_MAIL_WEBHOOK_SECRET: "local-test-only-synthetic-secret-0123456789",
  INBOUND_MAIL_INGEST_URL: "https://project.example.com/functions/v1/ingest-admin-email",
};

const plain = [
  "From: =?UTF-8?B?5byg5LiJ?= <sender@example.com>",
  'To: "EconMind Admin" <admin@econmind.group>',
  "Subject: =?UTF-8?B?5L2g5aW9?=",
  "Message-ID: <CaseSensitive.ID@example.com>",
  "In-Reply-To: <Parent.ID@example.com>",
  "References: <Grandparent.ID@example.com> <Parent.ID@example.com>",
  "Date: Tue, 15 Sep 2026 08:30:00 +0800",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=UTF-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Hello =E4=B8=96=E7=95=8C",
].join("\r\n");

function fixture(raw: string = plain, override: Partial<ForwardableEmailMessage> = {}) {
  const bytes = new TextEncoder().encode(raw);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  const rawAccess = vi.fn(() => stream);
  const forward = vi.fn(async (destination: string) => { void destination; return { messageId: "forwarded" }; });
  const reject = vi.fn();
  const message: ForwardableEmailMessage = {
    from: "envelope@example.com",
    to: OFFICIAL_MAILBOX,
    headers: new Headers(),
    get raw() { return rawAccess(); },
    rawSize: bytes.length,
    forward,
    setReject: reject,
    reply: async () => ({ messageId: "unused" }),
  };
  // Define overrides without evaluating the original raw getter.
  Object.defineProperties(message, Object.getOwnPropertyDescriptors(override));
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil(promise: Promise<unknown>) { pending.push(promise); } };
  return { message, rawAccess, forward, reject, ctx, finish: async () => { await Promise.all(pending); } };
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function ingested(): { payload: InboundPayload; body: string; init: RequestInit } {
  const init = fetchMock.mock.calls[0][1]!;
  const body = init.body as string;
  return { payload: JSON.parse(body), body, init };
}

describe("management delivery priority", () => {
  it("waits for every original forward before accessing raw MIME or starting fetch", async () => {
    const releases: (() => void)[] = [];
    const example = fixture();
    example.forward.mockImplementation(() => new Promise((resolve) => { releases.push(() => resolve({ messageId: "forwarded" })); }));
    const handling = handleEmail(example.message, env, example.ctx);
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(example.rawAccess).not.toHaveBeenCalled();
    releases[0]();
    await Promise.resolve();
    expect(example.rawAccess).not.toHaveBeenCalled();
    releases[1]();
    await handling;
    await example.finish();
    expect(example.rawAccess).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(example.reject).not.toHaveBeenCalled();
  });

  it("attempts all distinct valid destinations even when one fails or one entry is invalid", async () => {
    const example = fixture();
    example.forward.mockRejectedValueOnce(new Error("private destination failure"));
    await handleEmail(example.message, {
      ...env,
      MANAGEMENT_FORWARD_TO_JSON: JSON.stringify(["one@example.com", "bad input", "two@example.com", "two@example.com", "three@example.com", OFFICIAL_MAILBOX]),
    }, example.ctx);
    await example.finish();
    expect(example.forward.mock.calls.map(([destination]) => destination)).toEqual(["one@example.com", "two@example.com", "three@example.com"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"succeeded":2,"failed":1'));
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain("private destination");
  });

  it("surfaces total forwarding failure before touching raw; it does not claim a successful copy", async () => {
    const example = fixture();
    example.forward.mockRejectedValue(new Error("private delivery failure"));
    await expect(handleEmail(example.message, env, example.ctx)).rejects.toThrow("management_forwarding_failed");
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(example.rawAccess).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", "{}", "[]", '["admin@econmind.group"]'])("does not silently accept invalid forwarding configuration %s", async (secret) => {
    const example = fixture();
    await expect(handleEmail(example.message, { ...env, MANAGEMENT_FORWARD_TO_JSON: secret }, example.ctx)).rejects.toThrow("management_forwarding_configuration_invalid");
    expect(example.rawAccess).not.toHaveBeenCalled();
  });

  it("rejects misrouted messages without forwarding to management or ingestion", async () => {
    const example = fixture(plain, { to: "other@econmind.group" });
    await handleEmail(example.message, env, example.ctx);
    expect(example.reject).toHaveBeenCalledOnce();
    expect(example.forward).not.toHaveBeenCalled();
    expect(example.rawAccess).not.toHaveBeenCalled();
  });
});

describe("MIME and signed Inbox copy", () => {
  it("decodes MIME headers/text, preserves identifier case, and signs the exact UTF-8 payload", async () => {
    const example = fixture();
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    const { payload, init, body } = ingested();
    expect(payload).toMatchObject({
      sender_email: "sender@example.com", sender_name: "张三", recipient_email: OFFICIAL_MAILBOX,
      recipient_name: "EconMind Admin", envelope_from: "envelope@example.com", envelope_to: OFFICIAL_MAILBOX,
      subject: "你好", body_text: expect.stringContaining("Hello 世界"), body_html: null,
      internet_message_id: "CaseSensitive.ID@example.com", in_reply_to: "Parent.ID@example.com",
      references_ids: ["Grandparent.ID@example.com", "Parent.ID@example.com"],
      sent_at: "2026-09-15T00:30:00.000Z", attachments: [], attachment_count: 0, has_attachments: false,
      raw_sha256: createHash("sha256").update(plain).digest("hex"),
    });
    const headers = new Headers(init.headers);
    const timestamp = headers.get("X-EconMind-Timestamp")!;
    expect(timestamp).toMatch(/^\d+$/);
    expect(headers.get("X-EconMind-Signature")).toBe(createHmac("sha256", env.INBOUND_MAIL_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex"));
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeDefined();
    expect(new Date(payload.received_at).getTime()).toBeGreaterThan(0);
  });

  it("keeps multipart text/html alternatives and attachment metadata without serializing bytes", async () => {
    const raw = [
      "From: sender@example.com", "To: admin@econmind.group", "Subject: Attached", "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="outer"', "", "--outer",
      'Content-Type: multipart/alternative; boundary="inner"', "", "--inner", "Content-Type: text/plain", "", "Plain alternative",
      "--inner", "Content-Type: text/html", "", "<p>HTML alternative</p>", "--inner--", "--outer",
      'Content-Type: application/pdf; name="report.pdf"', 'Content-Disposition: attachment; filename="report.pdf"', "Content-Transfer-Encoding: base64", "", "JVBERg==",
      "--outer", "Content-Type: image/png", "Content-Disposition: inline", "Content-ID: <logo>", "Content-Transfer-Encoding: base64", "", "YWJj", "--outer--",
    ].join("\r\n");
    const example = fixture(raw);
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    const { payload, body } = ingested();
    expect(payload.body_text).toContain("Plain alternative");
    expect(payload.body_html).toContain("<p>HTML alternative</p>");
    expect(payload.attachments).toEqual([
      { filename: "report.pdf", content_type: "application/pdf", size: 4 },
      { filename: "unnamed attachment", content_type: "image/png", size: 3 },
    ]);
    expect(payload.attachment_count).toBe(2);
    expect(payload.has_attachments).toBe(true);
    expect(body).not.toContain("JVBERg");
    expect(body).not.toContain('"content":');
  });

  it("converts HTML-only email to inert text and does not fetch links or images", async () => {
    const raw = "From: sender@example.com\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" +
      '<html><body><script>stealSecrets()</script><style>hiddenPayload</style><p>Hello &amp; welcome</p><a href="javascript:evil()">Read me</a><img src="https://tracker.example.com/pixel"><iframe>private frame</iframe></body></html>';
    const example = fixture(raw);
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(ingested().payload.body_text).toContain("Hello & welcome");
    expect(ingested().payload.body_text).toContain("Read me");
    expect(ingested().payload.body_text).not.toMatch(/stealSecrets|hiddenPayload|evil\(\)|tracker|private frame|<html>/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(env.INBOUND_MAIL_INGEST_URL);
  });

  it("shows a clear HTML-only fallback when there is no readable text", async () => {
    const example = fixture("From: sender@example.com\r\nContent-Type: text/html\r\n\r\n<img src='cid:image'><script>hidden()</script>");
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(ingested().payload.body_text).toBe("HTML-only email. Original message was forwarded to management.");
  });

  it("uses a stable raw fingerprint without Message-ID and treats nested emails as attachments", async () => {
    const raw = 'From: sender@example.com\r\nContent-Type: multipart/mixed; boundary="x"\r\n\r\n--x\r\nContent-Type: text/plain\r\n\r\nBody\r\n--x\r\nContent-Type: message/rfc822\r\n\r\nFrom: nested@example.com\r\nSubject: Nested\r\n\r\nNested body\r\n--x--';
    for (let index = 0; index < 2; index += 1) {
      const example = fixture(raw);
      await handleEmail(example.message, env, example.ctx);
      await example.finish();
    }
    const payloads = fetchMock.mock.calls.map(([, init]) => JSON.parse(init!.body as string) as InboundPayload);
    expect(payloads[0].internet_message_id).toBeNull();
    expect(payloads[0].raw_sha256).toBe(payloads[1].raw_sha256);
    expect(payloads[0].attachments[0].content_type).toBe("message/rfc822");
    expect(payloads[0].body_text).not.toContain("Nested body");
  });

  it("bounds long text visibly and falls back to a validated envelope sender", async () => {
    const example = fixture("From: invalid\r\nContent-Type: text/plain\r\n\r\n" + "x".repeat(MAX_BODY_CHARS + 100));
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(ingested().payload.sender_email).toBe("envelope@example.com");
    expect(ingested().payload.body_text).toHaveLength(MAX_BODY_CHARS);
    expect(ingested().payload.body_text).toContain("Inbox copy truncated");
  });
});

describe("copy failure isolation", () => {
  it("decodes a legacy charset without changing forwarding", async () => {
    const example = fixture("From: sender@example.com\r\nContent-Type: text/plain; charset=windows-1252\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nCaf=E9 =80");
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(ingested().payload.body_text).toContain("Café €");
  });

  it("isolates unsupported charset handling from management delivery", async () => {
    const example = fixture("From: sender@example.com\r\nContent-Type: text/plain; charset=x-unknown-fixture\r\n\r\nPlain ASCII fallback");
    await handleEmail(example.message, env, example.ctx);
    await expect(example.finish()).resolves.toBeUndefined();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(example.reject).not.toHaveBeenCalled();
  });

  it("produces exact signed payload bytes accepted by the real ingestion handler", async () => {
    const example = fixture();
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    const { init } = ingested();
    const rpc = vi.fn<MailStore["rpc"]>().mockResolvedValue({ data: { id: "fixture-message", thread_id: "fixture-thread", duplicate: false }, error: null });
    const store: MailStore = {
      getUser: async () => { throw new Error("Inbound must not use user auth"); },
      getProfile: async () => { throw new Error("Inbound must not read a profile"); },
      rpc,
    };
    const response = await createIngestAdminEmailHandler({ store, secret: env.INBOUND_MAIL_WEBHOOK_SECRET })(new Request(env.INBOUND_MAIL_INGEST_URL, init));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("mail_ingest_inbound", {
      p_message: expect.objectContaining({ internet_message_id: "CaseSensitive.ID@example.com", in_reply_to: "Parent.ID@example.com", body_text: expect.stringContaining("Hello 世界") }),
    });
  });

  it("accepts a null SMTP reverse path when the MIME From mailbox is valid", async () => {
    const example = fixture();
    Object.defineProperty(example.message, "from", { value: "" });
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(ingested().payload.envelope_from).toBe("");
    expect(ingested().payload.sender_email).toBe("sender@example.com");
  });

  it("isolates MIME parser exceptions after successful original delivery", async () => {
    vi.spyOn(PostalMime, "parse").mockRejectedValue(new Error("PRIVATE CONTENT"));
    const example = fixture();
    await handleEmail(example.message, env, example.ctx);
    await expect(example.finish()).resolves.toBeUndefined();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(example.reject).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("copy_mime_parse_failed"));
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain("PRIVATE CONTENT");
  });

  it("enforces the real MIME parser's aggregate header bound", async () => {
    const example = fixture("From: sender@example.com\r\nX-Oversized: " + "x".repeat(33 * 1024) + "\r\n\r\nBody");
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("copy_mime_parse_failed"));
  });

  it.each(["https://project.example.com/other-function", "http://project.example.com/functions/v1/ingest-admin-email", "https://user:password@example.com/functions/v1/ingest-admin-email"])("rejects unsafe ingestion configuration only after forwarding: %s", async (url) => {
    const example = fixture();
    await handleEmail(example.message, { ...env, INBOUND_MAIL_INGEST_URL: url }, example.ctx);
    await example.finish();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(example.rawAccess).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips oversized raw mail while forwarding the unchanged original", async () => {
    const example = fixture(plain, { rawSize: MAX_RAW_BYTES + 1 });
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(example.rawAccess).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds actual streamed bytes even if the claimed rawSize is smaller", async () => {
    const cancel = vi.fn();
    const oversized = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(MAX_RAW_BYTES + 1)); }, cancel,
    });
    const example = fixture(plain, { raw: oversized });
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(cancel).toHaveBeenCalledOnce();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not ingest an empty record if raw is exhausted or unavailable after forwarding", async () => {
    const exhausted = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const example = fixture(plain, { raw: exhausted });
    await handleEmail(example.message, env, example.ctx);
    await example.finish();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(example.reject).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("copy_raw_unavailable"));
  });

  it.each(["http", "network"])("does not throw, reject, or retry after ingestion %s failure", async (failure) => {
    if (failure === "http") fetchMock.mockResolvedValueOnce(new Response("PRIVATE DATABASE ERROR", { status: 503 }));
    else fetchMock.mockRejectedValueOnce(new Error("PRIVATE NETWORK ERROR"));
    const example = fixture();
    await handleEmail(example.message, env, example.ctx);
    await expect(example.finish()).resolves.toBeUndefined();
    expect(example.forward).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(example.reject).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain("PRIVATE");
  });
});
