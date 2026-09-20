import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasRequiredPageRole, pageAccessForPath } from "@/lib/platform/access-control";
import { mailSenderName, mailStatusLabel, replySubject, validatedMailDraft, type MailDraft } from "@/lib/mail/admin-mail";

const { invoke, from } = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => ({ functions: { invoke }, from }),
  throwIfSupabaseError: (error: { message: string } | null) => { if (error) throw new Error(error.message); },
}));
import { getLatestInboundMessage, listMailInbox, listSentMail, listThreadMessages, MailSendError, sendAdminMail } from "@/lib/supabase/admin-mail";

const requestId = "0e19868c-637b-4593-bb83-25a0d858d8f7";
const threadId = "fd048c4f-c105-49f2-845d-6546e18d6842";
const draft = { to: "recipient@example.com", subject: "Official correspondence", message: "A plain-text message." };

function queryMock(data: unknown[] = []) {
  const result = { data, error: null };
  const query = {
    select: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error: null }),
  };
  from.mockReturnValue(query);
  return query;
}

beforeEach(() => vi.clearAllMocks());

describe("Mail Terminal access and compose", () => {
  it("restricts the route to platform administrators including direct URLs", () => {
    const policy = pageAccessForPath("/admin/mail");
    expect(policy.audience).toBe("account");
    expect(hasRequiredPageRole(policy, "student", "platform_admin")).toBe(true);
    expect(hasRequiredPageRole(policy, "teacher", "school_leader")).toBe(false);
    expect(hasRequiredPageRole(policy, "guest", null)).toBe(false);
    expect(pageAccessForPath("/econmind-os/admin/mail/").platformRoles).toEqual(["platform_admin"]);
  });

  it("validates one recipient and trims plain-text fields", () => {
    expect(validatedMailDraft({ to: ` ${draft.to} `, subject: " Subject ", message: " Message " })).toEqual({ to: draft.to, subject: "Subject", message: "Message" });
    for (const to of ["a@example.com,b@example.com", "a@example.com; b@example.com", "Alice <a@example.com>", "invalid", "a@example.com\nBcc:b@example.com"]) {
      expect(() => validatedMailDraft({ ...draft, to })).toThrow(/one recipient/);
    }
    expect(() => validatedMailDraft({ ...draft, subject: "  " })).toThrow();
    expect(() => validatedMailDraft({ ...draft, subject: "x".repeat(201) })).toThrow();
    expect(() => validatedMailDraft({ ...draft, subject: "Heading\r\nHeader" })).toThrow();
    expect(() => validatedMailDraft({ ...draft, message: "x".repeat(20_001) })).toThrow();
    expect(() => validatedMailDraft({ ...draft, threadId: "not-a-thread" })).toThrow();
  });

  it("normalizes reply subjects without stacking Re prefixes", () => {
    expect(replySubject("Re: RE: Re: Meeting")).toBe("Re: Meeting");
    expect(replySubject("Meeting")).toBe("Re: Meeting");
    expect(replySubject("x".repeat(200))).toHaveLength(200);
  });

  it("uses canonical display names and distinguishes acceptance from delivery", () => {
    expect(mailSenderName("  David Zhang ")).toBe("David Zhang · EconMind");
    expect(mailSenderName("invalid\nname")).toBe("EconMind Admin · EconMind");
    expect(mailSenderName("\nDavid Zhang")).toBe("EconMind Admin · EconMind");
    expect(mailSenderName("x".repeat(81))).toBe("EconMind Admin · EconMind");
    expect(mailSenderName(null)).toBe("EconMind Admin · EconMind");
    expect(mailStatusLabel("accepted")).toBe("Accepted by Brevo");
    expect(mailStatusLabel("delivered")).toBe("Delivered");
  });
});

describe("browser mail transport", () => {
  it("sends only allowed payload fields and places the logical UUID in a header", async () => {
    const result = { ok: true, messageId: "message-id", threadId, status: "accepted" };
    invoke.mockResolvedValue({ data: result, error: null });
    const tampered = { ...draft, threadId, senderName: "Impersonation", senderEmail: "wrong@example.com", actorUserId: "fake", role: "platform_admin", requestId } as MailDraft;
    expect(await sendAdminMail(tampered, requestId)).toEqual(result);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("send-admin-email", {
      body: { ...draft, threadId }, headers: { "X-EconMind-Request-Id": requestId },
    });
  });

  it("never retries an ambiguous network failure", async () => {
    invoke.mockRejectedValue(new Error("network interrupted"));
    await expect(sendAdminMail(draft, requestId)).rejects.toMatchObject({ ambiguous: true });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("preserves the failed status and a pending warning without claiming delivery", async () => {
    invoke.mockResolvedValue({ data: { ok: true, messageId: "message-id", threadId, status: "pending", warning: "Verify before sending again." }, error: null });
    await expect(sendAdminMail(draft, requestId)).resolves.toMatchObject({ status: "pending", warning: "Verify before sending again." });
    invoke.mockResolvedValue({ data: { ok: true, messageId: "message-id", threadId, status: "failed", duplicate: true }, error: null });
    await expect(sendAdminMail(draft, requestId)).resolves.toMatchObject({ status: "failed" });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("reads structured HTTP failures without treating a known rejection as uncertain", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ ok: false, code: "provider_rejected", message: "Brevo rejected this email." }), { status: 502 }) } });
    await expect(sendAdminMail(draft, requestId)).rejects.toMatchObject({ name: "MailSendError", ambiguous: false, code: "provider_rejected" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("treats unreadable HTTP failures as uncertain and makes no second call", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response("bad gateway", { status: 502 }) } });
    await expect(sendAdminMail(draft, requestId)).rejects.toBeInstanceOf(MailSendError);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("paginates Inbox by last activity and Sent by outbound direction without reading HTML", async () => {
    const query = queryMock(Array.from({ length: 26 }, (_, index) => ({ id: String(index) })));
    const inbox = await listMailInbox(1);
    expect(query.not).toHaveBeenCalledWith("last_inbound_at", "is", null);
    expect(query.order).toHaveBeenCalledWith("last_message_at", { ascending: false });
    expect(query.range).toHaveBeenCalledWith(25, 50);
    expect(inbox.rows).toHaveLength(25);
    expect(inbox.hasMore).toBe(true);
    await listSentMail();
    expect(query.eq).toHaveBeenCalledWith("direction", "outbound");
    expect(query.select.mock.calls.at(-1)?.[0]).not.toContain("body_html");
  });

  it("reads older thread pages and independently selects the latest inbound sender", async () => {
    const query = queryMock([{ sender_email: "latest@example.com" }]);
    await listThreadMessages(threadId, 2);
    expect(query.range).toHaveBeenCalledWith(50, 75);
    expect(query.eq).toHaveBeenCalledWith("thread_id", threadId);
    const latest = await getLatestInboundMessage(threadId);
    expect(latest?.sender_email).toBe("latest@example.com");
    expect(query.eq).toHaveBeenCalledWith("direction", "inbound");
    expect(query.limit).toHaveBeenCalledWith(1);
  });
});

describe("Mail Terminal static and content safety boundaries", () => {
  const ui = readFileSync("components/admin/mail-terminal.tsx", "utf8");
  const adapter = readFileSync("lib/supabase/admin-mail.ts", "utf8");
  it("renders plaintext and metadata with no HTML injection or browser history writes", () => {
    expect(ui).not.toContain("dangerouslySetInnerHTML");
    expect(ui).not.toContain("body_html");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    expect(ui).toContain("Attachments are available in the forwarded management copy.");
    expect(adapter).not.toContain("api.brevo.com");
  });
  it("requires native accessible confirmation and synchronously locks double clicks", () => {
    expect(ui).toContain("element?.showModal()");
    expect(ui).toContain('aria-labelledby="mail-confirm-title"');
    expect(ui).toContain("sending.current = true");
    expect(ui).toContain("requestId.current ??= crypto.randomUUID()");
    expect(ui).toContain("Keep the composer mounted");
    expect(readFileSync("app/admin/mail/page.tsx", "utf8")).not.toContain("use server");
  });
});
