"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Copy,
  LoaderCircle,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import {
  COMMAND_CENTRE_SCENARIO,
  DEFAULT_POLICY,
  SECTOR_LABELS,
  advanceQuarter,
  calculateFiscalConstraint,
  calculateScores,
  createInitialCommandCentreState,
  fiscalAllocationTotal,
  recommendedPolicyForState,
  type AdvanceQuarterResult,
  type CommandCentreState,
  type FiscalAllocation,
  type PolicyPackage,
  type SectorKey,
} from "@/lib/economics/command-centre";
import type {
  SandboxMode,
  SandboxRound,
  SandboxRun,
  SandboxScenario,
} from "@/lib/league/command-centre-types";
import { getLeagueContext } from "@/lib/supabase/league";
import {
  abandonCommandCentreRun,
  createCommandCentreRun,
  duplicateCommandCentreRun,
  getCommandCentreRun,
  getCommandCentreScenario,
  listAccessibleCommandCentreRuns,
  submitCommandCentreRound,
} from "@/lib/supabase/command-centre";

type RunWithRounds = SandboxRun & { rounds: SandboxRound[] };
type Phase = "briefing" | "policy" | "review" | "transmission" | "report";
type MobileTab =
  "overview" | "economy" | "policy" | "stakeholders" | "timeline";
const sectorKeys: SectorKey[] = [
  "manufacturing",
  "technology",
  "services",
  "energy",
];
const allocationMeta: Array<{
  key: keyof FiscalAllocation;
  label: string;
  immediate: string;
  delayed: string;
  beneficiary: string;
  risk: string;
}> = [
  {
    key: "infrastructure",
    label: "Infrastructure",
    immediate: "Supports demand, construction and employment",
    delayed: "Raises productivity and manufacturing capacity",
    beneficiary: "Firms and workers",
    risk: "Raises debt",
  },
  {
    key: "welfare",
    label: "Welfare",
    immediate: "Protects purchasing power and confidence",
    delayed: "No direct productivity effect",
    beneficiary: "Vulnerable households",
    risk: "Fiscal pressure",
  },
  {
    key: "energySupport",
    label: "Energy Support",
    immediate: "Reduces cost-of-living and firm cost pressure",
    delayed: "Can create dependency",
    beneficiary: "Households and energy-intensive firms",
    risk: "Emissions and price signals",
  },
  {
    key: "greenTransition",
    label: "Green Transition",
    immediate: "Builds energy investment",
    delayed: "Lowers emissions and energy dependence",
    beneficiary: "Energy resilience",
    risk: "Benefits arrive with a lag",
  },
  {
    key: "fiscalReserve",
    label: "Fiscal Reserve",
    immediate: "Protects credibility and reserves",
    delayed: "Improves shock capacity",
    beneficiary: "Future fiscal space",
    risk: "Less current demand support",
  },
];

const metric = (
  label: string,
  value: string | number,
  note?: string,
  danger = false,
) => (
  <Card key={label} className="p-4">
    <p className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
      {label}
    </p>
    <p
      className={`mt-2 text-2xl font-bold tabular-nums ${danger ? "text-[var(--red)]" : ""}`}
    >
      {value}
    </p>
    {note && (
      <p className="mt-1 text-[10px] leading-4 text-[var(--ink-muted)]">
        {note}
      </p>
    )}
  </Card>
);
const compact = (value: number, suffix = "") =>
  `${value.toFixed(value < 1 ? 2 : 1)}${suffix}`;

export function CommandCentreStart({
  basePath = "/league/command-centre",
  dashboardPath = "/league/dashboard",
}: {
  basePath?: string;
  dashboardPath?: string;
} = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const [scenario, setScenario] = useState<SandboxScenario | null>(null);
  const [runs, setRuns] = useState<SandboxRun[]>([]);
  const [mode, setMode] = useState<SandboxMode>("personal");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [canRunTeam, setCanRunTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [nextScenario, context, nextRuns] = await Promise.all([
        getCommandCentreScenario(),
        getLeagueContext(user.id),
        listAccessibleCommandCentreRuns(),
      ]);
      setScenario(nextScenario);
      setRuns(nextRuns);
      const captain =
        context.membership?.team?.captain_user_id === user.id ||
        context.membership?.team_role === "captain";
      const eligible = Boolean(
        context.membership?.team &&
        (captain ||
          context.profile?.platform_role === "school_leader" ||
          context.profile?.platform_role === "platform_admin"),
      );
      setCanRunTeam(eligible);
      setTeamId(eligible ? (context.membership?.team_id ?? null) : null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load Command Centre.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);
  async function start() {
    if (!scenario) return;
    setBusy(true);
    setError("");
    try {
      const run = await createCommandCentreRun({
        scenarioId: scenario.id,
        mode,
        teamId: mode === "team" ? teamId : null,
        initialState: createInitialCommandCentreState(),
      });
      router.push(
        `${basePath}/run?run=${encodeURIComponent(run.id)}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the sandbox run.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8">
      <header className="grid gap-6 border-b border-[var(--line)] pb-10 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <Badge className="border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]">
            Beta · 30–45 min
          </Badge>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
            Economic Sandbox + Policy Lab
          </p>
          <h1 className="mt-3 max-w-4xl text-5xl font-bold tracking-[-.06em] sm:text-6xl">
            Economic Command Centre
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--ink-muted)]">
            Manage a complete economy through three quarters of fiscal
            constraints, sectoral pressure, stakeholder reactions and two
            deterministic crises.
          </p>
          <p className="mt-5 rounded-lg border border-[var(--amber)] bg-[var(--amber-soft)] p-3 text-xs leading-5 text-[var(--amber)]">
            <CircleAlert className="mr-2 inline" size={14} />
            This is an educational, stylised model designed to illustrate
            mechanisms and trade-offs. It is not a forecasting tool.
          </p>
        </div>
        <Card className="p-6">
          <p className="text-sm font-bold">Scenario structure</p>
          <ol className="mt-5 space-y-4">
            {COMMAND_CENTRE_SCENARIO.roundLabels.map((label, index) => (
              <li key={label} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent)]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-bold">
                    Quarter {index + 1}: {label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                    {index === 0
                      ? "Set a coordinated policy package under limited fiscal space."
                      : index === 1
                        ? "Respond to a 40% oil-price rise and its transmission."
                        : "Manage capital outflow, reserves and investor confidence."}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </header>
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]"
        >
          {error}
        </p>
      )}
      <section className="mt-8 grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
        <Card className="p-6">
          <h2 className="text-xl font-bold">Start a new run</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Only quarter submission writes to Supabase. Policy controls
            calculate locally until then.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("personal")}
              className={`rounded-xl border p-5 text-left ${mode === "personal" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)]"}`}
            >
              <UserRound className="text-[var(--accent)]" size={18} />
              <p className="mt-4 font-bold">Personal run</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                Private strategy, private history.
              </p>
            </button>
            <button
              type="button"
              disabled={!canRunTeam}
              onClick={() => setMode("team")}
              className={`rounded-xl border p-5 text-left disabled:cursor-not-allowed disabled:opacity-55 ${mode === "team" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)]"}`}
            >
              <UsersIcon />
              <p className="mt-4 font-bold">Team run</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                Shared viewing; only captain or school leader submits.
              </p>
            </button>
          </div>
          {!canRunTeam && (
            <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">
              Join a team first, then ask its captain or school leader to create
              the team run.
            </p>
          )}
          <Button
            className="mt-6"
            disabled={loading || busy || !scenario}
            onClick={() => void start()}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : (
              <Play size={15} />
            )}
            {busy ? "Creating…" : "Enter Command Centre"}
          </Button>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Resume a saved run</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                Only records you are permitted to view appear here.
              </p>
            </div>
            <Link
              href={dashboardPath}
              className="text-xs font-bold text-[var(--accent)]"
            >
              Dashboard <ArrowRight className="inline" size={13} />
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {runs
              .filter((run) => run.status !== "abandoned")
              .slice(0, 5)
              .map((run) => (
                <Link
                  key={run.id}
                  href={`${basePath}/run?run=${encodeURIComponent(run.id)}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] p-4 hover:bg-[var(--surface-subtle)]"
                >
                  <div>
                    <p className="text-sm font-bold">
                      {run.status === "completed"
                        ? (run.result_type ?? "Completed run")
                        : `Quarter ${run.current_round} in progress`}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--ink-faint)]">
                      {run.mode === "team"
                        ? (run.team?.name ?? "Team")
                        : "Personal"}{" "}
                      · updated {new Date(run.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ArrowRight className="text-[var(--accent)]" size={15} />
                </Link>
              ))}
            {!loading && runs.length === 0 && (
              <p className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--ink-muted)]">
                No Command Centre records yet. Start a three-quarter strategy
                above.
              </p>
            )}
            {loading && (
              <div className="grid h-28 place-items-center">
                <LoaderCircle className="animate-spin text-[var(--accent)]" />
              </div>
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}

export function CommandCentreRun({
  runId,
  basePath = "/league/command-centre",
  dashboardPath = "/league/dashboard",
}: {
  runId: string;
  basePath?: string;
  dashboardPath?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [run, setRun] = useState<RunWithRounds | null>(null);
  const [policy, setPolicy] = useState<PolicyPackage>(DEFAULT_POLICY);
  const [phase, setPhase] = useState<Phase>("briefing");
  const [preview, setPreview] = useState<AdvanceQuarterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("overview");
  const [canManageRun, setCanManageRun] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [next, context] = await Promise.all([
        getCommandCentreRun(runId),
        user ? getLeagueContext(user.id) : Promise.resolve(null),
      ]);
      if (!next)
        throw new Error(
          "This Command Centre run is unavailable or you do not have access.",
        );
      setRun(next);
      setPolicy(recommendedPolicyForState(next.current_state));

      const profile = context?.profile;
      const isPlatformAdmin = profile?.platform_role === "platform_admin";
      const isOwnPersonalRun = next.mode === "personal" && next.user_id === user?.id;
      const isTeamCaptain =
        context?.membership?.team_id === next.team_id &&
        (context.membership.team_role === "captain" ||
          next.team?.captain_user_id === user?.id);
      const isSchoolLeaderForTeam =
        profile?.platform_role === "school_leader" &&
        profile.school_id === next.team?.school_id;
      setCanManageRun(
        Boolean(
          isPlatformAdmin ||
            isOwnPersonalRun ||
            (next.mode === "team" && (isTeamCaptain || isSchoolLeaderForTeam)),
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load this run.",
      );
    } finally {
      setLoading(false);
    }
  }, [runId, user]);
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-[var(--accent)]" />
      </main>
    );
  if (!run || error)
    return (
      <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center">
        <div>
          <XCircle className="mx-auto text-[var(--red)]" />
          <h1 className="mt-5 text-3xl font-bold">Run unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            {error || "The record could not be found."}
          </p>
          <Link
            className="mt-6 inline-flex text-sm font-bold text-[var(--accent)]"
            href={basePath}
          >
            Back to Command Centre
          </Link>
        </div>
      </main>
    );
  const activeRun = run;
  const state = activeRun.current_state;
  const allocationTotal = fiscalAllocationTotal(policy.allocation);
  const isValid = allocationTotal === 100;
  const isViewer = !canManageRun;
  const fiscalConstraint = calculateFiscalConstraint(state.macro.debt);
  const activeScore = calculateScores(state);
  function setAllocation(key: keyof FiscalAllocation, value: number) {
    setPolicy((current) => ({
      ...current,
      allocation: {
        ...current.allocation,
        [key]: Math.max(0, Math.min(100, Math.round(value))),
      },
    }));
  }
  function resetRecommendation() {
    setPolicy(recommendedPolicyForState(state));
    setPreview(null);
  }
  function review() {
    try {
      if (!isValid)
        throw new Error(
          "Fiscal allocation must total exactly 100 points before submission.",
        );
      setPreview(advanceQuarter(state, policy));
      setPhase("review");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Review could not be generated.",
      );
    }
  }
  async function submit() {
    if (!preview) return;
    setSaving(true);
    setError("");
    try {
      const updated = await submitCommandCentreRound(activeRun.id, preview);
      setRun((current) =>
        current
          ? {
              ...current,
              ...updated,
              rounds: [
                ...current.rounds,
                {
                  id: `local-${preview.roundNumber}`,
                  run_id: current.id,
                  round_number: preview.roundNumber,
                  state_before: preview.stateBefore,
                  policy_package: preview.policy,
                  shock_applied: preview.shock,
                  pending_effects_before: preview.stateBefore.pendingEffects,
                  pending_effects_after: preview.stateAfter.pendingEffects,
                  state_after: preview.stateAfter,
                  explanations: preview.explanation,
                  score_snapshot: preview.scoreSnapshot,
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : current,
      );
      setPhase("transmission");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save this quarter.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function abandon() {
    setSaving(true);
    try {
      await abandonCommandCentreRun(activeRun.id);
      router.push(basePath);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not abandon this run.",
      );
    } finally {
      setSaving(false);
    }
  }
  const show = (tab: MobileTab) =>
    mobileTab === tab ? "block" : "hidden lg:block";
  return (
    <main className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">
              Economic Command Centre ·{" "}
              {run.mode === "team"
                ? (run.team?.name ?? "Team run")
                : "Personal run"}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-.04em]">
              Quarter {state.quarter} ·{" "}
              {COMMAND_CENTRE_SCENARIO.roundLabels[state.quarter - 1]}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{run.status}</Badge>
            <Button
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => router.push(dashboardPath)}
            >
              <Save size={14} />
              Save & exit
            </Button>
            {run.status !== "completed" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || isViewer}
                onClick={() => void abandon()}
              >
                <XCircle size={14} />
                Abandon
              </Button>
            )}
          </div>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="mx-auto mt-5 max-w-[1600px] rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]"
        >
          {error}
        </p>
      )}
      <div className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2 lg:hidden">
        {(
          [
            "overview",
            "economy",
            "policy",
            "stakeholders",
            "timeline",
          ] as MobileTab[]
        ).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${mobileTab === tab ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)]"}`}
          >
            {tab === "policy"
              ? "Policy Lab"
              : tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="mx-auto grid max-w-[1600px] gap-5 p-4 sm:p-6 xl:grid-cols-[1.1fr_1fr_.85fr]">
        <section className={`min-w-0 space-y-5 ${show("overview")}`}>
          <NationalDashboard state={state} score={activeScore.totalScore} />
          <div className={show("economy")}>
            <EconomicSandbox state={state} />
          </div>
          <div className={show("timeline")}>
            <Timeline state={state} rounds={run.rounds} />
          </div>
        </section>
        <section className={`min-w-0 space-y-5 ${show("policy")}`}>
          <PolicyLab
            policy={policy}
            state={state}
            allocationTotal={allocationTotal}
            fiscalConstraint={fiscalConstraint}
            disabled={isViewer || activeRun.status === "completed"}
            onPolicy={setPolicy}
            onAllocation={setAllocation}
            onReset={resetRecommendation}
          />
          {phase === "briefing" && (
            <Card className="p-5">
              <h2 className="text-lg font-bold">Economic briefing</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Inflation remains {state.macro.inflation.toFixed(1)}%,
                unemployment is {state.macro.unemployment.toFixed(1)}%, and
                effective fiscal space is {fiscalConstraint}/100. Review active
                pipeline and sector risks before choosing the package.
              </p>
              <Button
                className="mt-5"
                disabled={isViewer || activeRun.status === "completed"}
                onClick={() => setPhase("policy")}
              >
                Open Policy Lab <ArrowRight size={14} />
              </Button>
            </Card>
          )}
          {phase === "policy" && (
            <Card className="p-5">
              <h2 className="text-lg font-bold">Review readiness</h2>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                {isValid
                  ? "Your fiscal allocation totals exactly 100. Review the channels and contradictions before locking this quarter."
                  : `Allocation totals ${allocationTotal}/100. Adjust it before review.`}
              </p>
              <Button
                className="mt-5"
                disabled={!isValid || isViewer}
                onClick={review}
              >
                Review policy package <ArrowRight size={14} />
              </Button>
            </Card>
          )}
          {phase === "review" && preview && (
            <ReviewPanel
              preview={preview}
              onBack={() => setPhase("policy")}
              onSubmit={() => void submit()}
              saving={saving}
            />
          )}
          {phase === "transmission" && preview && (
            <TransmissionPanel
              preview={preview}
              onContinue={() => {
                if (preview.stateAfter.completed)
                  router.push(
                    `${basePath}/run/results?run=${encodeURIComponent(activeRun.id)}`,
                  );
                else {
                  setPolicy(recommendedPolicyForState(preview.stateAfter));
                  setPreview(null);
                  setPhase("report");
                }
              }}
            />
          )}
          {phase === "report" && preview && (
            <QuarterReport
              preview={preview}
              onNext={() => {
                setPreview(null);
                setPhase("briefing");
              }}
            />
          )}
        </section>
        <section className={`min-w-0 space-y-5 ${show("stakeholders")}`}>
          <ResourcesPanel state={state} fiscalConstraint={fiscalConstraint} />
          <StakeholdersPanel state={state} />
          <PolicyPipeline state={state} />
        </section>
      </div>
    </main>
  );
}

function NationalDashboard({
  state,
  score,
}: {
  state: CommandCentreState;
  score: number;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
            National dashboard
          </p>
          <h2 className="mt-1 text-xl font-bold">Live economic state</h2>
        </div>
        <Badge>Score {score.toFixed(1)}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metric(
          "GDP growth",
          compact(state.macro.growth, "%"),
          "Target: sustainable recovery",
          state.macro.growth < 0,
        )}
        {metric(
          "Inflation",
          compact(state.macro.inflation, "%"),
          "Target: price stability",
          state.macro.inflation > 4,
        )}
        {metric(
          "Unemployment",
          compact(state.macro.unemployment, "%"),
          "Lower is stronger",
          state.macro.unemployment > 7,
        )}
        {metric(
          "Debt",
          compact(state.macro.debt, "% GDP"),
          "Constrains fiscal space",
          state.macro.debt > 85,
        )}
        {metric("Approval", compact(state.macro.approval), "Political mandate")}
        {metric(
          "Emissions",
          compact(state.macro.emissions),
          "Lower supports transition",
          state.macro.emissions > 105,
        )}
        {metric(
          "Productivity",
          compact(state.macro.productivity),
          "Long-run capacity",
        )}
        {metric(
          "Inequality",
          compact(state.macro.inequality),
          "Lower is more equal",
          state.macro.inequality > 0.4,
        )}
      </div>
    </section>
  );
}
function EconomicSandbox({ state }: { state: CommandCentreState }) {
  return (
    <Card className="overflow-hidden p-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          Economic sandbox
        </p>
        <h2 className="mt-1 text-xl font-bold">Four connected sectors</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          Energy, investment, demand and public support flow through the sector
          structure.
        </p>
      </div>
      <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
        {sectorKeys.map((key) => {
          const sector = state.sectors[key];
          const risk =
            key === "energy" && sector.energy_dependency > 120
              ? "High energy risk"
              : sector.confidence < 45
                ? "Low confidence"
                : sector.investment_index < 85
                  ? "Investment pressure"
                  : "Monitoring";
          return (
            <div
              key={key}
              className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4"
            >
              <div className="flex justify-between gap-2">
                <p className="font-bold">{SECTOR_LABELS[key]}</p>
                <Badge
                  className={
                    risk === "Monitoring"
                      ? ""
                      : "border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]"
                  }
                >
                  {risk}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                <span>
                  Output{" "}
                  <b className="block text-sm">
                    {sector.output_index.toFixed(0)}
                  </b>
                </span>
                <span>
                  Employment{" "}
                  <b className="block text-sm">
                    {sector.employment_index.toFixed(0)}
                  </b>
                </span>
                <span>
                  Investment{" "}
                  <b className="block text-sm">
                    {sector.investment_index.toFixed(0)}
                  </b>
                </span>
                <span>
                  Confidence{" "}
                  <b className="block text-sm">
                    {sector.confidence.toFixed(0)}
                  </b>
                </span>
              </div>
              <p className="mt-3 text-[10px] text-[var(--ink-muted)]">
                Energy dependency {sector.energy_dependency.toFixed(0)} ·
                emissions {sector.emissions_index.toFixed(0)}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[10px] text-[var(--ink-faint)]">
        Energy flow → Manufacturing · Investment flow → Technology · Household
        demand → Services · Government support → all sectors
      </p>
    </Card>
  );
}
function PolicyLab({
  policy,
  state,
  allocationTotal,
  fiscalConstraint,
  disabled,
  onPolicy,
  onAllocation,
  onReset,
}: {
  policy: PolicyPackage;
  state: CommandCentreState;
  allocationTotal: number;
  fiscalConstraint: number;
  disabled: boolean;
  onPolicy: (policy: PolicyPackage) => void;
  onAllocation: (key: keyof FiscalAllocation, value: number) => void;
  onReset: () => void;
}) {
  const cost = Math.round(
    Math.abs(policy.interestRate - state.lastPolicy.interestRate) * 4 +
      Math.abs(policy.businessTaxRate - state.lastPolicy.businessTaxRate) *
        0.65,
  );
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
            Policy Lab
          </p>
          <h2 className="mt-1 text-xl font-bold">
            Choose one coordinated package
          </h2>
        </div>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={onReset}>
          <RotateCcw size={13} />
          Recommended
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold">
          Policy interest rate{" "}
          <b className="float-right text-[var(--accent)]">
            {policy.interestRate.toFixed(1)}%
          </b>
          <input
            aria-label="Policy interest rate"
            disabled={disabled}
            className="mt-3 w-full accent-[var(--accent)]"
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={policy.interestRate}
            onChange={(event) =>
              onPolicy({ ...policy, interestRate: Number(event.target.value) })
            }
          />
          <span className="mt-2 block font-normal leading-5 text-[var(--ink-muted)]">
            Current: {state.lastPolicy.interestRate.toFixed(1)}% · delayed
            inflation and activity effects.
          </span>
        </label>
        <label className="text-xs font-bold">
          Business tax rate{" "}
          <b className="float-right text-[var(--accent)]">
            {policy.businessTaxRate}%
          </b>
          <input
            aria-label="Business tax rate"
            disabled={disabled}
            className="mt-3 w-full accent-[var(--accent)]"
            type="range"
            min="15"
            max="35"
            step="1"
            value={policy.businessTaxRate}
            onChange={(event) =>
              onPolicy({
                ...policy,
                businessTaxRate: Number(event.target.value),
              })
            }
          />
          <span className="mt-2 block font-normal leading-5 text-[var(--ink-muted)]">
            Revenue versus investment and hiring trade-off.
          </span>
        </label>
      </div>
      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Fiscal allocation</p>
            <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
              Nominal budget 100 · Effective fiscal space {fiscalConstraint}/100
            </p>
          </div>
          <div
            className={`text-right text-sm font-bold ${allocationTotal === 100 ? "text-[var(--accent)]" : "text-[var(--red)]"}`}
          >
            {allocationTotal}/100
            <p className="text-[10px] font-normal">
              {allocationTotal === 100 ? "Ready to submit" : "Must equal 100"}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {allocationMeta.map((item) => (
            <label key={item.key} className="block">
              <span className="flex justify-between gap-3 text-xs font-bold">
                {item.label}
                <input
                  aria-label={`${item.label} allocation`}
                  disabled={disabled}
                  type="number"
                  min="0"
                  max="100"
                  value={policy.allocation[item.key]}
                  onChange={(event) =>
                    onAllocation(item.key, Number(event.target.value))
                  }
                  className="h-7 w-14 rounded border border-[var(--line)] bg-[var(--surface)] px-2 text-right text-xs"
                />
              </span>
              <input
                aria-label={`${item.label} allocation slider`}
                disabled={disabled}
                className="mt-2 w-full accent-[var(--accent)]"
                type="range"
                min="0"
                max="100"
                step="1"
                value={policy.allocation[item.key]}
                onChange={(event) =>
                  onAllocation(item.key, Number(event.target.value))
                }
              />
              <span className="grid gap-1 text-[10px] leading-4 text-[var(--ink-muted)] sm:grid-cols-2">
                <span>Now: {item.immediate}</span>
                <span>Next: {item.delayed}</span>
                <span>Benefits: {item.beneficiary}</span>
                <span className="text-[var(--red)]">Risk: {item.risk}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <p className="mt-4 rounded-lg bg-[var(--surface-subtle)] p-3 text-[11px] leading-5 text-[var(--ink-muted)]">
        Political capital cost: <b>{cost}</b>. Low political capital weakens
        execution. Debt above 80% reduces effective fiscal space without
        changing the nominal 100-point allocation.
      </p>
    </Card>
  );
}
function ResourcesPanel({
  state,
  fiscalConstraint,
}: {
  state: CommandCentreState;
  fiscalConstraint: number;
}) {
  return (
    <Card className="p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
        Resources
      </p>
      <h2 className="mt-1 text-xl font-bold">Constraints shape outcomes</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {[
          [
            "Fiscal Space",
            fiscalConstraint,
            "Debt limits future effectiveness",
          ],
          [
            "Political Capital",
            state.resources.politicalCapital,
            "Reform capacity",
          ],
          [
            "Foreign Reserves",
            state.resources.foreignReserves,
            "External resilience",
          ],
        ].map(([label, value, note]) => (
          <div key={String(label)}>
            <div className="flex justify-between text-xs font-bold">
              <span>{label}</span>
              <span>{Number(value).toFixed(0)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-[var(--surface-subtle)]">
              <div
                className="h-full bg-[var(--accent)]"
                style={{
                  width: `${Math.max(0, Math.min(100, Number(value)))}%`,
                }}
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--ink-muted)]">{note}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
function StakeholdersPanel({ state }: { state: CommandCentreState }) {
  const groups = [
    {
      label: "Households",
      values: [
        ["confidence", state.stakeholders.households.confidence],
        ["purchasing power", state.stakeholders.households.purchasing_power],
      ],
    },
    {
      label: "Firms",
      values: [
        ["business confidence", state.stakeholders.firms.business_confidence],
        ["investment intention", state.stakeholders.firms.investment_intention],
      ],
    },
    {
      label: "Investors",
      values: [
        ["confidence", state.stakeholders.investors.confidence],
        [
          "capital flow pressure",
          state.stakeholders.investors.capital_flow_pressure,
        ],
      ],
    },
  ];
  return (
    <Card className="p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
        Stakeholders
      </p>
      <h2 className="mt-1 text-xl font-bold">Reactions in the economy</h2>
      <div className="mt-5 space-y-4">
        {groups.map((group) => (
          <div
            key={group.label}
            className="rounded-lg border border-[var(--line)] p-4"
          >
            <p className="font-bold">{group.label}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
              {group.values.map(([label, value]) => (
                <span key={label} className="mr-2">
                  {label}: <b className="text-[var(--ink)]">{value}</b>
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
function PolicyPipeline({ state }: { state: CommandCentreState }) {
  return (
    <Card className="p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
        Policy Pipeline
      </p>
      <h2 className="mt-1 text-xl font-bold">Effects still arriving</h2>
      <div className="mt-4 space-y-3">
        {state.pendingEffects.map((effect) => (
          <div
            key={effect.id}
            className="rounded-lg bg-[var(--surface-subtle)] p-3"
          >
            <p className="text-xs font-bold">{effect.source_policy}</p>
            <p className="mt-1 text-[10px] leading-5 text-[var(--ink-muted)]">
              Arrives in {effect.rounds_remaining} quarter ·{" "}
              {effect.explanation}
            </p>
          </div>
        ))}
        {state.pendingEffects.length === 0 && (
          <p className="text-sm leading-6 text-[var(--ink-muted)]">
            No delayed effects are waiting yet. Policies submitted this quarter
            will appear here for the next one.
          </p>
        )}
      </div>
    </Card>
  );
}
function Timeline({
  state,
  rounds,
}: {
  state: CommandCentreState;
  rounds: SandboxRound[];
}) {
  return (
    <Card className="p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
        Timeline
      </p>
      <h2 className="mt-1 text-xl font-bold">Policy, shock and outcome</h2>
      <div className="mt-5 space-y-4">
        {rounds.map((round) => (
          <div
            key={round.id}
            className="border-l-2 border-[var(--accent)] pl-4"
          >
            <p className="text-xs font-bold">
              Quarter {round.round_number}
              {round.shock_applied ? ` · ${round.shock_applied.title}` : ""}
            </p>
            <p className="mt-1 text-[10px] leading-5 text-[var(--ink-muted)]">
              Rate {round.policy_package.interestRate}% · tax{" "}
              {round.policy_package.businessTaxRate}% · score{" "}
              {round.score_snapshot.totalScore.toFixed(1)}
            </p>
          </div>
        ))}
        <div className="border-l-2 border-dashed border-[var(--line)] pl-4 text-xs text-[var(--ink-muted)]">
          Current quarter {state.quarter} · pipeline has{" "}
          {state.pendingEffects.length} active effect
          {state.pendingEffects.length === 1 ? "" : "s"}
        </div>
      </div>
    </Card>
  );
}
function ReviewPanel({
  preview,
  onBack,
  onSubmit,
  saving,
}: {
  preview: AdvanceQuarterResult;
  onBack: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <Card className="border-[var(--accent)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
        Step 4 · Review package
      </p>
      <h2 className="mt-2 text-xl font-bold">
        Expected channels, not exact future scores
      </h2>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--ink-muted)]">
        {preview.explanation.transmission.slice(0, 4).map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg bg-[var(--amber-soft)] p-3 text-xs leading-5 text-[var(--amber)]">
        Political capital and fiscal constraints are applied at submission; this
        review intentionally does not reveal the complete outcome score.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="secondary" disabled={saving} onClick={onBack}>
          Return to policy
        </Button>
        <Button disabled={saving} onClick={onSubmit}>
          {saving ? (
            <LoaderCircle className="animate-spin" size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
          {saving ? "Submitting…" : "Submit and lock quarter"}
        </Button>
      </div>
    </Card>
  );
}
function TransmissionPanel({
  preview,
  onContinue,
}: {
  preview: AdvanceQuarterResult;
  onContinue: () => void;
}) {
  return (
    <Card className="border-[var(--accent)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
        Transmission View
      </p>
      <h2 className="mt-2 text-xl font-bold">
        Policy → Stakeholders → Sectors → Macro
      </h2>
      {preview.shock && (
        <div className="mt-4 rounded-lg bg-[var(--red-soft)] p-4 text-[var(--red)]">
          <p className="flex items-center gap-2 font-bold">
            <ShieldAlert size={16} />
            Breaking News · {preview.shock.title}
          </p>
          <p className="mt-2 text-xs leading-5">{preview.shock.description}</p>
        </div>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ["Policy", preview.explanation.policySummary],
          ["Stakeholder reaction", preview.explanation.stakeholderReaction[0]],
          ["Sector response", preview.explanation.sectorWinners[0]],
          [
            "Macro outcome",
            `Growth ${preview.stateAfter.macro.growth.toFixed(1)}% · inflation ${preview.stateAfter.macro.inflation.toFixed(1)}% · debt ${preview.stateAfter.macro.debt.toFixed(1)}% GDP`,
          ],
        ].map(([title, body]) => (
          <div
            key={title}
            className="rounded-lg border border-[var(--line)] p-4"
          >
            <p className="text-xs font-bold">{title}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
              {body}
            </p>
          </div>
        ))}
      </div>
      <Button className="mt-5" onClick={onContinue}>
        {preview.stateAfter.completed
          ? "Open final result"
          : "Open quarter report"}
        <ArrowRight size={14} />
      </Button>
    </Card>
  );
}
function QuarterReport({
  preview,
  onNext,
}: {
  preview: AdvanceQuarterResult;
  onNext: () => void;
}) {
  return (
    <Card className="p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
        Quarter Report
      </p>
      <h2 className="mt-2 text-xl font-bold">
        What changed, and what remains at risk
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["Strongest decision", preview.explanation.sectorWinners[0]],
          ["Largest trade-off", preview.explanation.tradeOff],
          ["Unintended consequence", preview.explanation.unintendedConsequence],
          ["Forward risk", preview.explanation.forwardRisk],
        ].map(([title, text]) => (
          <div
            key={title}
            className="rounded-lg bg-[var(--surface-subtle)] p-4"
          >
            <p className="text-xs font-bold">{title}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
              {text}
            </p>
          </div>
        ))}
      </div>
      <Button className="mt-5" onClick={onNext}>
        Start Quarter {preview.roundNumber + 1} <ArrowRight size={14} />
      </Button>
    </Card>
  );
}
export function CommandCentreResults({
  runId,
  basePath = "/league/command-centre",
  dashboardPath = "/league/dashboard",
}: {
  runId: string;
  basePath?: string;
  dashboardPath?: string;
}) {
  const router = useRouter();
  const [run, setRun] = useState<RunWithRounds | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void getCommandCentreRun(runId)
      .then((next) => {
        if (!next) throw new Error("Run unavailable");
        setRun(next);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Could not load result.",
        ),
      )
      .finally(() => setLoading(false));
  }, [runId]);
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  if (!run || error || !run.final_state)
    return (
      <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 text-center">
        <p>{error || "This final result is unavailable."}</p>
      </main>
    );
  const completedRun = run;
  const outcome = calculateScores(completedRun.final_state);
  async function duplicate(round?: SandboxRound) {
    try {
      const state = round?.state_after ?? completedRun.final_state;
      const next = await duplicateCommandCentreRun({
        sourceRunId: completedRun.id,
        mode: "personal",
        teamId: null,
        state: {
          ...state,
          completed: false,
          quarter: (round ? Math.min(3, round.round_number + 1) : 1) as
            1 | 2 | 3,
        },
        startRound: round ? Math.min(3, round.round_number + 1) : 1,
      });
      router.push(
        `${basePath}/run?run=${encodeURIComponent(next.id)}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not duplicate this strategy.",
      );
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
            Completed
          </Badge>
          <h1 className="mt-4 text-5xl font-bold tracking-[-.06em]">
            {completedRun.result_type}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Overall score{" "}
            <b className="text-[var(--ink)]">
              {outcome.totalScore.toFixed(1)} / 100
            </b>{" "}
            across eight transparent dimensions.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => void duplicate()}>
            <Copy size={14} />
            Duplicate strategy
          </Button>
          <Link
            href={dashboardPath}
            className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-bold text-[var(--accent)]"
          >
            Dashboard
          </Link>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]"
        >
          {error}
        </p>
      )}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(outcome.scores).map(([key, value]) => (
          <Card key={key} className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
              {key.replace(/([A-Z])/g, " $1")}
            </p>
            <p className="mt-3 text-3xl font-bold">{value.toFixed(1)}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded bg-[var(--surface-subtle)]">
              <div
                className="h-full bg-[var(--accent)]"
                style={{ width: `${value}%` }}
              />
            </div>
          </Card>
        ))}
      </section>
      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <EconomicSandbox state={completedRun.final_state} />
        <ResourcesPanel
          state={completedRun.final_state}
          fiscalConstraint={calculateFiscalConstraint(
            completedRun.final_state.macro.debt,
          )}
        />
      </section>
      <section className="mt-8">
        <h2 className="text-2xl font-bold">
          Replay and duplicate from a point
        </h2>
        <div className="mt-5 space-y-4">
          {completedRun.rounds.map((round) => (
            <Card key={round.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold">
                    Quarter {round.round_number}
                    {round.shock_applied
                      ? ` · ${round.shock_applied.title}`
                      : ""}
                  </p>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--ink-muted)]">
                    {round.explanations.policySummary}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                    {round.explanations.tradeOff}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={round.round_number === 3}
                  onClick={() => void duplicate(round)}
                >
                  Duplicate from here
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
function UsersIcon() {
  return <Building2 className="text-[var(--accent)]" size={18} />;
}
