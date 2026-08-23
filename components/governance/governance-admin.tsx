"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAdminSupportRequests, reviewSupportRequest, type SupportRequest, type SupportStatus } from "@/lib/supabase/governance";

const STATUSES: readonly SupportStatus[] = ["open", "reviewing", "resolved", "closed"];

function statusLabel(status: SupportStatus) {
  return { open: "Open", reviewing: "Reviewing", resolved: "Resolved", closed: "Closed" }[status];
}

function actionForStatus(status: SupportStatus) {
  return status === "resolved" ? "resolved" : status === "closed" ? "closed" : status === "reviewing" ? "reviewed" : "responded";
}

export function GovernanceAdmin() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [filter, setFilter] = useState<SupportStatus | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setRequests(await listAdminSupportRequests());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load governance requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadInitialRequests() {
      try {
        const loaded = await listAdminSupportRequests();
        if (active) setRequests(loaded);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load governance requests.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialRequests();
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => filter === "all" ? requests : requests.filter((request) => request.status === filter), [filter, requests]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-12 sm:px-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">Platform administration</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em]">Governance requests</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">Review support, privacy, deletion, integrity, and safety requests. Public replies are visible to the requester; internal notes and moderation history remain administrator-only.</p></div><Button variant="secondary" onClick={() => void refresh()} disabled={loading}>{loading && <LoaderCircle size={15} className="animate-spin" />}Refresh</Button></header>
      <div className="mt-8 grid gap-3 sm:grid-cols-4">{STATUSES.map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={`rounded-xl border p-4 text-left transition-colors ${filter === status ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)]"}`}><p className="text-2xl font-bold">{requests.filter((request) => request.status === status).length}</p><p className="mt-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">{statusLabel(status)}</p></button>)}</div>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setFilter("all")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === "all" ? "bg-[var(--ink)] text-[var(--surface)]" : "bg-[var(--surface-strong)] text-[var(--ink-muted)]"}`}>All requests</button>{STATUSES.map((status) => <button key={status} type="button" onClick={() => setFilter(status)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === status ? "bg-[var(--ink)] text-[var(--surface)]" : "bg-[var(--surface-strong)] text-[var(--ink-muted)]"}`}>{statusLabel(status)}</button>)}</div>
      {error && <p role="alert" className="mt-6 rounded-lg bg-[var(--red-soft)] p-3 text-sm text-[var(--red)]">{error}</p>}
      {loading ? <p className="mt-10 text-sm text-[var(--ink-muted)]">Loading requests…</p> : visible.length === 0 ? <Card className="mt-8 p-7 text-sm leading-6 text-[var(--ink-muted)]">No {filter === "all" ? "support" : statusLabel(filter).toLowerCase()} requests are waiting.</Card> : <section className="mt-8 grid gap-5">{visible.map((request) => <RequestReview key={request.id} request={request} onUpdated={(updated) => setRequests((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))} />)}</section>}
    </main>
  );
}

function RequestReview({ request, onUpdated }: { request: SupportRequest; onUpdated: (request: SupportRequest) => void }) {
  const [status, setStatus] = useState<SupportStatus>(request.status);
  const [publicResponse, setPublicResponse] = useState(request.public_response ?? "");
  const [internalNote, setInternalNote] = useState(request.internal_note ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await reviewSupportRequest({
        requestId: request.id,
        status,
        publicResponse,
        internalNote,
        action: actionForStatus(status),
        outcome: publicResponse || `Request marked ${status}.`,
      });
      onUpdated({ ...request, ...updated });
      setMessage("Saved and recorded in the moderation history.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-5 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--accent)]">{request.category.replaceAll("_", " ")}</span><span className="rounded-full bg-[var(--surface-strong)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--ink-muted)]">{statusLabel(request.status)}</span></div><h2 className="mt-3 text-lg font-bold">{request.subject}</h2><p className="mt-1 text-xs text-[var(--ink-faint)]">Submitted {new Date(request.created_at).toLocaleString()} · requester {request.requester?.display_name || request.user_id || "deleted account"}</p></div><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-strong)] text-[var(--accent)]"><ShieldCheck size={18} /></span></div>
      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-muted)]">{request.message}</p>
      {(request.target_type || request.target_reference) && <p className="mt-4 rounded-lg bg-[var(--canvas)] p-3 text-xs leading-5 text-[var(--ink-muted)]"><span className="font-bold">Reported item: </span>{request.target_type ?? "Unspecified"}{request.target_reference ? ` · ${request.target_reference}` : ""}</p>}
      <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-2 text-xs font-bold">Status<select value={status} onChange={(event) => setStatus(event.target.value as SupportStatus)} className="h-10 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm">{STATUSES.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}</select></label>
        <label className="grid gap-2 text-xs font-bold">Reply visible to requester<textarea value={publicResponse} maxLength={6000} onChange={(event) => setPublicResponse(event.target.value)} className="min-h-24 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3 text-sm leading-6" placeholder="Optional final response shown in the requester's Profile page" /></label>
        <label className="grid gap-2 text-xs font-bold">Internal administrator note<textarea value={internalNote} maxLength={10000} onChange={(event) => setInternalNote(event.target.value)} className="min-h-24 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3 text-sm leading-6" placeholder="Not visible to the requester" /></label>
        {error && <p role="alert" className="rounded-lg bg-[var(--red-soft)] p-3 text-xs text-[var(--red)]">{error}</p>}{message && <p className="flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-xs text-[var(--accent)]"><CheckCircle2 size={14} />{message}</p>}
        <Button type="submit" disabled={busy}>{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? "Saving…" : "Save review"}</Button>
      </form>
    </Card>
  );
}
