"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listMailRecipients } from "@/lib/supabase/admin-mail";
import { recipientEmails, type MailRecipient } from "@/lib/mail/admin-mail";

export function MailRecipientPicker({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [directory, setDirectory] = useState<MailRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  useEffect(() => {
    let active = true;
    void listMailRecipients().then((rows) => { if (active) setDirectory(rows); })
      .catch(() => { if (active) setError("Could not load the user directory. Refresh to retry; manual addresses remain available."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const schools = [...new Map(directory.filter((row) => row.school_id).map((row) => [row.school_id!, row.school_name || "Unnamed school"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const selected = new Set(value.split(/[,;\n]+/).map((email) => email.trim().toLowerCase()));
  const schoolMembers = directory.filter((row) => row.school_id === school);
  const query = search.trim().toLowerCase();
  const matches = directory.filter((row) => (!school || row.school_id === school) && (!query || `${row.display_name || ""} ${row.email} ${row.school_name || ""}`.toLowerCase().includes(query)));
  function add(emails: string[]) {
    try { onChange(recipientEmails([value, ...emails].filter(Boolean).join(", ")).join(", ")); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Review recipients."); }
  }
  const inputClass = "w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm font-normal disabled:opacity-60";
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="text-xs font-bold">To</legend>
    <label className="block text-xs" htmlFor="mail-to">Email addresses<textarea id="mail-to" required rows={2} value={value} onChange={(event) => onChange(event.target.value)} placeholder="recipient@example.com, another@example.com" className={`mt-2 ${inputClass}`} /></label>
    <p className="text-xs text-[var(--ink-muted)]">Separate addresses with commas. Up to 500 recipients. Each receives a separate email; other addresses stay private.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs">Search users<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or school" className={`mt-2 ${inputClass}`} /></label>
      <label className="text-xs">School<select value={school} onChange={(event) => setSchool(event.target.value)} className={`mt-2 ${inputClass}`}><option value="">All schools</option>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    {school && <Button type="button" size="sm" variant="secondary" disabled={disabled || loading || !schoolMembers.length} onClick={() => add(schoolMembers.map((row) => row.email))}>Add entire school ({schoolMembers.length} users)</Button>}
    {loading ? <p role="status" className="text-xs">Loading users…</p> : <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--line)]">{matches.slice(0, 50).map((row) => <label key={row.user_id} className="flex cursor-pointer items-start gap-3 border-b border-[var(--line)] p-3 text-xs last:border-0"><input type="checkbox" checked={selected.has(row.email.toLowerCase())} onChange={(event) => event.target.checked ? add([row.email]) : onChange(value.split(/[,;\n]+/).map((email) => email.trim()).filter((email) => email.toLowerCase() !== row.email.toLowerCase()).join(", "))} /><span className="min-w-0 break-words"><strong>{row.display_name || row.email}</strong><span className="block break-all text-[var(--ink-muted)]">{row.email}</span><span className="block text-[var(--ink-muted)]">{row.school_name || "No school"}</span></span></label>)}{!matches.length && <p className="p-3 text-xs">No matching users with an email address.</p>}{matches.length > 50 && <p className="p-3 text-xs">Showing 50 of {matches.length}. Refine your search. Add entire school includes every member, regardless of this search.</p>}</div>}
    {error && <p role="alert" className="text-xs text-[var(--red)]">{error}</p>}
  </fieldset>;
}
