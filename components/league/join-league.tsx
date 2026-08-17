"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CURRICULUM_SYSTEM_LABELS, CURRICULUM_SYSTEMS, type CurriculumSystem } from "@/lib/league/curriculum";
import type { LeagueApplication } from "@/lib/league/types";
import { listMyLeagueApplications, submitLeagueApplication } from "@/lib/supabase/league";

const statusCopy: Record<LeagueApplication["status"], string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

const initialForm = {
  school_name: "",
  club_name: "",
  contact_person: "",
  curriculum_system: "" as "" | CurriculumSystem,
  expected_teams: "1",
  expected_members: "5",
  preferred_language: "English" as LeagueApplication["preferred_language"],
  preferred_format: "either" as LeagueApplication["preferred_format"],
  organising_committee_interest: false,
  notes: "",
};

export function JoinLeague() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [applications, setApplications] = useState<LeagueApplication[]>([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    void listMyLeagueApplications()
      .then(setApplications)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load your applications."));
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !form.curriculum_system) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const application = await submitLeagueApplication({
        school_name: form.school_name.trim(),
        club_name: form.club_name.trim() || null,
        contact_person: form.contact_person.trim(),
        curriculum_system: form.curriculum_system,
        expected_teams: Number(form.expected_teams),
        expected_members: Number(form.expected_members),
        preferred_language: form.preferred_language,
        preferred_format: form.preferred_format,
        organising_committee_interest: form.organising_committee_interest,
        notes: form.notes.trim() || null,
      }, userId);
      setApplications((current) => [application, ...current]);
      setMessage("Your League application has been submitted.");
      setForm(initialForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your application.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8">
    <header className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">League access</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-.05em]">Bring your school into the pilot.</h1>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-muted)]">The first pilot needs one liaison, one 4–6 person team and one activity commitment. Do not submit sensitive school information.</p>
    </header>
    <div className="mt-9 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
      <Card className="p-6">
        <h2 className="text-lg font-bold">School participation form</h2>
        <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
          <label className="text-xs font-bold">School Name<input required maxLength={160} value={form.school_name} onChange={(event) => setForm({ ...form, school_name: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" /></label>
          <label className="text-xs font-bold">Curriculum system<select required value={form.curriculum_system} onChange={(event) => setForm({ ...form, curriculum_system: event.target.value as "" | CurriculumSystem })} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm"><option value="">Select curriculum</option>{CURRICULUM_SYSTEMS.map((system) => <option key={system} value={system}>{CURRICULUM_SYSTEM_LABELS[system]}</option>)}</select></label>
          <label className="text-xs font-bold">Economics Club Name<input maxLength={160} value={form.club_name} onChange={(event) => setForm({ ...form, club_name: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" /></label>
          <label className="text-xs font-bold">Contact Person<input required maxLength={120} value={form.contact_person} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold">Expected Number of Teams<input required min="1" max="50" type="number" value={form.expected_teams} onChange={(event) => setForm({ ...form, expected_teams: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" /></label>
            <label className="text-xs font-bold">Estimated Team Size<input required min="1" max="500" type="number" value={form.expected_members} onChange={(event) => setForm({ ...form, expected_members: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm" /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold">Preferred Language<select value={form.preferred_language} onChange={(event) => setForm({ ...form, preferred_language: event.target.value as LeagueApplication["preferred_language"] })} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm"><option>English</option><option>Chinese</option><option>Bilingual</option></select></label>
            <label className="text-xs font-bold">Preferred Format<select value={form.preferred_format} onChange={(event) => setForm({ ...form, preferred_format: event.target.value as LeagueApplication["preferred_format"] })} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-sm"><option value="either">Either</option><option value="online">Online</option><option value="offline">Offline</option></select></label>
          </div>
          <label className="flex items-start gap-3 text-xs leading-5"><input type="checkbox" checked={form.organising_committee_interest} onChange={(event) => setForm({ ...form, organising_committee_interest: event.target.checked })} className="mt-0.5 size-4 accent-[var(--accent)]" />Interest in joining the Core Organising Committee</label>
          <label className="text-xs font-bold">Additional Notes<textarea maxLength={2000} rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3 text-sm" /></label>
          {error && <p role="alert" className="rounded-lg bg-[var(--red-soft)] p-3 text-xs text-[var(--red)]">{error}</p>}
          {message && <p className="flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-xs font-bold text-[var(--accent)]"><CheckCircle2 size={14} />{message}</p>}
          <Button disabled={busy || !form.curriculum_system} type="submit">{busy && <LoaderCircle className="animate-spin" size={14} />}{busy ? "Submitting…" : "Submit application"}</Button>
        </form>
      </Card>
      <aside>
        <h2 className="text-lg font-bold">Your applications</h2>
        <div className="mt-4 space-y-3">
          {applications.map((application) => <Card key={application.id} className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--accent)]">{statusCopy[application.status]}</p><h3 className="mt-2 text-sm font-bold">{application.school_name}</h3><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{CURRICULUM_SYSTEM_LABELS[application.curriculum_system]} · Submitted {new Date(application.created_at).toLocaleDateString()}</p></Card>)}
          {applications.length === 0 && <Card className="p-6 text-sm leading-6 text-[var(--ink-muted)]">Your submission status will appear here: Submitted, Under Review, Approved or Rejected.</Card>}
        </div>
      </aside>
    </div>
  </main>;
}
