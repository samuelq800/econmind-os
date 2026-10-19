"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listMailRecipients } from "@/lib/supabase/admin-mail";
import { MAIL_RECIPIENT_GROUPS, filterMailRecipients, partitionMailRecipientDirectory, recipientEmails, type MailRecipient, type MailRecipientGroup } from "@/lib/mail/admin-mail";

export function MailRecipientPicker({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [directory, setDirectory] = useState<MailRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    void listMailRecipients().then((rows) => { if (active) setDirectory(rows); })
      .catch(() => { if (active) setLoadError("Could not load the user directory. Refresh to retry; manual addresses remain available."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <MailRecipientSelection value={value} disabled={disabled} onChange={onChange} directory={directory} loading={loading} loadError={loadError} />;
}

/** Presentational picker is independently testable without authentication or mail delivery. */
export function MailRecipientSelection({ value, disabled, onChange, directory: allRows, loading = false, loadError = "" }: {
  value: string; disabled: boolean; onChange: (value: string) => void; directory: MailRecipient[]; loading?: boolean; loadError?: string;
}) {
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [groups, setGroups] = useState<MailRecipientGroup[]>([]);
  const { eligible: directory, unavailable } = partitionMailRecipientDirectory(allRows);
  const schools = [...new Map(directory.filter((row) => row.school_id).map((row) => [row.school_id!, row.school_name || "Unnamed school"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const selected = new Set(value.split(/[,;\n]+/).map((email) => email.trim().toLowerCase()).filter(Boolean));
  const schoolMembers = directory.filter((row) => row.school_id === school);
  const matches = filterMailRecipients(directory, groups, school, search);
  function add(emails: string[]) {
    try { onChange(recipientEmails([value, ...emails].filter(Boolean).join(", ")).join(", ")); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Review recipients."); }
  }
  const inputClass = "w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm font-normal disabled:opacity-60";
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="text-xs font-bold">To</legend>
    <label className="block text-xs" htmlFor="mail-to">Email addresses<textarea id="mail-to" required rows={2} value={value} onChange={(event) => onChange(event.target.value)} placeholder="recipient@example.com, another@example.com" className={`mt-2 ${inputClass}`} /></label>
    <p className="text-xs text-[var(--ink-muted)]">Separate addresses with commas. Up to 500 recipients. Each receives a separate email; other addresses stay private.</p>
    {unavailable.length > 0 && <details className="rounded-lg border border-[var(--line)] bg-[var(--amber-soft)] p-3 text-xs text-[var(--ink)]">
      <summary className="cursor-pointer font-semibold">{unavailable.length} users excluded: invalid email addresses</summary>
      <p className="mt-2 leading-5">All category counts and bulk selections include valid email addresses only. These accounts remain unchanged; their addresses must be corrected before receiving mail.</p>
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">{unavailable.map((row) => <li key={row.user_id} className="break-all">{row.display_name || "Unnamed user"} — {row.email}</li>)}</ul>
    </details>}
    <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={disabled || loading || !!loadError || !directory.length} onClick={() => add(directory.map((row) => row.email))}>Select all users ({directory.length})</Button>
        <span aria-live="polite" className="text-xs text-[var(--ink-muted)]">{selected.size} email addresses selected</span>
        <Button type="button" size="sm" variant="ghost" disabled={disabled || !selected.size} onClick={() => { onChange(""); setError(""); }}>Clear recipients</Button>
      </div>
      <fieldset disabled={disabled || loading || !!loadError}>
        <legend className="mb-2 text-xs font-bold">Recipient categories</legend>
        <div className="grid gap-2 sm:grid-cols-2">{MAIL_RECIPIENT_GROUPS.map((group) => <label key={group.id} className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-xs"><input type="checkbox" checked={groups.includes(group.id)} onChange={(event) => setGroups((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} /><span>{group.label} ({directory.filter((row) => row.groups.includes(group.id)).length})</span></label>)}</div>
      </fieldset>
      <p className="text-xs text-[var(--ink-muted)]">Choose one or more categories, then add matching users. Categories combine; school and search narrow the result. Team founders are the original creators of non-dissolved Season 1 teams, even if captaincy has changed. Season 1 participants include current team members and available free agents. Individual participants have explicitly chosen the no-school path.</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs">Search users<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or school" className={`mt-2 ${inputClass}`} /></label>
      <label className="text-xs">School<select value={school} onChange={(event) => setSchool(event.target.value)} className={`mt-2 ${inputClass}`}><option value="">All schools</option>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" disabled={disabled || loading || !!loadError || !matches.length} onClick={() => add(matches.map((row) => row.email))}>Add matching users ({matches.length})</Button>
      {(groups.length > 0 || school || search) && <Button type="button" size="sm" variant="ghost" onClick={() => { setGroups([]); setSchool(""); setSearch(""); }}>Reset filters</Button>}
    </div>
    {school && <Button type="button" size="sm" variant="secondary" disabled={disabled || loading || !schoolMembers.length} onClick={() => add(schoolMembers.map((row) => row.email))}>Add entire school ({schoolMembers.length} users)</Button>}
    {loading ? <p role="status" className="text-xs">Loading users…</p> : <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--line)]">{matches.slice(0, 50).map((row) => <label key={row.user_id} className="flex cursor-pointer items-start gap-3 border-b border-[var(--line)] p-3 text-xs last:border-0"><input type="checkbox" checked={selected.has(row.email.toLowerCase())} onChange={(event) => event.target.checked ? add([row.email]) : onChange(value.split(/[,;\n]+/).map((email) => email.trim()).filter((email) => email.toLowerCase() !== row.email.toLowerCase()).join(", "))} /><span className="min-w-0 break-words"><strong>{row.display_name || row.email}</strong><span className="block break-all text-[var(--ink-muted)]">{row.email}</span><span className="block text-[var(--ink-muted)]">{row.school_name || "No school"}</span></span></label>)}{!matches.length && <p className="p-3 text-xs">No matching users with an email address.</p>}{matches.length > 50 && <p className="p-3 text-xs">Showing 50 of {matches.length}. Refine your search. Add entire school includes every member, regardless of this search.</p>}</div>}
    {loadError && <p role="alert" className="text-xs text-[var(--red)]">{loadError}</p>}
    {error && <p role="alert" className="text-xs text-[var(--red)]">{error}</p>}
  </fieldset>;
}
