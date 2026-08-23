"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupportRequest, type SupportCategory } from "@/lib/supabase/governance";

const CATEGORIES: readonly { value: SupportCategory; label: string; detail: string }[] = [
  { value: "general", label: "General support", detail: "Help using a feature or understanding a page." },
  { value: "privacy", label: "Privacy or data request", detail: "Ask about access, correction, or privacy handling." },
  { value: "account_deletion", label: "Account deletion request", detail: "Ask for review of deletion for this signed-in account." },
  { value: "report", label: "Report a concern", detail: "Report conduct, content, safety, or integrity concerns." },
  { value: "league_appeal", label: "League or challenge appeal", detail: "Request a review of a school, team, role, or attempt outcome." },
  { value: "security", label: "Security concern", detail: "Report a potential account, access, or platform security issue." },
];

export function ContactForm({ initialCategory = "general" }: { initialCategory?: SupportCategory }) {
  const [category, setCategory] = useState<SupportCategory>(initialCategory);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetReference, setTargetReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await createSupportRequest({ category, subject, message, targetType, targetReference });
      setSuccess("Your request has been sent. You can follow its status and final response from your Profile page.");
      setSubject("");
      setMessage("");
      setTargetType("");
      setTargetReference("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-8 grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-7">
      <label className="grid gap-2 text-xs font-bold">Request type
        <select value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)} className="h-11 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm font-medium">
          {CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <p className="-mt-2 text-xs leading-5 text-[var(--ink-muted)]">{CATEGORIES.find((option) => option.value === category)?.detail}</p>
      <label className="grid gap-2 text-xs font-bold">Subject
        <input required minLength={4} maxLength={180} value={subject} onChange={(event) => setSubject(event.target.value)} className="h-11 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" placeholder="Briefly describe what you need" />
      </label>
      <label className="grid gap-2 text-xs font-bold">Message
        <textarea required minLength={10} maxLength={6000} value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-40 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3 text-sm leading-6" placeholder="Include the context needed to review this request. Do not include passwords or unnecessary sensitive information." />
      </label>
      {category === "report" && <div className="grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-xs font-bold">What are you reporting? <input maxLength={80} value={targetType} onChange={(event) => setTargetType(event.target.value)} className="h-11 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" placeholder="e.g. Team page, challenge" /></label><label className="grid gap-2 text-xs font-bold">Relevant link or reference <input maxLength={300} value={targetReference} onChange={(event) => setTargetReference(event.target.value)} className="h-11 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" placeholder="Optional" /></label></div>}
      {category === "account_deletion" && <p className="flex gap-2 rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]"><ShieldAlert className="mt-.5 shrink-0" size={15} />Deletion requests are reviewed by a platform administrator. Shared League records may be retained only in de-identified form when required to preserve an activity.</p>}
      {error && <p role="alert" className="rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]">{error}</p>}
      {success && <p className="flex gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-xs leading-5 text-[var(--accent)]"><CheckCircle2 className="mt-.5 shrink-0" size={15} />{success}</p>}
      <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" size={15} />}{busy ? "Sending…" : "Send request"}</Button>
    </form>
  );
}
