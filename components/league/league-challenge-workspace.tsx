"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  History,
  LoaderCircle,
  LockKeyhole,
  Play,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  TIME_MACHINE_STAGES,
  advanceChallengeState,
  challengeDefinition,
  createChallengeInitialState,
  policyDefaults,
  scoreChallengeState,
  type PolicyValues,
} from "@/lib/economics/league-arena";
import {
  CHALLENGE_COUNTRY_ROLES,
  CHALLENGE_ROLE_LABELS,
  type ChallengeCountryRole,
  type LeagueAttemptMode,
  type LeagueChallenge,
  type LeagueChallengeAttempt,
  type LeagueChallengeRoleAssignment,
  type LeagueChallengeStageDecision,
  type LeagueLeaderboardRow,
} from "@/lib/league/async-challenge-types";
import { getLeagueContext } from "@/lib/supabase/league";
import {
  getLeagueChallengeLeaderboard,
  listChallengeAttemptDecisions,
  listChallengeRoleAssignments,
  listLeagueChallenges,
  listMyChallengeAttempts,
  lockLeagueChallengeStage,
  saveLeagueChallengeAttempt,
  startLeagueChallengeAttempt,
  submitLeagueChallengeAttempt,
} from "@/lib/supabase/league-challenges";

type WorkspaceProps = { slug: string; preferredMode?: LeagueAttemptMode };

export function LeagueChallengeWorkspace({ slug, preferredMode = "practice" }: WorkspaceProps) {
  const definition = challengeDefinition(slug);
  const { user, openAuth } = useAuth();
  const [mode, setMode] = useState<LeagueAttemptMode>(preferredMode);
  const [configuredChallenge, setConfiguredChallenge] = useState<LeagueChallenge | null>(null);
  const [attempt, setAttempt] = useState<LeagueChallengeAttempt | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<LeagueChallengeRoleAssignment[]>([]);
  const [decisions, setDecisions] = useState<LeagueChallengeStageDecision[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeagueLeaderboardRow[]>([]);
  const [policies, setPolicies] = useState<PolicyValues>(() => definition ? policyDefaults(definition.controls) : {});
  const [state, setState] = useState<Record<string, unknown>>(() => definition ? createChallengeInitialState(definition.slug) as Record<string, unknown> : {});
  const [stage, setStage] = useState(1);
  const [selectedRole, setSelectedRole] = useState<ChallengeCountryRole>("central_bank");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "official") queueMicrotask(() => setMode("official"));
  }, []);

  const load = useCallback(async () => {
    if (!definition || !user) {
      setLoading(false);
      return;
    }
    try {
      const [context, challengeRows] = await Promise.all([
        getLeagueContext(user.id),
        listLeagueChallenges(),
      ]);
      const databaseChallenge = challengeRows.find((challenge) => challenge.slug === definition.slug) ?? null;
      setConfiguredChallenge(databaseChallenge);
      setTeamId(context.membership?.team_id ?? null);
      if (databaseChallenge && context.membership?.team_id) {
        const attempts = await listMyChallengeAttempts(context.membership.team_id, databaseChallenge.id);
        const resumable = attempts.find((candidate) => candidate.mode === "official" && candidate.status === "active");
        if (resumable) {
          const [locked, roles] = await Promise.all([
            listChallengeAttemptDecisions(resumable.id),
            listChallengeRoleAssignments(resumable.id),
          ]);
          setAttempt(resumable);
          setMode("official");
          setStage(resumable.current_stage);
          setPolicies({ ...policyDefaults(definition.controls), ...(resumable.policy_state as PolicyValues) });
          setState({ ...createChallengeInitialState(definition.slug), ...resumable.simulation_state });
          setDecisions(locked);
          setRoleAssignments(roles);
          setMessage("Your saved official attempt has been restored. Earlier locked stages remain immutable.");
        }
      }
      if (databaseChallenge) setLeaderboard(await getLeagueChallengeLeaderboard(definition.slug));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this Challenge.");
    } finally {
      setLoading(false);
    }
  }, [definition, user]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const score = useMemo(() => definition ? scoreChallengeState(definition.slug, state) : null, [definition, state]);
  const currentStageLabel = definition?.stageLabels[stage - 1] ?? "Final results";
  const visibleControls = definition?.controls.filter((control) => control.role === selectedRole) ?? [];
  const activeRoles = roleAssignments.length
    ? Array.from(new Set(roleAssignments.filter((assignment) => assignment.user_id === user?.id).map((assignment) => assignment.role_type)))
    : CHALLENGE_COUNTRY_ROLES;
  const canProceed = mode === "practice" || activeRoles.length > 0;

  if (!definition) {
    return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-16"><h1 className="text-3xl font-bold">Challenge not found</h1><Link href="/league/arena" className="mt-6 inline-flex text-sm font-bold text-[var(--accent)]">Return to Simulation Arena <ArrowRight size={14} /></Link></main>;
  }
  const currentDefinition = definition;

  function resetPractice() {
    setAttempt(null);
    setMode("practice");
    setStage(1);
    setPolicies(policyDefaults(currentDefinition.controls));
    setState(createChallengeInitialState(currentDefinition.slug) as Record<string, unknown>);
    setDecisions([]);
    setRoleAssignments([]);
    setMessage("New practice simulation ready. It does not affect League standings.");
    setError("");
  }

  async function beginOfficial() {
    if (!user) return openAuth("sign-in");
    setBusy(true); setError("");
    try {
      const nextAttempt = await startLeagueChallengeAttempt({ challengeSlug: currentDefinition.slug, mode: "official", teamId });
      setAttempt(nextAttempt);
      setMode("official");
      setStage(1);
      setPolicies(policyDefaults(currentDefinition.controls));
      setState(createChallengeInitialState(currentDefinition.slug) as Record<string, unknown>);
      setRoleAssignments(CHALLENGE_COUNTRY_ROLES.map((role) => ({ id: `local-${role}`, attempt_id: nextAttempt.id, user_id: user.id, role_type: role, is_primary: true, assigned_by: user.id, created_at: new Date().toISOString() })));
      setDecisions([]);
      setMessage("Official attempt started. You hold all four portfolios by default; a Team Captain can later reassign roles without changing the Challenge rules.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start an official attempt.");
    } finally { setBusy(false); }
  }

  async function saveProgress() {
    if (!attempt) return;
    setBusy(true); setError("");
    try {
      const saved = await saveLeagueChallengeAttempt(attempt.id, policies, state);
      setAttempt(saved);
      setMessage("Official attempt saved. You can leave and resume it later.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this attempt.");
    } finally { setBusy(false); }
  }

  async function lockCurrentStage() {
    if (!canProceed || stage > currentDefinition.stageCount) return;
    setBusy(true); setError("");
    const nextState = advanceChallengeState(currentDefinition.slug, state, policies, stage) as Record<string, unknown>;
    const result = { score: scoreChallengeState(currentDefinition.slug, nextState), interactions: nextState.interactions ?? nextState.policyInteractions ?? nextState.competitorActions ?? [] };
    try {
      if (mode === "official") {
        if (!attempt) throw new Error("Start the official attempt before locking a stage.");
        const updated = await lockLeagueChallengeStage({ attemptId: attempt.id, stageNumber: stage, policyState: policies, simulationState: nextState, result });
        setAttempt(updated);
      }
      setState(nextState);
      setDecisions((current) => [...current, {
        id: `local-${stage}`, attempt_id: attempt?.id ?? "practice", stage_number: stage, policy_state: policies, simulation_state: nextState, result, locked_by: user?.id ?? "practice", locked_at: new Date().toISOString(),
      }]);
      setStage((current) => current + 1);
      setMessage(`Decision Stage ${stage} locked. ${stage < currentDefinition.stageCount ? "The next information set is now available." : "Your final score is ready to review."}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not lock this Decision Stage.");
    } finally { setBusy(false); }
  }

  async function submitOfficial() {
    if (!attempt || !score) return;
    setBusy(true); setError("");
    try {
      const submitted = await submitLeagueChallengeAttempt({
        attemptId: attempt.id,
        scoreBreakdown: { score: score.score, components: score.components },
        finalResult: { state, completed_at: new Date().toISOString() },
      });
      setAttempt(submitted);
      setMessage(`Official result submitted: ${submitted.final_score?.toFixed(1) ?? score.score.toFixed(1)} / 100. It is now immutable unless a platform administrator explicitly resets it.`);
      setLeaderboard(await getLeagueChallengeLeaderboard(currentDefinition.slug));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit this official attempt.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12">
      <Link href="/league/arena" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--accent)]"><ArrowLeft size={14} /> Simulation Arena</Link>
      <header className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">{definition.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-.055em] sm:text-5xl">{definition.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">{definition.summary}</p>
        </div>
        <div className="flex gap-2"><Badge className={mode === "official" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : ""}>{mode === "official" ? "Official attempt" : "Practice"}</Badge><Badge>{definition.stageCount} stages</Badge></div>
      </header>

      {error && <p role="alert" className="mt-5 rounded-xl border border-[var(--red)] bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">{error}</p>}
      {message && <p className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--accent-soft)] p-4 text-sm leading-6 text-[var(--accent)]"><CheckCircle2 className="mt-0.5 shrink-0" size={16} />{message}</p>}

      {loading ? <div className="grid min-h-80 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div> : <>
        <section className="mt-8 grid gap-5 xl:grid-cols-[.72fr_1.45fr_.83fr]">
          <aside className="space-y-5">
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Run mode</p>
              <div className="mt-4 grid gap-2">
                <Button variant={mode === "practice" ? "primary" : "secondary"} onClick={resetPractice} disabled={busy}><Play size={14} /> Practice freely</Button>
                <Button variant={mode === "official" ? "primary" : "secondary"} onClick={() => void beginOfficial()} disabled={busy || attempt?.status === "submitted" || configuredChallenge?.status !== "open"}><ShieldCheck size={14} /> Start official</Button>
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">Practice is unlimited. Official teams receive five attempts; the team’s highest submitted score ranks.</p>
            </Card>
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">My responsibilities</p>
              <div className="mt-4 space-y-2">
                {CHALLENGE_COUNTRY_ROLES.map((role) => <button type="button" key={role} onClick={() => setSelectedRole(role)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition ${selectedRole === role ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-subtle)]"}`}><span>{CHALLENGE_ROLE_LABELS[role]}</span><span>{activeRoles.includes(role) ? "Control" : "View"}</span></button>)}
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">One person may hold all four Challenge portfolios. Only assigned portfolio holders can save or lock an official Decision Stage.</p>
            </Card>
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Decision timeline</p>
              <ol className="mt-4 space-y-3">{definition.stageLabels.map((label, index) => <li key={label} className="flex gap-3 text-sm"><span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${index + 1 < stage ? "bg-[var(--accent)] text-white" : index + 1 === stage ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-subtle)] text-[var(--ink-faint)]"}`}>{index + 1 < stage ? "✓" : index + 1}</span><span className={index + 1 > stage ? "text-[var(--ink-faint)]" : "font-semibold"}>{label}</span></li>)}</ol>
            </Card>
          </aside>

          <section className="space-y-5">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-[var(--line)] bg-[var(--surface-subtle)] px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Decision Stage {Math.min(stage, definition.stageCount)} of {definition.stageCount}</p><h2 className="mt-1 text-xl font-bold">{currentStageLabel}</h2></div><Badge>{stage > definition.stageCount ? "Ready to submit" : "Information unlocked"}</Badge></div>
                {definition.simulationType === "time_machine" && stage <= TIME_MACHINE_STAGES.length && <p className="mt-3 flex items-center gap-2 text-xs text-[var(--ink-muted)]"><Clock3 size={14} /> Available as of {TIME_MACHINE_STAGES[stage - 1]?.date}. Future historical information is locked.</p>}
              </div>
              <div className="p-6">
                {stage <= definition.stageCount ? <>
                  <p className="text-sm leading-6 text-[var(--ink-muted)]">{definition.simulationType === "time_machine" ? TIME_MACHINE_STAGES[stage - 1]?.briefing : "Your chosen values remain active until changed. Effects marked delayed build through later Decision Stages."}</p>
                  <div className="mt-6 grid gap-4">{visibleControls.map((control) => <label key={control.key} className="rounded-xl bg-[var(--surface-subtle)] p-4"><div className="flex justify-between gap-4"><span className="text-sm font-bold">{control.label}</span><output className="font-mono text-sm font-bold text-[var(--accent)]">{policies[control.key]} {control.unit}</output></div><input className="mt-4 w-full accent-[var(--accent)]" type="range" min={control.min} max={control.max} step={control.step} value={policies[control.key] ?? control.defaultValue} onChange={(event) => setPolicies((current) => ({ ...current, [control.key]: Number(event.target.value) }))} disabled={mode === "official" && !activeRoles.includes(selectedRole)} /><p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]"><b className="mr-1 text-[var(--ink)]">{control.timing === "immediate" ? "Immediate:" : "Delayed:"}</b>{control.description}</p></label>)}</div>
                  <div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => void lockCurrentStage()} disabled={busy || !canProceed}><LockKeyhole size={15} /> Lock Decision Stage</Button>{mode === "official" && attempt && <Button variant="secondary" onClick={() => void saveProgress()} disabled={busy}><Save size={15} /> Save & leave</Button>}</div>
                </> : <>
                  <p className="text-sm leading-6 text-[var(--ink-muted)]">All Decision Stages are locked. Review the visible score components, then submit this official result. Submission creates a reusable anonymous Ghost Strategy.</p>
                  <div className="mt-6 flex flex-wrap gap-3">{mode === "official" && attempt?.status === "active" ? <Button onClick={() => void submitOfficial()} disabled={busy}><CheckCircle2 size={15} /> Submit official result</Button> : <Button onClick={resetPractice}><Play size={15} /> New practice run</Button>}<Link href="#replay" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold"><History size={15} /> Replay timeline</Link></div>
                </>}
              </div>
            </Card>
            <Card className="p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Why did this happen?</p><h2 className="mt-1 text-xl font-bold">Visible mechanisms</h2></div><Sparkles className="text-[var(--accent)]" size={20} /></div><div className="mt-5 space-y-3">{((state.interactions ?? state.policyInteractions ?? state.competitorActions ?? []) as string[]).length ? ((state.interactions ?? state.policyInteractions ?? state.competitorActions ?? []) as string[]).map((explanation) => <p key={explanation} className="rounded-lg bg-[var(--surface-subtle)] p-3 text-sm leading-6 text-[var(--ink-muted)]">{explanation}</p>) : <p className="text-sm leading-6 text-[var(--ink-muted)]">No special policy interaction is active yet. The model only exposes explained interactions, such as spending plus high interest rates or tariffs plus domestic investment.</p>}</div></Card>
          </section>

          <aside className="space-y-5">
            <Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Predicted performance</p><p className="mt-3 text-5xl font-bold tracking-[-.07em] text-[var(--accent)]">{score?.score.toFixed(1) ?? "—"}<span className="ml-1 text-lg text-[var(--ink-muted)]">/ 100</span></p><div className="mt-5 space-y-3">{score?.components.map((component) => <div key={component.label} className="border-t border-[var(--line)] pt-3"><div className="flex justify-between gap-2 text-sm"><span className="font-semibold">{component.label}</span><b className={component.points < 0 ? "text-[var(--red)]" : "text-[var(--accent)]"}>{component.points > 0 ? "+" : ""}{component.points.toFixed(1)}</b></div><p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">{component.detail}</p></div>)}</div></Card>
            <Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Team leaderboard</p><div className="mt-4 space-y-3">{leaderboard.slice(0, 5).map((entry) => <div key={entry.team_id} className="flex items-center justify-between gap-3 text-sm"><span><b className="mr-2 text-[var(--accent)]">{entry.rank}</b>{entry.team_name}<small className="ml-2 text-[var(--ink-faint)]">{entry.school_name}</small></span><b>{Number(entry.performance_score).toFixed(1)}</b></div>)}{leaderboard.length === 0 && <p className="text-sm leading-6 text-[var(--ink-muted)]">No official team result has been submitted yet. Rankings always use a team’s highest official score.</p>}</div></Card>
            <Card id="replay" className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Replay</p><div className="mt-4 space-y-3">{decisions.map((decision) => <div key={decision.id} className="rounded-lg bg-[var(--surface-subtle)] p-3"><p className="text-sm font-bold">Stage {decision.stage_number} locked</p><p className="mt-1 text-xs text-[var(--ink-muted)]">{new Date(decision.locked_at).toLocaleString()}</p></div>)}{decisions.length === 0 && <p className="text-sm leading-6 text-[var(--ink-muted)]">Your decision timeline will appear here as stages are locked.</p>}</div></Card>
          </aside>
        </section>
        <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-5 text-xs leading-5 text-[var(--ink-muted)]"><CircleAlert className="mr-2 inline text-[var(--accent)]" size={14} />{definition.simulationType === "time_machine" ? "Historical Data, calibrated values and stylised model results are deliberately labelled separately. This educational counterfactual is not an exact historical forecast." : definition.simulationType === "industry" ? "All firms are fictional. Standard agents and Ghosts use documented deterministic behaviour for comparable educational competition." : "World Economy Challenge is an asynchronous fixed-snapshot learning format. It does not change the persistent 12-country World Simulation."}</section>
      </>}
    </main>
  );
}
