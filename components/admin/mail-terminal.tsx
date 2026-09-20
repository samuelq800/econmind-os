"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Inbox, LoaderCircle, Mail, Paperclip, PenLine, RefreshCw, Reply, Send, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatAttachmentSize, MAIL_PAGE_SIZE, mailSenderName, mailStatusLabel, OFFICIAL_MAIL_ADDRESS, replySubject, validatedMailDraft, type MailDeliveryStatus, type MailDraft, type MailMessage, type MailThread } from "@/lib/mail/admin-mail";
import { getProfile } from "@/lib/supabase/data";
import { getLatestInboundMessage, getMailThread, listMailInbox, listSentMail, listThreadMessages, MailSendError, sendAdminMail, type SendMailResult } from "@/lib/supabase/admin-mail";

type MailView = "inbox" | "sent" | "compose";
const EMPTY_DRAFT: MailDraft = { to: "", subject: "", message: "" };
const fieldClass = "mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2.5 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] disabled:opacity-60";

function errorText(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function timestamp(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Status({ status }: { status: MailDeliveryStatus }) {
  const tone = status === "delivered" ? "text-[var(--accent)] bg-[var(--accent-soft)]" : ["failed", "hard_bounced", "blocked", "invalid", "spam"].includes(status) ? "text-[var(--red)] bg-[var(--red-soft)]" : ["pending", "deferred", "soft_bounced"].includes(status) ? "text-[var(--amber)] bg-[var(--amber-soft)]" : "";
  return <Badge className={`normal-case tracking-normal ${tone}`}>{mailStatusLabel(status)}</Badge>;
}

function Loading({ children = "Loading mail…" }: { children?: React.ReactNode }) {
  return <p role="status" className="flex items-center justify-center gap-2 p-10 text-sm text-[var(--ink-muted)]"><LoaderCircle size={17} className="animate-spin" />{children}</p>;
}

export function MailTerminal() {
  const { user, platformRole, loading, roleLoading, configured, openAuth } = useAuth();
  if (!configured) return <main className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-3xl font-bold">Mail Terminal</h1><p className="mt-4 text-sm text-[var(--ink-muted)]">Mail Terminal is unavailable until the platform connection is configured.</p></main>;
  if (loading || roleLoading) return <main className="min-h-[60vh]"><Loading>Checking administrator access…</Loading></main>;
  if (!user || platformRole !== "platform_admin") return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center"><div><ShieldCheck size={28} className="mx-auto text-[var(--accent)]" /><h1 className="mt-4 text-3xl font-bold tracking-tight">Platform administrator access required</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">The shared official mailbox is available to platform administrators.</p>{!user && <Button className="mt-6" onClick={() => openAuth("sign-in")}>Sign in</Button>}</div></main>;
  // Remount on account changes so another session never inherits a draft or loaded mail.
  return <MailWorkspace key={user.id} userId={user.id} />;
}

function MailWorkspace({ userId }: { userId: string }) {
  const [view, setView] = useState<MailView>("inbox");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [senderName, setSenderName] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<MailDraft>(EMPTY_DRAFT);
  const [draftVersion, setDraftVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void getProfile(userId).then((profile) => { if (active) setSenderName(mailSenderName(profile?.display_name)); })
      .catch(() => { if (active) setIdentityError("Your sender identity could not be loaded. Refresh the page before composing."); });
    return () => { active = false; };
  }, [userId]);

  function changeView(next: MailView) {
    if (busy) return;
    setView(next);
    setPageIndex(0);
    setSelectedThread(null);
  }

  function startDraft(next = EMPTY_DRAFT) {
    if (busy) return;
    setDraft(next);
    setDraftVersion((value) => value + 1);
    setView("compose");
  }

  function checkSent(threadId?: string) {
    setView("sent");
    setPageIndex(0);
    setSelectedThread(threadId ?? null);
    setRevision((value) => value + 1);
  }

  return <main className="mx-auto min-h-screen max-w-[1480px] px-5 py-10 sm:px-8 lg:px-12">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">Platform administration</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">Mail Terminal</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Shared correspondence. One official address.</p></div>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs font-semibold"><ShieldCheck size={16} className="text-[var(--accent)]" />{OFFICIAL_MAIL_ADDRESS}</div>
    </header>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
      <nav className="flex gap-1" aria-label="Mail views">{([{ key: "inbox", label: "Inbox", icon: Inbox }, { key: "sent", label: "Sent", icon: Send }, { key: "compose", label: "Compose", icon: PenLine }] as const).map(({ key, label, icon: Icon }) => <Button key={key} variant={view === key ? "primary" : "ghost"} disabled={busy} aria-current={view === key ? "page" : undefined} onClick={() => changeView(key)}><Icon size={15} />{label}</Button>)}</nav>
      <div className="flex gap-2">{view === "compose" ? <Button variant="secondary" disabled={busy} onClick={() => startDraft()}>New message</Button> : <Button variant="secondary" disabled={busy} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={14} />Refresh</Button>}</div>
    </div>
    {identityError && <p role="alert" className="mt-5 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{identityError}</p>}
    {/* Keep the composer mounted when visiting Sent: uncertain sends retain their UUID and lock. */}
    <div hidden={view !== "compose"} className="mt-6"><Composer key={draftVersion} initialDraft={draft} senderName={senderName} onBusy={setBusy} onCheckSent={checkSent} /></div>
    {view !== "compose" && <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(300px,.8fr)_minmax(0,1.3fr)]">
      <MailList key={`${view}:${pageIndex}:${revision}`} view={view} pageIndex={pageIndex} selectedThread={selectedThread} onSelect={setSelectedThread} onPage={setPageIndex} />
      {selectedThread ? <ThreadReader key={`${selectedThread}:${revision}`} threadId={selectedThread} onReply={(latest) => startDraft({ to: latest.sender_email, subject: replySubject(latest.subject), message: "", threadId: latest.thread_id })} /> : <Card className="flex min-h-80 flex-col items-center justify-center px-8 py-12 text-center"><span className="grid size-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Mail size={23} /></span><h2 className="mt-5 text-xl font-bold tracking-tight">Every exchange, in context</h2><p className="mt-3 max-w-xs text-sm leading-6 text-[var(--ink-muted)]">Select a conversation to read its history or compose a new official email.</p><Button variant="secondary" className="mt-6" onClick={() => startDraft()}><PenLine size={14} />Compose a message</Button></Card>}
    </div>}
    <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-[var(--ink-muted)]"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Original inbound emails and attachments continue to arrive in the forwarded management copy.</p>
  </main>;
}

function MailList({ view, pageIndex, selectedThread, onSelect, onPage }: { view: "inbox" | "sent"; pageIndex: number; selectedThread: string | null; onSelect: (id: string) => void; onPage: (page: number) => void }) {
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (view === "inbox") {
          const result = await listMailInbox(pageIndex);
          if (active) { setThreads(result.rows); setHasMore(result.hasMore); }
        } else {
          const result = await listSentMail(pageIndex);
          if (active) { setMessages(result.rows); setHasMore(result.hasMore); }
        }
      } catch (caught) { if (active) setError(errorText(caught, "Could not load mail.")); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [view, pageIndex]);
  const count = view === "inbox" ? threads.length : messages.length;
  return <Card className="overflow-hidden">
    <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><h2 className="text-sm font-bold">{view === "inbox" ? "Inbox conversations" : "Sent messages"}</h2><span className="text-xs text-[var(--ink-faint)]">{loading ? "…" : count ? `${pageIndex * MAIL_PAGE_SIZE + 1}–${pageIndex * MAIL_PAGE_SIZE + count}` : "0"}</span></div>
    {loading ? <Loading /> : error ? <p role="alert" className="p-5 text-sm leading-6 text-[var(--red)]">{error} Use Refresh to try loading again.</p> : !count ? <div className="px-6 py-12 text-center"><Inbox size={24} className="mx-auto text-[var(--ink-faint)]" /><p className="mt-4 text-sm font-semibold">{view === "inbox" ? "No inbound conversations yet" : "No outbound messages yet"}</p><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{view === "inbox" ? "New emails will appear here after the inbound connection is enabled." : "Your team's official outgoing email history will appear here."}</p></div> : <ul className="divide-y divide-[var(--line)]">
      {view === "inbox" ? threads.map((thread) => <li key={thread.id}><button type="button" onClick={() => onSelect(thread.id)} aria-pressed={selectedThread === thread.id} className={`w-full px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${selectedThread === thread.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-subtle)]"}`}>
        <div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-bold">{thread.last_sender_name || thread.last_sender_email || "Unknown sender"}</span><span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--ink-muted)]">{thread.has_attachments && <Paperclip size={13} aria-label="Has attachments" />}{thread.message_count} <span className="sr-only">messages</span></span></div>
        <p className="mt-2 truncate text-sm font-semibold">{thread.subject || "(No subject)"}</p><p className="mt-1 truncate text-xs leading-5 text-[var(--ink-muted)]">{thread.last_message_preview || "No text preview"}</p><time dateTime={thread.last_message_at} className="mt-3 block text-[11px] text-[var(--ink-faint)]">{timestamp(thread.last_message_at)}</time>
      </button></li>) : messages.map((message) => <li key={message.id}><button type="button" onClick={() => onSelect(message.thread_id)} aria-pressed={selectedThread === message.thread_id} className={`w-full px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${selectedThread === message.thread_id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-subtle)]"}`}>
        <p className="truncate text-xs font-bold">To: {message.recipient_email}</p><p className="mt-2 truncate text-sm font-semibold">{message.subject}</p><p className="mt-2 break-words text-[11px] leading-5 text-[var(--ink-muted)]">From: {message.sender_name || "EconMind Admin"} &lt;{message.sender_email}&gt;<br />Sent by: {message.actor_display_name || "EconMind Admin"}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Status status={message.delivery_status} /><time dateTime={message.created_at} className="text-[11px] text-[var(--ink-faint)]">{timestamp(message.sent_at || message.created_at)}</time></div>
      </button></li>)}
    </ul>}
    <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-3"><Button size="sm" variant="ghost" disabled={loading || pageIndex === 0} onClick={() => onPage(pageIndex - 1)}><ChevronLeft size={14} />Previous</Button><span className="text-xs text-[var(--ink-muted)]">Page {pageIndex + 1}</span><Button size="sm" variant="ghost" disabled={loading || !hasMore} onClick={() => onPage(pageIndex + 1)}>Next<ChevronRight size={14} /></Button></div>
  </Card>;
}

function ThreadReader({ threadId, onReply }: { threadId: string; onReply: (message: MailMessage) => void }) {
  const [thread, setThread] = useState<MailThread | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [latestInbound, setLatestInbound] = useState<MailMessage | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderLock = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([getMailThread(threadId), listThreadMessages(threadId), getLatestInboundMessage(threadId)])
      .then(([nextThread, page, latest]) => { if (active) { setThread(nextThread); setMessages([...page.rows].reverse()); setHasMore(page.hasMore); setLatestInbound(latest); } })
      .catch((caught) => { if (active) setError(errorText(caught, "Could not load this conversation.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [threadId]);

  async function loadOlder() {
    if (olderLock.current) return;
    olderLock.current = true;
    setLoadingOlder(true);
    setError("");
    try {
      const page = await listThreadMessages(threadId, pageIndex + 1);
      setMessages((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...page.rows.filter((item) => !seen.has(item.id)).reverse(), ...current];
      });
      setPageIndex((current) => current + 1);
      setHasMore(page.hasMore);
    } catch (caught) { setError(errorText(caught, "Could not load older messages.")); }
    finally { olderLock.current = false; setLoadingOlder(false); }
  }

  if (loading) return <Card><Loading>Loading conversation…</Loading></Card>;
  return <section aria-label="Conversation" className="min-w-0">
    <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">Conversation</p><h2 className="mt-2 break-words text-2xl font-bold tracking-tight">{thread?.subject || "Mail thread"}</h2>{thread && <p className="mt-2 text-xs text-[var(--ink-muted)]">{thread.message_count} messages · Last activity {timestamp(thread.last_message_at)}</p>}</div><Button variant="secondary" disabled={!latestInbound} onClick={() => latestInbound && onReply(latestInbound)}><Reply size={15} />Reply</Button></div>{!latestInbound && thread && <p className="mt-4 text-xs text-[var(--ink-muted)]">Reply becomes available when this conversation has an inbound message.</p>}</Card>
    {error && <p role="alert" className="mt-4 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}
    {hasMore && <Button variant="secondary" className="mt-5 w-full" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder && <LoaderCircle size={14} className="animate-spin" />}Load older messages</Button>}
    <ol className="mt-5 space-y-4">{messages.map((message) => <li key={message.id}><MessageCard message={message} /></li>)}</ol>
  </section>;
}

function MessageCard({ message }: { message: MailMessage }) {
  const inbound = message.direction === "inbound";
  const date = message.received_at || message.sent_at || message.created_at;
  return <Card className="overflow-hidden">
    <div className={`border-b border-[var(--line)] p-5 ${inbound ? "bg-[var(--surface-subtle)]" : "bg-[var(--accent-soft)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.13em]">{inbound ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{inbound ? "Inbound" : "Outbound"}</span><time dateTime={date} className="text-xs text-[var(--ink-muted)]">{timestamp(date)}</time></div>
      <p className="mt-3 break-words text-sm font-bold">{message.sender_name || message.sender_email}</p><p className="mt-1 break-all text-xs leading-5 text-[var(--ink-muted)]">From: {message.sender_email}<br />To: {message.recipient_name ? `${message.recipient_name} · ` : ""}{message.recipient_email}</p>
      <p className="mt-3 break-words text-sm font-semibold">{message.subject || "(No subject)"}</p>
      {!inbound && <div className="mt-3 flex flex-wrap items-center gap-2"><Status status={message.delivery_status} /><span className="text-xs text-[var(--ink-muted)]">Sent by {message.actor_display_name || "EconMind Admin"}</span></div>}
    </div>
    <div className="p-5"><p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{message.body_text || "No plain-text content. The original message is available in the forwarded management copy."}</p>
      {message.has_attachments && <div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4"><p className="flex items-center gap-2 text-xs font-bold"><Paperclip size={14} />Attachments ({message.attachments?.length || "metadata unavailable"})</p><ul className="mt-3 space-y-2">{message.attachments?.map((attachment, index) => <li key={`${attachment.filename}:${index}`} className="break-words text-xs leading-5"><span className="font-semibold">{attachment.filename || "Unnamed attachment"}</span><span className="block text-[var(--ink-muted)]">{attachment.content_type} · {formatAttachmentSize(attachment.size)}</span></li>)}</ul><p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">Attachments are available in the forwarded management copy.</p></div>}
      {!inbound && <details className="mt-5 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-muted)]"><summary className="cursor-pointer font-semibold">Delivery details</summary><dl className="mt-3 grid gap-2 break-all"><div><dt className="inline font-semibold">Request: </dt><dd className="inline">{message.request_id || "Unavailable"}</dd></div><div><dt className="inline font-semibold">Provider message: </dt><dd className="inline">{message.provider_message_id || "Awaiting confirmation"}</dd></div>{message.delivered_at && <div><dt className="inline font-semibold">Delivered: </dt><dd className="inline">{timestamp(message.delivered_at)}</dd></div>}{message.failure_code && <div><dt className="inline font-semibold">Failure: </dt><dd className="inline">{message.failure_code}</dd></div>}</dl>{message.delivery_status === "pending" && <p className="mt-3 leading-5">The outcome may be uncertain. Verify this request before sending another email.</p>}</details>}
    </div>
  </Card>;
}

function Composer({ initialDraft, senderName, onBusy, onCheckSent }: { initialDraft: MailDraft; senderName: string; onBusy: (busy: boolean) => void; onCheckSent: (threadId?: string) => void }) {
  const [draft, setDraft] = useState(initialDraft);
  const [confirmation, setConfirmation] = useState<MailDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const requestId = useRef<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState<SendMailResult | null>(null);
  const locked = busy || uncertain || Boolean(result);

  function edit(field: "to" | "subject" | "message", value: string) {
    if (locked) return;
    setDraft((current) => ({ ...current, [field]: value }));
    // Editing after a definite rejection starts a new logical send. Unknown outcomes stay locked.
    requestId.current = null;
    setAttemptId(null);
    setError("");
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || !senderName) return;
    try { setConfirmation(validatedMailDraft(draft)); setError(""); }
    catch (caught) { setError(errorText(caught, "Review the message fields.")); }
  }

  async function send() {
    if (sending.current || !confirmation || uncertain || result) return;
    // A ref closes the double-click window before React commits disabled button state.
    sending.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      requestId.current ??= crypto.randomUUID();
      setAttemptId(requestId.current);
      const sent = await sendAdminMail(confirmation, requestId.current);
      setResult(sent);
    } catch (caught) {
      const ambiguous = caught instanceof MailSendError ? caught.ambiguous : true;
      setUncertain(ambiguous);
      setError(errorText(caught, "The send outcome is unknown. Check Sent before trying again."));
    } finally {
      sending.current = false;
      setBusy(false);
      onBusy(false);
      setConfirmation(null);
    }
  }

  return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
    <Card className="p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold tracking-tight">{draft.threadId ? "Reply to conversation" : "Compose a message"}</h2>{draft.threadId && <Badge>Thread reply</Badge>}</div>
      <form onSubmit={review} className="mt-6 space-y-5">
        <div><p className="text-xs font-bold">From</p><div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-3"><p className="text-sm font-semibold">{senderName || "Loading sender identity…"}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">&lt;{OFFICIAL_MAIL_ADDRESS}&gt;</p></div></div>
        <label className="block text-xs font-bold" htmlFor="mail-to">To<input id="mail-to" name="to" type="email" required autoComplete="off" maxLength={254} placeholder="recipient@example.com" value={draft.to} disabled={locked} onChange={(event) => edit("to", event.target.value)} className={fieldClass} /><span className="mt-1.5 block text-[11px] font-normal text-[var(--ink-muted)]">One recipient</span></label>
        <label className="block text-xs font-bold" htmlFor="mail-subject">Subject<input id="mail-subject" name="subject" required maxLength={200} value={draft.subject} disabled={locked} onChange={(event) => edit("subject", event.target.value)} className={fieldClass} /></label>
        <label className="block text-xs font-bold" htmlFor="mail-message">Message<textarea id="mail-message" name="message" required maxLength={20_000} rows={13} value={draft.message} disabled={locked} onChange={(event) => edit("message", event.target.value)} className={`${fieldClass} min-h-64 resize-y leading-7`} /><span className="mt-1.5 flex justify-between gap-3 text-[11px] font-normal text-[var(--ink-muted)]"><span>Plain text</span><span>{draft.message.length.toLocaleString()} / 20,000</span></span></label>
        {error && <div role="alert" className="rounded-lg bg-[var(--red-soft)] p-4 text-sm leading-6 text-[var(--red)]"><p>{error}</p>{uncertain && <p className="mt-2">No retry was made. Check Sent and verify this request before creating a new message.</p>}</div>}
        {result && <div role="status" className="rounded-lg bg-[var(--accent-soft)] p-4 text-sm leading-6"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} />{mailStatusLabel(result.status)}</p><p className="mt-2">{result.status === "accepted" ? "Brevo accepted the request. Delivery is confirmed separately in Sent." : result.status === "delivered" ? "The delivery event confirms this message was delivered." : "Check the recorded delivery status before taking further action."}</p>{result.warning && <p className="mt-2">{result.warning}</p>}</div>}
        {(uncertain || result) && attemptId && <p className="break-all text-xs leading-5 text-[var(--ink-muted)]">Request ID: {attemptId}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">{uncertain || result ? <Button type="button" variant="secondary" onClick={() => onCheckSent(result?.threadId)}><Send size={14} />Check Sent</Button> : <Button type="submit" disabled={busy || !senderName}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}Send</Button>}<span className="text-xs text-[var(--ink-muted)]">{uncertain || result ? "Use New message for another email." : "Review recipient and subject before sending."}</span></div>
      </form>
    </Card>
    <aside className="space-y-4"><Card className="p-5"><ShieldCheck size={22} className="text-[var(--accent)]" /><h3 className="mt-4 text-sm font-bold">One official identity</h3><p className="mt-2 text-xs leading-6 text-[var(--ink-muted)]">Your name accompanies the shared official address. Replies return to {OFFICIAL_MAIL_ADDRESS} and appear in the shared Inbox.</p></Card><div className="px-1 text-xs leading-6 text-[var(--ink-muted)]"><p className="font-semibold text-[var(--ink)]">A shared record</p><p className="mt-1">Outgoing messages retain the sender identity and administrator name recorded at send time.</p></div></aside>
    {confirmation && <SendConfirmation draft={confirmation} senderName={senderName} busy={busy} onCancel={() => !sending.current && setConfirmation(null)} onSend={() => void send()} />}
  </div>;
}

function SendConfirmation({ draft, senderName, busy, onCancel, onSend }: { draft: MailDraft; senderName: string; busy: boolean; onCancel: () => void; onSend: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    cancelButton.current?.focus();
    return () => { element?.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="mail-confirm-title" aria-describedby="mail-confirm-description" aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-black/50">
    <div className="p-6 sm:p-8"><span className="grid size-11 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Send size={20} /></span><h2 id="mail-confirm-title" className="mt-5 text-2xl font-bold tracking-tight">Send this email?</h2><p id="mail-confirm-description" className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Confirm the recipient and subject. This email will be sent from EconMind’s official address.</p><dl className="mt-6 space-y-4 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4 text-sm"><div><dt className="text-xs font-bold text-[var(--ink-muted)]">From</dt><dd className="mt-1 break-words">{senderName}<br />&lt;{OFFICIAL_MAIL_ADDRESS}&gt;</dd></div><div><dt className="text-xs font-bold text-[var(--ink-muted)]">To</dt><dd className="mt-1 break-all">{draft.to}</dd></div><div><dt className="text-xs font-bold text-[var(--ink-muted)]">Subject</dt><dd className="mt-1 break-words">{draft.subject}</dd></div></dl><div className="mt-6 flex justify-end gap-3"><button ref={cancelButton} type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[var(--surface-subtle)] disabled:opacity-45">Cancel</button><Button type="button" disabled={busy} onClick={onSend}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}{busy ? "Sending…" : "Send"}</Button></div></div>
  </dialog>;
}
