import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { filterMailRecipients, isMailRecipientAddress, partitionMailRecipientDirectory, MAIL_RECIPIENT_GROUPS, recipientEmails, validatedMailBatchDraft, validatedMailDraft, type MailRecipient } from "@/lib/mail/admin-mail";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => ({ rpc }),
  throwIfSupabaseError: (error: { message: string } | null) => { if (error) throw new Error(error.message); },
}));
import { listMailRecipients } from "@/lib/supabase/admin-mail";
import { MailRecipientSelection } from "@/components/admin/mail-recipient-picker";

function row(n: number, groups: MailRecipient["groups"] = []): MailRecipient {
  return { user_id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`, display_name: `Person ${n}`, email: `person${n}@example.com`, school_id: n % 2 ? "school-a" : null, school_name: n % 2 ? "School A" : null, groups };
}
beforeEach(() => vi.clearAllMocks());

describe("Mail recipient category selection", () => {
  const directory = [row(1, ["season1_team_founders", "season1_participants", "school_participants"]), row(2, ["season1_participants", "individual_participants"]), row(3, ["school_participants"]), row(4)];
  it("unions categories without duplicate users; school and search intersect", () => {
    expect(filterMailRecipients(directory, ["season1_team_founders", "season1_participants"]).map((r) => r.user_id)).toEqual([row(1).user_id, row(2).user_id]);
    expect(filterMailRecipients(directory, ["season1_participants"], "school-a", "PERSON 1")).toEqual([directory[0]]);
    expect(filterMailRecipients(directory, [], "", "school a")).toHaveLength(2);
  });
  it("all users includes unclassified setup accounts without mislabelling them individual", () => {
    expect(filterMailRecipients(directory, [])).toHaveLength(4);
    expect(filterMailRecipients(directory, ["individual_participants"])).toEqual([directory[1]]);
  });
  it("bulk selection includes more than the first 50; preserves manual entries and deduplicates email case", () => {
    const rows = Array.from({ length: 230 }, (_, i) => row(i + 1, ["school_participants"]));
    const emails = recipientEmails(["PERSON1@example.com", "manual@example.com", ...filterMailRecipients(rows, ["school_participants"]).map((r) => r.email)].join(", "));
    expect(emails).toHaveLength(231);
    expect(emails).toContain("person230@example.com");
    expect(emails).toContain("manual@example.com");
  });
  it("never silently truncates bulk selections above 500", () => {
    expect(() => recipientEmails(Array.from({ length: 501 }, (_, i) => row(i + 1).email).join(","))).toThrow("at most 500");
  });
  it("excludes malformed legacy directory emails without blocking a valid group", () => {
    const rows = [row(1, ["season1_team_founders"]), { ...row(2, ["season1_team_founders"]), email: "legacy@local" }, { ...row(3), email: "x@y" }];
    const before = structuredClone(rows);
    const { eligible, unavailable } = partitionMailRecipientDirectory(rows);
    expect(eligible).toEqual([rows[0]]);
    expect(unavailable).toEqual(rows.slice(1));
    expect(recipientEmails(filterMailRecipients(eligible, ["season1_team_founders"]).map((r) => r.email).join(","))).toEqual([row(1).email]);
    expect(rows).toEqual(before);
    const markup = renderToStaticMarkup(createElement(MailRecipientSelection, { directory: rows, value: "", disabled: false, onChange: () => {} }));
    expect(markup).toContain("Select all users (1)");
    expect(markup).toContain("Season 1 team founders (1)");
    expect(markup).toContain("2 users excluded: invalid email addresses");
    expect(markup).toContain("legacy@local");
  });
  it("gives an address-specific batch error while retaining one-recipient server payloads", () => {
    expect(() => recipientEmails("good@example.com,legacy@local")).toThrow("Invalid recipient email address: legacy@local");
    expect(() => recipientEmails("good@example.com,legacy@local")).not.toThrow("multiple recipients are not supported");
    expect(() => validatedMailDraft({ to: "a@example.com,b@example.com", subject: "Subject", message: "Message" })).toThrow("one recipient");
    for (const address of ["a@example.com", "x@y", "legacy@local", "a@example.com\r\nBcc:x@y.com", "Name <a@example.com>"]) {
      let accepted = true;
      try { validatedMailDraft({ to: address, subject: "Validation", message: "Validation" }); } catch { accepted = false; }
      expect(isMailRecipientAddress(address)).toBe(accepted);
    }
  });
  it("reviews the selected valid category as a batch without invoking the one-recipient validator on the whole list", () => {
    const { eligible } = partitionMailRecipientDirectory([row(1), row(2), { ...row(3), email: "invalid@local" }]);
    const reviewed = validatedMailBatchDraft({ to: eligible.map((r) => r.email).join(", "), subject: "  Announcement  ", message: "  Hello everyone  " });
    expect(reviewed).toEqual({ to: "person1@example.com, person2@example.com", subject: "Announcement", message: "Hello everyone" });
    for (const to of recipientEmails(reviewed.to)) expect(validatedMailDraft({ ...reviewed, to }).to).toBe(to);
    expect(() => validatedMailBatchDraft({ ...reviewed, to: reviewed.to + ",invalid@local" })).toThrow("Invalid recipient email address: invalid@local");
    expect(() => validatedMailBatchDraft({ ...reviewed, subject: "Heading\r\nHeader" })).toThrow("Subject");
  });
  it("renders all category counts and disables selection during sending or directory failure", () => {
    const markup = renderToStaticMarkup(createElement(MailRecipientSelection, { directory, value: "manual@example.com", disabled: true, onChange: () => {} }));
    for (const group of MAIL_RECIPIENT_GROUPS) expect(markup).toContain(group.label.replaceAll("&", "&amp;"));
    expect(markup).toContain("Select all users (4)");
    expect(markup).toContain("fieldset disabled");
    expect(markup).toContain("Team founders are the original creators");
    const failed = renderToStaticMarkup(createElement(MailRecipientSelection, { directory: [], value: "", disabled: false, loadError: "Directory unavailable", onChange: () => {} }));
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Directory unavailable");
  });
});

describe("Guarded directory pagination", () => {
  it("reads every page with a stable cursor and category metadata", async () => {
    const rows = Array.from({ length: 205 }, (_, i) => row(i + 1, ["school_participants"]));
    rpc.mockResolvedValueOnce({ data: rows.slice(0, 200), error: null }).mockResolvedValueOnce({ data: rows.slice(200), error: null });
    expect(await listMailRecipients()).toEqual(rows);
    expect(rpc).toHaveBeenNthCalledWith(1, "admin_mail_recipient_directory", { p_after: null });
    expect(rpc).toHaveBeenNthCalledWith(2, "admin_mail_recipient_directory", { p_after: rows[199].user_id });
  });
  it("does not return a partial directory after a later-page failure", async () => {
    rpc.mockResolvedValueOnce({ data: Array.from({ length: 200 }, (_, i) => row(i + 1)), error: null }).mockResolvedValueOnce({ data: null, error: { message: "Access denied" } });
    await expect(listMailRecipients()).rejects.toThrow("Access denied");
  });
  it("rejects stale, repeated or unordered pages instead of looping or duplicating", async () => {
    rpc.mockResolvedValueOnce({ data: [row(2), row(1)], error: null });
    await expect(listMailRecipients()).rejects.toThrow("pagination failed");
    rpc.mockResolvedValueOnce({ data: [{ ...row(1), groups: undefined }], error: null });
    await expect(listMailRecipients()).rejects.toThrow("pagination failed");
  });
  it("surfaces server-side permission denial without a client roster fallback", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Platform administrator access required" } });
    await expect(listMailRecipients()).rejects.toThrow("Platform administrator");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
