"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { getModel } from "@/lib/models/registry";
import { getExperimentAggregate, getPublishedExperiment, joinExperiment, type ExperimentRow, type ParameterPermissionRow } from "@/lib/supabase/experiments";

type Preview = ExperimentRow & { experiment_parameter_permissions: ParameterPermissionRow[] };

export default function JoinExperimentPage() {
  const { user, role, openAuth } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [experiment, setExperiment] = useState<Preview | null>(null);
  const [aggregate, setAggregate] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() ?? "";
    queueMicrotask(() => setCode(value));
    if (!value) { queueMicrotask(() => setLoading(false)); return; }
    void getPublishedExperiment(value).then(async (row) => { setExperiment(row); if (row?.aggregate_published && row.result_visibility === "aggregate") setAggregate(await getExperimentAggregate(row.id)); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load this experiment.")).finally(() => setLoading(false));
  }, []);

  async function join() {
    if (!user) { openAuth("sign-in"); return; }
    if (role !== "student" || !experiment) return;
    setJoining(true); setError("");
    try { await joinExperiment(experiment.id); router.push(`/experiments/run?code=${experiment.code}`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not join this experiment."); }
    finally { setJoining(false); }
  }

  if (loading) return <main className="grid min-h-[65vh] place-items-center text-sm text-[var(--ink-muted)]">Loading experiment…</main>;
  if (!experiment) return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Experiment {code || "code"}</p><h1 className="mt-3 text-3xl font-bold">Experiment not available</h1><p className="mt-3 text-sm text-[var(--ink-muted)]">Check the eight-character code. Only published experiments can be previewed.</p></div></main>;

  const model = getModel(experiment.model_key);
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8">
    <header className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-xs font-bold text-[var(--accent)]">{experiment.code}</p><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Published</span></div>
      <p className="mt-8 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--ink-faint)]">{model?.title}</p><h1 className="mt-2 text-4xl font-bold tracking-[-.04em]">{experiment.title}</h1><p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">{experiment.context}</p>
    </header>
    {error && <p className="mt-5 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.65fr]">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-sm font-bold">Objective</h2><p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">{experiment.objective}</p><h2 className="mt-8 text-sm font-bold">Prediction prompt</h2><p className="mt-3 text-sm leading-6">{experiment.prediction_question}</p><div className="mt-8 flex items-center gap-2 rounded-lg bg-[var(--canvas)] p-4 text-xs text-[var(--ink-muted)]"><LockKeyhole size={16} className="shrink-0 text-[var(--accent)]" />Correct answers, target thresholds, and scoring rules remain hidden from students.</div></section>
      <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-sm font-bold">Participation</h2><div className="mt-4 space-y-3 text-xs leading-5 text-[var(--ink-muted)]"><p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />Runs are calculated deterministically and stored only when you press Run.</p><p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />Your report is private unless you create a share link.</p></div>
        {!user ? <Button className="mt-6 w-full" onClick={() => openAuth("sign-in")}><LogIn size={15} />Sign in to join</Button> : role === "student" ? <Button className="mt-6 w-full" disabled={joining} onClick={() => void join()}>{joining ? "Joining…" : "Join experiment"}<ArrowRight size={15} /></Button> : <p className="mt-6 rounded-lg bg-[var(--accent-soft)] p-4 text-xs font-bold text-[var(--accent)]">Teacher accounts can preview this experiment but cannot join as students.</p>}
      </aside>
    </div>
    {aggregate && <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-sm font-bold">Published anonymous aggregate</h2><p className="mt-2 text-xs text-[var(--ink-muted)]">No participant names or individual records are included.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(aggregate).filter(([, value]) => typeof value === "number").map(([key, value]) => <div key={key} className="rounded-lg bg-[var(--canvas)] p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">{key.replaceAll("_", " ")}</p><p className="mt-2 font-mono text-xl font-bold">{Number(value).toFixed(key.includes("rate") || key.includes("score") ? 1 : 0)}</p></div>)}</div></section>}
  </main>;
}
