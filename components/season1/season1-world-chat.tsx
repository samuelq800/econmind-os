"use client";

import { ArrowDown, ChevronRight, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createChatSync } from "@/lib/season1/chat-sync";
import { postSeason1LobbyMessage, unsubscribeSeason1Lobby, type Season1Message } from "@/lib/supabase/season1";
import { getSeason1WorldMessages, subscribeToSeason1WorldChat } from "@/lib/supabase/season1-world-chat";

export function Season1WorldChat({ seasonId, initialMessages }: {
  seasonId: string;
  initialMessages: Season1Message[];
}) {
  const { user, profileDisplayName } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [unread, setUnread] = useState(0);
  const [below, setBelow] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const panel = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const followLatest = useRef(true);
  const openRef = useRef(false);
  const sendingRef = useRef(false);
  const mounted = useRef(false);
  const seen = useRef(new Set(initialMessages.map((message) => message.id)));
  const confirmedSends = useRef(new Map<string, Season1Message>());
  const sync = useRef<ReturnType<typeof createChatSync<Season1Message[]>> | null>(null);
  const userId = user?.id;

  function markRead(items: Season1Message[]) {
    items.forEach((message) => seen.current.add(message.id));
    setUnread(0);
  }

  function scrollToLatest() {
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
    followLatest.current = true;
    setBelow(false);
    markRead(messages);
  }

  function changeOpen(next: boolean) {
    openRef.current = next;
    setOpen(next);
    if (next) {
      followLatest.current = true;
      markRead(messages);
      void sync.current?.refresh();
    } else window.requestAnimationFrame(() => toggle.current?.focus());
  }

  useEffect(() => {
    mounted.current = true;
    if (!userId) return;
    const reader = createChatSync({
      read: getSeason1WorldMessages,
      onData: (incoming) => {
        // A pre-send read must never briefly erase a successfully sent message.
        incoming.forEach((message) => confirmedSends.current.delete(message.id));
        const next = [...incoming, ...confirmedSends.current.values()]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
          .slice(-100);
        setMessages(next);
        if (openRef.current && followLatest.current) markRead(next);
        else setUnread(next.filter((message) => !seen.current.has(message.id) && message.authorId !== userId && !message.deletedAt).length);
        setError("");
      },
      onError: () => setError("Chat could not update. Your messages are still here. Try again."),
    });
    sync.current = reader;
    const refresh = () => {
      if (document.visibilityState === "visible") void reader.refresh();
    };
    const channel = subscribeToSeason1WorldChat(refresh);
    // Realtime may be disabled or interrupted; visible tabs still catch up.
    const interval = window.setInterval(refresh, 10_000);
    const initial = window.setTimeout(() => {
      if (window.matchMedia("(min-width: 1440px)").matches || window.location.hash === "#world-chat") {
        openRef.current = true;
        setOpen(true);
      }
      refresh();
    }, 0);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      mounted.current = false;
      reader.dispose();
      sync.current = null;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      unsubscribeSeason1Lobby(channel);
    };
  }, [seasonId, userId]);

  useEffect(() => {
    if (!open) return;
    if (followLatest.current && list.current) list.current.scrollTop = list.current.scrollHeight;
    else setBelow(true);
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus({ preventScroll: true });
    const mobile = window.matchMedia("(max-width: 639px)");
    const previousOverflow = document.body.style.overflow;
    const lockedBody = mobile.matches;
    if (lockedBody) document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && panel.current?.contains(document.activeElement)) {
        openRef.current = false;
        setOpen(false);
        window.requestAnimationFrame(() => toggle.current?.focus());
      }
      if (event.key === "Tab" && mobile.matches && panel.current) {
        const controls = Array.from(panel.current.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)"));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener("keydown", escape);
    const viewport = window.visualViewport;
    const resize = () => {
      if (panel.current && viewport && window.matchMedia("(max-width: 639px)").matches) {
        panel.current.style.setProperty("--chat-viewport-height", `${viewport.height}px`);
        panel.current.style.setProperty("--chat-viewport-top", `${viewport.offsetTop}px`);
      }
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      document.removeEventListener("keydown", escape);
      if (lockedBody) document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
    };
  }, [open]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !user || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError("");
    try {
      const id = await postSeason1LobbyMessage(content);
      if (!mounted.current) return;
      const message: Season1Message = {
        id, content, messageType: "TEXT", metadata: {}, deletedAt: null,
        createdAt: new Date().toISOString(), authorId: user.id,
        authorName: profileDisplayName || "You",
      };
      confirmedSends.current.set(id, message);
      seen.current.add(id);
      followLatest.current = true;
      setMessages((previous) => [...previous.filter((item) => item.id !== id), message].slice(-100));
      setDraft("");
      void sync.current?.refresh();
    } catch (caught) {
      if (mounted.current) setSendError(caught instanceof Error ? caught.message : "Message could not be sent. Try again.");
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }

  return <>
    <button ref={toggle} type="button" className="season1-chat-toggle" hidden={open}
      aria-controls="world-chat" aria-expanded={open} onClick={() => changeOpen(true)}>
      <MessageCircle size={20} aria-hidden="true" /><span>World Chat</span>
      {unread > 0 && <span className="season1-chat-count" aria-label={`${unread} unread messages`}>{unread > 99 ? "99+" : unread}</span>}
    </button>
    <aside ref={panel} id="world-chat" className="season1-world-chat" hidden={!open}
      tabIndex={-1} aria-labelledby="world-chat-title">
      <header className="season1-chat-header">
        <div><p className="season1-chat-eyebrow">SEASON 1 / THE COMMONS</p>
          <h2 id="world-chat-title"><MessageCircle size={20} aria-hidden="true" /> World Chat</h2>
          <p className="season1-chat-caption">Meet the world before it begins.</p>
        </div>
        <button type="button" className="season1-chat-icon-button" aria-label="Collapse World Chat"
          aria-controls="world-chat" aria-expanded={open} onClick={() => changeOpen(false)}>
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="season1-chat-stream">
        <ol ref={list} className="season1-chat-messages" aria-label="World chat messages"
          role="log" aria-live="polite" aria-relevant="additions text"
          onScroll={() => {
            const element = list.current;
            if (!element) return;
            followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
            if (followLatest.current) { setBelow(false); markRead(messages); }
          }}>
          {!messages.length && <li className="season1-chat-empty">No messages yet.<br />Start a conversation with the world.</li>}
          {messages.map((message) => <li key={message.id} className={`season1-chat-message ${message.authorId === userId ? "is-own" : ""}`}>
            <div className="season1-chat-author"><span>{message.authorName}</span>
              <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            </div>
            <p>{message.deletedAt ? "Message deleted." : message.content}</p>
          </li>)}
        </ol>
        {below && <button type="button" className="season1-chat-latest" onClick={scrollToLatest}>
          <ArrowDown size={15} aria-hidden="true" /> Latest messages {unread > 0 ? `(${unread})` : ""}
        </button>}
      </div>
      <p className="sr-only" role="status">{unread > 0 ? `${unread} unread world chat messages` : sending ? "Sending message" : ""}</p>
      {(sendError || error) && <div className="season1-chat-error" role="alert"><p>{sendError || error}</p>
        {error && <button type="button" onClick={() => void sync.current?.refresh()}>Retry update</button>}
      </div>}
      <form className="season1-chat-compose" onSubmit={(event) => void send(event)}>
        <label className="sr-only" htmlFor="world-chat-draft">Message the world</label>
        <textarea id="world-chat-draft" value={draft} onChange={(event) => setDraft(event.target.value)}
          disabled={sending} maxLength={1000} rows={3} required placeholder="Message the world…" />
        <div className="season1-chat-compose-footer"><span>{draft.length} / 1000</span>
          <button type="submit" disabled={sending || !draft.trim()}>
            {sending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </aside>
  </>;
}
