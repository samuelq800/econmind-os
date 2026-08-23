"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupportRequest, listMySupportRequests, type SupportRequest } from "@/lib/supabase/governance";

function statusLabel(status: SupportRequest["status"]) {
  return { open: "Open", reviewing: "Under review", resolved: "Resolved", closed: "Closed" }[status];
}

export function ProfilePrivacyControls({ email }: { email: string | undefined }) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRequests() {
    setLoading(true);
    try {
      setRequests(await listMySupportRequests());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadInitialRequests() {
      try {
        const loaded = await listMySupportRequests();
        if (active) setRequests(loaded);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load your requests.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialRequests();
    return () => { active = false; };
  }, []);

  async function requestDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "DELETE") {
      setError("Type DELETE exactly to submit an account deletion request.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createSupportRequest({
        category: "account_deletion",
        subject: "Account deletion request",
        message: "I am requesting review of deletion for the account currently signed in. I understand that shared League records may be retained only in de-identified form where needed to preserve an activity.",
      });
      setConfirmation("");
      setDeletionOpen(false);
      setMessage("Your account-deletion request has been sent for review.");
      await loadRequests();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your deletion request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6">
      <Card className="p-6">
        <div className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><ShieldCheck size={18} /></span><div><p className="text-sm font-bold">Privacy and account controls</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Your sign-in email ({email ?? "not available"}) is private and is not shown in public profiles or League directories. Your ordinary profile displays only the information you intentionally save for that purpose.</p></div></div>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/privacy" className="inline-flex h-10 items-center rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[var(--surface-subtle)]">Read Privacy Notice</Link><Link href="/contact" className="inline-flex h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">Request data help</Link></div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold">Your support requests</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">You can see the status and final public response to requests sent from this account. Administrator working notes remain private.</p></div><Button variant="secondary" size="sm" onClick={() => void loadRequests()} disabled={loading}>{loading ? <LoaderCircle size={14} className="animate-spin" /> : "Refresh"}</Button></div>
        {loading ? <p className="mt-5 text-sm text-[var(--ink-muted)]">Loading requests…</p> : requests.length === 0 ? <p className="mt-5 rounded-xl bg-[var(--canvas)] p-4 text-sm leading-6 text-[var(--ink-muted)]">You have not sent a request yet.</p> : <div className="mt-5 grid gap-3">{requests.map((request) => <article key={request.id} className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{request.subject}</p><span className="rounded-full bg-[var(--surface-strong)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--ink-muted)]">{statusLabel(request.status)}</span></div><p className="mt-2 text-xs text-[var(--ink-faint)]">{request.category.replaceAll("_", " ")} · {new Date(request.created_at).toLocaleDateString()}</p>{request.public_response && <div className="mt-3 rounded-lg bg-[var(--accent-soft)] p-3 text-xs leading-5 text-[var(--ink-muted)]"><span className="font-bold text-[var(--accent)]">Platform response: </span>{request.public_response}</div>}</article>)}</div>}
      </Card>

      <Card className="border-[color-mix(in_srgb,var(--red)_35%,var(--line))] p-6">
        <div className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--red-soft)] text-[var(--red)]"><Trash2 size={18} /></span><div><p className="text-sm font-bold">Request account deletion</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Deletion is reviewed by a platform administrator to protect shared work and League records. Private account information and personal workspace data are removed or anonymised where appropriate.</p></div></div>
        {!deletionOpen ? <Button variant="danger" className="mt-5" onClick={() => { setError(""); setMessage(""); setDeletionOpen(true); }}>Start deletion request</Button> : <form className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4" onSubmit={(event) => void requestDeletion(event)}><label className="grid gap-2 text-xs font-bold">Type DELETE to confirm this request<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm" autoComplete="off" /></label><div className="mt-4 flex gap-3"><Button variant="danger" type="submit" disabled={busy}>{busy && <LoaderCircle size={14} className="animate-spin" />}Submit for review</Button><Button variant="secondary" type="button" onClick={() => { setDeletionOpen(false); setConfirmation(""); }}>Cancel</Button></div></form>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]">{error}</p>}
        {message && <p className="mt-4 flex gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-xs leading-5 text-[var(--accent)]"><CheckCircle2 className="mt-.5 shrink-0" size={15} />{message}</p>}
      </Card>
    </div>
  );
}
