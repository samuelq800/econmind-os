import { describe, expect, it } from "vitest";
import { forwardDraft, recipientEmails, type MailMessage } from "@/lib/mail/admin-mail";

describe("mail recipient selection", () => {
  it("splits manual recipients and deduplicates school/user overlaps", () => {
    expect(recipientEmails("Alice@example.com; bob@example.com\nalice@example.com, ")).toEqual(["alice@example.com", "bob@example.com"]);
    expect(() => recipientEmails(" ")).toThrow(/at least one/);
    expect(() => recipientEmails("valid@example.com,invalid")).toThrow();
    expect(() => recipientEmails("a@example.com\r\nBcc: attacker@example.com")).toThrow();
    expect(() => recipientEmails(Array.from({ length: 501 }, (_, i) => `${i}@example.com`).join(","))).toThrow(/500/);
  });
  it("forwards plaintext with provenance, a fresh thread, and an attachment notice", () => {
    const source = { subject: "Fwd: Meeting", sender_name: "Alice", sender_email: "alice@example.com", recipient_email: "admin@econmind.group", received_at: "2026-09-21T00:00:00Z", body_text: "<script>inert</script>\nOriginal body", has_attachments: true, thread_id: "old-thread" } as MailMessage;
    const result = forwardDraft(source);
    expect(result.to).toBe("");
    expect(result.threadId).toBeUndefined();
    expect(result.subject).toBe("Fwd: Meeting");
    expect(result.message).toContain(source.body_text);
    expect(result.message).toContain("Attachments are not included");
    expect(result.message).toContain("From: Alice <alice@example.com>");
    expect(result.message).toContain("Date: 2026-09-21T00:00:00Z");
  });
});
