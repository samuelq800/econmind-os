import { requireSupabaseBrowserClient as client, throwIfSupabaseError as fail } from "@/lib/supabase/client";
import { MAIL_PAGE_SIZE, validatedMailDraft, type MailDeliveryStatus, type MailDraft, type MailMessage, type MailPage, type MailThread } from "@/lib/mail/admin-mail";

// Do not fetch HTML or attachment binaries into the reader. React renders only plaintext.
const MESSAGE_COLUMNS = "id,thread_id,direction,sender_email,sender_name,recipient_email,recipient_name,subject,body_text,delivery_status,actor_user_id,actor_display_name,has_attachments,attachments,created_at,received_at,sent_at,delivered_at,failed_at,failure_code,request_id,provider_message_id";
const THREAD_COLUMNS = "id,subject,created_at,updated_at,last_message_at,last_inbound_at,last_outbound_at,message_count,last_message_preview,last_sender_email,last_sender_name,has_attachments";

function page<T>(rows: T[] | null): MailPage<T> {
  return { rows: (rows ?? []).slice(0, MAIL_PAGE_SIZE), hasMore: (rows?.length ?? 0) > MAIL_PAGE_SIZE };
}

function pageStart(pageIndex: number) {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) throw new Error("Invalid mail page.");
  return pageIndex * MAIL_PAGE_SIZE;
}

export async function listMailInbox(pageIndex = 0): Promise<MailPage<MailThread>> {
  const start = pageStart(pageIndex);
  const { data, error } = await client().from("mail_threads").select(THREAD_COLUMNS)
    .not("last_inbound_at", "is", null).order("last_message_at", { ascending: false })
    .order("id", { ascending: false }).range(start, start + MAIL_PAGE_SIZE);
  fail(error);
  return page(data as MailThread[] | null);
}

export async function listSentMail(pageIndex = 0): Promise<MailPage<MailMessage>> {
  const start = pageStart(pageIndex);
  const { data, error } = await client().from("mail_messages").select(MESSAGE_COLUMNS)
    .eq("direction", "outbound").order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(start, start + MAIL_PAGE_SIZE);
  fail(error);
  return page(data as MailMessage[] | null);
}

export async function getMailThread(threadId: string): Promise<MailThread> {
  const { data, error } = await client().from("mail_threads").select(THREAD_COLUMNS).eq("id", threadId).single();
  fail(error);
  return data as MailThread;
}

/** Newest page first; the reader reverses it and prepends older pages for chronological reading. */
export async function listThreadMessages(threadId: string, pageIndex = 0): Promise<MailPage<MailMessage>> {
  const start = pageStart(pageIndex);
  const { data, error } = await client().from("mail_messages").select(MESSAGE_COLUMNS)
    .eq("thread_id", threadId).order("created_at", { ascending: false })
    .order("id", { ascending: false }).range(start, start + MAIL_PAGE_SIZE);
  fail(error);
  return page(data as MailMessage[] | null);
}

export async function getLatestInboundMessage(threadId: string): Promise<MailMessage | null> {
  const { data, error } = await client().from("mail_messages").select(MESSAGE_COLUMNS)
    .eq("thread_id", threadId).eq("direction", "inbound")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  fail(error);
  return data as MailMessage | null;
}

export type SendMailResult = { ok: true; messageId: string; threadId: string; status: MailDeliveryStatus; warning?: string };
type SendMailFailure = { ok: false; message: string; code?: string };

export class MailSendError extends Error {
  constructor(message: string, public readonly ambiguous: boolean, public readonly code?: string) {
    super(message);
    this.name = "MailSendError";
  }
}

function isFailure(value: unknown): value is SendMailFailure {
  return Boolean(value && typeof value === "object" && "ok" in value && value.ok === false && "message" in value && typeof value.message === "string");
}

/** One invocation only. A logical request UUID stays outside the strictly limited body. */
export async function sendAdminMail(input: MailDraft, requestId: string): Promise<SendMailResult> {
  const body = validatedMailDraft(input);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error("A valid send request ID is required.");
  let result;
  try {
    result = await client().functions.invoke("send-admin-email", {
      body,
      headers: { "X-EconMind-Request-Id": requestId },
    });
  } catch {
    throw new MailSendError("The send outcome is unknown. Check Sent and verify delivery before creating another send.", true);
  }
  if (result.error) {
    // Supabase puts non-2xx response JSON in FunctionsHttpError.context.
    const context = result.error.context;
    let failure: unknown;
    if (context instanceof Response) {
      try { failure = await context.clone().json(); } catch { /* Treat an unreadable response as ambiguous. */ }
    }
    if (isFailure(failure)) {
      const ambiguous = /unknown|ambiguous|pending|conflict/i.test(failure.code ?? "") || (failure.code !== "provider_rejected" && context instanceof Response && context.status >= 500);
      throw new MailSendError(failure.message, ambiguous, failure.code);
    }
    throw new MailSendError("The send outcome is unknown. Check Sent before sending again. No automatic retry was made.", true);
  }
  if (isFailure(result.data)) {
    throw new MailSendError(result.data.message, /unknown|ambiguous|pending|conflict/i.test(result.data.code ?? ""), result.data.code);
  }
  const response = result.data as SendMailResult | null;
  if (!response?.ok || !response.messageId || !response.threadId || !response.status) {
    throw new MailSendError("The send response could not be verified. Check Sent before sending again.", true);
  }
  return response;
}
