"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Copy,
  Gauge,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Printer,
  RotateCcw,
  Send,
  Target,
  TimerReset,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  checkEconBenchCondition,
  conditionLabel,
  defaultsForChallenge,
  humanize,
  previewEconBenchOutcomes,
  type EconBenchChallenge,
  type OutcomePreview,
} from "@/lib/economics/econbench";
import {
  econBenchProgressKey,
  listEconBenchProgress,
  saveEconBenchProgress,
  type EconBenchProgressSnapshot,
} from "@/lib/supabase/econbench";

type AnalysisTab = "Transmission" | "Model Charts" | "Projected Outcomes";
type Result = { correct: boolean; failed: string[]; submittedAt: string };

const storageKey = (id: string) => `econmind:econbench:${id}:v1`;
const claimConditions = (challenge: EconBenchChallenge) =>
  challenge.accept.all.filter(
    (condition) =>
      !/^select\s|^[a-z0-9_]+ between |^[a-z0-9_]+\s*(>=|<=|>|<)\s*/i.test(
        condition,
      ) && !condition.includes(" OR "),
  );
const requiredModels = (challenge: EconBenchChallenge) =>
  challenge.accept.all.flatMap(
    (condition) => condition.match(/^select\s+(.+)$/i)?.[1] ?? [],
  );
const displayNumber = (number: number) =>
  Math.abs(number) >= 10 ? number.toFixed(0) : number.toFixed(1);
const displayValue = (number: unknown, suffix = "") =>
  `${displayNumber(Number(number))}${suffix}`;

export function EconBenchWorkspace({
  challenge,
}: {
  challenge: EconBenchChallenge;
}) {
  const { user } = useAuth();
  const initialValues = useMemo(
    () => defaultsForChallenge(challenge),
    [challenge],
  );
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, number>>(initialValues);
  const [claims, setClaims] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<AnalysisTab>("Transmission");
  const [tested, setTested] = useState(false);
  const [testHistory, setTestHistory] = useState<
    Array<{ at: string; ready: boolean }>
  >([]);
  const [result, setResult] = useState<Result | null>(null);
  const [cloudStatus, setCloudStatus] = useState<
    "Local draft" | "Saving" | "Saved to learning record"
  >("Local draft");
  const [hydrated, setHydrated] = useState(false);
  const claimsRequired = claimConditions(challenge);
  const outcomes = useMemo(
    () => previewEconBenchOutcomes(challenge, values),
    [challenge, values],
  );
  const selectedRequired = requiredModels(challenge).every((model) =>
    selectedModels.includes(model),
  );
  const numericComplete = Object.entries(challenge.adjustable).every(
    ([key, [minimum, maximum]]) =>
      Number.isFinite(values[key]) &&
      values[key] >= minimum &&
      values[key] <= maximum,
  );
  const claimsComplete = claimsRequired.every((condition) => claims[condition]);
  const configurationIssues = [
    !selectedRequired && "Select each required model.",
    selectedModels.length > challenge.meta.maxModels &&
      `Select no more than ${challenge.meta.maxModels} models.`,
    !numericComplete &&
      "Complete every authorised intervention within its stated range.",
    !claimsComplete && "Complete the required interpretation statement.",
  ].filter(Boolean) as string[];
  const ready = configurationIssues.length === 0 && !result;
  const activeStage = result ? 4 : tested ? 3 : selectedModels.length ? 2 : 1;

  const snapshot = useCallback(
    (next?: Partial<EconBenchProgressSnapshot>): EconBenchProgressSnapshot => ({
      selectedModels,
      values,
      claims,
      activeStage,
      testHistory,
      submissionCount: testHistory.length + (result ? 1 : 0),
      finalResult: result?.correct ? "correct" : result ? "incorrect" : null,
      completedAt: result?.correct ? result.submittedAt : null,
      lastErrorCategory: result?.correct
        ? undefined
        : result?.failed[0]?.startsWith("select")
          ? "Model selection"
          : result?.failed[0]?.includes("reserve")
            ? "Constraint management"
            : "Policy design",
      ...next,
    }),
    [activeStage, claims, result, selectedModels, testHistory, values],
  );

  const applySnapshot = useCallback(
    (saved: Partial<EconBenchProgressSnapshot>) => {
      if (Array.isArray(saved.selectedModels))
        setSelectedModels(saved.selectedModels);
      if (saved.values && typeof saved.values === "object")
        setValues((current) => ({ ...current, ...saved.values }));
      if (saved.claims && typeof saved.claims === "object")
        setClaims(saved.claims);
      if (Array.isArray(saved.testHistory)) setTestHistory(saved.testHistory);
      if (saved.finalResult)
        setResult({
          correct: saved.finalResult === "correct",
          failed: [],
          submittedAt: saved.completedAt ?? new Date().toISOString(),
        });
    },
    [],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey(challenge.challenge_id));
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<EconBenchProgressSnapshot>;
        queueMicrotask(() => applySnapshot(saved));
      } catch {
        window.localStorage.removeItem(storageKey(challenge.challenge_id));
      }
    }
    queueMicrotask(() => setHydrated(true));
  }, [applySnapshot, challenge.challenge_id]);

  useEffect(() => {
    if (!user || !hydrated) return;
    void listEconBenchProgress(user.id)
      .then((rows) => {
        const cloud = rows.find(
          (row) =>
            row.model_key === econBenchProgressKey(challenge.challenge_id),
        );
        if (
          !window.localStorage.getItem(storageKey(challenge.challenge_id)) &&
          cloud?.last_parameters
        )
          applySnapshot(cloud.last_parameters);
      })
      .catch(() => undefined);
  }, [applySnapshot, challenge.challenge_id, hydrated, user]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      storageKey(challenge.challenge_id),
      JSON.stringify(snapshot()),
    );
  }, [challenge.challenge_id, hydrated, snapshot]);

  const saveCloud = async (next: EconBenchProgressSnapshot) => {
    if (!user) return;
    setCloudStatus("Saving");
    try {
      await saveEconBenchProgress({
        userId: user.id,
        challengeId: challenge.challenge_id,
        snapshot: next,
      });
      setCloudStatus("Saved to learning record");
    } catch {
      setCloudStatus("Local draft");
    }
  };
  const change = (key: string, next: number) => {
    setValues((current) => ({ ...current, [key]: next }));
    setTested(false);
    setResult(null);
    setCloudStatus("Local draft");
  };
  const toggleModel = (model: string) => {
    setSelectedModels((current) =>
      current.includes(model)
        ? current.filter((item) => item !== model)
        : current.length >= challenge.meta.maxModels
          ? current
          : [...current, model],
    );
    setTested(false);
    setResult(null);
    setCloudStatus("Local draft");
  };
  const reset = () => {
    setSelectedModels([]);
    setValues(initialValues);
    setClaims({});
    setTested(false);
    setTestHistory([]);
    setResult(null);
    setTab("Transmission");
    setCloudStatus("Local draft");
  };
  const testPolicy = () => {
    const entry = { at: new Date().toISOString(), ready };
    const nextHistory = [...testHistory, entry];
    setTestHistory(nextHistory);
    setTested(true);
    setCloudStatus(user ? "Saving" : "Local draft");
    void saveCloud(snapshot({ testHistory: nextHistory, activeStage: 3 }));
  };
  const submit = () => {
    if (!ready) return;
    const failed = challenge.accept.all.filter(
      (condition) =>
        !checkEconBenchCondition(condition, selectedModels, values, claims),
    );
    const next = {
      correct: failed.length === 0,
      failed,
      submittedAt: new Date().toISOString(),
    };
    setResult(next);
    setCloudStatus(user ? "Saving" : "Local draft");
    void saveCloud(
      snapshot({
        finalResult: next.correct ? "correct" : "incorrect",
        completedAt: next.correct ? next.submittedAt : null,
        activeStage: 4,
        submissionCount: testHistory.length + 1,
        lastErrorCategory: failed[0]?.startsWith("select")
          ? "Model selection"
          : failed[0]?.includes("reserve")
            ? "Constraint management"
            : "Policy design",
      }),
    );
  };

  return (
    <main className="econbench-print mx-auto min-h-[calc(100vh-4rem)] max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/econbench"
            className="no-print inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]"
          >
            <ArrowLeft size={14} />
            Back to EconBench
          </Link>
          <div className="flex flex-wrap gap-2">
            <Badge>{challenge.territory}</Badge>
            <Badge>{challenge.meta.category}</Badge>
            <Badge>
              {challenge.meta.difficulty} · {challenge.meta.minutes}
            </Badge>
            <Badge
              className={
                result?.correct
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : undefined
              }
            >
              {result
                ? result.correct
                  ? "Completed Correct"
                  : "Submitted Incorrect"
                : ready
                  ? "Ready to Submit"
                  : selectedModels.length
                    ? "In Progress"
                    : "Not Started"}
            </Badge>
          </div>
        </div>
        <p className="mt-4 text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
          CHALLENGE {challenge.challenge_id.slice(3, 5)} ·{" "}
          {challenge.challenge_id} · {challenge.territory.toUpperCase()}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-.05em] sm:text-4xl">
          {challenge.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
          {challenge.meta.objective} {challenge.meta.constraint}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <ChallengeProgress active={activeStage} />
          <span className="text-[10px] font-bold text-[var(--ink-faint)]">
            {user ? cloudStatus : "Saved locally on this device"}
          </span>
          <Button
            className="no-print"
            size="sm"
            variant="ghost"
            onClick={reset}
          >
            <RotateCcw size={13} />
            Reset Challenge
          </Button>
        </div>
      </header>
      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <aside className="econbench-briefing space-y-4 xl:col-span-3 xl:sticky xl:top-20 xl:self-start">
          <BriefingPanel challenge={challenge} />
        </aside>
        <section className="min-w-0 space-y-5 xl:col-span-6">
          <AnalysisWorkspace
            challenge={challenge}
            selectedModels={selectedModels}
            values={values}
            tab={tab}
            setTab={setTab}
            outcomes={outcomes}
          />
          <ModelToolkit
            challenge={challenge}
            selectedModels={selectedModels}
            onToggle={toggleModel}
          />
          <ClaimPanel
            conditions={claimsRequired}
            claims={claims}
            onChange={(condition, checked) => {
              setClaims((current) => ({ ...current, [condition]: checked }));
              setResult(null);
              setCloudStatus("Local draft");
            }}
          />
        </section>
        <aside className="econbench-policy space-y-4 xl:col-span-3 xl:sticky xl:top-20 xl:self-start">
          <PolicyDecision
            challenge={challenge}
            values={values}
            onChange={change}
            onReset={(key) => change(key, initialValues[key])}
          />
          <PolicyPackageSummary challenge={challenge} values={values} />
          <ChallengeValidation issues={configurationIssues} ready={ready} />
          <SubmissionActions
            ready={ready}
            tested={tested}
            result={result}
            onTest={testPolicy}
            onSubmit={submit}
          />
        </aside>
      </div>
      {result && (
        <ChallengeResult
          challenge={challenge}
          values={values}
          selectedModels={selectedModels}
          outcomes={outcomes}
          result={result}
          onRetry={() => {
            setResult(null);
            setTested(false);
          }}
        />
      )}
    </main>
  );
}

function ChallengeProgress({ active }: { active: number }) {
  return (
    <ol className="flex min-w-0 flex-1 flex-wrap gap-1.5">
      {["Briefing", "Select Models", "Design Policy", "Submit & Review"].map(
        (label, index) => (
          <li
            key={label}
            className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${index + 1 === active ? "bg-[var(--accent)] text-white" : index + 1 < active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-subtle)] text-[var(--ink-faint)]"}`}
          >
            {index + 1}. {label}
          </li>
        ),
      )}
    </ol>
  );
}

function BriefingPanel({ challenge }: { challenge: EconBenchChallenge }) {
  return (
    <>
      <Card className="p-4">
        <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
          CHALLENGE BRIEFING
        </p>
        <h2 className="mt-2 text-lg font-bold">Situation</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
          {challenge.meta.situation}
        </p>
        <p className="mt-3 rounded-md bg-[var(--surface-subtle)] p-2.5 text-[10px] leading-4 text-[var(--ink-muted)]">
          <strong className="text-[var(--ink)]">Affected:</strong>{" "}
          {challenge.meta.affectedActors}
        </p>
      </Card>
      <MetricGroup
        title="Initial State"
        tone="state"
        data={challenge.initial_state}
      />
      <MetricGroup title="Objectives" tone="objective" data={challenge.goal} />
      <MetricGroup
        title="Hard Constraints"
        tone="constraint"
        data={challenge.constraints}
      />
    </>
  );
}

function MetricGroup({
  title,
  tone,
  data,
}: {
  title: string;
  tone: "state" | "objective" | "constraint";
  data: Record<string, unknown>;
}) {
  const styles = {
    state: "border-[var(--line)] bg-[var(--surface)]",
    objective: "border-[var(--accent)] bg-[var(--accent-soft)]",
    constraint: "border-[var(--amber)] bg-[var(--amber-soft)]",
  };
  return (
    <Card className={`border ${styles[tone]} p-3`}>
      <p className="text-[10px] font-bold uppercase tracking-wide">{title}</p>
      <div className="mt-2 grid gap-2">
        {Object.entries(data).map(([key, raw]) => (
          <div
            key={key}
            className="flex items-start justify-between gap-2 rounded-md bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] p-2"
          >
            <span className="text-[10px] leading-4 text-[var(--ink-muted)]">
              {humanize(key.replace(/_(min|max)$/, ""))}
            </span>
            <strong className="text-right text-xs">
              {typeof raw === "number"
                ? `${key.endsWith("_max") ? "≤ " : key.endsWith("_min") ? "≥ " : ""}${displayValue(raw, key.includes("pct") || key.includes("gdp") ? "%" : key.includes("months") ? " months" : "")}`
                : humanize(String(raw))}
            </strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AnalysisWorkspace({
  challenge,
  selectedModels,
  values,
  tab,
  setTab,
  outcomes,
}: {
  challenge: EconBenchChallenge;
  selectedModels: string[];
  values: Record<string, number>;
  tab: AnalysisTab;
  setTab: (tab: AnalysisTab) => void;
  outcomes: OutcomePreview[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--line)] p-4">
        <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
          ECONOMIC ANALYSIS
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {(
            [
              "Transmission",
              "Model Charts",
              "Projected Outcomes",
            ] as AnalysisTab[]
          ).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${tab === item ? "bg-[var(--accent)] text-white" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 sm:p-5">
        {tab === "Transmission" ? (
          <TransmissionMap
            challenge={challenge}
            selectedModels={selectedModels}
          />
        ) : tab === "Model Charts" ? (
          <ChallengeCharts
            challenge={challenge}
            values={values}
            outcomes={outcomes}
          />
        ) : (
          <ProjectedOutcomes outcomes={outcomes} />
        )}
      </div>
    </Card>
  );
}

function TransmissionMap({
  challenge,
  selectedModels,
}: {
  challenge: EconBenchChallenge;
  selectedModels: string[];
}) {
  const steps =
    challenge.challenge_id === "EB-01-OIL-SHOCK"
      ? [
          [
            "Imported oil price rises",
            "Direct · immediate",
            "supply_shock_ad_as",
          ],
          [
            "Transport and production costs rise",
            "Direct · short-run",
            "supply_shock_ad_as",
          ],
          [
            "Short-run aggregate supply shifts left",
            "Direct · short-run",
            "supply_shock_ad_as",
          ],
          [
            "Inflation rises; output weakens",
            "Direct · short-run",
            "monetary_policy",
          ],
          [
            "Household real income falls",
            "Indirect · short-run",
            "targeted_fiscal_support",
          ],
        ]
      : [
          [
            challenge.scenario,
            "Direct · immediate",
            challenge.model_options[0],
          ],
          [
            "Economic mechanism transmits",
            "Direct · short-run",
            challenge.model_options[0],
          ],
          [
            "Policy choices alter the path",
            "Indirect · delayed",
            challenge.model_options[1] ?? challenge.model_options[0],
          ],
          [
            "Objectives and constraints determine feasibility",
            "Indirect · review",
            challenge.model_options[2] ?? challenge.model_options[0],
          ],
        ];
  return (
    <div>
      <p className="text-xs leading-5 text-[var(--ink-muted)]">
        Select model cards below to reveal which links each model explains. A
        link is highlighted only when its corresponding model is selected.
      </p>
      <ol className="mt-5 space-y-2">
        {steps.map(([text, detail, model], index) => {
          const active = selectedModels.includes(model);
          return (
            <li key={text} className="grid grid-cols-[26px_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-subtle)] text-[var(--ink-faint)]"}`}
                >
                  {index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span
                    className={`mt-1 h-5 w-px ${active ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`}
                  />
                )}
              </div>
              <div
                className={`rounded-lg border p-3 ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface-subtle)]"}`}
              >
                <p className="text-xs font-bold">{text}</p>
                <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                  {detail} · {humanize(model)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ChallengeCharts({
  challenge,
  values,
  outcomes,
}: {
  challenge: EconBenchChallenge;
  values: Record<string, number>;
  outcomes: OutcomePreview[];
}) {
  const [chart, setChart] = useState(0);
  const chartNames =
    challenge.challenge_id === "EB-01-OIL-SHOCK"
      ? ["AD–AS", "Inflation & output", "Household hardship", "Reserve path"]
      : ["Policy path", "Outcomes", "Trade-offs"];
  const selected = chartNames[chart] ?? chartNames[0];
  const inflation =
    outcomes.find((item) => item.key === "inflation_pct_max")?.value ?? 0;
  const poverty =
    outcomes.find((item) => item.key === "poverty_change_pp_max")?.value ?? 0;
  const reserve = values.reserve_release_pct ?? 0;
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {chartNames.map((name, index) => (
          <button
            key={name}
            onClick={() => setChart(index)}
            className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${chart === index ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)]"}`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3">
        <svg
          viewBox="0 0 520 230"
          className="h-56 w-full"
          role="img"
          aria-label={`${selected} interactive teaching chart`}
        >
          <line
            x1="50"
            y1="190"
            x2="485"
            y2="190"
            stroke="var(--line-strong)"
          />
          <line x1="50" y1="195" x2="50" y2="25" stroke="var(--line-strong)" />
          {chart === 0 ? (
            <>
              <path
                d="M70 160 C160 145 310 95 470 45"
                fill="none"
                stroke="var(--blue)"
                strokeWidth="3"
              />
              <path
                d="M70 58 C210 73 350 118 470 165"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
              />
              <path
                d="M70 40 C215 59 350 103 470 151"
                fill="none"
                stroke="var(--red)"
                strokeWidth="3"
                strokeDasharray="7 5"
              />
              <text x="70" y="30" fill="var(--red)" fontSize="11">
                Shock SRAS
              </text>
            </>
          ) : chart === 1 ? (
            <>
              <rect
                x="95"
                y={170 - Math.min(110, inflation * 13)}
                width="65"
                height={Math.min(110, inflation * 13)}
                fill="var(--red)"
                opacity=".72"
              />
              <rect
                x="210"
                y="120"
                width="65"
                height="50"
                fill="var(--ink-faint)"
                opacity=".55"
              />
              <rect
                x="325"
                y={170 - Math.min(110, Math.max(0, inflation) * 13)}
                width="65"
                height={Math.min(110, Math.max(0, inflation) * 13)}
                fill="var(--accent)"
                opacity=".82"
              />
              <text x="90" y="210" fill="var(--ink-muted)" fontSize="10">
                Shock
              </text>
              <text x="196" y="210" fill="var(--ink-muted)" fontSize="10">
                Baseline
              </text>
              <text x="306" y="210" fill="var(--ink-muted)" fontSize="10">
                Policy
              </text>
            </>
          ) : chart === 2 ? (
            <>
              <path
                d={`M75 70 L185 ${75 + Math.max(0, poverty) * 33} L300 ${70 + Math.max(0, poverty) * 20} L445 ${55 + Math.max(0, poverty) * 14}`}
                fill="none"
                stroke="var(--red)"
                strokeWidth="3"
              />
              <path
                d="M75 163 L445 163"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <text x="75" y="42" fill="var(--ink-muted)" fontSize="11">
                Household hardship pathway
              </text>
            </>
          ) : (
            <>
              <path
                d={`M75 60 L175 ${65 + reserve * 2} L290 ${76 + reserve * 2.2} L445 ${91 + reserve * 2.4}`}
                fill="none"
                stroke="var(--blue)"
                strokeWidth="3"
              />
              <path
                d="M75 150 L445 150"
                stroke="var(--amber)"
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <text x="75" y="42" fill="var(--ink-muted)" fontSize="11">
                Reserve buffer after release
              </text>
            </>
          )}
        </svg>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[var(--ink-muted)]">
          <span>
            <i className="mr-1 inline-block size-2 rounded-full bg-[var(--ink-faint)]" />
            Baseline
          </span>
          <span>
            <i className="mr-1 inline-block size-2 rounded-full bg-[var(--red)]" />
            Shock without policy
          </span>
          <span>
            <i className="mr-1 inline-block size-2 rounded-full bg-[var(--accent)]" />
            Current policy package
          </span>
        </div>
      </div>
    </div>
  );
}

function ProjectedOutcomes({ outcomes }: { outcomes: OutcomePreview[] }) {
  return (
    <div className="space-y-3">
      {outcomes.map((outcome) => (
        <OutcomeThreshold key={outcome.key} outcome={outcome} />
      ))}
      <p className="text-[10px] leading-5 text-[var(--ink-faint)]">
        These are browser-only working estimates from the disclosed teaching
        rules. They help test a policy package but do not determine the official
        Correct / Incorrect result.
      </p>
    </div>
  );
}
function OutcomeThreshold({ outcome }: { outcome: OutcomePreview }) {
  const pass =
    outcome.comparator === "max"
      ? outcome.value <= outcome.target
      : outcome.value >= outcome.target;
  const ratio = Math.max(
    4,
    Math.min(
      100,
      outcome.comparator === "max"
        ? (outcome.target / Math.max(Math.abs(outcome.value), 0.1)) * 100
        : (outcome.value / Math.max(Math.abs(outcome.target), 0.1)) * 100,
    ),
  );
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold">{outcome.label}</p>
          <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
            Projected {displayValue(outcome.value, outcome.unit)} ·{" "}
            {outcome.comparator === "max" ? "Target ≤" : "Constraint ≥"}{" "}
            {displayValue(outcome.target, outcome.unit)}
          </p>
        </div>
        <Badge
          className={
            pass
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-[var(--amber-soft)] text-[var(--amber)]"
          }
        >
          {pass
            ? outcome.source === "objective"
              ? "Within target"
              : "Constraint satisfied"
            : outcome.source === "objective"
              ? "Outside target"
              : "Constraint breached"}
        </Badge>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
        <span
          className={
            pass
              ? "block h-full bg-[var(--accent)]"
              : "block h-full bg-[var(--amber)]"
          }
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}

function ModelToolkit({
  challenge,
  selectedModels,
  onToggle,
}: {
  challenge: EconBenchChallenge;
  selectedModels: string[];
  onToggle: (model: string) => void;
}) {
  const notes = challenge.meta.modelNotes ?? {};
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
            MODEL TOOLKIT
          </p>
          <h2 className="mt-1 text-lg font-bold">
            Select the mechanisms you will use
          </h2>
        </div>
        <p className="text-[10px] text-[var(--ink-muted)]">
          {selectedModels.length}/{challenge.meta.maxModels} selected
        </p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {challenge.model_options.map((model) => {
          const selected = selectedModels.includes(model);
          const note = notes[model];
          const required = requiredModels(challenge).includes(model);
          return (
            <button
              key={model}
              aria-pressed={selected}
              onClick={() => onToggle(model)}
              className={`rounded-lg border p-3 text-left transition ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)]"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold">
                  {note?.role ?? humanize(model)}
                </p>
                {selected ? (
                  <CheckCircle2
                    size={15}
                    className="shrink-0 text-[var(--accent)]"
                  />
                ) : required ? (
                  <Badge>Required</Badge>
                ) : (
                  <Badge>Optional</Badge>
                )}
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[var(--ink-muted)]">
                {note?.relevance ??
                  `Explains a stated part of this challenge’s ${challenge.meta.category.toLowerCase()} mechanism.`}
              </p>
              <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
                Main variable: {humanize(model.split("_").slice(-1)[0])}
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ClaimPanel({
  conditions,
  claims,
  onChange,
}: {
  conditions: string[];
  claims: Record<string, boolean>;
  onChange: (condition: string, checked: boolean) => void;
}) {
  if (!conditions.length) return null;
  return (
    <Card className="p-4">
      <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
        INTERPRETATION
      </p>
      <h2 className="mt-1 text-lg font-bold">
        State the required economic interpretation
      </h2>
      <div className="mt-3 space-y-2">
        {conditions.map((condition) => (
          <label
            key={condition}
            className="flex gap-3 rounded-lg border border-[var(--line)] p-3 text-xs leading-5 text-[var(--ink-muted)]"
          >
            <input
              className="mt-0.5 accent-[var(--accent)]"
              type="checkbox"
              checked={Boolean(claims[condition])}
              onChange={(event) => onChange(condition, event.target.checked)}
            />
            <span>{conditionLabel(condition)}</span>
          </label>
        ))}
      </div>
    </Card>
  );
}

function PolicyDecision({
  challenge,
  values,
  onChange,
  onReset,
}: {
  challenge: EconBenchChallenge;
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  onReset: (key: string) => void;
}) {
  const tradeoffs: Record<string, string> = {
    policy_rate_change_pp:
      "Higher rates reduce demand pressure but may weaken output and employment.",
    reserve_release_pct:
      "Reserve use can limit exchange-rate pressure but reduces future crisis protection.",
    targeted_voucher_pct:
      "Targeted support limits poverty effects but adds fiscal demand.",
  };
  return (
    <Card className="p-4">
      <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
        POLICY DECISION
      </p>
      <h2 className="mt-1 text-lg font-bold">Policy Package</h2>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
        Adjust only authorised instruments. The charts use disclosed
        browser-based teaching rules.
      </p>
      <div className="mt-4 space-y-4">
        {Object.entries(challenge.adjustable).map(
          ([key, [minimum, maximum]]) => (
            <PolicyControl
              key={key}
              label={humanize(key)}
              value={values[key]}
              minimum={minimum}
              maximum={maximum}
              onChange={(value) => onChange(key, value)}
              onReset={() => onReset(key)}
              tradeoff={
                tradeoffs[key] ??
                "This instrument has an explicit policy trade-off in the challenge design."
              }
            />
          ),
        )}
      </div>
    </Card>
  );
}
function PolicyControl({
  label,
  value,
  minimum,
  maximum,
  onChange,
  onReset,
  tradeoff,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
  onReset: () => void;
  tradeoff: string;
}) {
  const step = maximum - minimum <= 10 ? 0.1 : 1;
  const commit = (next: number) =>
    onChange(
      Math.min(
        maximum,
        Math.max(minimum, Number.isFinite(next) ? next : value),
      ),
    );
  return (
    <div className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold">{label}</p>
          <p className="mt-1 text-[10px] leading-4 text-[var(--ink-muted)]">
            {tradeoff}
          </p>
        </div>
        <div className="flex items-center rounded-md border border-[var(--accent)] bg-[var(--accent-soft)]">
          <input
            aria-label={`${label} value`}
            type="number"
            min={minimum}
            max={maximum}
            step={step}
            value={value}
            onChange={(event) => commit(Number(event.target.value))}
            className="h-8 w-16 bg-transparent px-1 text-right text-xs font-bold text-[var(--ink)] outline-none"
          />
          <button
            className="no-print grid size-7 place-items-center text-[var(--accent)]"
            aria-label={`Reset ${label}`}
            onClick={onReset}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="w-8 text-[9px] text-[var(--ink-faint)]">
          {minimum}
        </span>
        <input
          aria-label={`${label} slider`}
          className="min-w-0 flex-1"
          type="range"
          min={minimum}
          max={maximum}
          step={step}
          value={value}
          onChange={(event) => commit(Number(event.target.value))}
        />
        <span className="w-8 text-right text-[9px] text-[var(--ink-faint)]">
          {maximum}
        </span>
      </div>
    </div>
  );
}

function PolicyPackageSummary({
  challenge,
  values,
}: {
  challenge: EconBenchChallenge;
  values: Record<string, number>;
}) {
  const oil = challenge.challenge_id === "EB-01-OIL-SHOCK";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Gauge size={15} className="text-[var(--accent)]" />
        <h2 className="text-sm font-bold">Current package</h2>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-[var(--ink-muted)]">
        {Object.entries(values).map(([key, value]) => (
          <li key={key}>
            <strong className="text-[var(--ink)]">{humanize(key)}:</strong>{" "}
            {displayNumber(value)}
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-[var(--line)] pt-3 text-[10px] leading-5 text-[var(--ink-muted)]">
        <p className="font-bold text-[var(--ink)]">Estimated trade-offs</p>
        <p>
          {oil
            ? `Inflation pressure: ${values.policy_rate_change_pp >= 0 ? "lower" : "higher"} · poverty protection: ${values.targeted_voucher_pct >= 10 ? "stronger" : "limited"} · reserve position: ${values.reserve_release_pct > 0 ? "weaker" : "preserved"}`
            : "The live outcomes panel translates the disclosed policy range into a working estimate. Official grading remains binary and separate."}
        </p>
      </div>
    </Card>
  );
}

function ChallengeValidation({
  issues,
  ready,
}: {
  issues: string[];
  ready: boolean;
}) {
  return (
    <Card
      className={`p-4 ${ready ? "border-[var(--accent)]" : "border-[var(--amber)]"}`}
    >
      <div className="flex items-center gap-2">
        {ready ? (
          <CheckCircle2 size={16} className="text-[var(--accent)]" />
        ) : (
          <CircleAlert size={16} className="text-[var(--amber)]" />
        )}
        <h2 className="text-sm font-bold">
          {ready ? "Ready to test" : "Incomplete configuration"}
        </h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
        {ready
          ? "Required models, controls and interpretation are complete. Testing is still not a final grade."
          : (issues[0] ?? "Finish the required configuration.")}
      </p>
    </Card>
  );
}

function SubmissionActions({
  ready,
  tested,
  result,
  onTest,
  onSubmit,
}: {
  ready: boolean;
  tested: boolean;
  result: Result | null;
  onTest: () => void;
  onSubmit: () => void;
}) {
  if (result)
    return (
      <Card className="no-print p-4">
        <p className="text-xs text-[var(--ink-muted)]">
          The current response has been submitted. Review the result below or
          revise the response.
        </p>
      </Card>
    );
  return (
    <Card className="no-print sticky bottom-3 z-20 border-[var(--line-strong)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
      <p className="mb-3 text-[10px] text-[var(--ink-muted)]">
        {tested
          ? "Policy test updated the charts; it did not grade the challenge."
          : "Test policy before final submission."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onTest}>
          <TimerReset size={14} />
          Test Policy
        </Button>
        <Button disabled={!ready} onClick={onSubmit}>
          <Send size={14} />
          Submit Final Response
        </Button>
      </div>
    </Card>
  );
}

function ChallengeResult({
  challenge,
  values,
  selectedModels,
  outcomes,
  result,
  onRetry,
}: {
  challenge: EconBenchChallenge;
  values: Record<string, number>;
  selectedModels: string[];
  outcomes: OutcomePreview[];
  result: Result;
  onRetry: () => void;
}) {
  const summary = {
    challengeId: challenge.challenge_id,
    scenarioVersion: "0.1.0",
    calculationEngine: "econbench-browser-preview-1.0",
    initialState: challenge.initial_state,
    selectedModels,
    finalIntervention: values,
    calculatedOutcomes: outcomes,
    binaryResult: result.correct ? "Correct" : "Incorrect",
    submittedAt: result.submittedAt,
  };
  const copy = () =>
    void navigator.clipboard?.writeText(JSON.stringify(summary, null, 2));
  return (
    <section className="mt-6 space-y-5">
      <Card
        className={`border-2 p-5 ${result.correct ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--red)] bg-[var(--red-soft)]"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[.12em]">
              SUBMISSION RESULT
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold">
              {result.correct ? (
                <CheckCircle2 className="text-[var(--accent)]" />
              ) : (
                <AlertTriangle className="text-[var(--red)]" />
              )}
              {result.correct ? "Correct" : "Incorrect"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6">
              {result.correct
                ? "Your model selection and intervention package satisfy the challenge’s accepted conditions."
                : "Your current response does not satisfy all required model and outcome conditions."}
            </p>
          </div>
          <div className="no-print flex gap-2">
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Revise Response
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.print()}
            >
              <Printer size={13} />
              Print Review
            </Button>
          </div>
        </div>
        {!result.correct && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {result.failed.map((condition) => (
              <p
                key={condition}
                className="rounded-md bg-[var(--surface)] p-3 text-xs text-[var(--ink-muted)]"
              >
                <CircleAlert
                  className="mr-2 inline text-[var(--red)]"
                  size={13}
                />
                Review{" "}
                {condition.startsWith("select")
                  ? "the required model mechanism"
                  : condition.includes("reserve")
                    ? "reserve management"
                    : "the policy range or interpretation"}
                .
              </p>
            ))}
          </div>
        )}
      </Card>
      {result.correct && <MechanismExplanation challenge={challenge} />}
      <Card className="econbench-answer-summary p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
              REPRODUCIBLE ANSWER SUMMARY
            </p>
            <h2 className="mt-1 text-lg font-bold">
              Versioned submission record
            </h2>
          </div>
          <div className="no-print flex gap-2">
            <Button size="sm" variant="secondary" onClick={copy}>
              <Copy size={13} />
              Copy Summary
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.print()}
            >
              <Printer size={13} />
              Print Review
            </Button>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <Summary
            label="Challenge version"
            value={`${challenge.challenge_id} · 0.1.0`}
          />
          <Summary
            label="Selected models"
            value={selectedModels.map(humanize).join(" · ") || "None"}
          />
          <Summary
            label="Final policy package"
            value={Object.entries(values)
              .map(([key, value]) => `${humanize(key)} ${displayNumber(value)}`)
              .join(" · ")}
          />
          <Summary
            label="Calculated outcomes"
            value={outcomes
              .map(
                (outcome) =>
                  `${outcome.label} ${displayValue(outcome.value, outcome.unit)}`,
              )
              .join(" · ")}
          />
          <Summary
            label="Binary result"
            value={result.correct ? "Correct" : "Incorrect"}
          />
          <Summary
            label="Submission time"
            value={new Date(result.submittedAt).toLocaleString()}
          />
        </dl>
      </Card>
    </section>
  );
}
function MechanismExplanation({
  challenge,
}: {
  challenge: EconBenchChallenge;
}) {
  return (
    <Card className="p-5">
      <p className="text-[10px] font-bold tracking-[.12em] text-[var(--accent)]">
        EXPLANATION
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ExplanationBlock
          icon={<MapPin size={15} />}
          title="What happened"
          text={challenge.meta.situation}
        />
        <ExplanationBlock
          icon={<Target size={15} />}
          title="Model mechanism"
          text={challenge.model_chain}
        />
        <ExplanationBlock
          icon={<Lightbulb size={15} />}
          title="Why a mixed policy is useful"
          text={challenge.explanation}
        />
        <ExplanationBlock
          icon={<LockKeyhole size={15} />}
          title="Main trade-off"
          text="A policy that improves one objective can pressure another: protect the stated hard constraints while designing the response."
        />
      </div>
    </Card>
  );
}
function ExplanationBlock({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--surface-subtle)] p-3">
      <p className="flex items-center gap-2 text-xs font-bold">
        {icon}
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{text}</p>
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-subtle)] p-3">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-xs leading-5">{value}</dd>
    </div>
  );
}
