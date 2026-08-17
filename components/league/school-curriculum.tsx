"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, LogIn, School2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CURRICULUM_SYSTEM_LABELS, CURRICULUM_SYSTEMS, type CurriculumSystem } from "@/lib/league/curriculum";
import type { LeagueContext } from "@/lib/league/types";
import { getLeagueContext, updateLeagueSchoolCurriculum } from "@/lib/supabase/league";

export function SchoolCurriculum() {
  const { user, roleLoading, openAuth } = useAuth();
  const [context, setContext] = useState<LeagueContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [curriculumSystem, setCurriculumSystem] = useState<"" | CurriculumSystem>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    queueMicrotask(() => { if (active) setLoading(true); });
    void getLeagueContext(user.id)
      .then((next) => {
        if (!active) return;
        setContext(next);
        setCurriculumSystem(next.school?.curriculum_system ?? "");
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load your school.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  async function save() {
    if (!context?.school || !curriculumSystem) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const updated = await updateLeagueSchoolCurriculum({ schoolId: context.school.id, curriculumSystem });
      setContext((current) => current ? { ...current, school: updated } : current);
      setMessage(`${updated.name} is now marked as ${CURRICULUM_SYSTEM_LABELS[curriculumSystem]}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the curriculum system.");
    } finally {
      setBusy(false);
    }
  }

  const isSchoolLeader = context?.profile?.platform_role === "school_leader";

  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-12 sm:px-8">
    <Link href="/league/schools" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><ArrowLeft size={14} /> League schools</Link>
    <header className="mt-10">
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Temporary school information page</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-.055em]">Set your school’s curriculum.</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-muted)]">Share this page with your School Leader. It automatically identifies their registered school, so they can only update their own school.</p>
    </header>

    {!user && <Card className="mt-8 p-7"><LogIn className="text-[var(--accent)]" size={22} /><h2 className="mt-5 text-xl font-bold">Sign in as the School Leader</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">This shared link has no school selector. After sign-in, it opens only the school registered to that School Leader account.</p><Button className="mt-5" onClick={() => openAuth("sign-in")}>Sign in</Button></Card>}

    {user && (roleLoading || loading) && <div className="grid min-h-48 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div>}

    {user && !roleLoading && !loading && !isSchoolLeader && <Card className="mt-8 p-7"><ShieldCheck className="text-[var(--accent)]" size={22} /><h2 className="mt-5 text-xl font-bold">School Leader access required</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Only the School Leader who registered a school can update its curriculum. Ask that account holder to open this same link.</p></Card>}

    {user && !roleLoading && !loading && isSchoolLeader && !context?.school && <Card className="mt-8 p-7"><School2 className="text-[var(--accent)]" size={22} /><h2 className="mt-5 text-xl font-bold">No registered school found</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">This School Leader account is not currently linked to an approved school. Please contact the League administrator if this is unexpected.</p></Card>}

    {user && !roleLoading && !loading && isSchoolLeader && context?.school && <Card className="mt-8 p-7"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><School2 size={19} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Your registered school</p><h2 className="mt-1 text-xl font-bold">{context.school.name}</h2></div></div><label className="mt-7 block text-sm font-bold">Curriculum system<select required value={curriculumSystem} onChange={(event) => setCurriculumSystem(event.target.value as "" | CurriculumSystem)} className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm font-normal outline-none focus:border-[var(--accent)]"><option value="">Select curriculum</option>{CURRICULUM_SYSTEMS.map((system) => <option key={system} value={system}>{CURRICULUM_SYSTEM_LABELS[system]}</option>)}</select></label><p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">Choose the programme that best describes your school’s economics learning pathway. “Other / mixed curriculum” is available when no single option applies.</p>{error && <p role="alert" className="mt-5 rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]">{error}</p>}{message && <p className="mt-5 flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-xs font-bold text-[var(--accent)]"><CheckCircle2 size={15} />{message}</p>}<Button className="mt-6" disabled={!curriculumSystem || busy} onClick={() => void save()}>{busy && <LoaderCircle className="animate-spin" size={15} />}{busy ? "Saving…" : "Save curriculum system"}</Button></Card>}
  </main>;
}
