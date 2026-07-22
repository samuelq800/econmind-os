"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { listStudentSubmissions, type SubmissionRow } from "@/lib/supabase/experiments";

export default function ExperimentHistoryPage() {
  const { user, role, openAuth } = useAuth(); const [rows, setRows] = useState<SubmissionRow[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (user && role === "student") void listStudentSubmissions().then(setRows).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load history.")); }, [user, role]);
  if (!user || role !== "student") return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center"><div><h1 className="text-3xl font-bold">Student sign-in required</h1><Button className="mt-5" onClick={() => openAuth("sign-in")}>Sign in</Button></div></main>;
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8"><header><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Private records</p><h1 className="mt-2 text-4xl font-bold">Submission history</h1><p className="mt-3 text-sm text-[var(--ink-muted)]">Each report is private by default. Submissions remain immutable across teacher resets.</p></header>{error && <p className="mt-5 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}<div className="mt-8 space-y-3">{rows.map((row) => <Link key={row.id} href={`/experiments/report?id=${row.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><span className="flex min-w-0 items-center gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><FileText size={17} /></span><span className="min-w-0"><b className="block truncate text-sm">{row.experiment?.title ?? "Experiment report"}</b><span className="mt-1 block text-[10px] text-[var(--ink-faint)]">{new Date(row.created_at).toLocaleString()} · {row.feedback_released ? `Score ${row.final_score.toFixed(1)}` : "Submitted — feedback pending"}</span></span></span><ArrowRight size={14} className="shrink-0 text-[var(--accent)]" /></Link>)}{rows.length === 0 && <p className="rounded-xl border border-dashed border-[var(--line)] p-12 text-center text-sm text-[var(--ink-muted)]">No submitted experiments yet.</p>}</div></main>;
}
