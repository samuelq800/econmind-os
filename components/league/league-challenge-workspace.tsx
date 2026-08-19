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
  FINANCIAL_NETWORK_STAGES,
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
  challengeRoleLabels,
  type ChallengeCountryRole,
  type LeagueAttemptMode,
  type LeagueChallenge,
  type LeagueChallengeAttempt,
  type LeagueChallengeRoleAssignment,
  type LeagueChallengeStageDecision,
} from "@/lib/league/async-challenge-types";
import { LEAGUE_SEASON } from "@/lib/league/league-season";
import { getLeagueContext } from "@/lib/supabase/league";
import {
  listChallengeAttemptDecisions,
  listChallengeRoleAssignments,
  listLeagueChallenges,
  listMyChallengeAttempts,
  lockLeagueChallengeStage,
  saveLeagueChallengeAttempt,
  submitLeagueChallengeAttempt,
} from "@/lib/supabase/league-challenges";

type WorkspaceProps = {
  slug: string;
  preferredMode?: LeagueAttemptMode;
  arenaPath?: string;
  standingsPath?: string;
  replayPath?: string;
};

export function LeagueChallengeWorkspace({
  slug,
  preferredMode = "practice",
  arenaPath = "/league/arena",
  standingsPath = "/league/standings",
  replayPath = "/league/replay",
}: WorkspaceProps) {
  const definition = challengeDefinition(slug);
  const { user } = useAuth();
  const [mode, setMode] = useState<LeagueAttemptMode>(preferredMode);
  const [attempt, setAttempt] = useState<LeagueChallengeAttempt | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<LeagueChallengeRoleAssignment[]>([]);
  const [decisions, setDecisions] = useState<LeagueChallengeStageDecision[]>([]);
  const [policies, setPolicies] = useState<PolicyValues>(() => definition ? policyDefaults(definition.controls) : {});
  const [state, setState] = useState<Record<string, unknown>>(() => definition ? createChallengeInitialState(definition.slug) as Record<string, unknown> : {});
  const [stage, setStage] = useState(1);
  const [selectedRole, setSelectedRole] = useState<ChallengeCountryRole>("central_bank");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [analysisTab, setAnalysisTab] = useState<"mechanism" | "score" | "data" | "assumptions">("mechanism");
  const [timeMachineDesk, setTimeMachineDesk] = useState<"portfolio" | "all">("all");

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "practice") queueMicrotask(() => setMode("practice"));
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
      if (databaseChallenge && context.membership?.team_id) {
        const attempts = await listMyChallengeAttempts(context.membership.team_id, databaseChallenge.id);
        const requestedAttemptId = new URLSearchParams(window.location.search).get("attempt");
        const resumable = attempts.find((candidate) => candidate.id === requestedAttemptId && candidate.mode === "official")
          ?? attempts.find((candidate) => candidate.mode === "official" && candidate.status === "active");
        if (resumable) {
          const [locked, roles] = await Promise.all([
            listChallengeAttemptDecisions(resumable.id),
            listChallengeRoleAssignments(resumable.id),
          ]);
          setAttempt(resumable);
          setMode("official");
          setStage(resumable.status === "submitted" ? definition.stageCount + 1 : resumable.current_stage);
          setPolicies({ ...policyDefaults(definition.controls), ...(resumable.policy_state as PolicyValues) });
          setState({ ...createChallengeInitialState(definition.slug), ...resumable.simulation_state });
          setDecisions(locked);
          setRoleAssignments(roles);
          setMessage(resumable.status === "submitted" ? "Completed official replay restored. Its score and locked decisions are immutable." : "Your saved official attempt has been restored. Earlier locked stages remain immutable.");
        }
      }
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
  const roleLabels = definition ? challengeRoleLabels(definition.simulationType) : CHALLENGE_ROLE_LABELS;
  const activeRoles = roleAssignments.length
    ? Array.from(new Set(roleAssignments.filter((assignment) => assignment.user_id === user?.id).map((assignment) => assignment.role_type)))
    : CHALLENGE_COUNTRY_ROLES;
  const showAllTimeMachineControls = definition?.simulationType === "time_machine" && timeMachineDesk === "all";
  const visibleControls = definition?.controls.filter((control) => showAllTimeMachineControls ? activeRoles.includes(control.role) : control.role === selectedRole) ?? [];
  const canProceed = mode === "practice" || activeRoles.length > 0;
  const showExactScore = mode === "practice" || decisions.length > 0 || attempt?.status === "submitted";

  if (!definition) {
    return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-16"><h1 className="text-3xl font-bold">Challenge not found</h1><Link href={arenaPath} className="mt-6 inline-flex text-sm font-bold text-[var(--accent)]">Return to Simulation Arena <ArrowRight size={14} /></Link></main>;
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit this official attempt.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12">
      <Link href={arenaPath} className="inline-flex items-center gap-2 text-xs font-bold text-[var(--accent)]"><ArrowLeft size={14} /> Simulation Arena</Link>
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
                <Button className="h-12" variant={mode === "practice" ? "primary" : "secondary"} onClick={resetPractice} disabled={busy}><Play size={15} /> START PRACTICE</Button>
                <Button variant="secondary" disabled><ShieldCheck size={14} /> Official opens with Season 1</Button>
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">Practice is unlimited. {LEAGUE_SEASON.title} Official mode is coming soon; it will keep each Team’s highest score across five attempts.</p>
            </Card>
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">My responsibilities</p>
              <div className="mt-4 space-y-2">
                {CHALLENGE_COUNTRY_ROLES.map((role) => <button type="button" key={role} onClick={() => setSelectedRole(role)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition ${selectedRole === role ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-subtle)]"}`}><span>{roleLabels[role]}</span><span>{activeRoles.includes(role) ? "Control" : "View"}</span></button>)}
              </div>
              {definition.simulationType === "time_machine" && <div className="mt-4 flex gap-2"><button type="button" onClick={() => setTimeMachineDesk("all")} className={`rounded-md px-3 py-2 text-xs font-bold ${timeMachineDesk === "all" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-subtle)] text-[var(--ink-muted)]"}`}>All my controls</button><button type="button" onClick={() => setTimeMachineDesk("portfolio")} className={`rounded-md px-3 py-2 text-xs font-bold ${timeMachineDesk === "portfolio" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-subtle)] text-[var(--ink-muted)]"}`}>One portfolio</button></div>}
              <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">One person may hold all four Challenge portfolios. Only assigned portfolio holders can save or lock an official Decision Stage.</p>
            </Card>
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Decision timeline</p>
              <ol className="mt-4 space-y-3">{definition.stageLabels.map((label, index) => <li key={label} className="flex gap-3 text-sm"><span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${index + 1 < stage ? "bg-[var(--accent)] text-white" : index + 1 === stage ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-subtle)] text-[var(--ink-faint)]"}`}>{index + 1 < stage ? "✓" : index + 1}</span><span className={index + 1 > stage ? "text-[var(--ink-faint)]" : "font-semibold"}>{label}</span></li>)}</ol>
            </Card>
          </aside>

          <section className="space-y-5">
            <SystemView simulationType={definition.simulationType} state={state} stage={stage} />
            <Card className="overflow-hidden p-0">
              <div className="border-b border-[var(--line)] bg-[var(--surface-subtle)] px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Decision Stage {Math.min(stage, definition.stageCount)} of {definition.stageCount}</p><h2 className="mt-1 text-xl font-bold">{currentStageLabel}</h2></div><Badge>{stage > definition.stageCount ? "Ready to submit" : "Information unlocked"}</Badge></div>
                {definition.simulationType === "time_machine" && stage <= TIME_MACHINE_STAGES.length && <p className="mt-3 flex items-center gap-2 text-xs text-[var(--ink-muted)]"><Clock3 size={14} /> Available as of {TIME_MACHINE_STAGES[stage - 1]?.date}. Future historical information is locked.</p>}
              </div>
              <div className="p-6">
                {stage <= definition.stageCount ? <>
                  <p className="text-sm leading-6 text-[var(--ink-muted)]">{definition.simulationType === "time_machine" ? TIME_MACHINE_STAGES[stage - 1]?.briefing : "Your chosen values remain active until changed. Effects marked delayed build through later Decision Stages."}</p>
                  <div className="mt-6 grid gap-4">{visibleControls.map((control) => <label key={control.key} className="rounded-xl bg-[var(--surface-subtle)] p-4"><div className="flex justify-between gap-4"><span><small className="mb-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[var(--accent)]">{showAllTimeMachineControls ? roleLabels[control.role] : "Current portfolio"}</small><b className="text-sm">{control.label}</b></span><output className="font-mono text-sm font-bold text-[var(--accent)]">{policies[control.key]} {control.unit}</output></div><input className="mt-4 w-full accent-[var(--accent)]" type="range" min={control.min} max={control.max} step={control.step} value={policies[control.key] ?? control.defaultValue} onChange={(event) => setPolicies((current) => ({ ...current, [control.key]: Number(event.target.value) }))} disabled={mode === "official" && !activeRoles.includes(control.role)} /><p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]"><b className="mr-1 text-[var(--ink)]">{control.timing === "immediate" ? "Immediate:" : "Delayed:"}</b>{control.description}</p></label>)}</div>
                  <div className="mt-6 flex flex-wrap gap-3"><Button className="h-14 w-full text-base sm:w-auto sm:min-w-64" onClick={() => void lockCurrentStage()} disabled={busy || !canProceed}><LockKeyhole size={17} /> LOCK DECISION</Button>{mode === "official" && attempt && <Button variant="secondary" onClick={() => void saveProgress()} disabled={busy}><Save size={15} /> Save & leave</Button>}</div>
                </> : <>
                  <p className="text-sm leading-6 text-[var(--ink-muted)]">All Decision Stages are locked. Review the visible score components, then submit this official result. Submission creates a reusable anonymous Ghost Strategy.</p>
                  <div className="mt-6 flex flex-wrap gap-3">{mode === "official" && attempt?.status === "active" ? <Button onClick={() => void submitOfficial()} disabled={busy}><CheckCircle2 size={15} /> Submit official result</Button> : <Button onClick={resetPractice}><Play size={15} /> New practice run</Button>}{attempt?.status === "submitted" && <Link href={replayPath} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold"><History size={15} /> View replay</Link>}</div>
                </>}
              </div>
            </Card>
            <Card className="p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Why did this happen?</p><h2 className="mt-1 text-xl font-bold">Visible mechanisms</h2></div><Sparkles className="text-[var(--accent)]" size={20} /></div><div className="mt-5 space-y-3">{((state.interactions ?? state.policyInteractions ?? state.competitorActions ?? []) as string[]).length ? ((state.interactions ?? state.policyInteractions ?? state.competitorActions ?? []) as string[]).map((explanation) => <p key={explanation} className="rounded-lg bg-[var(--surface-subtle)] p-3 text-sm leading-6 text-[var(--ink-muted)]">{explanation}</p>) : <p className="text-sm leading-6 text-[var(--ink-muted)]">No special policy interaction is active yet. The model only exposes explained interactions, such as spending plus high interest rates or tariffs plus domestic investment.</p>}</div></Card>
          </section>

          <aside className="space-y-5">
            <Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">{showExactScore ? "Performance score" : "Directional pressure"}</p>{showExactScore ? <><p className="mt-3 text-5xl font-bold tracking-[-.07em] text-[var(--accent)]">{score?.score.toFixed(1) ?? "—"}<span className="ml-1 text-lg text-[var(--ink-muted)]">/ 100</span></p><div className="mt-5 space-y-3">{score?.components.map((component) => <div key={component.label} className="border-t border-[var(--line)] pt-3"><div className="flex justify-between gap-2 text-sm"><span className="font-semibold">{component.label}</span><b className={component.points < 0 ? "text-[var(--red)]" : "text-[var(--accent)]"}>{component.points > 0 ? "+" : ""}{component.points.toFixed(1)}</b></div><p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">{component.detail}</p></div>)}</div></> : <DirectionalPressure simulationType={definition.simulationType} state={state} />}</Card>
            <Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Challenge fairness</p><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Official attempts hide exact predicted performance until a Decision Stage is locked. Team standings, other teams’ policies and Ghost rules remain outside the active workspace.</p><Link href={standingsPath} className="mt-4 inline-flex text-sm font-bold text-[var(--accent)]">View released standings <ArrowRight size={14} /></Link></Card>
            {attempt?.status === "submitted" && <Card className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--ink-faint)]">Completed attempt</p><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Your final result is immutable. Its decision history is now available in the dedicated Replay hub.</p><Link href={replayPath} className="mt-4 inline-flex text-sm font-bold text-[var(--accent)]"><History size={14} /> View replay</Link></Card>}
          </aside>
        </section>
        <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Analysis dock</p><h2 className="mt-1 text-lg font-bold">Mechanism, score and model context</h2></div><div className="flex flex-wrap gap-1">{(["mechanism", "score", "data", "assumptions"] as const).map((tab) => <button type="button" key={tab} onClick={() => setAnalysisTab(tab)} className={`rounded-md px-3 py-2 text-xs font-bold capitalize ${analysisTab === tab ? "bg-[var(--accent)] text-white" : "bg-[var(--canvas)] text-[var(--ink-muted)]"}`}>{tab}</button>)}</div></div><AnalysisDock tab={analysisTab} simulationType={definition.simulationType} score={score} state={state} /></section>
      </>}
    </main>
  );
}

function stateNumber(state: Record<string, unknown>, key: string) {
  const value = state[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function SystemView({ simulationType, state, stage }: { simulationType: LeagueChallenge["simulation_type"]; state: Record<string, unknown>; stage: number }) {
  const content = simulationType === "financial"
    ? [
      ["Profit", stateNumber(state, "profit"), "credits"],
      ["Capital ratio", stateNumber(state, "capitalRatio"), "%"],
      ["Liquidity ratio", stateNumber(state, "liquidityRatio"), "%"],
      ["Default risk", stateNumber(state, "defaultRisk"), "%"],
      ["Interbank exposure", stateNumber(state, "interbankExposure"), "% assets"],
    ]
    : simulationType === "industry"
      ? [["Units sold", stateNumber(state, "unitsSold"), ""], ["Market share", stateNumber(state, "marketShare"), "%"], ["Revenue", stateNumber(state, "revenue"), "credits"], ["Profit", stateNumber(state, "profit"), "credits"], ["Firm value", stateNumber(state, "firmValue"), ""]]
      : simulationType === "time_machine"
        ? [["Inflation", stateNumber(state, "inflation"), "%"], ["Unemployment", stateNumber(state, "unemployment"), "%"], ["Real output", stateNumber(state, "realOutput"), "index"], ["Debt", stateNumber(state, "debtToGdp"), "% GDP"], ["Energy security", stateNumber(state, "energySecurity"), "/ 100"], ["Oil dependence", stateNumber(state, "energyDependence"), "%"]]
        : [["Growth", stateNumber(state, "growth"), "%"], ["Inflation", stateNumber(state, "inflation"), "%"], ["Unemployment", stateNumber(state, "unemployment"), "%"], ["Debt", stateNumber(state, "debtToGdp"), "% GDP"], ["Domestic production", stateNumber(state, "domesticProduction"), "index"]];
  const financialStage = simulationType === "financial" ? FINANCIAL_NETWORK_STAGES[Math.min(stage, FINANCIAL_NETWORK_STAGES.length) - 1] : null;
  const bankStates = Array.isArray(state.bankStates) ? state.bankStates as Array<{ id?: string; label?: string; stress?: string }> : [];
  return <Card className="overflow-hidden p-0"><div className="border-b border-[var(--line)] bg-[var(--surface-subtle)] px-6 py-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">Main system view</p><h2 className="mt-1 text-xl font-bold">{financialStage?.title ?? (simulationType === "industry" ? "Fictional EV market" : simulationType === "time_machine" ? "Counterfactual economy" : "National economy")}</h2></div><div className="p-6"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{content.map(([label, value, unit]) => <div key={label} className="rounded-xl bg-[var(--surface-subtle)] p-3"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ink-faint)]">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-.04em]">{value === null ? "—" : value}<span className="ml-1 text-xs font-semibold text-[var(--ink-muted)]">{unit}</span></p></div>)}</div>{simulationType === "financial" && <div className="mt-5 rounded-xl border border-[var(--line)] p-4" aria-label="Financial Network diagram: Your Bank is connected to four fictional counterparties by interbank exposures."><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-bold text-white">Your Bank · {String(state.stress ?? "stable")}</span>{bankStates.map((bank) => <><span key={`line-${bank.id}`} aria-hidden className="h-px w-5 bg-[var(--line)]" /><span key={bank.id} className="rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-bold">{bank.label ?? "Network bank"} · {bank.stress ?? "stable"}</span></>)}</div><p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">Node labels communicate stress state without relying on colour. Interbank links can transmit losses and funding pressure in later stages.</p></div>}</div></Card>;
}

function DirectionalPressure({ simulationType, state }: { simulationType: LeagueChallenge["simulation_type"]; state: Record<string, unknown> }) {
  const pressures = simulationType === "financial"
    ? [["Capital", stateNumber(state, "capitalRatio"), "higher buffer reduces stress"], ["Liquidity", stateNumber(state, "liquidityRatio"), "withdrawal capacity"], ["Default risk", stateNumber(state, "defaultRisk"), "lower is safer"]]
    : simulationType === "industry"
      ? [["Demand", stateNumber(state, "unitsSold"), "sales pressure"], ["Margin", stateNumber(state, "profit"), "profit pressure"], ["Inventory", stateNumber(state, "inventory"), "lower is usually safer"]]
      : [["Inflation", stateNumber(state, "inflation"), "price pressure"], ["Output", stateNumber(state, simulationType === "world" ? "growth" : "realOutput"), "activity pressure"], ["Debt", stateNumber(state, "debtToGdp"), "fiscal pressure"]];
  return <div className="mt-4 space-y-3">{pressures.map(([label, value, detail]) => <div key={label} className="rounded-lg bg-[var(--surface-subtle)] p-3"><div className="flex justify-between gap-2 text-sm"><span className="font-semibold">{label}</span><span className="font-mono text-[var(--accent)]">{value ?? "—"}</span></div><p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">{detail}</p></div>)}<p className="text-xs leading-5 text-[var(--ink-muted)]">Exact Performance Score unlocks after you lock a Decision Stage. This prevents pre-submission parameter searching in official mode.</p></div>;
}

function AnalysisDock({ tab, simulationType, score, state }: { tab: "mechanism" | "score" | "data" | "assumptions"; simulationType: LeagueChallenge["simulation_type"]; score: ReturnType<typeof scoreChallengeState> | null; state: Record<string, unknown> }) {
  const interactions = (state.interactions ?? state.policyInteractions ?? state.competitorActions ?? []) as string[];
  if (tab === "score") return <div className="mt-5 grid gap-3 sm:grid-cols-3">{score?.components.map((component) => <div key={component.label} className="rounded-lg bg-[var(--canvas)] p-4"><p className="text-sm font-bold">{component.label}</p><p className="mt-2 text-2xl font-bold text-[var(--accent)]">{component.points.toFixed(1)}</p><p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{component.detail}</p></div>)}</div>;
  if (tab === "data") return <pre className="scroll-slim mt-5 overflow-x-auto rounded-lg bg-[var(--canvas)] p-4 text-xs leading-6 text-[var(--ink-muted)]">{JSON.stringify(state, null, 2)}</pre>;
  if (tab === "assumptions") return <p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">{simulationType === "financial" ? "This is a stylised educational banking system, not financial advice, a real bank-risk model, a regulatory stress test, or a prediction of real institutions. Assets equal liabilities plus capital at every displayed state." : simulationType === "time_machine" ? "Historical Data, calibrated values and stylised model results are labelled separately. The counterfactual does not claim to reproduce an exact historical forecast." : simulationType === "industry" ? "All firms are fictional. Standard competitors and Ghosts use documented deterministic behaviour for comparable educational competition." : "This fixed-snapshot Challenge is separate from the persistent 12-country World Simulation. Policies remain active until changed, with only documented immediate and delayed effects."}</p>;
  return <div className="mt-5 space-y-3">{interactions.length ? interactions.map((explanation) => <p key={explanation} className="rounded-lg bg-[var(--canvas)] p-4 text-sm leading-6 text-[var(--ink-muted)]">{explanation}</p>) : <p className="text-sm leading-6 text-[var(--ink-muted)]"><CircleAlert className="mr-2 inline text-[var(--accent)]" size={14} />No special interaction is active yet. The workspace exposes only documented mechanisms rather than hidden coefficients.</p>}</div>;
}
