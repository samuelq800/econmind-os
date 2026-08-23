"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, GraduationCap, LoaderCircle, MapPin, School2, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { CURRICULUM_SYSTEM_LABELS, CURRICULUM_SYSTEMS, type CurriculumSystem } from "@/lib/league/curriculum";
import { completeAccountOnboarding, getAccountOnboarding, listApprovedSchoolChoices, type ApprovedSchoolChoice, type OnboardingPath } from "@/lib/supabase/account-onboarding";

type SetupStep = "choose" | OnboardingPath;

const onboardingStoragePrefix = "econmind.account-onboarding.completed.";

function hasSavedOnboardingChoice(userId: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`${onboardingStoragePrefix}${userId}`) === "true";
}

function saveOnboardingChoice(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${onboardingStoragePrefix}${userId}`, "true");
}

const paths: Array<{ id: OnboardingPath; title: string; description: string; icon: typeof School2 }> = [
  { id: "school", title: "Choose an existing school", description: "Associate your account with an approved school. Join a team later with its invite code.", icon: School2 },
  { id: "create_school", title: "Create a school", description: "Submit a school for teacher approval. It does not create a League team or country automatically.", icon: Building2 },
  { id: "visitor", title: "Continue as a visitor", description: "Use individual learning tools now. You can apply to join the League later.", icon: UserRound },
];

export function AccountOnboarding() {
  const { user, roleLoading, viewerAccess, authOpen } = useAuth();
  const userId = user?.id ?? null;
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [completedUserId, setCompletedUserId] = useState<string | null>(null);
  const [step, setStep] = useState<SetupStep>("choose");
  const [schools, setSchools] = useState<ApprovedSchoolChoice[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [clubName, setClubName] = useState("");
  const [curriculumSystem, setCurriculumSystem] = useState<"" | CurriculumSystem>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!userId || roleLoading) return;
    let active = true;
    void getAccountOnboarding().then((profile) => {
      if (!active) return;
      const isComplete = Boolean(profile?.onboarding_path) || hasSavedOnboardingChoice(userId);
      if (profile?.onboarding_path) saveOnboardingChoice(userId);
      setCompletedUserId(isComplete ? userId : null);
      setCheckedUserId(userId);
    }).catch(() => {
      if (!active) return;
      setCompletedUserId(hasSavedOnboardingChoice(userId) ? userId : null);
      setCheckedUserId(userId);
    });
    return () => { active = false; };
  }, [userId, roleLoading]);

  useEffect(() => {
    if (step !== "school") return;
    let active = true;
    void listApprovedSchoolChoices().then((rows) => {
      if (active) setSchools(rows);
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not load approved schools.");
    });
    return () => { active = false; };
  }, [step]);

  if (authOpen || viewerAccess || !user || roleLoading || checkedUserId !== userId || completedUserId === userId) return null;

  function choose(next: OnboardingPath) {
    setError("");
    setMessage("");
    setStep(next);
  }

  async function finish(path: OnboardingPath) {
    if (!userId) return;
    setBusy(true);
    setError("");
    try {
      const result = await completeAccountOnboarding({
        path,
        schoolId: path === "school" ? selectedSchoolId : null,
        schoolName: path === "create_school" ? schoolName.trim() : undefined,
        clubName: path === "create_school" ? clubName.trim() : undefined,
        curriculumSystem: path === "create_school" && curriculumSystem ? curriculumSystem : undefined,
      });
      setMessage(result.path === "create_school" ? "School application submitted for teacher approval." : "Account setup complete.");
      saveOnboardingChoice(userId);
      setCompletedUserId(userId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete account setup.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="scroll-slim fixed inset-0 z-[110] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="account-setup-title">
    <div className="mx-auto my-6 w-full max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl sm:my-12 sm:p-7">
      <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--accent)]">Account setup · one-time choice</p>
      <h2 id="account-setup-title" className="mt-2 text-2xl font-bold tracking-[-.04em] sm:text-3xl">How would you like to enter EconMind OS?</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">Choose your school path before entering the platform. This does not grant a League role, team membership or country control by itself.</p>

      {step === "choose" && <div className="mt-7 grid gap-3 sm:grid-cols-3">{paths.map((option) => { const Icon = option.icon; return <button key={option.id} type="button" onClick={() => choose(option.id)} className="group rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[var(--shadow)]"><span className="grid size-9 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={18} /></span><p className="mt-5 text-sm font-bold">{option.title}</p><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{option.description}</p></button>; })}</div>}

      {step === "school" && <div className="mt-7"><div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold">Choose an approved school</h3><button type="button" onClick={() => setStep("choose")} className="text-xs font-bold text-[var(--accent)]">Back</button></div><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">After choosing, use your team’s invite code to become a League participant. A school selection alone cannot claim a country.</p><div className="scroll-slim mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">{schools.map((school) => <label key={school.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${selectedSchoolId === school.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--canvas)]"}`}><input type="radio" name="school" value={school.id} checked={selectedSchoolId === school.id} onChange={() => setSelectedSchoolId(school.id)} className="accent-[var(--accent)]" /><span className="min-w-0"><span className="block text-sm font-bold">{school.name}</span><span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">{school.city && <><MapPin size={11} />{school.city}</>}{school.city && school.club_name && <span>·</span>}{school.club_name}</span></span></label>)}{schools.length === 0 && <p className="rounded-lg bg-[var(--surface-subtle)] p-4 text-sm text-[var(--ink-muted)]">No approved schools are listed yet. You can submit a school instead or continue as a visitor.</p>}</div><Button className="mt-5 w-full" disabled={!selectedSchoolId || busy} onClick={() => void finish("school")}>{busy && <LoaderCircle className="animate-spin" size={15} />}Continue with selected school</Button></div>}

      {step === "create_school" && <div className="mt-7"><div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold">Submit a school for approval</h3><button type="button" onClick={() => setStep("choose")} className="text-xs font-bold text-[var(--accent)]">Back</button></div><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">A teacher administrator reviews this request before the school can create teams or participate in the world.</p><label className="mt-5 block text-xs font-bold">School name<input autoFocus required maxLength={160} value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]" placeholder="Your school" /></label><label className="mt-4 block text-xs font-bold">Curriculum system<select required value={curriculumSystem} onChange={(event) => setCurriculumSystem(event.target.value as "" | CurriculumSystem)} className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"><option value="">Select curriculum</option>{CURRICULUM_SYSTEMS.map((system) => <option key={system} value={system}>{CURRICULUM_SYSTEM_LABELS[system]}</option>)}</select></label><label className="mt-4 block text-xs font-bold">Economics club name <span className="font-normal text-[var(--ink-faint)]">(optional)</span><input maxLength={160} value={clubName} onChange={(event) => setClubName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]" placeholder="Economics Club" /></label><Button className="mt-5 w-full" disabled={schoolName.trim().length < 2 || !curriculumSystem || busy} onClick={() => void finish("create_school")}>{busy && <LoaderCircle className="animate-spin" size={15} />}Submit for approval</Button></div>}

      {step === "visitor" && <div className="mt-7 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-5"><GraduationCap className="text-[var(--accent)]" size={21} /><h3 className="mt-4 text-base font-bold">Learn as an individual first</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">You will have access to the individual learning systems. League team membership and the persistent World Simulation remain school-and-team based.</p><Button className="mt-5" disabled={busy} onClick={() => void finish("visitor")}>{busy && <LoaderCircle className="animate-spin" size={15} />}Continue as visitor</Button></div>}

      {error && <p role="alert" className="mt-5 rounded-lg bg-[var(--red-soft)] p-3 text-xs leading-5 text-[var(--red)]">{error}</p>}
      {message && <p className="mt-5 flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] p-3 text-xs font-bold text-[var(--accent)]"><CheckCircle2 size={15} />{message}</p>}
    </div>
  </div>;
}
