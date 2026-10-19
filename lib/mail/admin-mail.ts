/** Browser-safe mail presentation and validation. Sender authority stays on the server. */
export const OFFICIAL_MAIL_ADDRESS = "admin@econmind.group";
export const MAIL_PAGE_SIZE = 25;

export type MailDeliveryStatus = "received" | "pending" | "accepted" | "delivered" | "deferred" | "soft_bounced" | "hard_bounced" | "blocked" | "invalid" | "failed" | "spam";
export type MailAttachment = { filename: string; content_type: string; size: number };
export type MailThread = {
  id: string;
  subject: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  message_count: number;
  last_message_preview: string;
  last_sender_email: string | null;
  last_sender_name: string | null;
  has_attachments: boolean;
};
export type MailMessage = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_text: string;
  body_html?: string | null;
  delivery_status: MailDeliveryStatus;
  actor_user_id: string | null;
  actor_display_name: string | null;
  has_attachments: boolean;
  attachments: MailAttachment[];
  created_at: string;
  received_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  request_id: string | null;
  provider_message_id: string | null;
};
export type MailDraft = { to: string; subject: string; message: string; threadId?: string };
export type MailPage<T> = { rows: T[]; hasMore: boolean };

export const MAIL_RECIPIENT_GROUPS = [
  { id: "season1_team_founders", label: "Season 1 team founders" },
  { id: "season1_participants", label: "Season 1 participants" },
  { id: "season1_team_members", label: "Season 1 team members" },
  { id: "season1_free_agents", label: "Season 1 free agents" },
  { id: "school_participants", label: "School participants" },
  { id: "individual_participants", label: "Individual participants" },
  { id: "school_leaders", label: "School leaders" },
  { id: "teachers_professors", label: "Teachers & professors" },
] as const;
export type MailRecipientGroup = typeof MAIL_RECIPIENT_GROUPS[number]["id"];
export type MailRecipient = { user_id: string; display_name: string | null; email: string; school_id: string | null; school_name: string | null; groups: MailRecipientGroup[] };

/** Categories combine as a union; school and search further narrow that union. */
export function filterMailRecipients(rows: MailRecipient[], groups: MailRecipientGroup[], school = "", search = ""): MailRecipient[] {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => (!groups.length || groups.some((group) => row.groups.includes(group)))
    && (!school || row.school_id === school)
    && (!query || `${row.display_name || ""} ${row.email} ${row.school_name || ""}`.toLowerCase().includes(query)));
}

export function recipientEmails(value: string): string[] {
  const addresses = value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
  if (!addresses.length) throw new Error("Select at least one recipient.");
  const unique = [...new Map(addresses.map((email) => [email.toLowerCase(), email])).values()];
  if (unique.length > 500) throw new Error("Select at most 500 recipients per send.");
  for (const to of unique) {
    if (!isMailRecipientAddress(to)) throw new Error(`Invalid recipient email address: ${to.slice(0, 254)}. Correct or remove this address before continuing.`);
  }
  return unique;
}

/** Keep directory eligibility and the one-recipient transport validator in sync. */
export function isMailRecipientAddress(value: string): boolean {
  const to = value.trim();
  return to.length <= 254 && /^[^\s@<>,;:]+@[^\s@<>,;:]+\.[^\s@<>,;:]+$/.test(to);
}

export function partitionMailRecipientDirectory(rows: MailRecipient[]) {
  return {
    eligible: rows.filter((row) => isMailRecipientAddress(row.email)),
    unavailable: rows.filter((row) => !isMailRecipientAddress(row.email)),
  };
}

/** Composer review accepts a batch; transport still validates and sends one address per call. */
export function validatedMailBatchDraft(input: MailDraft): MailDraft {
  const recipients = recipientEmails(input.to);
  const checked = validatedMailDraft({ ...input, to: recipients[0] });
  return { ...checked, to: recipients.join(", ") };
}

export function forwardDraft(mail: MailMessage): MailDraft {
  const attachmentNote = mail.has_attachments ? "\n[Attachments are not included. Obtain originals from the management mailbox.]\n" : "";
  return {
    to: "",
    subject: `Fwd: ${mail.subject.replace(/^(?:\s*fwd?\s*:\s*)+/i, "").trim()}`.slice(0, 200),
    message: `\n\n---------- Forwarded message ----------\nFrom: ${mail.sender_name || mail.sender_email} <${mail.sender_email}>\nDate: ${mail.received_at || mail.sent_at || mail.created_at}\nSubject: ${mail.subject}\nTo: ${mail.recipient_email}\n${attachmentNote}\n${mail.body_text}`,
  };
}

const statusLabels: Record<MailDeliveryStatus, string> = {
  received: "Received", pending: "Pending · verify before resending", accepted: "Accepted by Brevo",
  delivered: "Delivered", deferred: "Deferred", soft_bounced: "Soft bounced", hard_bounced: "Hard bounced",
  blocked: "Blocked", invalid: "Invalid", failed: "Failed", spam: "Spam reported",
};

export function mailStatusLabel(status: MailDeliveryStatus) {
  return statusLabels[status] ?? "Unknown status";
}

export function mailSenderName(displayName: string | null | undefined) {
  const name = displayName?.trim() ?? "";
  return `${name && name.length <= 80 && !/[\u0000-\u001f\u007f]/.test(displayName ?? "") ? name : "EconMind Admin"} · EconMind`;
}

export function replySubject(subject: string) {
  return `Re: ${subject.replace(/^(?:\s*re\s*:\s*)+/i, "").trim()}`.slice(0, 200);
}

/** Explicit allow-list: UI identity and presentation fields never enter a send payload. */
export function validatedMailDraft(input: MailDraft): MailDraft {
  const to = input.to.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!isMailRecipientAddress(to)) {
    throw new Error("Enter one recipient email address. CC, BCC, and multiple recipients are not supported.");
  }
  if (!subject || subject.length > 200 || /[\r\n\u0000]/.test(subject)) throw new Error("Subject must contain 1–200 characters on a single line.");
  if (!message || message.length > 20_000 || message.includes("\u0000")) throw new Error("Message must contain 1–20,000 plain-text characters.");
  if (input.threadId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.threadId)) throw new Error("Select a valid conversation before replying.");
  return { to, subject, message, ...(input.threadId ? { threadId: input.threadId } : {}) };
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
